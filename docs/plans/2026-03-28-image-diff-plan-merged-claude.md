# Image Diff Library Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `compareImages()` library function that takes two image buffers and returns a mismatch ratio, diff heatmap PNG, and mismatch region bounding boxes.

**Architecture:** Decode both images to raw RGBA via `sharp`, run per-pixel delta comparison (same algorithm as `scripts/slide-diff.mjs`), extract top-N mismatch regions via tile-based flood-fill grouping, encode diff image back to PNG via `sharp`. No Playwright dependency — pure Node image processing.

**Tech Stack:** `sharp` (^0.34.5, already installed), Vitest

**Design doc:** `docs/plans/2026-03-28-image-diff-design.md`

## Locked Decisions

These are part of the spec and should not be revisited during implementation:

- Build `src/lib/render/compare.ts` as a reusable library, not an API route.
- Keep `/api/render` and `src/lib/render/screenshot.ts` unchanged in this step.
- Do not use Playwright for diffing.
- Do not resize one image to match the other; dimension mismatch is a hard error.
- Do not refactor `scripts/slide-diff.mjs` in this step — it is plain JS executed as `node scripts/slide-diff.mjs`; importing a new TS module would require tooling changes.
- Model-facing output stays simple: `mismatchRatio`, `mismatchPixels`, `diffImage`, `regions`.
- Support PNG, JPEG, and WebP inputs through `sharp`.
- Preserve the existing `slide-diff.mjs` heatmap appearance:
  - mismatch pixel: `255, 64, 64, 255`
  - matched pixel: grayscale of the original pixel, alpha `40`

---

### Task 1: Core pixel diff + diff image

The foundation: decode two images, compare pixels, produce a diff heatmap and mismatch stats. Region extraction is stubbed as `[]` and implemented in Task 2.

**Files:**
- Create: `src/lib/render/compare.ts`
- Test: `src/lib/render/compare.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { compareImages } from "./compare";

/** Create a solid-color PNG buffer. */
async function solidPng(
  width: number,
  height: number,
  color: { r: number; g: number; b: number; alpha?: number },
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: color.r, g: color.g, b: color.b, alpha: color.alpha ?? 1 },
    },
  })
    .png()
    .toBuffer();
}

describe("compareImages", () => {
  it("returns zero mismatch for identical images", async () => {
    const img = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const result = await compareImages(img, img);
    expect(result.mismatchRatio).toBe(0);
    expect(result.mismatchPixels).toBe(0);
    expect(result.totalPixels).toBe(10000);
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
    expect(result.regions).toEqual([]);
  });

  it("returns full mismatch for completely different images", async () => {
    const red = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const blue = await solidPng(100, 100, { r: 0, g: 0, b: 255 });
    const result = await compareImages(red, blue);
    expect(result.mismatchRatio).toBe(1);
    expect(result.mismatchPixels).toBe(10000);
  });

  it("produces a valid PNG diff image with correct dimensions", async () => {
    const red = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const blue = await solidPng(100, 100, { r: 0, g: 0, b: 255 });
    const result = await compareImages(red, blue);
    // PNG magic bytes
    expect(result.diffImage[0]).toBe(0x89);
    expect(result.diffImage[1]).toBe(0x50);
    const meta = await sharp(result.diffImage).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  it("uses threshold correctly — below threshold is no mismatch", async () => {
    const a = await solidPng(100, 100, { r: 100, g: 100, b: 100 });
    const b = await solidPng(100, 100, { r: 110, g: 100, b: 100 });
    // Delta is 10. Default threshold 24 -> no mismatch
    const loose = await compareImages(a, b);
    expect(loose.mismatchRatio).toBe(0);
    // Threshold 5 -> full mismatch
    const strict = await compareImages(a, b, { threshold: 5 });
    expect(strict.mismatchRatio).toBe(1);
  });

  it("throws on dimension mismatch", async () => {
    const a = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const b = await solidPng(200, 100, { r: 255, g: 0, b: 0 });
    await expect(compareImages(a, b)).rejects.toThrow(/dimension/i);
  });

  it("accepts JPEG input", async () => {
    const png = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const jpeg = await sharp({
      create: {
        width: 100, height: 100, channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    }).jpeg({ quality: 100 }).toBuffer();
    // JPEG is lossy — allow small mismatch
    const result = await compareImages(png, jpeg);
    expect(result.mismatchRatio).toBeLessThan(0.05);
  });

  it("accepts WebP input", async () => {
    const png = await solidPng(100, 100, { r: 0, g: 128, b: 0 });
    const webp = await sharp({
      create: {
        width: 100, height: 100, channels: 4,
        background: { r: 0, g: 128, b: 0, alpha: 1 },
      },
    }).webp({ lossless: true }).toBuffer();
    const result = await compareImages(png, webp);
    expect(result.mismatchRatio).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- src/lib/render/compare.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```ts
