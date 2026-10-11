import { mkdir, writeFile } from "node:fs/promises";
import { sarvamProviders } from "../lib/voice/providers";
import { streamChat } from "../lib/voice/stream-chat";
import type { VoiceConfig } from "../lib/voice/protocol";

const report: Record<string, unknown> = { at: new Date().toISOString(), physicalMicrophoneTested: false, physicalPlaybackTested: false, stages: {} };
const stages = report.stages as Record<string, unknown>;
const pcm: Buffer[] = [];
async function check(name: string, task: (signal: AbortSignal) => Promise<unknown>) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 45_000);
  const start = performance.now();
  try { const result = await task(controller.signal); stages[name] = { ok: true, elapsedMs: performance.now() - start, result }; console.log(`${name}: passed`); }
  catch (error) { stages[name] = { ok: false, error: error instanceof Error ? error.message : "Failed" }; console.log(`${name}: failed (see report)`); process.exitCode = 1; }
  finally { controller.abort(); clearTimeout(timeout); }
}
await check("tts", async signal => {
  const tts = await sarvamProviders.tts("en-IN", signal);
  let first: number | undefined; const start = performance.now();
  try {
    await tts.speak("Please explain the main benefits of this insurance plan.", data => { first ??= performance.now() - start; pcm.push(Buffer.from(data, "base64")); });
    if (!pcm.length) throw new Error("No audio returned");
    let secondBytes = 0;
    await tts.speak("Include the important conditions.", data => { secondBytes += Buffer.from(data, "base64").length; });
    if (!secondBytes) throw new Error("Second flush returned no audio");
    return { firstChunkMs: first, bytes: pcm.reduce((sum, b) => sum + b.length, 0), secondSegmentBytes: secondBytes, format: "linear16", sampleRate: 24000 };
  } finally { tts.close(); }
});
await check("stt", async signal => {
  if (!pcm.length) throw new Error("TTS fixture unavailable");
  let partials = 0; let finalLength = 0;
  let resolve!: () => void; let reject!: (e: Error) => void;
  const done = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
  // Attach immediately, including while paced input is still being transmitted.
  void done.catch(() => {});
  signal.addEventListener("abort", () => reject(new Error("STT timeout")), { once: true });
  const stt = await sarvamProviders.stt(event => {
    if (event.event === "transcript.partial") partials++;
    if (event.event === "transcript.final" && event.text?.trim()) { finalLength = event.text.length; resolve(); }
  }, () => reject(new Error("STT connection failed")), signal);
  try {
    const input = Buffer.concat(pcm); const output = Buffer.alloc(Math.floor(input.length / 2 * 2 / 3) * 2);
    for (let i = 0; i < output.length / 2; i++) {
      const position = i * 1.5, at = Math.floor(position);
      const a = input.readInt16LE(at * 2), b = input.readInt16LE(Math.min(at + 1, input.length / 2 - 1) * 2);
      output.writeInt16LE(Math.round(a + (b-a) * (position-at)), i * 2);
    }
    const withSilence = Buffer.concat([output, Buffer.alloc(32000)]);
    for (let i = 0; i < withSilence.length; i += 1280) {
      signal.throwIfAborted(); stt.send(withSilence.subarray(i, i + 1280));
      await new Promise(r => setTimeout(r, 40));
    }
    await done; return { partials, finalCharacters: finalLength };
  } finally { stt.close(); }
});
for (const language of ["en-IN", "hi-IN"] as const) await check(`chat.${language}`, async signal => {
  const config: VoiceConfig = { planId: "digi-term", language, answerStyle: "normal", history: [], priority: "", voice: true, validation: "segments" };
  let segments = 0; let first: number | undefined; const start = performance.now(); const events: string[] = [];
  for await (const segment of streamChat(config, "What is term insurance?", signal, name => events.push(name))) { first ??= performance.now() - start; if (!segment.text) throw new Error("Empty segment"); segments++; }
  if (!segments) throw new Error("No accepted segments");
  return { segments, firstSegmentMs: first, events, trueSegmentStream: !events.includes("validation.whole_answer_fallback") };
});
await mkdir(".local", { recursive: true });
await writeFile(".local/streaming-capabilities.json", JSON.stringify(report, null, 2));
console.log("Capability report: .local/streaming-capabilities.json (no credentials, transcripts or audio)");
