import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { plans } from "../../lib/plans";
import { ui } from "../../lib/i18n";

test("live native recording → Sarvam transcript → grounded chat → playback without browser decoding, all plans/languages", async () => {
  test.skip(
    process.env.LIVE_VOICE_TEST !== "1",
    "Explicit opt-in: makes real Sarvam API calls with synthetic microphone input.",
  );
  test.setTimeout(300000);
  const results = [];
  for (const language of ["en-IN", "hi-IN"] as const) {
    const t = ui(language);
    const browser = await chromium.launch({
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${path.resolve(`.local/smoke-${language}.wav`)}`,
      ],
    });
    try {
      const context = await browser.newContext({
        permissions: ["microphone"],
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        AudioContext.prototype.decodeAudioData = () => {
          throw new Error("Unable to decode audio data");
        };
      });
      await page.goto("http://127.0.0.1:3000");
      if (language === "hi-IN")
        await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
      for (const plan of plans) {
        await page
          .getByRole("button", {
            name: new RegExp(`${t.planCard} ${plan.number}`),
          })
          .click();
        const sttResponse = page.waitForResponse((r) =>
          r.url().endsWith("/api/transcribe"),
        );
        const chatResponse = page.waitForResponse((r) =>
          r.url().endsWith("/api/chat"),
        );
        const ttsResponse = page.waitForResponse((r) =>
          r.url().endsWith("/api/speak"),
        );
        // Attach rejection handlers now so an earlier-stage failure keeps its actual diagnostic.
        void chatResponse.catch(() => {});
        void ttsResponse.catch(() => {});
        await page.getByRole("button", { name: t.startRecording }).click();
        await expect(
          page.getByRole("button", { name: t.stopRecording }),
        ).toBeVisible();
        await page.waitForTimeout(4000); // Record actual MediaRecorder bytes from the synthetic microphone.
        const start = Date.now();
        await page.getByRole("button", { name: t.stopRecording }).click();
        const stt = await sttResponse;
        expect(stt.status()).toBe(200);
        const chat = await chatResponse;
        expect(chat.status()).toBe(200);
        const answer = await chat.json();
        expect(answer.sourceIds.length).toBeGreaterThan(0);
        expect(
          answer.sources.every((s: { planId: string }) => s.planId === plan.id),
        ).toBeTruthy();
        if (language === "hi-IN")
          expect(answer.text).toMatch(/[\u0900-\u097F]/);
        const textMs = Date.now() - start;
        const tts = await ttsResponse;
        expect(tts.status()).toBe(200);
        await expect(
          page.getByRole("button", { name: t.stopAudio }),
        ).toBeVisible({ timeout: 10000 });
        await page.screenshot({
          path: `.local/voice-${plan.number}-${language}.png`,
          fullPage: true,
        });
        results.push({
          plan: plan.id,
          language,
          transcript: await stt.json(),
          answer,
          textMs,
          audioMs: Date.now() - start,
        });
        console.log(
          `Voice PASS: ${plan.number} ${language}; text ${textMs}ms, audio ${Date.now() - start}ms`,
        );
        await mkdir(".local", { recursive: true });
        await writeFile(
          ".local/voice-results.json",
          JSON.stringify(results, null, 2),
        );
        await page.getByRole("button", { name: t.stopAudio }).click();
        await expect(
          page.getByRole("button", { name: t.replay }),
        ).toBeVisible();
      }
    } finally {
      await browser.close();
    }
  }
  await mkdir(".local", { recursive: true });
  await writeFile(
    ".local/voice-results.json",
    JSON.stringify(results, null, 2),
  );
});

test("empty transcription sends no chat; recording cap auto-submits and stops tracks", async ({
  page,
}) => {
  let chats = 0,
    transcriptions = 0;
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { configured: true } }),
  );
  await page.route("**/api/transcribe", (r) => {
    transcriptions++;
    return r.fulfill({ json: { transcript: "" } });
  });
  await page.route("**/api/chat", (r) => {
    chats++;
    return r.fulfill({ status: 500, json: {} });
  });
  await page.addInitScript(() => {
    const context = window as unknown as { stoppedTracks: number };
    context.stoppedTracks = 0;
    navigator.mediaDevices.getUserMedia = async () =>
      ({
        getTracks: () => [
          {
            stop: () => {
              context.stoppedTracks++;
            },
          },
        ],
      }) as unknown as MediaStream;
    class FakeRecorder {
      state = "inactive";
      onstop?: () => void;
      ondataavailable?: (e: { data: Blob }) => void;
      static isTypeSupported() {
        return true;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["audio"], { type: "audio/webm" }),
        });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { value: FakeRecorder });
    AudioContext.prototype.decodeAudioData = () => {
      throw new Error("Unable to decode audio data");
    };
  });
  await page.goto("/");
  await page.clock.install();
  await page.getByRole("button", { name: "Start recording" }).click();
  await page.clock.fastForward(25000);
  await expect(
    page.getByText("No speech was detected.", { exact: false }),
  ).toBeVisible();
  expect(transcriptions).toBe(1);
  expect(chats).toBe(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { stoppedTracks: number }).stoppedTracks,
    ),
  ).toBeGreaterThan(0);
  await expect(page.getByLabel("Your question")).toBeEnabled();
});
