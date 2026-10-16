import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { POST } from "../app/api/speak/route";
import { settings } from "../lib/sarvam";
import { sarvamProviders } from "../lib/voice/providers";

// Opt-in real provider calls. Only synthetic text/audio is used or saved.
const { tts: model, voice } = settings();
const results: object[] = [];
await mkdir(".local", { recursive: true });
for (const language of ["en-IN", "hi-IN"] as const) {
  const text = language === "en-IN"
    ? "Hello, please explain this insurance plan. What are its benefits and conditions?"
    : "नमस्ते, मुझे इस बीमा योजना के बारे में बताइए। इसके लाभ और शर्तें क्या हैं?";
  const start = performance.now();
  const response = await POST(new Request("http://localhost/api/speak", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  }));
  assert.equal(response.status, 200, `REST ${language} failed (HTTP ${response.status})`);
  const result = await response.json() as { audios: string[]; mimeType: string };
  assert.equal(result.mimeType, "audio/wav");
  for (const [index, encoded] of result.audios.entries()) {
    const wav = Buffer.from(encoded, "base64");
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.toString("ascii", 8, 12), "WAVE");
    // Walk RIFF chunks rather than assuming a fixed 44-byte header.
    let format = false, data = false;
    for (let offset = 12; offset + 8 <= wav.length;) {
      const id = wav.toString("ascii", offset, offset + 4);
      const size = wav.readUInt32LE(offset + 4);
      if (id === "fmt ") {
        assert.equal(wav.readUInt16LE(offset + 8), 1, "Expected PCM WAV");
        assert.equal(wav.readUInt32LE(offset + 12), 24000);
        format = true;
      }
      if (id === "data") { assert.ok(size > 0 && offset + 8 + size <= wav.length); data = true; }
      offset += 8 + size + (size % 2);
    }
    assert.ok(format && data, "Missing WAV format/audio chunks");
    await writeFile(`.local/tts-${language}-${index}.wav`, wav);
  }
  results.push({ language, transport: "REST", elapsedMs: Math.round(performance.now() - start), audios: result.audios.length });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const tts = await sarvamProviders.tts(language, controller.signal);
    try {
      for (let segment = 0; segment < 2; segment++) {
        const chunks: Buffer[] = [];
        const started = performance.now();
        let firstChunkMs: number | undefined;
        await tts.speak(text, encoded => {
          firstChunkMs ??= Math.round(performance.now() - started);
          chunks.push(Buffer.from(encoded, "base64"));
        });
        const pcm = Buffer.concat(chunks);
        assert.ok(pcm.length > 0 && pcm.length % 2 === 0, "Expected PCM16 samples");
        assert.notEqual(pcm.toString("ascii", 0, 4), "RIFF", "Streaming player expects raw PCM");
        let peak = 0;
        for (let offset = 0; offset < pcm.length; offset += 2) peak = Math.max(peak, Math.abs(pcm.readInt16LE(offset)));
        assert.ok(peak > 100, "Audio is silent");
        results.push({ language, transport: "WebSocket", segment, firstChunkMs, elapsedMs: Math.round(performance.now() - started), bytes: pcm.length, peak });
      }
    } finally { tts.close(); }
  } finally { clearTimeout(timeout); controller.abort(); }
}
const report = { at: new Date().toISOString(), model, voice, sampleRate: 24000, physicalAudibilityVerified: false, results };
await writeFile(".local/tts-capabilities.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("TTS PASS: turn-based REST WAV and live WebSocket PCM, English/Hindi, repeated flushes.");
