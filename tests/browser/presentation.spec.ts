import { test, expect } from "@playwright/test";

test.describe("presentation layout", () => {
    test.use({ hasTouch: true });

    for (const filename of ["enterprise-voice-ai.html", "presentation.html"]) {
      test(`${filename} stays centered and fits when the viewport changes`, async ({ page }) => {
        await page.setViewportSize({ width: 1180, height: 696 });
        await page.goto(`/${filename}`);

        for (const size of [
          { width: 1180, height: 696 }, // iPad landscape with Safari's bars visible
          { width: 820, height: 1056 }, // Portrait
          { width: 1180, height: 820 }, // More space as browser bars hide
          { width: 768, height: 920 }, // Smaller iPad and taller toolbar
          { width: 1440, height: 1000 },
          { width: 1920, height: 1080 },
        ]) {
          await page.setViewportSize(size);
          await expect.poll(async () => page.locator("main").evaluate((container) => {
            const outer = container.getBoundingClientRect();
            const slide = container.firstElementChild!.getBoundingClientRect();
            const toolbar = document.querySelector(".toolbar")!.getBoundingClientRect();
            return Math.max(
              Math.abs(slide.left + slide.width / 2 - (outer.left + outer.width / 2)),
              Math.abs(slide.top + slide.height / 2 - (outer.top + outer.height / 2)),
              outer.left - slide.left, slide.right - outer.right,
              outer.top - slide.top, slide.bottom - outer.bottom,
              slide.bottom - toolbar.top,
              Math.abs(slide.width / slide.height - 16 / 9),
            );
          }), { message: `Slide must fit and center at ${size.width}x${size.height}` }).toBeLessThan(1);
        }

        await page.locator("#next").click();
        await expect(page.locator("#counter")).toHaveText(/^2 \/ /);
        await page.keyboard.press("ArrowLeft");
        await expect(page.locator("#counter")).toHaveText(/^1 \/ /);

        await page.emulateMedia({ media: "print" });
        const slides = page.locator(".slide");
        await expect(slides.last()).toBeVisible();
        const first = await slides.first().boundingBox();
        const second = await slides.nth(1).boundingBox();
        expect(first!.x).toBe(0);
        expect(first!.y).toBe(0);
        expect(second!.y).toBeGreaterThanOrEqual(first!.height - 1);
      });
    }
});
