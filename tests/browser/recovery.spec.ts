import { test, expect, type Page } from "@playwright/test";
const response = {
  kind: "answer",
  text: "A supported demonstration answer.",
  sourceIds: ["NJA-benefits"],
  sources: [
    {
      id: "NJA-benefits",
      planId: "new-jeevan-anand",
      documentTitle: "Official LIC brochure",
      pageOrSection: "PDF page 3",
      url: "https://licindia.in/#page=3",
    },
  ],
};
async function ready(page: Page) {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { configured: true } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Explain this plan", exact: true }),
  ).toBeEnabled();
}
test("desktop layout, source links, follow-up context, language preservation and plan reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const bodies: { history: unknown[]; language: string; planId: string }[] = [];
  await page.route("**/api/chat", (r) => {
    bodies.push(r.request().postDataJSON());
    return r.fulfill({ json: response });
  });
  await ready(page);
  await page.getByRole("switch").click();
  await page.screenshot({ path: ".local/desktop.png", fullPage: true });
  await page
    .getByRole("button", { name: "Explain this plan", exact: true })
    .click();
  await expect(page.getByText(response.text)).toBeVisible();
  await page.locator("summary").click();
  await expect(
    page.getByRole("link", { name: "Official LIC brochure" }),
  ).toHaveAttribute("href", /licindia.in/);
  await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
  await expect(page.getByText(response.text)).toBeVisible();
  await page.getByLabel("आपका सवाल").fill("और उसके बाद?");
  await page.getByRole("button", { name: "सवाल भेजें" }).click();
  await expect(page.getByText(response.text)).toHaveCount(2);
  expect(bodies[1].history).toHaveLength(1);
  expect(bodies[1].language).toBe("hi-IN");
  await page.getByRole("button", { name: /योजना 876/ }).click();
  await expect(page.getByText(response.text)).toHaveCount(0);
  expect(errors).toEqual([]);
});
for (const action of ["reset", "plan", "language"])
  test(`${action} cancels pending answers`, async ({ page }) => {
    let deliver!: () => void;
    await page.route("**/api/chat", async (r) => {
      await new Promise<void>((resolve) => {
        deliver = resolve;
      });
      await r.fulfill({ json: response }).catch(() => {});
    });
    await ready(page);
    await page.getByRole("switch").click();
    await page
      .getByRole("button", { name: "Explain this plan", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Send question" }),
    ).toBeDisabled();
    await expect.poll(() => Boolean(deliver)).toBeTruthy();
    if (action === "reset")
      await page.getByRole("button", { name: "Reset", exact: true }).click();
    else if (action === "plan")
      await page.getByRole("button", { name: /PLAN 876/ }).click();
    else
      await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
    deliver();
    await page.waitForTimeout(300);
    await expect(page.getByText(response.text)).toHaveCount(0);
    await expect(
      page.getByLabel(action === "language" ? "आपका सवाल" : "Your question"),
    ).toBeEnabled();
  });
test("chat failure retains question and retry does not duplicate it", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/chat", (r) =>
    ++calls === 1
      ? r.fulfill({ status: 502, json: { error: "Provider unavailable" } })
      : r.fulfill({ json: response }),
  );
  await ready(page);
  await page.getByRole("switch").click();
  await page.getByLabel("Your question").fill("My question");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Provider unavailable",
  );
  await page.getByRole("button", { name: "Retry question" }).click();
  await expect(page.getByText(response.text)).toBeVisible();
  await expect(page.getByText("My question", { exact: true })).toHaveCount(1);
});
test("TTS failure retains answer; retry audio does not call chat", async ({
  page,
}) => {
  let chats = 0,
    audioCalls = 0;
  await page.route("**/api/chat", (r) => {
    chats++;
    return r.fulfill({ json: response });
  });
  await page.route("**/api/speak", (r) => {
    audioCalls++;
    return r.fulfill({ status: 502, json: { error: "Speech is unavailable" } });
  });
  await ready(page);
  await page
    .getByRole("button", { name: "Explain this plan", exact: true })
    .click();
  await expect(page.getByText("Speech is unavailable")).toBeVisible();
  await page.getByRole("button", { name: "Retry audio" }).click();
  await expect.poll(() => audioCalls).toBe(2);
  expect(chats).toBe(1);
  await expect(page.getByText(response.text)).toBeVisible();
});
test("microphone denial preserves typing", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
  });
  await ready(page);
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "permission was denied",
  );
  await expect(page.getByLabel("Your question")).toBeEnabled();
});
test("mobile layout remains within viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await expect(
    page.getByRole("combobox", { name: "Select plan", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: ".local/mobile.png", fullPage: true });
});
test("blocked autoplay has Play fallback; replay and Stop work", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let plays = 0;
    HTMLMediaElement.prototype.play = function () {
      return ++plays === 1
        ? Promise.reject(new DOMException("blocked", "NotAllowedError"))
        : Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {};
  });
  await page.route("**/api/chat", (r) => r.fulfill({ json: response }));
  await page.route("**/api/speak", (r) =>
    r.fulfill({
      json: {
        audios: [
          "UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=",
        ],
        mimeType: "audio/wav",
      },
    }),
  );
  await ready(page);
  await page
    .getByRole("button", { name: "Explain this plan", exact: true })
    .click();
  await expect(
    page.getByText("Audio is ready.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play / Replay" }).click();
  await expect(page.getByRole("button", { name: "Stop audio" })).toBeVisible();
  await page.getByRole("button", { name: "Stop audio" }).click();
  await expect(page.getByRole("button", { name: "Stop audio" })).toHaveCount(0);
});
test("plan change prevents late speech playback", async ({ page }) => {
  let deliver!: () => void;
  await page.route("**/api/chat", (r) => r.fulfill({ json: response }));
  await page.route("**/api/speak", async (r) => {
    await new Promise<void>((resolve) => {
      deliver = resolve;
    });
    await r
      .fulfill({ json: { audios: ["UklGRg=="], mimeType: "audio/wav" } })
      .catch(() => {});
  });
  await ready(page);
  await page
    .getByRole("button", { name: "Explain this plan", exact: true })
    .click();
  await expect.poll(() => Boolean(deliver)).toBeTruthy();
  await page.getByRole("button", { name: /PLAN 876/ }).click();
  deliver();
  await page.waitForTimeout(300);
  await expect(page.getByText(response.text)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Stop audio" })).toHaveCount(0);
});
