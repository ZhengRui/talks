# Design: Headless Render Endpoint

> Step 4 of the v11 feedback loop plan (see `docs/2026-03-26-discussion-v11.md`)

## Context

The extraction pipeline (steps 1-3) now produces a visual inventory and a scene template from a screenshot. To close the feedback loop, we need to render the generated template back to an image so it can be scored against the original. The extract UI can also use this endpoint to show a rendered replica alongside the source image.

This endpoint is the foundation for steps 5-6 (composite scoring and iterative refinement).

## API Contract

```http
POST /api/render
Content-Type: application/json

Body: {
  slide: LayoutSlide,                  // compiled layout IR for one slide
  width?: number,                     // output raster width in px; default: slide.width
  height?: number,                    // output raster height in px; default: slide.height
  fit?: "contain" | "cover" | "stretch",
                                      // how the logical slide is mapped into the output raster
                                      // default: "contain"
  background?: string,                // output-canvas background outside the scaled slide
                                      // default: slide.background
  format?: "png" | "jpeg",            // default: png
  deviceScaleFactor?: number,         // default: 1
  assetBaseUrl?: string               // base URL for resolving root-relative assets like /foo.png
}

Response 200: image/png or image/jpeg (raw bytes)
Response 400: invalid or missing slide/options
Response 500: render failure
```

Contract notes:

- `slide.width` and `slide.height` remain the logical layout coordinate space.
- `width` and `height` control the output raster size only.
- `fit: "contain"` preserves aspect ratio and shows the full slide with letterboxing when needed.
- `fit: "cover"` preserves aspect ratio and fills the output frame by cropping overflow.
- `fit: "stretch"` scales X and Y independently to exactly match the output size.
- Absolute URLs and `data:` URLs work without `assetBaseUrl`.
- Root-relative or relative asset URLs require `assetBaseUrl`.
- Local filesystem path serving is out of scope for this endpoint.

Caller still provides compiled layout IR. The route stays focused on rendering, not scene compilation or slug lookup.

## Architecture

### HTML Generation

Deterministic helper: `(slide, options) -> string`

1. `ReactDOMServer.renderToStaticMarkup()` renders `<LayoutSlideRenderer slide={slide} animationNone={true} />`
2. The markup is wrapped in a minimal HTML document containing:
   - a fixed-size output root sized to `width x height`
   - a positioned inner slide wrapper that scales the logical slide according to `fit`
   - a `<style>` block with `animations.css` content so continuous keyframes such as `float` and `pulse` still resolve
   - a Google Fonts `<link>` plus inline CSS custom properties for the project's `--font-*` variables
   - an optional `<base href="...">` when `assetBaseUrl` is supplied
3. Theme CSS is still not required because `LayoutSlideRenderer` consumes resolved values from the IR and emits inline styles.

### Render Readiness

Taking the screenshot immediately after `setContent()` is not reliable enough for scoring. Before capture, the renderer must wait for:

- `page.setContent(..., { waitUntil: "networkidle" })`
- `document.fonts.ready` so typography has settled
- all `<img>` elements to either decode or fail

This keeps the first scored render from accidentally using fallback fonts or half-loaded images.

### Browser Management

Singleton Playwright Chromium with page reuse:

- lazy init on first render request
- one reusable page for the common case
- page recreation when `deviceScaleFactor` changes
- serial access through a small in-process queue so concurrent requests do not mutate the same page at once
- 10s guard on content load + screenshot
- graceful cleanup on process exit / SIGTERM

Performance target remains roughly:

- first render: browser launch + font load
- subsequent renders: one `setContent()` + readiness wait + screenshot

### Asset Handling

The route should support normal web-style slide assets without becoming a file server.

- Absolute URLs: supported as-is
- `data:` URLs: supported as-is
- Root-relative and relative URLs: supported when `assetBaseUrl` is provided
- Local filesystem paths: not supported

In practice, the HTML builder can inject a `<base>` tag or rewrite URLs against `assetBaseUrl` before calling `page.setContent()`.

### File Organization

- `src/app/api/render/route.ts` — thin route handler
- `src/lib/render/fonts.ts` — shared font URL + `--font-*` mappings
- `src/lib/render/html.ts` — HTML builder + fit/base-url handling
- `src/lib/render/screenshot.ts` — browser lifecycle + `renderSlideToImage()`

Core logic lives in `src/lib/render/` so refinement loops, tests, and scripts can reuse it without going through HTTP.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Standalone vs embedded in SSE | Standalone endpoint | Composable, testable, callable N times during refinement |
| Rendering approach | SSR React + `setContent()` | Reuses the real `LayoutRenderer` without navigation overhead |
| Output sizing | Arbitrary `width` / `height` plus `fit` | Generic enough for previews, scoring, and exports without redefining slide coordinates |
| Browser library | Playwright via `@playwright/test` | Already present in the repo |
| Font loading | Google Fonts + explicit `document.fonts.ready` wait | Keeps typography stable before scoring |
| Asset support | `assetBaseUrl` for root-relative assets | Covers project-style web assets without adding filesystem serving |
| Scope | Single slide | Matches the extraction/refinement loop |

## Non-Goals

- Multi-slide batch rendering
- Composite scoring or pixel diffing
- Block extraction regression gating
- Serving arbitrary local filesystem assets
