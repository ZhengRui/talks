import { chromium, type Browser, type Page } from "@playwright/test";
import type { LayoutSlide } from "@/lib/layout/types";
import { buildSlideHtml, type RenderFit } from "./html";

export interface RenderOptions {
  width?: number;
  height?: number;
  fit?: RenderFit;
  background?: string;
  format?: "png" | "jpeg";
  deviceScaleFactor?: number;
  assetBaseUrl?: string;
}

let browser: Browser | null = null;
let page: Page | null = null;
let currentDeviceScaleFactor = 1;
let cleanupRegistered = false;
let queue: Promise<unknown> = Promise.resolve();

function registerCleanup(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  const cleanup = () => {
    closeBrowser().catch(() => {});
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
  process.on("beforeExit", cleanup);
}

async function ensurePage(
  width: number,
  height: number,
  deviceScaleFactor: number,
): Promise<Page> {
  registerCleanup();

  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch();
    page = null;
  }

  const mustRecreatePage =
    !page ||
    page.isClosed() ||
    currentDeviceScaleFactor !== deviceScaleFactor;

  if (mustRecreatePage) {
    if (page && !page.isClosed()) {
      await page.close().catch(() => {});
    }
    page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor,
    });
    currentDeviceScaleFactor = deviceScaleFactor;
  } else {
    const activePage = page!;
    await activePage.setViewportSize({ width, height });
    return activePage;
  }

  return page!;
}

async function waitForRenderReady(activePage: Page): Promise<void> {
  await activePage.evaluate(async () => {
    if ("fonts" in document) {
      try {
        await document.fonts.ready;
      } catch {
        // Ignore font API failures and continue with current font state.
      }
    }

    await Promise.all(
      Array.from(document.images).map(async (img) => {
        if (img.complete) {
          try {
            await img.decode?.();
          } catch {
            // Ignore decode failures so a broken image does not deadlock the render.
          }
          return;
        }
        await new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
      }),
    );
  });
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function renderSlideToImage(
  slide: LayoutSlide,
  options: RenderOptions = {},
): Promise<Buffer> {
  return enqueue(async () => {
    const {
      width = slide.width,
      height = slide.height,
      fit = "contain",
      background,
      format = "png",
      deviceScaleFactor = 1,
      assetBaseUrl,
    } = options;

    const activePage = await ensurePage(width, height, deviceScaleFactor);
    const html = buildSlideHtml(slide, {
      width,
      height,
      fit,
      background,
      assetBaseUrl,
    });

    await activePage.setContent(html, {
      waitUntil: "networkidle",
      timeout: 10_000,
    });
    await waitForRenderReady(activePage);
    await activePage.locator("#render-root").waitFor({
      state: "visible",
      timeout: 10_000,
    });

    const buf = await activePage.locator("#render-root").screenshot({
      type: format,
    });

    return Buffer.from(buf);
  });
}

export async function closeBrowser(): Promise<void> {
  if (page && !page.isClosed()) {
    await page.close().catch(() => {});
    page = null;
  }
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}
