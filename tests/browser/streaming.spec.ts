import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import type { ServerEvent } from "../../lib/voice/protocol";

async function live(page: Page, options: { setupError?: string; stall?: boolean; challenge?: boolean } = {}) {
  const messages: Record<string, any>[] = [];
  const challenges: string[] = [];
  let socket!: WebSocketRoute;
  await page.route("**/api/status", route => route.fulfill({ json: { configured: true, streaming: true } }));
  await page.route("**/api/voice/session", route => {
    const challenge = route.request().postDataJSON()?.challenge;
    if (challenge) challenges.push(challenge);
    return route.fulfill({ json: { ticket: challenge || "test", url: "ws://127.0.0.1:3001/voice", ...(options.challenge ? { authentication: "challenge" } : {}) } });
  });
  await page.addInitScript(() => {
    // A silent real MediaStream exercises AudioWorklet without a physical mic.
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext();
      const source = context.createConstantSource(); source.offset.value = 0;
      const destination = context.createMediaStreamDestination(); source.connect(destination); source.start();
      destination.stream.getTracks().forEach(track => { const stop = track.stop.bind(track); track.stop = () => { stop(); source.stop(); void context.close(); }; });
      return destination.stream;
    };
  });
  await page.routeWebSocket("ws://127.0.0.1:3001/voice", route => {
    socket = route;
    if (options.challenge) route.send(JSON.stringify({ type: "challenge", challenge: crypto.randomUUID() }));
    route.onMessage(data => {
      if (typeof data !== "string") return;
      const event = JSON.parse(data); messages.push(event);
      if (event.type === "authenticate") route.send(JSON.stringify({ type: "ready", sessionId: "session-1" }));
      if (event.type === "configure") {
        if (options.setupError) route.send(JSON.stringify({ type: "error", fatal: true, message: options.setupError }));
        else if (!options.stall) route.send(JSON.stringify({ type: "listening" }));
      }
      if (event.type === "ping") route.send(JSON.stringify({ type: "pong" }));
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start live conversation", exact: true }).click();
  if (!options.setupError && !options.stall) await expect(page.getByText("listening", { exact: true })).toBeVisible();
  else await expect.poll(() => messages.filter(e => e.type === "configure").length).toBe(1);
  return { messages, challenges, send: (event: ServerEvent) => socket.send(JSON.stringify(event)), close: (code?: number) => socket.close({ code }) };
}
const answer = { kind: "answer" as const, text: "A checked explanation with its conditions.", sourceIds: [], sources: [] };
function pcm(seconds = .3) { const bytes = Buffer.alloc(Math.floor(24000 * seconds) * 2); for (let i = 0; i < bytes.length / 2; i++) bytes.writeInt16LE(Math.round(Math.sin(i / 24000 * Math.PI * 2 * 330) * 1000), i * 2); return bytes.toString("base64"); }

test("Vercel connection renewal obtains a fresh challenge ticket without replaying a turn", async ({ page }) => {
  const h = await live(page, { challenge: true });
  expect(h.challenges).toHaveLength(1);
  expect(h.messages.find(event => event.type === "authenticate")?.ticket).toBe(h.challenges[0]);
  h.close(1001);
  await expect.poll(() => h.messages.filter(event => event.type === "configure").length).toBe(2);
  await expect(page.getByText("listening", { exact: true })).toBeVisible();
  expect(h.challenges).toHaveLength(2);
  expect(h.challenges[0]).not.toBe(h.challenges[1]);
  expect(h.messages.filter(event => event.type === "text")).toHaveLength(0);
  await page.getByRole("button", { name: "End live conversation", exact: true }).click();
});

test("provider certificate error survives shutdown without retrying setup", async ({ page }) => {
  await page.clock.install();
  const message = "The voice service could not verify the speech provider's secure connection. Restart the app with system certificates enabled; if it persists, check the server certificate configuration.";
  const h = await live(page, { setupError: message });
  await expect(page.locator(".composer-area [role=alert]")).toHaveText(message);
  await expect(page.getByRole("button", { name: "Start live conversation", exact: true })).toBeVisible();
  await page.clock.runFor(15_000);
  expect(h.messages.filter(e => e.type === "authenticate")).toHaveLength(1);
  await expect(page.getByLabel("Your question")).toBeEnabled();
  await expect(page.locator(".composer-area [role=alert]")).toHaveText(message);
});

test("an open socket that never finishes setup times out and retries", async ({ page }) => {
  await page.clock.install();
  const h = await live(page, { stall: true });
  await page.clock.runFor(22_000);
  await expect.poll(() => h.messages.filter(e => e.type === "authenticate").length).toBe(2);
  await page.getByRole("button", { name: "End live conversation", exact: true }).click();
});

test("policy rejection ends the session without a futile reconnect", async ({ page }) => {
  await page.clock.install();
  const h = await live(page); h.close(1008);
  await expect(page.locator(".composer-area [role=alert]")).toContainText("rejected this session");
  await page.clock.runFor(15_000);
  expect(h.messages.filter(e => e.type === "authenticate")).toHaveLength(1);
});

test("stable recovery restores the retry budget for a later network outage", async ({ page }) => {
  await page.clock.install();
  const h = await live(page);
  for (let i = 0; i < 4; i++) {
    h.close();
    await expect(page.getByText("reconnecting", { exact: true })).toBeVisible();
    await page.clock.runFor(2_000);
    await expect.poll(() => h.messages.filter(e => e.type === "configure").length).toBe(i + 2);
    await expect(page.getByText("listening", { exact: true })).toBeVisible();
    // Advance one heartbeat at a time so real socket pong events are delivered.
    for (let beat = 0; beat < 4; beat++) {
      const pings = h.messages.filter(e => e.type === "ping").length;
      await page.clock.runFor(10_000);
      await expect.poll(() => h.messages.filter(e => e.type === "ping").length).toBeGreaterThan(pings);
    }
  }
  await page.getByRole("button", { name: "End live conversation", exact: true }).click();
});

test("live transcript, streamed playback, progress, review and export", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  const h = await live(page);
  h.send({ type: "speech.start", turnId: "turn-1" });
  h.send({ type: "transcript.partial", turnId: "turn-1", text: "Explain this" });
  await expect(page.getByText("Explain this", { exact: true })).toBeVisible();
  h.send({ type: "speech.end", turnId: "turn-1" });
  h.send({ type: "transcript.final", turnId: "turn-1", text: "Explain this plan", spoken: true });
  h.send({ type: "response.start", turnId: "turn-1", responseId: "reply-1" });
  h.send({ type: "segment", responseId: "reply-1", index: 0, answer });
  h.send({ type: "audio", responseId: "reply-1", segment: 0, sequence: 0, audio: pcm(), sampleRate: 24000 });
  h.send({ type: "segment.audio.end", responseId: "reply-1", segment: 0 });
  h.send({ type: "response.end", responseId: "reply-1" });
  await expect(page.getByText(answer.text, { exact: true })).toBeVisible();
  await expect.poll(() => h.messages.some(e => e.type === "played" && e.responseId === "reply-1")).toBe(true);
  await page.getByText("Voice measurements and review", { exact: true }).click();
  expect(await page.locator(".conversation-scroll").evaluate(el => el.clientHeight)).toBeGreaterThan(150);
  await page.getByLabel("Review scenario").selectOption("source_support");
  await page.getByLabel("Review outcome").selectOption("pass");
  await page.getByRole("button", { name: "Record review", exact: true }).click();
  await expect(page.getByText("Review recorded", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export voice measurements", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^voice-measurements-.*\.json$/);
  await page.getByRole("button", { name: "End live conversation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start live conversation", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("barge-in clears queued audio and rejects late text/audio; reset stops the session", async ({ page }) => {
  const h = await live(page);
  h.send({ type: "transcript.final", turnId: "turn-1", text: "Question", spoken: true });
  h.send({ type: "response.start", turnId: "turn-1", responseId: "reply-1" });
  h.send({ type: "segment", responseId: "reply-1", index: 0, answer });
  h.send({ type: "audio", responseId: "reply-1", segment: 0, sequence: 0, audio: pcm(3), sampleRate: 24000 });
  await expect(page.getByText("speaking", { exact: true })).toBeVisible();
  h.send({ type: "speech.start", turnId: "turn-2" });
  await expect(page.getByText("Response interrupted", { exact: true })).toBeVisible();
  h.send({ type: "segment", responseId: "reply-1", index: 1, answer: { ...answer, text: "STALE TEXT MUST NOT APPEAR" } });
  h.send({ type: "audio", responseId: "reply-1", segment: 0, sequence: 1, audio: pcm(), sampleRate: 24000 });
  await expect(page.getByText("STALE TEXT MUST NOT APPEAR")).toHaveCount(0);
  expect(h.messages.some(e => e.type === "interrupt" && e.responseId === "reply-1")).toBe(true);
  await page.getByText("Voice measurements and review", { exact: true }).click();
  await page.getByRole("button", { name: "Refresh measurements", exact: true }).click();
  await expect(page.getByText("Stop event to audio stop", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start live conversation", exact: true })).toBeVisible();
  await expect(page.getByText(answer.text)).toHaveCount(0);
});

test("disconnect reconnects with completed context and never replays an old request", async ({ page }) => {
  const h = await live(page);
  h.send({ type: "transcript.final", turnId: "turn", text: "Question", spoken: true });
  h.send({ type: "response.start", turnId: "turn", responseId: "reply" });
  h.send({ type: "segment", responseId: "reply", index: 0, answer });
  h.close();
  await expect(page.getByText("Response interrupted", { exact: true })).toBeVisible();
  await expect.poll(() => h.messages.filter(e => e.type === "configure").length).toBe(2);
  const resumed = h.messages.filter(e => e.type === "configure")[1];
  expect(resumed.config.history).toHaveLength(1);
  expect(resumed.config.history[0].assistant).not.toContain(answer.text);
  expect(h.messages.filter(e => e.type === "text")).toHaveLength(0);
});

test("live microphone denial leaves typing available", async ({ page }) => {
  await page.route("**/api/status", route => route.fulfill({ json: { configured: true, streaming: true } }));
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied", "NotAllowedError"); }; });
  await page.goto("/"); await page.getByRole("button", { name: "Start live conversation", exact: true }).click();
  await expect(page.locator(".composer-area [role=alert]")).toContainText("Check microphone permission");
  await expect(page.getByLabel("Your question")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Start live conversation", exact: true })).toBeVisible();
});

test("ending live setup suppresses a late microphone-permission failure", async ({ page }) => {
  await page.route("**/api/status", route => route.fulfill({ json: { configured: true, streaming: true } }));
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => new Promise((_resolve, reject) => { (window as any).denyPendingMicrophone = () => reject(new DOMException("Denied", "NotAllowedError")); });
  });
  await page.goto("/"); await page.getByRole("button", { name: "Start live conversation", exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as any).denyPendingMicrophone)).toBe("function");
  await page.getByRole("button", { name: "End live conversation", exact: true }).click();
  await page.evaluate(() => (window as any).denyPendingMicrophone());
  await expect(page.locator(".composer-area [role=alert]")).toHaveCount(0);
  await expect(page.getByLabel("Your question")).toBeEnabled();
});

test("live generation failure has an explicit retry without duplicate questions or failed history", async ({ page }) => {
  const h = await live(page); let history: unknown[] | undefined;
  await page.route("**/api/chat", route => { history = route.request().postDataJSON().history; return route.fulfill({ json: answer }); });
  await page.route("**/api/speak", route => route.fulfill({ status: 503, json: { error: "Audio unavailable" } }));
  h.send({ type: "transcript.final", turnId: "turn", text: "A test question", spoken: true });
  h.send({ type: "response.start", turnId: "turn", responseId: "reply" });
  h.send({ type: "error", responseId: "reply", fatal: false, scope: "generation", message: "The response did not finish." });
  h.send({ type: "interrupted", responseId: "reply" });
  await page.getByRole("button", { name: "Retry question", exact: true }).click();
  await expect(page.getByText(answer.text, { exact: true })).toBeVisible();
  await expect(page.getByText("A test question", { exact: true })).toHaveCount(1);
  expect(history).toEqual([]);
});
