# Render Endpoint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `POST /api/render` endpoint that takes compiled layout IR and returns a screenshot image, using SSR React + Playwright headless browser.

**Architecture:** `LayoutSlideRenderer` is rendered to static HTML via `ReactDOMServer.renderToStaticMarkup()`, wrapped in an output-sized container that applies `fit` scaling, loaded into a persistent headless Chromium page via `page.setContent()`, then screenshotted after fonts and images are ready.

**Tech Stack:** `@playwright/test`, `react-dom/server`, Next.js API route

**Design doc:** `docs/plans/2026-03-27-render-endpoint-design.md`

---

### Task 1: Shared render constants

Keep the headless renderer's font setup in sync with the rest of the app.

**Files:**
- Create: `src/lib/render/fonts.ts`

**Create constants for the headless HTML**

- Export `GOOGLE_FONTS_URL` for the full project font set.
- Export `FONT_FAMILY_VARS` mapping each `--font-*` CSS variable to its actual family stack.

This does not replace `next/font` in [`layout.tsx`](/Users/zerry/Work/Projects/talks/src/app/layout.tsx); it gives the headless HTML a compatible font environment.

**Commit**

```text
feat(render): add shared font constants for headless renderer
```

---

### Task 2: HTML builder with output sizing and asset base support

Build a deterministic server helper that turns `LayoutSlide` + render options into one self-contained HTML string.

**Files:**
- Create: `src/lib/render/html.ts`
- Test: `src/lib/render/html.test.ts`

**API shape**

```ts
export type RenderFit = "contain" | "cover" | "stretch";

export interface BuildSlideHtmlOptions {
  width?: number;
  height?: number;
  fit?: RenderFit;
  background?: string;
  assetBaseUrl?: string;
}
```

**Write tests first**

Cover at least:

- returns a full HTML document
- includes Google Fonts link and `--font-*` CSS variables
- includes `animations.css`
- renders the slide markup
- injects a `<base>` tag when `assetBaseUrl` is provided
- defaults `width` / `height` to `slide.width` / `slide.height`
- includes the correct transform/wrapper structure for:
  - `fit: "contain"`
  - `fit: "cover"`
  - `fit: "stretch"`

Use string assertions. This test is about contract and document shape, not image fidelity.

**Implementation notes**

- Render `LayoutSlideRenderer` with `animationNone: true`.
- Read `src/styles/animations.css` once at module load.
- Build a root container, for example:
  - `#render-root`: output raster box sized to requested `width x height`
  - `#render-slide`: logical slide box sized to `slide.width x slide.height`
- Compute transform based on `fit`:
  - `contain`: uniform scale = `min(width / slide.width, height / slide.height)`
  - `cover`: uniform scale = `max(width / slide.width, height / slide.height)`
  - `stretch`: independent `scaleX`, `scaleY`
- Center the slide wrapper within the output box for `contain` and `cover`.
- Use `background ?? slide.background` as the output-root background.
- Inject `<base href="...">` when `assetBaseUrl` is present.

**Implementation sketch**

```ts
import { readFileSync } from "fs";
import { join } from "path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LayoutSlideRenderer } from "@/components/LayoutRenderer";
import type { LayoutSlide } from "@/lib/layout/types";
import { FONT_FAMILY_VARS, GOOGLE_FONTS_URL } from "./fonts";

const animationsCss = readFileSync(
  join(process.cwd(), "src/styles/animations.css"),
  "utf8",
);

function buildFontVarStyle(): string {
  return Object.entries(FONT_FAMILY_VARS)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
}

function resolveOutputSize(slide: LayoutSlide, width?: number, height?: number) {
  return {
    width: width ?? slide.width,
    height: height ?? slide.height,
  };
}

function computeFitTransform(
  slide: LayoutSlide,
  width: number,
  height: number,
  fit: RenderFit,
) {
  const scaleX = width / slide.width;
  const scaleY = height / slide.height;

  if (fit === "stretch") {
    return {
      x: 0,
      y: 0,
      transform: `scale(${scaleX}, ${scaleY})`,
    };
  }

  const scale = fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
  return {
    x: (width - slide.width * scale) / 2,
    y: (height - slide.height * scale) / 2,
    transform: `scale(${scale})`,
  };
}
```

**Commit**

```text
feat(render): add HTML builder with fit and asset base handling
```

---

### Task 3: Browser singleton and screenshot helper

Manage Playwright lifecycle and expose the render primitive.

