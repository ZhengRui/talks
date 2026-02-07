import { test, expect } from "@playwright/test";

test.describe("home page", () => {
  test("displays Presentations heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Presentations");
  });

  test("lists 70 Years of AI presentation", async ({ page }) => {
    await page.goto("/");
    const link = page.locator('a[href="/70-years-of-ai"]');
    await expect(link).toBeVisible();
    await expect(link).toContainText("70 Years of AI");
  });

  test("shows slide count", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=2 slides")).toBeVisible();
  });

  test("navigates to presentation on click", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/70-years-of-ai"]');
    await expect(page).toHaveURL("/70-years-of-ai");
  });
});
