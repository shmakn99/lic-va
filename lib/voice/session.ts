import { randomUUID } from "node:crypto";
import { limits, type ClientEvent, type Segment, type ServerEvent, type VoiceConfig } from "./protocol";
import { sarvamProviders, type SttConnection, type SttEvent, type VoiceProviders, type TtsConnection } from "./providers";
import { streamChat } from "./stream-chat";
import { providerConnectionError, VoiceProviderError } from "./provider-error";

type ResponseState = { id: string; turnId: string; question: string; segments: Segment[]; played: number; controller: AbortController; done: boolean; tts?: TtsConnection };
export type ChatStream = typeof streamChat;
export class VoiceSession {
  readonly id = randomUUID();
  private config?: VoiceConfig;
  private stt?: SttConnection;
  private lifecycle = new AbortController();
  private response?: ResponseState;
  private turn?: { id: string; committed: boolean; started: number; ended?: number };
  private seenText = new Set<string>();
  private turns = 0;
  private closed = false;
  private finishingUntil = 0;
  private lastActivity = Date.now();
  private started = Date.now();
  private inputWindow = Date.now();
  private inputBytes = 0;
  private timer: ReturnType<typeof setInterval>;
  constructor(private send: (event: ServerEvent) => void, private terminate: () => void, private providers: VoiceProviders = sarvamProviders, private generate: ChatStream = streamChat) {
    this.timer = setInterval(() => {
      if (Date.now() - this.started > limits.sessionMs || Date.now() - this.lastActivity > limits.idleMs) this.fail("Live conversation expired. Start a new conversation to continue.", true);
      if (this.turn && !this.turn.committed && !this.turn.ended && Date.now() - this.turn.started > limits.utteranceMs) this.finish();
      if (this.finishingUntil > Date.now()) {
        try { this.stt?.send(Buffer.alloc(1280)); }
        catch { this.fail("Transcription connection failed. Please restart live conversation.", true); }
      }
    }, 40);
  }
  metric(name: string, value?: number, responseId?: string) { this.emit({ type: "metric", name, value, responseId }); }
  private emit(event: ServerEvent) { if (!this.closed) this.send(event); }
  private fail(message: string, fatal = false, responseId?: string, scope?: "audio" | "generation") {
    this.emit({ type: "error", message, fatal, responseId, scope });
    if (fatal) { this.close(); this.terminate(); }
  }
  async handle(event: ClientEvent) {
    if (this.closed) return;
    if (event.type === "configure") {
      if (this.config) throw new Error("Session is already configured");
      this.config = process.env.VOICE_VALIDATION_MODE === "whole" ? { ...event.config, validation: "whole" } : event.config;
      try {
        this.stt = await this.providers.stt(e => this.onStt(e), () => this.fail("Transcription disconnected. Restart live conversation or use typing.", true), this.lifecycle.signal);
      } catch (error) {
        if (this.closed) return;
        const failure = error instanceof VoiceProviderError ? error : providerConnectionError(error);
        console.warn(JSON.stringify({ component: "voice", stage: "stt.connect", sessionId: this.id, code: failure.code }));
        this.metric(`connection.${failure.code}`);
        this.fail(failure.message, true);
        return;
      }
      if (this.closed) { this.stt.close(); return; }
      this.emit({ type: "listening" });
    } else if (event.type === "text") {
      if (!this.config) throw new Error("Configure the session first");
      if (this.seenText.has(event.id)) { this.metric("correctness.duplicate_turn_prevented"); return; }
      if (this.seenText.size >= limits.maxTurns) throw new Error("Session turn limit reached");
      this.seenText.add(event.id); this.lastActivity = Date.now();
      this.startResponse(event.id, event.text, false);
    } else if (event.type === "interrupt") {
      if (this.response?.id === event.responseId) this.interrupt();
    } else if (event.type === "played") {
      const r = this.response;
      if (r?.id === event.responseId && event.segment === r.played + 1 && event.segment < r.segments.length) r.played = event.segment;
    } else if (event.type === "finish") this.finish();
    else if (event.type === "ping") this.emit({ type: "pong" });
    else if (event.type === "stop") { this.close(); this.terminate(); }
  }
  audio(bytes: Buffer) {
    if (this.closed || !this.stt) return;
    if (!bytes.length || bytes.length > limits.frameBytes || bytes.length % 2) throw new Error("Invalid audio frame");
    if (Date.now() - this.inputWindow >= 1000) { this.inputWindow = Date.now(); this.inputBytes = 0; }
    this.inputBytes += bytes.length;
    if (this.inputBytes > 64_000) throw new Error("Audio input exceeds real-time rate");
    if (Date.now() < this.finishingUntil) return;
    this.stt.send(bytes);
  }
  private finish() {
    // Sarvam's manual flush command is not valid in VAD endpointing mode.
    // Paced silence finalizes the current utterance on the same STT connection.
    if (!this.turn || this.turn.committed || this.finishingUntil > Date.now()) return;
    this.finishingUntil = Date.now() + Math.max(1200, Number(process.env.VOICE_SILENCE_MS || 600) + 300);
    this.metric("turn.manual_finish");
  }
  private onStt(event: SttEvent) {
    if (this.closed) return;
    if (event.event === "vad.speech_start") {
      this.lastActivity = Date.now();
      this.interrupt();
      this.turn = { id: randomUUID(), committed: false, started: Date.now() };
      this.emit({ type: "speech.start", turnId: this.turn.id });
    } else if (event.event === "vad.speech_end") {
      if (this.turn) { this.turn.ended = Date.now(); this.emit({ type: "speech.end", turnId: this.turn.id }); }
    } else if (event.event === "transcript.partial") {
      if (this.turn && !this.turn.committed) this.emit({ type: "transcript.partial", turnId: this.turn.id, text: (event.text || "").slice(0, 1200) });
    } else if (event.event === "transcript.final") {
      if (!this.turn) this.turn = { id: randomUUID(), committed: false, started: Date.now() };
      if (this.turn.committed) { this.metric("correctness.duplicate_final_prevented"); return; }
      this.turn.committed = true;
      const text = event.text?.trim();
      if (!text) { this.metric("turn.empty"); return; }
      if (text.length > 1200) { this.fail("Please ask a shorter question."); return; }
      this.lastActivity = Date.now();
      if (this.turn.ended) this.metric("stt.final_after_endpoint_ms", Date.now() - this.turn.ended);
      this.startResponse(this.turn.id, text, true);
    }
  }
  private commitHistory(r: ResponseState) {
    if (!this.config) return;
    const heard = r.segments.slice(0, r.played + 1).map(s => s.text).join(" ");
    const complete = r.done && r.played === r.segments.length - 1;
    const assistant = complete ? heard : `${heard}\n[Response interrupted or incomplete; only the preceding complete segments were played. Do not assume the rest was heard.]`;
    this.config.history = [...this.config.history, { user: r.question, assistant: assistant.slice(0, 2400) }].slice(-6);
  }
  interrupt() {
    const r = this.response;
    if (!r) return;
    this.response = undefined;
    this.commitHistory(r);
    r.controller.abort(); r.tts?.close();
    if (!r.done || r.played < r.segments.length - 1) {
      this.metric("turn.interrupted", undefined, r.id);
      this.emit({ type: "interrupted", responseId: r.id });
    }
  }
  private startResponse(turnId: string, question: string, spoken: boolean) {
    if (!this.config) return;
    if (++this.turns > limits.maxTurns) { this.fail("Session turn limit reached. Start a new live conversation.", true); return; }
    this.interrupt();
    const r: ResponseState = { id: randomUUID(), turnId, question, segments: [], played: -1, controller: new AbortController(), done: false };
    this.response = r;
    this.emit({ type: "transcript.final", turnId, text: question, spoken });
    this.emit({ type: "response.start", turnId, responseId: r.id });
    void this.run(r, { ...this.config, history: [...this.config.history] });
  }
  private async run(r: ResponseState, config: VoiceConfig) {
    const started = performance.now();
    const deadline = setTimeout(() => r.controller.abort(new Error("Response timed out")), limits.responseMs);
    let sequence = 0;
    let audioTask = Promise.resolve();
    let audioFailed = false;
    let firstAudio = true;
    const active = () => this.response === r && !r.controller.signal.aborted && !this.closed;
    try {
      for await (const answer of this.generate(config, r.question, r.controller.signal, name => this.metric(name, ["llm.first_token", "validation.accepted"].includes(name) ? performance.now() - started : undefined, r.id))) {
        if (!active()) { this.metric("correctness.stale_segment_prevented"); break; }
        const index = r.segments.length;
        if (index >= limits.maxSegments) throw new Error("Too many segments");
        r.segments.push(answer);
        this.emit({ type: "segment", responseId: r.id, index, answer });
        if (!config.voice) { r.played = index; continue; }
        // At most eight bounded segments can be queued; LLM generation overlaps
        // the serialized TTS stream, retaining exact segment/audio association.
        audioTask = audioTask.then(async () => {
          if (!active() || audioFailed) return;
          r.tts ??= await this.providers.tts(config.language, r.controller.signal);
          if (!active()) { r.tts.close(); return; }
          let bytes = 0;
          await r.tts.speak(answer.text, audio => {
            if (!active()) { this.metric("correctness.stale_audio_prevented"); return; }
            const data = Buffer.from(audio, "base64"); bytes += data.length;
            if (data.length % 2 || bytes > 2_880_000) throw new Error("Invalid or excessive speech audio");
            if (firstAudio) { firstAudio = false; this.metric("tts.first_audio_ms", performance.now() - started, r.id); }
            // Bound client messages independently of provider chunk sizes.
            for (let offset = 0; offset < data.length; offset += 9600) this.emit({ type: "audio", responseId: r.id, segment: index, sequence: sequence++, audio: data.subarray(offset, offset + 9600).toString("base64"), sampleRate: 24000 });
          });
          if (!bytes) throw new Error("Speech provider returned no audio");
          if (active()) this.emit({ type: "segment.audio.end", responseId: r.id, segment: index });
        }).catch(() => {
          audioFailed = true; r.tts?.close();
          if (active()) { this.metric("audio.failure", undefined, r.id); this.fail("Audio was interrupted. The accepted text remains available; use Listen to retry.", false, r.id, "audio"); }
        });
      }
      await audioTask;
      if (active()) { r.done = true; this.emit({ type: "response.end", responseId: r.id }); this.metric("response.generated_ms", performance.now() - started, r.id); }
    } catch {
      if (this.response === r && !this.closed) {
        this.metric("response.failure", undefined, r.id);
        this.fail("The response did not finish. You can read the accepted portion or retry your question.", false, r.id, "generation");
        this.interrupt();
      }
    } finally {
      clearTimeout(deadline); r.tts?.close();
      // Deadline aborts can cause a provider iterator to end without throwing.
      if (this.response === r && !r.done && r.controller.signal.aborted) this.interrupt();
    }
  }
  close() {
    if (this.closed) return;
    this.closed = true; clearInterval(this.timer);
    this.lifecycle.abort(); this.response?.controller.abort(); this.response?.tts?.close(); this.stt?.close();
  }
}