import sharp from "sharp";

export interface DiffRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  mismatchRatio: number; // mismatch ratio within this region
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
  threshold?: number;   // per-channel delta tolerance (0–255, default: 24)
  maxRegions?: number;  // max mismatch regions to return (default: 5)
}

interface DecodedImage {
  data: Buffer;
  width: number;
  height: number;
}

async function decodeImage(buffer: Buffer): Promise<DecodedImage> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Compare two image buffers and return a diff result.
 * Images must have the same pixel dimensions.
 * Accepts any format sharp can decode (PNG, JPEG, WebP).
 */
export async function compareImages(
  original: Buffer,
  replica: Buffer,
  options: DiffOptions = {},
): Promise<DiffResult> {
  const { threshold = 24, maxRegions = 5 } = options;

  const orig = await decodeImage(original);
  const repl = await decodeImage(replica);

  if (orig.width !== repl.width || orig.height !== repl.height) {
    throw new Error(
      `Dimension mismatch: original ${orig.width}×${orig.height}, ` +
        `replica ${repl.width}×${repl.height}`,
    );
  }

  const { width, height } = orig;
  const totalPixels = width * height;
  const diffData = Buffer.alloc(totalPixels * 4);
  let mismatchPixels = 0;

  // Per-pixel comparison — same algorithm as scripts/slide-diff.mjs
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const dr = Math.abs(orig.data[offset] - repl.data[offset]);
    const dg = Math.abs(orig.data[offset + 1] - repl.data[offset + 1]);
    const db = Math.abs(orig.data[offset + 2] - repl.data[offset + 2]);
    const da = Math.abs(orig.data[offset + 3] - repl.data[offset + 3]);
    const delta = Math.max(dr, dg, db, da);

    if (delta > threshold) {
      mismatchPixels++;
      diffData[offset] = 255;     // R
      diffData[offset + 1] = 64;  // G
      diffData[offset + 2] = 64;  // B
      diffData[offset + 3] = 255; // A
    } else {
      // Grayscale of original pixel at low alpha — faded context
      const tone = Math.round(
        (orig.data[offset] + orig.data[offset + 1] + orig.data[offset + 2]) / 3,
      );
      diffData[offset] = tone;
      diffData[offset + 1] = tone;
      diffData[offset + 2] = tone;
      diffData[offset + 3] = 40;  // raw byte 40, matching slide-diff.mjs
    }
  }

  const diffImage = await sharp(diffData, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  // Region extraction stubbed — implemented in Task 2
  const regions = extractMismatchRegions(
    orig.data, repl.data, width, height, threshold, maxRegions,
  );

  return {
    mismatchRatio: totalPixels > 0 ? mismatchPixels / totalPixels : 0,
    mismatchPixels,
    totalPixels,
    diffImage,
    regions,
    width,
    height,
  };
}