**Files:**
- Create: `src/lib/render/screenshot.ts`
- Test: `src/lib/render/screenshot.test.ts`

**Render options**

```ts
export interface RenderOptions {
  width?: number;
  height?: number;
  fit?: "contain" | "cover" | "stretch";
  background?: string;
  format?: "png" | "jpeg";
  deviceScaleFactor?: number;
  assetBaseUrl?: string;
}
```

**Write integration tests first**

Cover at least:

- returns a PNG buffer
- returns a JPEG buffer when requested
- respects custom output dimensions
- recreates the page correctly when `deviceScaleFactor` changes

For the dimension test, parse PNG width/height from the returned bytes instead of only asserting that the buffer is non-empty.

**Implementation requirements**

- Import Chromium from `@playwright/test`, not `playwright`, because the repo already depends on the former.
- Reuse one browser instance.
- Reuse one page when possible.
- Recreate the page when:
  - the page is closed
  - the browser is disconnected
  - `deviceScaleFactor` changes
- Serialize render calls through a simple promise queue.
- Wait for:
  - `page.setContent(..., { waitUntil: "networkidle" })`
  - `document.fonts.ready`
  - all `document.images` to decode or fail
- Screenshot `#render-root`, not the whole page.

**Implementation sketch**

```ts
import { chromium, type Browser, type Page } from "@playwright/test";
import type { LayoutSlide } from "@/lib/layout/types";
import { buildSlideHtml } from "./html";

let browser: Browser | null = null;
let page: Page | null = null;
let currentDeviceScaleFactor = 1;
let queue = Promise.resolve();

async function ensurePage(
  width: number,
  height: number,
  deviceScaleFactor: number,
): Promise<Page> {
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
    await page.setViewportSize({ width, height });
  }

  return page;
}

async function waitForRenderReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if ("fonts" in document) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    await Promise.all(
      Array.from(document.images).map(async (img) => {
        if (img.complete) {
          try {
            await img.decode?.();
          } catch {}
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
```

Wrap the actual render body in the queue so two concurrent requests cannot stomp on the shared page.

**Commit**

```text
feat(render): add screenshot helper with browser reuse and readiness waits
```

---

### Task 4: API route

Add the public route that validates input and delegates to `renderSlideToImage()`.

**Files:**
- Create: `src/app/api/render/route.ts`

**Route requirements**

- `export const runtime = "nodejs";`
- parse JSON body
- validate:
  - `slide` exists and has `elements`
  - `width` / `height` are positive finite numbers when provided
  - `fit` is one of `"contain" | "cover" | "stretch"` when provided
  - `format` is one of `"png" | "jpeg"` when provided
  - `assetBaseUrl` is a valid absolute URL when provided
- return raw image bytes with the correct `Content-Type`
- return `400` for bad input and `500` for render failure

**Suggested body shape**

```ts
const {
  slide,
  width,
  height,
  fit,
  background,
  format,
  deviceScaleFactor,
  assetBaseUrl,
} = body;
```

**Manual smoke tests**

1. Render a plain red slide to PNG.
2. Render the same slide with `width: 800`, `height: 800`, `fit: "contain"`.
3. Render a slide containing an image with `src: "/some/project/asset.png"` and pass `assetBaseUrl: "http://127.0.0.1:3000"`.

**Commit**

```text
feat(render): add POST /api/render route
```

---

### Task 5: E2E route test

Verify the route works end-to-end through the app server.

**Files:**
- Create: `e2e/render.spec.ts`

**Write an E2E test that covers**

- `POST /api/render` returns `200` and `image/png`
- missing slide returns `400`
- custom `width` / `height` returns an image with the requested output dimensions

For the output-dimension assertion, parse the PNG IHDR bytes directly in the test.

**Optional follow-up E2E**

- slide with root-relative image asset + `assetBaseUrl`

That can land in the same PR if there is already a stable fixture asset available. If not, defer it and keep the contract covered in the HTML-builder unit test.

**Commit**

```text
test(render): add E2E coverage for render endpoint
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Shared font constants | `src/lib/render/fonts.ts` |
| 2 | HTML builder with fit/base-url support | `src/lib/render/html.ts`, `src/lib/render/html.test.ts` |
| 3 | Screenshot helper with readiness waits | `src/lib/render/screenshot.ts`, `src/lib/render/screenshot.test.ts` |
| 4 | `POST /api/render` route | `src/app/api/render/route.ts` |
| 5 | E2E route coverage | `e2e/render.spec.ts` |
