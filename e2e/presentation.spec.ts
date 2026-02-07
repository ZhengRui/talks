import { test, expect } from "@playwright/test";

test.describe("presentation page", () => {
  test("renders the slide engine container", async ({ page }) => {
    await page.goto("/70-years-of-ai");
    await expect(page.locator(".slide-engine")).toBeVisible();
    await expect(page.locator(".slide-canvas")).toBeVisible();
  });

  test("renders correct number of slides", async ({ page }) => {
    await page.goto("/70-years-of-ai");
    const slides = page.locator(".slide-canvas > .slide");
    await expect(slides).toHaveCount(2);
  });

  test("cover slide shows title", async ({ page }) => {
    await page.goto("/70-years-of-ai");
    await expect(page.locator(".slide.active")).toContainText("70 Years of AI");
  });

  test("navigates to next slide with arrow key", async ({ page }) => {
    await page.goto("/70-years-of-ai");
    await page.waitForSelector(".slide-engine");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".slide.active")).toContainText(
      "AI Applications"
    );
  });

  test("shows slide counter", async ({ page }) => {
    await page.goto("/70-years-of-ai");
    await expect(page.locator(".slide-counter")).toContainText("1 / 2");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".slide-counter")).toContainText("2 / 2");
  });
});
