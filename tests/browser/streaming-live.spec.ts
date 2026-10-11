import { test, expect, chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { sarvamProviders } from "../../lib/voice/providers";

test("live streaming capture → Sarvam STT → validated chat → PCM playback in English and Hindi", async ({}, testInfo) => {
  test.skip(process.env.LIVE_STREAMING_TEST !== "1", "Opt-in: uses real Sarvam services and synthetic microphone speech.");
  test.setTimeout(180000);
  for (const language of ["en-IN", "hi-IN"] as const) {
    const chunks: Buffer[] = [];
    const tts = await sarvamProviders.tts(language, AbortSignal.timeout(30000));
    try { await tts.speak(language === "en-IN" ? "What is term life insurance?" : "टर्म जीवन बीमा क्या होता है?", data => chunks.push(Buffer.from(data, "base64"))); }
    finally { tts.close(); }
    const pcm = Buffer.concat(chunks); const header = Buffer.alloc(44);
    header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8);
    header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
    header.writeUInt32LE(24000, 24); header.writeUInt32LE(48000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
      await page.route("**/test-voice-fixture.wav", route => route.fulfill({ body: Buffer.concat([header, pcm]), contentType: "audio/wav" }));
      await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = async () => {
          const context = new AudioContext(); const destination = context.createMediaStreamDestination();
          const bytes = await (await fetch("/test-voice-fixture.wav")).arrayBuffer();
          const buffer = await context.decodeAudioData(bytes);
          (window as any).startVoiceFixture = () => { const source = context.createBufferSource(); source.buffer = buffer; source.connect(destination); void context.resume(); source.start(); };
          destination.stream.getTracks().forEach(track => { const stop = track.stop.bind(track); track.stop = () => { stop(); void context.close(); }; });
          return destination.stream;
        };
      });
      await page.goto(testInfo.project.use.baseURL!);
      if (language === "hi-IN") await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
      await page.getByRole("button", { name: language === "en-IN" ? "Start live conversation" : "लाइव बातचीत शुरू करें", exact: true }).click();
      await expect(page.getByText(language === "en-IN" ? "listening" : "सुन रहा है", { exact: true })).toBeVisible({ timeout: 25000 });
      await page.evaluate(() => (window as any).startVoiceFixture());
      await expect(page.locator(".message.assistant .message-body p")).toBeVisible({ timeout: 60000 });
      await expect(page.getByText(language === "en-IN" ? "speaking" : "बोल रहा है", { exact: true })).toBeVisible({ timeout: 60000 });
      // Speak a second utterance while the first answer is still playing.
      await page.evaluate(() => (window as any).startVoiceFixture());
      await expect(page.getByText(language === "en-IN" ? "Response interrupted" : "उत्तर बीच में रोका गया", { exact: true })).toBeVisible();
      await expect(page.locator(".message.assistant")).toHaveCount(2, { timeout: 60000 });
      await expect(page.getByText(language === "en-IN" ? "speaking" : "बोल रहा है", { exact: true })).toBeVisible({ timeout: 60000 });
      await expect(page.getByText(language === "en-IN" ? "listening" : "सुन रहा है", { exact: true })).toBeVisible({ timeout: 60000 });
      await page.getByText(language === "en-IN" ? "Voice measurements and review" : "वॉइस माप और समीक्षा", { exact: true }).click();
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: language === "en-IN" ? "Export voice measurements" : "माप डाउनलोड करें", exact: true }).click();
      await mkdir(".local", { recursive: true });
      await (await download).saveAs(`.local/streaming-browser-${language}.json`);
      await page.screenshot({ path: `.local/streaming-browser-${language}.png`, fullPage: true });
      expect(errors).toEqual([]);
      await page.getByRole("button", { name: language === "en-IN" ? "End live conversation" : "लाइव बातचीत बंद करें", exact: true }).click();
    } finally { await browser.close(); }
  }
  await writeFile(".local/streaming-browser-check.json", JSON.stringify({ at: new Date().toISOString(), languages: ["en-IN", "hi-IN"], syntheticMicrophone: true, physicalAudibilityVerified: false }, null, 2));
});
