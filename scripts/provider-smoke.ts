import { writeFile, mkdir } from "node:fs/promises";
import { sarvam, settings } from "../lib/sarvam";
const config = settings();
console.log("Testing configured Sarvam models", config);
const chat = (await sarvam(
  "/v1/chat/completions",
  {
    model: config.chat,
    messages: [
      {
        role: "user",
        content: "Reply only with: Hello, the connection is working.",
      },
    ],
    max_tokens: 100,
    reasoning_effort: null,
  },
  AbortSignal.timeout(30000),
)) as { choices: { message: { content: string } }[] };
if (!chat.choices?.[0]?.message?.content)
  throw new Error("Chat returned no content");
console.log("Chat PASS");
for (const language of ["en-IN", "hi-IN"] as const) {
  const text =
    language === "hi-IN"
      ? "नमस्ते, मुझे इस बीमा योजना के बारे में बताइए।"
      : "Hello, please explain this insurance plan.";
  const tts = (await sarvam(
    "/text-to-speech",
    {
      text,
      language_code: language,
      model: config.tts,
      speaker: config.voice,
      speech_sample_rate: 24000,
      output_audio_codec: "wav",
    },
    AbortSignal.timeout(15000),
  )) as { audios: string[] };
  if (!tts.audios?.[0]) throw new Error("TTS returned no audio");
  const audio = Buffer.from(tts.audios[0], "base64");
  await mkdir(".local", { recursive: true });
  await writeFile(`.local/smoke-${language}.wav`, audio);
  console.log(`TTS ${language} PASS (${audio.length} bytes)`);
  const form = new FormData();
  form.set("file", new Blob([audio], { type: "audio/wav" }), "smoke.wav");
  form.set("model", config.stt);
  form.set("mode", "transcribe");
  form.set("language_code", "unknown");
  const stt = (await sarvam(
    "/speech-to-text",
    form,
    AbortSignal.timeout(30000),
  )) as { transcript: string };
  if (!stt.transcript?.trim())
    throw new Error("STT returned an empty transcript");
  console.log(`STT ${language} PASS:`, stt.transcript);
}
console.log(
  "Provider smoke PASS. This uses synthetic speech; real microphone/playback still requires a device rehearsal.",
);
