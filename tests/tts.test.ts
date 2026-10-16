import test from "node:test";
import assert from "node:assert/strict";
import { settings } from "../lib/sarvam";
import { POST } from "../app/api/speak/route";

test("TTS defaults and explicit rollback send compatible model/voice pairs through the turn-based route", async () => {
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.SARVAM_TTS_MODEL;
    delete process.env.SARVAM_VOICE;
    process.env.SARVAM_API_KEY = "test-only";
    assert.equal(settings().tts, "bulbul:v4-flash");
    assert.equal(settings().voice, "shubh_enhi_ads");
    for (const [model, voice, override] of [
      ["bulbul:v4-flash", "shubh_enhi_ads", ""],
      ["bulbul:v4-flash", "shubh_hi_customer", "shubh_hi_customer"],
      ["bulbul:v3", "shubh", ""],
    ]) {
      process.env.SARVAM_TTS_MODEL = model;
      process.env.SARVAM_VOICE = override;
      for (const language of ["en-IN", "hi-IN"]) {
        globalThis.fetch = async (url, init) => {
          assert.equal(url, "https://api.sarvam.ai/text-to-speech");
          assert.deepEqual(JSON.parse(init!.body as string), {
            text: "Synthetic test", language_code: language, model, speaker: voice,
            speech_sample_rate: 24000, output_audio_codec: "wav", pace: 1,
          });
          return Response.json({ audios: ["test-base64"] });
        };
        const response = await POST(new Request("http://localhost/api/speak", {
          method: "POST", body: JSON.stringify({ text: "Synthetic test", language }),
        }));
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { audios: ["test-base64"], mimeType: "audio/wav" });
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of ["SARVAM_TTS_MODEL", "SARVAM_VOICE", "SARVAM_API_KEY"]) {
      if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name];
    }
  }
});
