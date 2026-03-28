# Design: Image Diff Library

> Step 5 of the v11 feedback loop plan (see `docs/2026-03-26-discussion-v11.md`)

## Context

The render endpoint (step 4) already produces a raster image from compiled layout IR. The next step is to compare that rendered replica against the original reference image and produce feedback that both the user and the model can act on.

The original discussion proposed composite scoring (blurred similarity, edge-map similarity, color histograms, worst-region crops). After further review, we decided that these are useful internal analysis primitives at most, but they are not good **model-facing** feedback. Claude and similar models respond better to perceptual evidence than to scientific-looking subscores.

The model-facing output should stay simple:

1. A **diff heatmap** image — shows where the visible mismatches are
2. A **mismatch ratio** — a scalar gate for "keep iterating or stop"
3. A small set of **mismatch regions** — bboxes for the largest mismatch blobs

The project already has the core diff algorithm in `scripts/slide-diff.mjs`, but that script mixes several concerns:

- page navigation
- slide screenshot capture
- image decoding
- per-pixel comparison
- artifact writing

Step 5 should extract the image comparison part into a reusable library.

## Current Rendering Paths

It is important to distinguish the current runtime surfaces:

- **Presentation preview page:** renders slides as normal DOM via `LayoutSlideRenderer` inside `SlideEngine`
- **Extract page replica tab:** compiles the proposal client-side, then renders it as normal DOM via `LayoutSlideRenderer`
- **Render API (`/api/render`):** renders the slide DOM in headless Chromium and screenshots it to PNG

There is currently **no client-side canvas renderer** for slides. The preview surfaces feel canvas-like because the DOM slide is uniformly scaled with CSS transforms, but they are still DOM trees, not `<canvas>` bitmaps.

This distinction matters because:

- **diffing pixels is easy**
- **turning the rendered slide DOM into a faithful image is the hard part**

That is why the render-to-image path still relies on Playwright today, even if the diff step itself does not need to.

## Terminology

To avoid ambiguity:

- **Playwright-side comparison** means server code uses headless Chromium pages to decode images and run canvas diff logic
- **Non-Playwright comparison** means the diff runs without Chromium page automation
- **In-browser comparison** means the diff runs in the user's actual browser tab

Playwright-side comparison does use a browser engine, but it is still a **server-side automation path**, not a client-browser path.

## Requirements

The image diff layer should satisfy these requirements:

1. **Simple model-facing feedback**
   - return a heatmap, one scalar gate, and mismatch regions
   - do not expose multiple scientific-looking subscores to the model

2. **No coupling to the mutable render worker page**
   - the current render implementation uses one mutable singleton page for rendering
   - compare should not rely on mutating that same page

3. **Support real extract inputs**
   - reference images may be PNG, JPEG, or WebP
   - candidate images come from the render endpoint as PNG

4. **Fast enough for iterative refinement**
   - comparison should not become the bottleneck

5. **Future portability**
   - long term, users may run the whole extraction/refinement flow locally in their own browser
   - the diff core should be reusable in that future architecture

## API Contract

Library function, not an HTTP endpoint. Called in-process by the refinement loop (step 6) and potentially wrapped in a route later.

```ts
interface DiffRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  mismatchRatio: number;
}

interface DiffResult {
  mismatchRatio: number;     // 0–1, fraction of pixels that differ
  mismatchPixels: number;    // raw count
  totalPixels: number;
  diffImage: Buffer;         // PNG — red heatmap on faded grayscale
  regions: DiffRegion[];     // largest mismatch blobs / regions
  width: number;
  height: number;
}

interface DiffOptions {
  threshold?: number;        // per-channel delta tolerance (0–255, default: 24)
  maxRegions?: number;       // default: 5
}

function compareImages(
  original: Buffer,          // reference image buffer (PNG/JPEG/WebP)
  replica: Buffer,           // rendered replica image buffer
  options?: DiffOptions,
): Promise<DiffResult>;
```

### Dimension handling

The comparison function should require the two images to be in the same raster dimensions and fail if they do not match.

We do **not** auto-resize one image to the other for scoring. Resampling changes the score semantics and can hide aspect-ratio, crop, or canvas-size regressions that the refinement loop should catch.

If a caller needs resizing for some future UI-only use case, that should be an explicit preprocessing step outside the scoring function.

### Consumers

- **Refinement loop (step 6):** calls `compareImages()`, checks `mismatchRatio` against a threshold to decide whether to iterate, sends `diffImage` plus mismatch regions to Claude as visual feedback
- **Extract UI:** displays `mismatchRatio` as a badge and shows the heatmap / mismatch regions

## Core Algorithm

The core algorithm stays intentionally simple and matches the existing `slide-diff.mjs` behavior:

