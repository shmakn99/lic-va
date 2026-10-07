import { test, expect } from "@playwright/test";

test("three-position slider controls new answers without clearing context and speech uses the answer", async ({ page }) => {
  const requests: { answerStyle: string; history: unknown[] }[] = [];
  const spoken: string[] = [];
  await page.route("**/api/status", (r) => r.fulfill({ json: { configured: true } }));
  await page.route("**/api/chat", (r) => {
    const body = r.request().postDataJSON();
    requests.push(body);
    return r.fulfill({ json: { kind: "answer", text: `Answer in ${body.answerStyle}.`, sourceIds: [], sources: [] } });
  });
  await page.route("**/api/speak", (r) => {
    spoken.push(r.request().postDataJSON().text);
    return r.fulfill({ status: 502, json: { error: "Audio unavailable" } });
  });
  await page.goto("/");
  const slider = page.getByRole("slider", { name: "Answer style", exact: true });
  await expect(slider).toHaveValue("2");
  await expect(slider).toHaveAttribute("aria-valuetext", "Technical language");
  await slider.focus();
  await slider.press("ArrowLeft");
  await expect(slider).toHaveValue("1");
  await page.getByRole("button", { name: "Explain this plan", exact: true }).click();
  await expect(page.getByText("Answer in normal.", { exact: true })).toBeVisible();
  await expect.poll(() => spoken.length).toBe(1);
  expect(spoken[0]).toBe("Answer in normal.");
  await page.getByRole("button", { name: "Very simple language", exact: true }).click();
  await expect(slider).toHaveValue("0");
  await page.getByRole("textbox", { name: "Your question", exact: true }).fill("And then?");
  await page.getByRole("button", { name: "Send question", exact: true }).click();
  await expect(page.getByText("Answer in very-simple.", { exact: true })).toBeVisible();
  expect(requests.map((r) => r.answerStyle)).toEqual(["normal", "very-simple"]);
  expect(requests[1].history).toHaveLength(1);
  await expect(page.getByText("Answer in normal.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "हिन्दी", exact: true }).click();
  await expect(page.getByRole("slider")).toHaveAttribute("aria-valuetext", "बहुत आसान भाषा");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("slider")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
