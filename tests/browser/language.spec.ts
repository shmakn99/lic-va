import { test, expect } from "@playwright/test";

test("Hindi covers the whole page, all plans, source details, errors and accessible controls", async ({
  page,
}) => {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { configured: true } }),
  );
  await page.route("**/api/chat", (r) =>
    r.fulfill({
      json: {
        kind: "answer",
        text: "यह योजना का विवरण है।",
        sourceIds: ["NJA-benefits"],
        sources: [
          {
            id: "NJA-benefits",
            planId: "new-jeevan-anand",
            documentTitle: "Official LIC brochure",
            pageOrSection: "PDF pages 3, 4; Death and maturity",
            url: "https://licindia.in/#page=3",
          },
        ],
      },
    }),
  );
  await page.route("**/api/speak", (r) =>
    r.fulfill({
      status: 502,
      json: {
        error: "Audio was unavailable. You can read the answer or retry audio.",
      },
    }),
  );
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page).toHaveTitle("योजना साथी");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "आपके सवाल। योजना की बेहतर समझ।",
  );
  await expect(page.locator(".brand")).toContainText("एलआईसी की योजनाएँ");
  await expect(page.locator(".sidebar-note")).toContainText(
    "हर जवाब के साथ स्रोत",
  );
  await expect(page.locator(".page-footer")).toContainText(
    "सर्वम द्वारा संचालित",
  );
  for (const name of [
    "न्यू जीवन आनंद",
    "जीवन उत्सव सिंगल प्रीमियम",
    "डिजि टर्म",
  ]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.locator(".plan-heading")).toHaveText(name);
    // Official identifiers stay unchanged; every other interface word is Hindi.
    const text = (await page.locator("main").innerText()).replace(
      /512N\d+V\d+/g,
      "",
    );
    expect(text).not.toMatch(/[A-Za-z]/);
  }
  await page.getByRole("button", { name: /योजना 715/ }).click();
  await page.screenshot({ path: ".local/hindi-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "रिकॉर्डिंग शुरू करें" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "माइक की अनुमति नहीं मिली",
  );
  await page
    .getByRole("button", { name: "यह योजना समझाइए", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "आवाज़ फिर आज़माएँ" }),
  ).toBeVisible();
  await expect(page.locator(".audio-error")).toContainText(
    "आवाज़ उपलब्ध नहीं थी",
  );
  await page.locator("summary").click();
  await expect(
    page.getByRole("link", { name: /आधिकारिक विवरणिका/ }),
  ).toHaveAttribute("href", "https://licindia.in/#page=3");
  await expect(page.locator("details")).toContainText("पीडीएफ पृष्ठ 3, 4");
  expect(
    (await page.locator("main").innerText()).replace(/512N\d+V\d+/g, ""),
  ).not.toMatch(/[A-Za-z]/);
  await page.getByRole("button", { name: "अंग्रेज़ी", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your questions. A clearer plan.",
  );
  await expect(page.getByText("यह योजना का विवरण है।")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry audio" })).toBeVisible();
});

test("Hindi mobile layout and plan selector remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { configured: true } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
  const select = page.getByRole("combobox", {
    name: "योजना चुनें",
    exact: true,
  });
  await expect(select).toBeVisible();
  await select.selectOption("jeevan-utsav-single-premium");
  await expect(page.locator(".plan-heading")).toHaveText(
    "जीवन उत्सव सिंगल प्रीमियम",
  );
  await expect(
    page.getByRole("button", { name: "रिकॉर्डिंग शुरू करें" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: ".local/hindi-mobile.png", fullPage: true });
});
