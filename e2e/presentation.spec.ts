import { test, expect } from "@playwright/test";

test.describe("presentation page", () => {
  test("renders the reveal.js container", async ({ page }) => {
    await page.goto("/70-years-of-ai");
    await expect(page.locator(".reveal")).toBeVisible();
    await expect(page.locator(".slides")).toBeVisible();
  });

  test("renders correct number of slides", async ({ page }) => {
    await page.goto("/70-years-of-ai");
    const sections = page.locator(".slides > section");
    await expect(sections).toHaveCount(2);
  });

  test("cover slide shows title", async ({ page }) => {
    await page.goto("/70-years-of-ai");
    await expect(page.locator("h1")).toContainText("70 Years of AI");
  });

  test("navigates to next slide with arrow key", async ({ page }) => {
    await page.goto("/70-years-of-ai");
    // Wait for Reveal.js to initialize
    await page.waitForSelector(".reveal.ready");
    await page.keyboard.press("ArrowRight");
    // Second slide should now be visible with its title
    await expect(page.locator("h2")).toContainText("AI Applications");
  });

  test("cover slide has background image", async ({ page }) => {
    await page.goto("/70-years-of-ai");
    const section = page.locator(".slides > section").first();
    await expect(section).toHaveAttribute(
      "data-background-image",
      "/70-years-of-ai/cover-bg.jpg"
    );
  });
});