// Stub — replaced in Task 2
function extractMismatchRegions(
  _origData: Buffer,
  _replData: Buffer,
  _width: number,
  _height: number,
  _threshold: number,
  _maxRegions: number,
): DiffRegion[] {
  return [];
}
```

**Step 4: Run tests to verify they pass**

Run: `bun run test -- src/lib/render/compare.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(render): add compareImages() with pixel diff and heatmap
```

---

### Task 2: Tile-based mismatch region extraction

Replace the stub with tile-based flood-fill grouping. Divides the image into a 32×32 tile grid, marks hot tiles by dual threshold, flood-fills adjacent hot tiles into connected regions, returns top N sorted by mismatch severity.

**Files:**
- Modify: `src/lib/render/compare.ts`
- Modify: `src/lib/render/compare.test.ts`

**Step 1: Add failing tests**

Append to the existing test file:

```ts
describe("mismatch regions", () => {
  it("returns no regions for identical images", async () => {
    const img = await solidPng(200, 200, { r: 255, g: 0, b: 0 });
    const result = await compareImages(img, img);
    expect(result.regions).toEqual([]);
  });

  it("detects a localized mismatch region", async () => {
    // 200×200 red image with a 64×64 blue square at top-left
    const red = await solidPng(200, 200, { r: 255, g: 0, b: 0 });
    const blueSquare = await sharp({
      create: {
        width: 64, height: 64, channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    }).png().toBuffer();
    const modified = await sharp(red)
      .composite([{ input: blueSquare, left: 0, top: 0 }])
      .png()
      .toBuffer();

    const result = await compareImages(red, modified);
    expect(result.regions.length).toBeGreaterThan(0);
    // Top region should overlap the top-left changed area
    const topRegion = result.regions[0];
    expect(topRegion.x).toBeLessThanOrEqual(0);
    expect(topRegion.y).toBeLessThanOrEqual(0);
    expect(topRegion.x + topRegion.w).toBeGreaterThanOrEqual(64);
    expect(topRegion.y + topRegion.h).toBeGreaterThanOrEqual(64);
    expect(topRegion.mismatchRatio).toBeGreaterThan(0.5);
  });

  it("detects separated mismatch areas as distinct regions", async () => {
    // 400×200 red image with two blue squares far apart
    const red = await solidPng(400, 200, { r: 255, g: 0, b: 0 });
    const blueSquare = await sharp({
      create: {
        width: 64, height: 64, channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    }).png().toBuffer();
    const modified = await sharp(red)
      .composite([
        { input: blueSquare, left: 0, top: 0 },
        { input: blueSquare, left: 336, top: 136 },
      ])
      .png()
      .toBuffer();

    const result = await compareImages(red, modified);
    expect(result.regions.length).toBeGreaterThanOrEqual(2);
  });

  it("respects maxRegions", async () => {
    const red = await solidPng(400, 200, { r: 255, g: 0, b: 0 });
    const blueSquare = await sharp({
      create: {
        width: 64, height: 64, channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    }).png().toBuffer();
    const modified = await sharp(red)
      .composite([
        { input: blueSquare, left: 0, top: 0 },
        { input: blueSquare, left: 336, top: 136 },
      ])
      .png()
      .toBuffer();

    const result = await compareImages(red, modified, { maxRegions: 1 });
    expect(result.regions.length).toBe(1);
  });

  it("region mismatchRatio is the within-region ratio", async () => {
    const red = await solidPng(200, 200, { r: 255, g: 0, b: 0 });
    const blue = await solidPng(200, 200, { r: 0, g: 0, b: 255 });
    const result = await compareImages(red, blue);
    for (const region of result.regions) {
      expect(region.mismatchRatio).toBeGreaterThan(0);
      expect(region.mismatchRatio).toBeLessThanOrEqual(1);
    }
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run test -- src/lib/render/compare.test.ts`
Expected: FAIL — "detects a localized mismatch region" fails (regions is `[]`)

**Step 3: Replace the stub with the real implementation**

Replace the `extractMismatchRegions` function:

```ts
/**
 * Tile-based mismatch region extraction.
 *
 * 1. Divide image into TILE_SIZE × TILE_SIZE grid cells
 * 2. Compute per-tile mismatch count and ratio
 * 3. Mark tiles as "hot" if EITHER:
 *    - tileMismatchRatio >= TILE_DENSITY_THRESHOLD, OR
 *    - tileMismatchPixels >= TILE_PIXEL_THRESHOLD
 * 4. Flood-fill 4-connected hot tiles into regions
 * 5. Sort regions by mismatchPixels desc, then ratio desc, then area desc
 * 6. Return top N
 */

const TILE_SIZE = 32;
const TILE_DENSITY_THRESHOLD = 0.08; // 8% of tile pixels must mismatch
const TILE_PIXEL_THRESHOLD = 64;     // or at least 64 mismatched pixels

function extractMismatchRegions(
  origData: Buffer,
  replData: Buffer,
  width: number,
  height: number,
  threshold: number,
  maxRegions: number,
): DiffRegion[] {
  const cols = Math.ceil(width / TILE_SIZE);
  const rows = Math.ceil(height / TILE_SIZE);
  const tileCount = rows * cols;

  // Step 1: compute per-tile mismatch stats
  const tileMismatchCount = new Uint32Array(tileCount);
  const tileTotalCount = new Uint32Array(tileCount);

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const x0 = tx * TILE_SIZE;
      const y0 = ty * TILE_SIZE;
      const x1 = Math.min(x0 + TILE_SIZE, width);
      const y1 = Math.min(y0 + TILE_SIZE, height);
      const tilePixels = (x1 - x0) * (y1 - y0);
      let mismatch = 0;

      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const offset = (py * width + px) * 4;
          const dr = Math.abs(origData[offset] - replData[offset]);
          const dg = Math.abs(origData[offset + 1] - replData[offset + 1]);
          const db = Math.abs(origData[offset + 2] - replData[offset + 2]);
          const da = Math.abs(origData[offset + 3] - replData[offset + 3]);
          if (Math.max(dr, dg, db, da) > threshold) {
            mismatch++;
          }
        }
      }

      const idx = ty * cols + tx;
      tileMismatchCount[idx] = mismatch;
      tileTotalCount[idx] = tilePixels;
    }
  }

  // Step 2: determine hot tiles (dual threshold)
  const hot = new Uint8Array(tileCount);
  for (let i = 0; i < tileCount; i++) {
    const ratio = tileTotalCount[i] > 0 ? tileMismatchCount[i] / tileTotalCount[i] : 0;
    if (ratio >= TILE_DENSITY_THRESHOLD || tileMismatchCount[i] >= TILE_PIXEL_THRESHOLD) {
      hot[i] = 1;
    }
  }

  // Step 3: flood-fill 4-connected hot tiles into regions
  const visited = new Uint8Array(tileCount);
  const regions: DiffRegion[] = [];

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const idx = ty * cols + tx;
      if (visited[idx] || !hot[idx]) continue;

      let minTx = tx, maxTx = tx, minTy = ty, maxTy = ty;
      let regionMismatch = 0;
      let regionPixels = 0;
      const queue = [idx];
      visited[idx] = 1;

      while (queue.length > 0) {
        const ci = queue.pop()!;
        const cy = Math.floor(ci / cols);
        const cx = ci % cols;

        minTx = Math.min(minTx, cx);
        maxTx = Math.max(maxTx, cx);
        minTy = Math.min(minTy, cy);
        maxTy = Math.max(maxTy, cy);

        regionMismatch += tileMismatchCount[ci];
        regionPixels += tileTotalCount[ci];

        // 4-connected neighbors
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          const ni = ny * cols + nx;
          if (!visited[ni] && hot[ni]) {
            visited[ni] = 1;
            queue.push(ni);
          }
        }
      }

      const regionX = minTx * TILE_SIZE;
      const regionY = minTy * TILE_SIZE;
      const regionW = Math.min((maxTx + 1) * TILE_SIZE, width) - regionX;
      const regionH = Math.min((maxTy + 1) * TILE_SIZE, height) - regionY;

      regions.push({
        x: regionX,
        y: regionY,
        w: regionW,
        h: regionH,
        mismatchRatio: regionPixels > 0 ? regionMismatch / regionPixels : 0,
      });
    }
  }

  // Step 4: sort by mismatchPixels desc, then ratio desc, then area desc
  regions.sort((a, b) => {
    const aMismatch = Math.round(a.mismatchRatio * a.w * a.h);
    const bMismatch = Math.round(b.mismatchRatio * b.w * b.h);
    if (bMismatch !== aMismatch) return bMismatch - aMismatch;
    if (b.mismatchRatio !== a.mismatchRatio) return b.mismatchRatio - a.mismatchRatio;
    return (b.w * b.h) - (a.w * a.h);
  });

  return regions.slice(0, maxRegions);
}
```

**Step 4: Run tests to verify they pass**

Run: `bun run test -- src/lib/render/compare.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(render): add tile-based mismatch region extraction
```

---

### Task 3: Verification and boundaries

Make sure nothing is broken and no out-of-scope changes were made.

**Files:**
- No changes

**Step 1: Run all render tests**

Run: `bun run test -- src/lib/render/`
Expected: All pass (html.test.ts, screenshot.test.ts, compare.test.ts)

**Step 2: Run lint**

Run: `bun run lint`
Expected: No new errors from render files

**Step 3: Confirm no out-of-scope changes**

This step should not have modified:

- `src/lib/render/screenshot.ts`
- `src/app/api/render/route.ts`
- `scripts/slide-diff.mjs`
- Extract UI components

**Step 4: Commit if lint fixes needed**

```
chore(render): lint fixes
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Core pixel diff + heatmap + stats (regions stubbed) | `src/lib/render/compare.ts`, `compare.test.ts` |
| 2 | Tile-based region extraction with dual threshold + multi-key sort | `src/lib/render/compare.ts`, `compare.test.ts` |
| 3 | Full test suite + lint verification | No file changes |

## Test Matrix

Minimum required coverage:

- identical PNG vs PNG
- full mismatch PNG vs PNG
- threshold below/above boundary
- dimension mismatch
- PNG vs JPEG
- PNG vs WebP
- localized changed block produces region
- separated mismatch clusters → distinct regions
- `maxRegions` caps output
- region `mismatchRatio` is within-region
- diff image encodes as valid PNG with expected dimensions

Nice-to-have if implementation is straightforward:

- partially transparent images
- mismatch on alpha-only changes

## Assumptions

- `sharp` ^0.34.5 is already installed.
- Dimension mismatch is a hard error, not an implicit resize.
- Match pixel alpha is raw byte `40` (matching `slide-diff.mjs`), not `102`.
- Region extraction is approximate and tile-based by design — it guides critique, not serves as a second score.
- This step does not add API routes, UI wiring, Playwright compare pages, or `slide-diff.mjs` refactoring.
