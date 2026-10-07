import { test, expect, type Page } from "@playwright/test";

const documentText = "Example Protect provides life cover for 20 years while premiums are paid. There is no maturity benefit. Claims require a claim form and death certificate. The document does not specify a processing timeline.";
async function ready(page: Page) {
  await page.route("**/api/status", (r) => r.fulfill({ json: { configured: true } }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Pitch this plan", exact: true })).toBeEnabled();
}
async function applyDocument(page: Page) {
  await page.getByRole("button", { name: "Use your own product document", exact: true }).click();
  await page.getByLabel("Product / document name", { exact: true }).fill("Example Protect");
  await page.getByLabel("Product document text", { exact: true }).fill(documentText);
  await page.getByRole("button", { name: "Use this document", exact: true }).click();
}

test("custom pitches and follow-ups keep priority/context, show excerpts and send the answer to speech", async ({ page }) => {
  const requests: { document?: { text: string }; priority: string; history: unknown[]; question: string }[] = [];
  const speech: string[] = [];
  await page.route("**/api/chat", (r) => {
    requests.push(r.request().postDataJSON());
    return r.fulfill({ json: { kind: "answer", text: `Supported answer ${requests.length}.`, sourceIds: ["DOC-1"], sources: [{ id: "DOC-1", planId: "custom", documentTitle: "Example Protect", pageOrSection: "Pasted text · section 1", url: "", excerpt: documentText }] } });
  });
  await page.route("**/api/speak", (r) => {
    speech.push(r.request().postDataJSON().text);
    return r.fulfill({ status: 502, json: { error: "Audio was unavailable. You can read the answer or retry audio." } });
  });
  await ready(page);
  await applyDocument(page);
  await expect(page.locator(".plan-heading")).toHaveText("Example Protect");
  await expect(page.locator(".plan-meta")).not.toContainText("512N");
  await page.getByLabel("What matters to you? (optional)", { exact: true }).fill("Family protection");
  await page.getByRole("button", { name: "Pitch this plan", exact: true }).click();
  await expect(page.getByText("Supported answer 1.", { exact: true })).toBeVisible();
  await expect.poll(() => speech.length).toBe(1);
  expect(speech[0]).toBe("Supported answer 1.");
  await page.locator("summary").click();
  await expect(page.locator(".source-excerpt")).toHaveText(documentText);
  await expect(page.locator(".answer-controls a")).toHaveCount(0);
  await page.getByRole("button", { name: "How do claims work?", exact: true }).click();
  await expect(page.getByText("Supported answer 2.", { exact: true })).toBeVisible();
  expect(requests[1].document?.text).toBe(documentText);
  expect(requests[1].priority).toBe("Family protection");
  expect(requests[1].history).toHaveLength(1);
  await page.getByRole("button", { name: /PLAN 876/ }).click();
  await expect(page.locator(".message")).toHaveCount(0);
  await expect(page.getByLabel("What matters to you? (optional)", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Pitch this plan", exact: true }).click();
  await expect(page.getByText("Supported answer 3.", { exact: true })).toBeVisible();
  expect(requests[2].document).toBeUndefined();
  expect(requests[2].history).toEqual([]);
});

test("document validation, Hindi labels and mobile layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.getByRole("button", { name: "Use your own product document", exact: true }).click();
  await page.getByRole("button", { name: "Use this document", exact: true }).click();
  await expect(page.locator(".document-editor").getByRole("alert")).toContainText("80–24,000");
  await page.getByLabel("Product / document name", { exact: true }).fill("Example Protect");
  await page.getByLabel("Product document text", { exact: true }).fill(documentText);
  await page.getByRole("button", { name: "Use this document", exact: true }).click();
  await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
  await expect(page.getByRole("button", { name: "इस योजना की खूबियाँ बताइए", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "दस्तावेज़ देखें / बदलें" })).toBeVisible();
  await expect(page.getByLabel("आपके लिए क्या ज़रूरी है? (वैकल्पिक)", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: ".local/sales-mobile.png", fullPage: true });
});

test("applying a document cancels a pending answer from the previous product", async ({ page }) => {
  let deliver!: () => void;
  await page.route("**/api/chat", async (r) => {
    await new Promise<void>((resolve) => { deliver = resolve; });
    await r.fulfill({ json: { kind: "answer", text: "Old product answer.", sources: [], sourceIds: [] } }).catch(() => {});
  });
  await ready(page);
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: "Pitch this plan", exact: true }).click();
  await expect.poll(() => Boolean(deliver)).toBeTruthy();
  await applyDocument(page);
  deliver();
  await expect(page.locator(".plan-heading")).toHaveText("Example Protect");
  await expect(page.getByRole("button", { name: "Pitch this plan", exact: true })).toBeEnabled();
  await expect(page.getByText("Old product answer.")).toHaveCount(0);
});

test("a misheard voice question can be corrected without carrying the wrong exchange forward", async ({ page }) => {
  const requests: { question: string; history: unknown[] }[] = [];
  await page.route("**/api/chat", (r) => {
    requests.push(r.request().postDataJSON());
    return r.fulfill({ json: { kind: "answer", text: `Answer ${requests.length}`, sources: [], sourceIds: [] } });
  });
  await page.route("**/api/transcribe", (r) => r.fulfill({ json: { transcript: "Cover for two years?" } }));
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] }) as unknown as MediaStream;
    class Recorder {
      state = "inactive";
      onstop?: () => void;
      ondataavailable?: (e: { data: Blob }) => void;
      static isTypeSupported() { return true; }
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { value: Recorder });
  });
  await ready(page);
  await page.getByRole("switch").click();
  await page.getByRole("button", { name: "Pitch this plan", exact: true }).click();
  await expect(page.getByText("Answer 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start recording", exact: true }).click();
  await page.getByRole("button", { name: "Stop recording and submit", exact: true }).click();
  await expect(page.getByText("Answer 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Correct question", exact: true }).click();
  await expect(page.getByLabel("Your question", { exact: true })).toHaveValue("Cover for two years?");
  await expect(page.getByText("Answer 2", { exact: true })).toHaveCount(0);
  await page.getByLabel("Your question", { exact: true }).fill("Cover for twenty years?");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.getByText("Answer 3", { exact: true })).toBeVisible();
  expect(requests[2].question).toBe("Cover for twenty years?");
  expect(requests[2].history).toHaveLength(1);
  expect(JSON.stringify(requests[2].history)).not.toContain("two years");
});
