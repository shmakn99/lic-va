import WebSocket from "ws";
import { settings } from "../sarvam";
import type { Language } from "../plans";
import { limits } from "./protocol";
import { providerConnectionError } from "./provider-error";

export type SttEvent = { event: string; text?: string; code?: string; is_fatal?: boolean };
export interface SttConnection { send(audio: Buffer): void; close(): void }
export interface TtsConnection { speak(text: string, audio: (data: string) => void): Promise<void>; close(): void }
export interface VoiceProviders {
  stt(event: (event: SttEvent) => void, failure: () => void, signal: AbortSignal): Promise<SttConnection>;
  tts(language: Language, signal: AbortSignal): Promise<TtsConnection>;
}
function connect(path: string, signal: AbortSignal): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const ws = new WebSocket(`wss://api.sarvam.ai${path}`, { headers: { "api-subscription-key": process.env.SARVAM_API_KEY || "" }, handshakeTimeout: 10_000, maxPayload: 2_000_000 });
    const cancel = () => ws.terminate();
    signal.addEventListener("abort", cancel, { once: true });
    ws.once("close", () => signal.removeEventListener("abort", cancel));
    ws.once("error", error => reject(providerConnectionError(error)));
    ws.once("unexpected-response", (_request, response) => {
      reject(providerConnectionError(undefined, response.statusCode));
      response.resume(); ws.terminate();
    });
    ws.once("close", () => reject(providerConnectionError()));
    ws.once("open", () => resolve(ws));
  });
}
export const sarvamProviders: VoiceProviders = {
  async stt(event, failure, signal) {
    const query = new URLSearchParams({ model: settings().stt, language_code: "auto", mode: "transcribe", stream_type: "fast", encoding: "linear16", sample_rate: "16000", endpointing: "vad", silence_duration_ms: process.env.VOICE_SILENCE_MS || "600", min_speech_duration_ms: "250" });
    const ws = await connect(`/speech-to-text-realtime/ws?${query}`, signal);
    let closed = false;
    ws.on("message", data => {
      try { const parsed = JSON.parse(data.toString()); if (parsed.event === "error") failure(); else event(parsed); }
      catch { failure(); }
    });
    ws.on("error", () => { if (!closed) failure(); });
    ws.on("close", () => { if (!closed) failure(); });
    const heartbeat = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: "ping" })); }, 15_000);
    ws.once("close", () => clearInterval(heartbeat));
    return {
      send(audio) {
        if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > limits.socketBytes) throw new Error("Transcription connection is congested");
        ws.send(JSON.stringify({ event: "audio_input", audio: audio.toString("base64") }));
      },
      close() { closed = true; clearInterval(heartbeat); ws.close(); },
    };
  },
  async tts(language, signal) {
    const ws = await connect(`/text-to-speech/ws?model=${encodeURIComponent(settings().tts)}&send_completion_event=true`, signal);
    let pending: { resolve: () => void; reject: (e: Error) => void; audio: (data: string) => void; timer: ReturnType<typeof setTimeout> } | undefined;
    const fail = () => { if (pending) { clearTimeout(pending.timer); pending.reject(new Error("Speech generation failed. You can read or replay the answer.")); pending = undefined; } };
    ws.on("error", fail); ws.on("close", fail);
    ws.on("message", raw => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === "error") { fail(); return; }
        if (message.type === "audio" && pending && typeof message.data?.audio === "string") pending.audio(message.data.audio);
        if (message.type === "event" && message.data?.event_type === "final" && pending) {
          clearTimeout(pending.timer); pending.resolve(); pending = undefined;
        }
      } catch { fail(); }
    });
    ws.send(JSON.stringify({ type: "config", data: { language_code: language, speaker: settings().voice, pace: 1, speech_sample_rate: 24000, output_audio_codec: "linear16", min_buffer_size: 30, max_chunk_length: 200 } }));
    return {
      speak(text, audio) {
        signal.throwIfAborted();
        if (pending || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("Speech connection unavailable"));
        return new Promise<void>((resolve, reject) => {
          pending = { resolve, reject, audio, timer: setTimeout(fail, 20_000) };
          ws.send(JSON.stringify({ type: "text", data: { text } }));
          ws.send(JSON.stringify({ type: "flush" }));
        });
      },
      close() { fail(); ws.close(); },
    };
  },
};
