# Image Diff Implementation Plan (Codex)

## Summary

Implement step 5 as a **server-side non-Playwright image diff library** using `sharp`, with a small, model-friendly output contract:

- `mismatchRatio`
- `mismatchPixels`
- `diffImage` PNG heatmap
- `regions` for the largest mismatch areas

Keep the existing Playwright render-to-image path unchanged. Do **not** add a new route or UI wiring in this step. Do **not** refactor `scripts/slide-diff.mjs` yet, because it currently runs as plain Node JS and importing a new TypeScript library would add avoidable tooling churn.

## Key Changes

### 1. Add a reusable image diff library

Create `src/lib/render/compare.ts` with these exported types and function:

```ts
export interface DiffRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  mismatchRatio: number;
}

export interface DiffResult {
  mismatchRatio: number;
  mismatchPixels: number;
  totalPixels: number;
  diffImage: Buffer;
  regions: DiffRegion[];
  width: number;
  height: number;
}

export interface DiffOptions {
  threshold?: number;
  maxRegions?: number;
}

export async function compareImages(
  original: Buffer,
  replica: Buffer,
  options?: DiffOptions,
): Promise<DiffResult>;
```

Behavior is decision-complete:

- Default `threshold = 24`
- Default `maxRegions = 5`
- Accept any input format `sharp` can decode; in practice this step must support PNG, JPEG, and WebP
- Decode both inputs with `sharp(...).ensureAlpha().raw().toBuffer({ resolveWithObject: true })`
- Require equal `width` and `height`; if they differ, throw an `Error` with a clear dimension-mismatch message
- Compare pixels with the same rule as `slide-diff.mjs`:
  - `delta = max(|dr|, |dg|, |db|, |da|)`
  - mismatch if `delta > threshold`
- Build the diff image in RGBA:
  - mismatch pixel: `255, 64, 64, 255`
  - match pixel: grayscale average of the **original/reference** RGB with alpha `102` (40%)
- Encode `diffImage` back to PNG with `sharp`

### 2. Add mismatch-region extraction

Keep the scalar score simple, but return focused regions to make downstream critique more actionable.

Implementation choice:

- Use a **tile-grouped region pass**, not pixel-level connected components
- Divide the image into `64x64` tiles
- For each tile, compute:
  - `tileMismatchPixels`
  - `tileTotalPixels`
  - `tileMismatchRatio`
- Mark a tile as “hot” if either condition holds:
  - `tileMismatchRatio >= 0.08`
  - `tileMismatchPixels >= 128`
- Run **4-connected component grouping** over hot tiles
- For each grouped region, compute:
  - bounding box in image coordinates
  - region mismatch pixels
  - region mismatch ratio = `regionMismatchPixels / regionTotalPixels`
- Sort regions by:
  1. descending `regionMismatchPixels`
  2. descending `regionMismatchRatio`
  3. descending area
- Return at most `maxRegions`

This keeps region extraction stable and cheap, avoids noisy pixel-level components from antialiasing, and stays aligned with the “large mismatch blobs” requirement.

### 3. Keep Playwright only for rendering

Do not change:

- `src/lib/render/screenshot.ts`
- `/api/render`
- the persistent headless Chromium render worker

The boundary after this step is:

- Playwright renders slide DOM into a candidate image buffer
- `compareImages()` compares image buffers in pure Node

That separation is an explicit architectural goal of the implementation.

### 4. Leave `scripts/slide-diff.mjs` unchanged in this step

Do **not** refactor the CLI script yet.

Reason:

- it is currently executed as `node scripts/slide-diff.mjs`
- importing a new TS module from that script would require extra tooling or script-runner changes
- step 5 should deliver the reusable comparison library first, without broadening scope into CLI/runtime changes

Follow-up work can later decide whether to:
- migrate the script to Bun/TS-aware execution and reuse the library
- or keep the script standalone

## Test Plan

Create `src/lib/render/compare.test.ts` with unit tests only. Use synthetic images generated in-memory; do not add fixture files.

Required tests:

1. `returns zero mismatch for identical images`
- generate a simple PNG with `sharp`
- compare it to itself
- assert `mismatchPixels = 0`, `mismatchRatio = 0`, no regions, diff buffer is PNG

2. `counts mismatches for a localized changed block`
- create two same-size images
- change a single rectangle in the replica
- assert mismatch is nonzero
- assert at least one region exists
- assert the top region bbox overlaps the changed rectangle

3. `uses threshold correctly`
- create images that differ by a small per-channel amount below threshold
- assert zero mismatch
- create images that differ above threshold
- assert nonzero mismatch

4. `fails on dimension mismatch`
- compare two different-sized images
- assert rejection with a clear dimension error
- do not resize implicitly

5. `accepts JPEG and WebP inputs`
- generate or transcode synthetic images into PNG/JPEG/WebP
- compare cross-format images with the same pixels
- assert correct decode and expected mismatch results

6. `produces a valid PNG diff buffer`
- compare two different images
- assert the returned `diffImage` starts with PNG signature bytes
- optionally parse width/height from the PNG header and assert they match the source size

7. `respects maxRegions`
- create multiple separated mismatch areas
- assert the result caps output at the requested region count

Test command coverage for implementation completion:

- `bun run test -- src/lib/render/compare.test.ts`
- optionally `bun run test` if there are no unrelated failures

## Assumptions and Defaults

- `sharp` is already installed and is the only new dependency used by this step.
- The current scalar gate remains `mismatchRatio`; no additional model-facing subscores are introduced.
- Dimension mismatch is a hard error, not an implicit resize.
- Region extraction is approximate and tile-based by design; it is meant to guide critique, not serve as a second authoritative score.
- This step does not add:
  - a new API route
  - extract UI wiring
  - Playwright compare pages
  - browser-side diffing
  - `slide-diff.mjs` refactoring