1. Decode both images to raw RGBA pixel data
2. Require same width and height
3. For each pixel: `delta = max(|dr|, |dg|, |db|, |da|)`
4. If `delta > threshold`: mark as mismatch, paint red (`#ff4040`, full alpha) in the diff image
5. Otherwise: paint grayscale average of the reference pixel at 40% alpha
6. Compute `mismatchPixels`, `mismatchRatio`, and the diff PNG
7. Extract connected or tile-grouped mismatch regions and return the top N by area / mismatch density

The mismatch regions are supplementary structure, not a second scoring system. They help the model focus on the largest error areas without introducing a large taxonomy of scores.

## Options Considered

### Option A: Server-side Playwright diff on a separate compare page

Implementation:

- keep using headless Chromium
- create a dedicated compare page in the shared browser
- load both images as data URLs
- run the existing canvas diff logic via `page.evaluate()`

Pros:

- lowest implementation risk
- reuses the proven browser-canvas approach from `slide-diff.mjs`
- no new image-processing dependency
- browser image decoding naturally supports common web formats

Cons:

- slower than necessary for the diff step
- still coupled to Playwright and browser lifecycle management
- requires a separate compare page to avoid interference with the mutable render page
- less reusable for a future browser-only architecture

Notes:

- if this option were chosen, compare must use a **separate page** in the shared browser, not the renderer's singleton page
- reusing the same page would couple diffing to `setContent()` / viewport mutation in the render worker and make the system harder to reason about

### Option B: Server-side non-Playwright diff

Implementation:

- keep the current Playwright render-to-image path
- decode both image buffers directly in Node
- run the pixel diff in Node
- encode the diff image back to PNG in Node

Pros:

- fastest server-side diff option
- clean separation of concerns: Playwright renders, diff library compares
- easier unit testing
- avoids page / queue / browser-state coupling
- better foundation for a future browser-local diff core

Cons:

- requires an image-processing dependency
- still server-side for now

### Option C: Client-browser-side non-Playwright diff

Implementation:

- run diff logic directly in the user's browser tab
- draw the original image and candidate image/canvas into canvases
- compare `ImageData` in page JS

Pros:

- best fit for a long-term no-server workflow
- avoids server work for comparison
- diff core maps naturally to browser canvas APIs

Cons:

- does not solve the hard problem of browser-side render-to-image
- only becomes truly useful once candidate rendering/rasterization is also browser-local
- not the most practical primary path for the current architecture

## Decision

Choose **Option B: server-side non-Playwright diff**.

### Why this route

1. **Diffing does not require a browser once the candidate image already exists**

   The candidate image is already produced by the render endpoint. At that point, comparison is just image processing.

2. **It is faster than Playwright-side diff**

   A non-Playwright diff avoids:

   - data URL conversion
   - `page.evaluate()` round-trips
   - compare-page management
   - queueing behind Chromium page work

3. **It keeps the architecture clean**

   The current render path should remain responsible for one thing: faithfully converting slide DOM into pixels.

   The diff path should remain responsible for one thing: comparing two pixel buffers.

4. **It is a better stepping stone toward a browser-only future**

   Long term, we may want:

   - AI calls from the user's browser with their own credentials
   - local proposal compilation
   - local slide preview
   - local diffing

   A pure image-diff core is easier to reuse in that future than a Playwright-coupled compare implementation.

5. **The truly difficult browser-local problem is render-to-image, not diff**

   We should not over-couple the diff design to the current server-side rendering mechanism.

## Dependency Choice

For the server-side non-Playwright route, use a single image-processing dependency rather than multiple format-specific packages.

Recommended dependency:

- `sharp`

Why:

- supports PNG, JPEG, and WebP decode/encode
- supports raw RGBA output and PNG output
- keeps the implementation in one package

Alternative pure-JS stacks would require multiple packages and provide weaker performance / format coverage.

## Implementation Sketch

### File Organization

- `src/lib/render/compare.ts` — `compareImages()` function
- `src/lib/render/compare.test.ts` — unit tests

This lives in `src/lib/render/` because it is part of the render-and-score loop, but it should not depend on Playwright internals.

### Suggested internal structure

- `decodeImage(buffer) -> { data, width, height }`
- `buildDiffImage(original, replica, options) -> { diffData, mismatchPixels, mismatchRatio, regions }`
- `encodeDiffImage(rawRGBA, width, height) -> Buffer`
- `compareImages(original, replica, options) -> DiffResult`

### Relationship to `slide-diff.mjs`

The current script remains useful as a CLI workflow, but its logic is split conceptually:

- keep CLI/browser navigation concerns in the script
- move reusable diff logic into the new library

The algorithm is transferable; the Playwright-specific page/navigation code is not.

## Non-Goals

- HTTP endpoint (deferred to step 6 wiring)
- Composite scoring exposed directly to the model
- Replacing the render endpoint
- Solving browser-local render-to-image in this step
- Replacing `slide-diff.mjs` immediately
