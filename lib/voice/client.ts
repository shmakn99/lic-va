import { BrowserAudio, type AudioEvent } from "./browser-audio";
import { limits, type ClientEvent, type ServerEvent, type VoiceConfig } from "./protocol";
import { VoiceMeasurements } from "./metrics";

export type LiveState = "off" | "connecting" | "listening" | "thinking" | "speaking" | "reconnecting";
export class VoiceClient {
  private socket?: WebSocket;
  private audio: BrowserAudio;
  private stopped = false;
  private sessionId?: string;
  private responseId?: string;
  private sequence = 0;
  private lastSpeechEnd?: number;
  private responseEndOfSpeech?: number;
  private responseStarted?: number;
  private first = new Set<string>();
  private interruption = new Map<string, { at: number; detectedAt: number; responseId: string; reason: string }>();
  private reconnects = 0;
  private connection = 0;
  private heartbeat?: ReturnType<typeof setInterval>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private setupTimer?: ReturnType<typeof setTimeout>;
  private listeningSince?: number;
  private callbacks = new Set<ReturnType<typeof setTimeout>>();
  private request?: AbortController;
  private lastPong = 0;
  private userSpeaking = false;
  constructor(private config: () => VoiceConfig, private event: (event: ServerEvent) => void, private state: (value: LiveState) => void, readonly measurements: VoiceMeasurements) {
    this.audio = new BrowserAudio((event, outputAt) => this.onAudio(event, outputAt));
  }
  async start() {
    this.state("connecting");
    try { await this.audio.open(); if (!this.stopped) await this.connect(); }
    catch { if (this.stopped) return; this.event({ type: "error", fatal: true, message: "Could not start live conversation. Check microphone permission and the voice service, or use recording / typing." }); this.stop(); }
  }
  private async connect() {
    const connection = ++this.connection;
    this.listeningSince = undefined;
    this.request = new AbortController();
    const response = await fetch("/api/voice/session", { method: "POST", signal: AbortSignal.any([this.request.signal, AbortSignal.timeout(10_000)]) });
    if (!response.ok) {
      this.measurements.record("connection.ticket_http_status", response.status);
      throw new Error("Live conversation unavailable");
    }
    const data = await response.json();
    if (this.stopped || connection !== this.connection) return;
    const ws = new WebSocket(data.url); this.socket = ws;
    let authenticating = false;
    // An open socket is not yet a usable voice session. Bound authentication
    // and provider setup too, including a server that opens but never replies.
    this.setupTimer = setTimeout(() => {
      if (this.stopped || connection !== this.connection) return;
      this.measurements.record("connection.setup_timeout"); ws.close();
    }, 20_000);
    ws.onopen = () => {
      if (this.stopped || connection !== this.connection) { ws.close(); return; }
      if (data.authentication !== "challenge") this.send({ type: "authenticate", ticket: data.ticket });
    };
    ws.onmessage = ({ data }) => {
      if (this.stopped || connection !== this.connection) return;
      try {
        const event: ServerEvent = JSON.parse(data);
        if (event.type === "challenge") {
          if (authenticating) throw new Error("Repeated authentication challenge");
          authenticating = true;
          void this.authenticate(event.challenge, ws, connection).catch(() => {
            if (this.stopped || connection !== this.connection) return;
            this.event({ type: "error", fatal: true, message: "Live conversation authentication failed. Please restart live conversation." }); this.stop();
          });
        } else this.onEvent(event);
      }
      catch { this.event({ type: "error", fatal: true, message: "The live audio connection failed. Use recording or typing." }); this.stop(); }
    };
    ws.onclose = ({ code }) => {
      if (this.stopped || connection !== this.connection) return;
      clearTimeout(this.setupTimer);
      this.audio.capture(false); this.interrupt("disconnect"); this.lastSpeechEnd = undefined; this.userSpeaking = false;
      clearInterval(this.heartbeat); this.measurements.record("connection.disconnected", undefined, undefined, this.sessionId);
      this.measurements.record("connection.close_code", code, undefined, this.sessionId);
      if (code === 1008) {
        this.event({ type: "error", fatal: true, message: "The voice service rejected this session. Restart the app and start a new live conversation." }); this.stop(); return;
      }
      if (this.reconnects++ >= 3) {
        this.event({ type: "error", fatal: true, message: "Live conversation disconnected. Use recording or typing, or start live conversation again." }); this.stop(); return;
      }
      this.state("reconnecting");
      this.retryTimer = setTimeout(() => { void this.connect().catch(() => { if (this.stopped) return; this.event({ type: "error", fatal: true, message: "Reconnection failed. Please restart live conversation." }); this.stop(); }); }, Math.min(4000, 500 * 2 ** this.reconnects) + Math.random() * 200);
    };
  }
  private async authenticate(challenge: string, ws: WebSocket, connection: number) {
    const response = await fetch("/api/voice/session", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challenge }),
      signal: AbortSignal.any([this.request!.signal, AbortSignal.timeout(10_000)]),
    });
    if (!response.ok) { this.measurements.record("connection.ticket_http_status", response.status); throw new Error("Ticket rejected"); }
    const data = await response.json();
    if (this.stopped || connection !== this.connection || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "authenticate", ticket: data.ticket }));
  }
  private onEvent(event: ServerEvent) {
    if (event.type === "ready") {
      this.sessionId = event.sessionId; this.lastPong = performance.now();
      this.send({ type: "configure", config: this.config() });
      clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => {
        if (performance.now() - this.lastPong > 30_000) this.socket?.close();
        else {
          // Budget consecutive failures, not every disconnect over a whole call.
          // Do not reset on 'ready': a provider setup failure can follow it.
          if (this.listeningSince !== undefined && performance.now() - this.listeningSince >= 30_000) this.reconnects = 0;
          this.send({ type: "ping" });
        }
      }, 10_000);
    } else if (event.type === "pong") this.lastPong = performance.now();
    else if (event.type === "listening") {
      clearTimeout(this.setupTimer); this.listeningSince = performance.now();
      this.measurements.record("connection.listening", undefined, undefined, this.sessionId);
      this.audio.capture(true); this.state("listening");
    }
    else if (event.type === "speech.start") { this.interrupt("provider_speech"); this.state("listening"); }
    else if (event.type === "speech.end") {
      // Local energy endpoint excludes the provider's silence wait. Keep both
      // measurements labeled; never mix them into the same distribution.
      this.measurements.record("turn.provider_endpoint", undefined, undefined, this.sessionId);
    } else if (event.type === "response.start") {
      this.responseId = event.responseId; this.sequence = 0;
      this.responseEndOfSpeech = this.lastSpeechEnd;
      this.responseStarted = performance.now();
      this.audio.reset(event.responseId); this.state("thinking");
      if (this.userSpeaking) { this.event(event); this.interrupt("local_speech"); return; }
    } else if ("responseId" in event && event.responseId && event.responseId !== this.responseId) {
      if (event.type === "metric") this.measurements.record(event.name, event.value, event.responseId, this.sessionId);
      else this.measurements.record("correctness.stale_event_prevented", undefined, event.responseId, this.sessionId);
      return;
    } else if (event.type === "audio") {
      if (event.sequence !== this.sequence++ || event.sampleRate !== 24000) throw new Error("Audio sequence or format mismatch");
      this.audio.audio(event.responseId, event.segment, event.audio);
    } else if (event.type === "segment.audio.end") this.audio.segmentEnd(event.responseId, event.segment);
    else if (event.type === "response.end") { this.audio.end(event.responseId); if (!this.config().voice) { this.responseId = undefined; this.state("listening"); } }
    else if (event.type === "interrupted") this.interrupt("server");
    else if (event.type === "metric") this.measurements.record(event.name, event.value, event.responseId, this.sessionId);
    else if (event.type === "error" && event.fatal) { this.event(event); this.stop(); return; }
    this.event(event);
  }
  private onAudio(event: AudioEvent, outputAt: number) {
    if (this.stopped) return;
    if (event.type === "input" && event.buffer) {
      if (this.socket?.readyState === WebSocket.OPEN) {
        if (this.socket.bufferedAmount > limits.socketBytes) { this.measurements.record("audio.input_congestion"); this.socket.close(); return; }
        this.socket.send(event.buffer);
      }
    } else if (event.type === "speech.start") { this.userSpeaking = true; this.lastSpeechEnd = undefined; this.interrupt("local_speech", event.captureAt); }
    else if (event.type === "speech.end") { this.userSpeaking = false; this.lastSpeechEnd = event.captureAt ?? performance.now() - 200; }
    else if (event.type === "cleared" && event.requestId) {
      const interruption = this.interruption.get(event.requestId);
      if (interruption) {
        if (event.hadAudio) {
          this.measurements.record(interruption.reason === "local_speech" ? "interruption_to_output_stop_estimate_ms" : "interrupt_event_to_output_stop_estimate_ms", Math.max(0, outputAt - interruption.at), interruption.responseId, this.sessionId);
          this.measurements.record("interrupt_detection_to_output_stop_estimate_ms", Math.max(0, outputAt - interruption.detectedAt), interruption.responseId, this.sessionId);
        }
        else this.measurements.record("interruption.before_audio", undefined, interruption.responseId, this.sessionId);
        this.interruption.delete(event.requestId);
      }
    } else if (event.type === "overflow") {
      this.measurements.record("audio.playback_overflow"); this.interrupt("overflow");
      this.event({ type: "error", fatal: false, message: "Audio could not keep up. Read the answer or use Listen to retry." });
    } else if (event.responseId === this.responseId) {
      if (event.type === "first" && !this.first.has(event.responseId!)) {
        this.first.add(event.responseId!); this.state("speaking");
        if (this.responseEndOfSpeech !== undefined) this.measurements.record("first_audible_response_estimate_ms", Math.max(0, outputAt - this.responseEndOfSpeech), event.responseId, this.sessionId);
        else this.measurements.record("audio.first_output_without_local_endpoint", undefined, event.responseId, this.sessionId);
        if (this.responseStarted !== undefined) this.measurements.record("response_start_to_audio_estimate_ms", Math.max(0, outputAt - this.responseStarted), event.responseId, this.sessionId);
        this.measurements.record("audio.first_output", undefined, event.responseId, this.sessionId);
      } else if (event.type === "played" || event.type === "ended") {
        const id = this.responseId;
        const timer = setTimeout(() => {
          this.callbacks.delete(timer);
          if (this.stopped || this.responseId !== id) return;
          if (event.type === "played") { this.send({ type: "played", responseId: id!, segment: event.segment! }); this.event({ type: "metric", name: "playback.segment", value: event.segment, responseId: id }); }
          else { this.responseId = undefined; this.state("listening"); this.measurements.record("playback.complete", undefined, id, this.sessionId); }
        }, Math.max(0, outputAt - performance.now()));
        this.callbacks.add(timer);
      } else if (event.type === "underrun") this.measurements.record("audio.underrun", undefined, event.responseId, this.sessionId);
    }
  }
  send(event: ClientEvent) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(event)); }
  text(text: string) { if (!text.trim()) return; this.lastSpeechEnd = undefined; this.interrupt("typed_turn"); this.send({ type: "text", id: crypto.randomUUID(), text }); }
  finish() { this.send({ type: "finish" }); }
  interrupt(reason = "manual", onset?: number) {
    const id = this.responseId;
    if (!id) return;
    this.responseId = undefined;
    const requestId = crypto.randomUUID();
    this.interruption.set(requestId, { at: onset ?? performance.now(), detectedAt: performance.now(), responseId: id, reason });
    this.audio.reset(undefined, requestId); this.send({ type: "interrupt", responseId: id });
    this.measurements.record(`interruption.${reason}`, undefined, id, this.sessionId);
    this.event({ type: "interrupted", responseId: id }); this.state("listening");
  }
  stop() {
    if (this.stopped) return;
    this.interrupt("session_stop"); this.stopped = true; this.connection++;
    this.request?.abort(); this.send({ type: "stop" }); this.socket?.close(); this.audio.close();
    clearInterval(this.heartbeat); clearTimeout(this.retryTimer); clearTimeout(this.setupTimer);
    for (const timer of this.callbacks) clearTimeout(timer);
    this.callbacks.clear(); this.state("off");
  }
}
