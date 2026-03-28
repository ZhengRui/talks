# Image Diff Library Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `compareImages()` library function that takes two image buffers and returns a mismatch ratio, diff heatmap PNG, and mismatch region bounding boxes.

**Architecture:** Decode both images to raw RGBA via `sharp`, run per-pixel delta comparison (same algorithm as `scripts/slide-diff.mjs`), extract top-N mismatch regions via tile-based grouping, encode diff image back to PNG via `sharp`. No Playwright dependency — pure Node image processing.

**Tech Stack:** `sharp` (^0.34.5, already installed), Vitest

**Design doc:** `docs/plans/2026-03-28-image-diff-design.md`

---

### Task 1: Core pixel diff + diff image

The foundation: decode two images, compare pixels, produce a diff heatmap and mismatch stats.

**Files:**
- Create: `src/lib/render/compare.ts`
- Test: `src/lib/render/compare.test.ts`

**Step 1: Write the failing test**

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
  it("returns 0 mismatch for identical images", async () => {
    const img = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const result = await compareImages(img, img);
    expect(result.mismatchRatio).toBe(0);
    expect(result.mismatchPixels).toBe(0);
    expect(result.totalPixels).toBe(10000);
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
  });

  it("returns 1.0 mismatch for completely different images", async () => {
    const red = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const blue = await solidPng(100, 100, { r: 0, g: 0, b: 255 });
    const result = await compareImages(red, blue);
    expect(result.mismatchRatio).toBe(1);
    expect(result.mismatchPixels).toBe(10000);
  });

  it("returns a valid PNG diff image", async () => {
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

  it("respects threshold", async () => {
    const a = await solidPng(100, 100, { r: 100, g: 100, b: 100 });
    const b = await solidPng(100, 100, { r: 110, g: 100, b: 100 });
    // Delta is 10. Threshold 24 (default) -> no mismatch
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

  it("supports JPEG input", async () => {
    const png = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const jpeg = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .jpeg({ quality: 100 })
      .toBuffer();
    // JPEG is lossy, so allow some mismatch, but it should be very low
    const result = await compareImages(png, jpeg);
    expect(result.mismatchRatio).toBeLessThan(0.05);
  });
});
```

**Step 2: Run test to verify it fails**

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
  const image = sharp(buffer).ensureAlpha();
  const { width, height } = await image.metadata();
  if (!width || !height) {
    throw new Error("Failed to read image dimensions");
  }
  const data = await image.raw().toBuffer();
  return { data, width, height };
}

/**
 * Compare two image buffers and return a diff result.
 * Images must have the same dimensions.
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
      const tone = Math.round(
        (orig.data[offset] + orig.data[offset + 1] + orig.data[offset + 2]) / 3,
      );
      diffData[offset] = tone;
      diffData[offset + 1] = tone;
      diffData[offset + 2] = tone;
      diffData[offset + 3] = 40;
    }
  }

  const diffImage = await sharp(diffData, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  const regions = extractMismatchRegions(
    orig.data,
    repl.data,
    width,
    height,
    threshold,
    maxRegions,
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
```

Note: `extractMismatchRegions` is stubbed as returning `[]` for now — it's implemented in Task 2. Add a placeholder at the bottom of the file:

```ts
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

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/render/compare.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(render): add compareImages() with pixel diff and heatmap
```

---

### Task 2: Mismatch region extraction

Add tile-based grouping to find the largest mismatch areas. The approach: divide the image into a grid of tiles, compute per-tile mismatch density, then merge adjacent high-density tiles into bounding boxes.

**Files:**
- Modify: `src/lib/render/compare.ts`
- Modify: `src/lib/render/compare.test.ts`

**Step 1: Add failing tests**

Append to the existing test file:

```ts
describe("mismatch regions", () => {
  it("returns no regions for identical images", async () => {
    const img = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const result = await compareImages(img, img);
    expect(result.regions).toEqual([]);
  });

  it("returns regions for partially different images", async () => {
    // Create a 200x200 red image, overlay a 50x50 blue square at top-left
    const red = await solidPng(200, 200, { r: 255, g: 0, b: 0 });
    const blueSquare = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const modified = await sharp(red)
      .composite([{ input: blueSquare, left: 0, top: 0 }])
      .png()
      .toBuffer();

    const result = await compareImages(red, modified);
    expect(result.regions.length).toBeGreaterThan(0);
    // The top-left region should be detected
    const topLeft = result.regions[0];
    expect(topLeft.x).toBeLessThan(60);
    expect(topLeft.y).toBeLessThan(60);
    expect(topLeft.mismatchRatio).toBeGreaterThan(0.5);
  });

  it("respects maxRegions", async () => {
    const red = await solidPng(100, 100, { r: 255, g: 0, b: 0 });
    const blue = await solidPng(100, 100, { r: 0, g: 0, b: 255 });
    const result = await compareImages(red, blue, { maxRegions: 2 });
    expect(result.regions.length).toBeLessThanOrEqual(2);
  });

  it("region mismatchRatio is within-region ratio", async () => {
    const red = await solidPng(200, 200, { r: 255, g: 0, b: 0 });
    const blue = await solidPng(200, 200, { r: 0, g: 0, b: 255 });
    const result = await compareImages(red, blue);
    for (const region of result.regions) {
      // Every pixel in every region should mismatch
      expect(region.mismatchRatio).toBeGreaterThan(0);
      expect(region.mismatchRatio).toBeLessThanOrEqual(1);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/render/compare.test.ts`
Expected: FAIL — region tests fail (regions is always `[]`)

**Step 3: Implement `extractMismatchRegions`**

Replace the stub with the real implementation:

```ts
/**
 * Tile-based mismatch region extraction.
 *
 * 1. Divide image into TILE_SIZE × TILE_SIZE grid cells
 * 2. Compute per-tile mismatch ratio
 * 3. Mark tiles above a density threshold as "hot"
 * 4. Flood-fill to merge adjacent hot tiles into connected regions
 * 5. Return top N regions by area, sorted largest first
 */

const TILE_SIZE = 32;
const TILE_DENSITY_THRESHOLD = 0.1; // 10% of tile pixels must mismatch

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

  // Step 1: compute per-tile mismatch density
  const tileMismatch = new Float32Array(rows * cols);

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

      tileMismatch[ty * cols + tx] = mismatch / tilePixels;
    }
  }

  // Step 2: flood-fill adjacent hot tiles into connected regions
  const visited = new Uint8Array(rows * cols);
  const regions: DiffRegion[] = [];

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const idx = ty * cols + tx;
      if (visited[idx] || tileMismatch[idx] < TILE_DENSITY_THRESHOLD) continue;

      // BFS flood fill
      let minTx = tx, maxTx = tx, minTy = ty, maxTy = ty;
      let totalMismatch = 0;
      let totalPixels = 0;
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

        const x0 = cx * TILE_SIZE;
        const y0 = cy * TILE_SIZE;
        const x1 = Math.min(x0 + TILE_SIZE, width);
        const y1 = Math.min(y0 + TILE_SIZE, height);
        const tilePixels = (x1 - x0) * (y1 - y0);
        totalPixels += tilePixels;
        totalMismatch += Math.round(tileMismatch[ci] * tilePixels);

        // Visit 4-connected neighbors
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
          const ni = ny * cols + nx;
          if (!visited[ni] && tileMismatch[ni] >= TILE_DENSITY_THRESHOLD) {
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
        mismatchRatio: totalPixels > 0 ? totalMismatch / totalPixels : 0,
      });
    }
  }

  // Sort by area descending, return top N
  regions.sort((a, b) => b.w * b.h - a.w * a.h);
  return regions.slice(0, maxRegions);
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/render/compare.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(render): add tile-based mismatch region extraction
```

---

### Task 3: Verify full test suite and run existing tests

Make sure the new code doesn't break anything.

**Files:**
- No changes

**Step 1: Run all render-related tests**

Run: `bun run test -- src/lib/render/`
Expected: All tests pass (html.test.ts, screenshot.test.ts, compare.test.ts)

**Step 2: Run linting**

Run: `bun run lint`
Expected: No new errors from the render files

**Step 3: Commit (if any lint fixes needed)**

```
chore(render): lint fixes
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Core pixel diff + diff heatmap + stats | `src/lib/render/compare.ts`, `compare.test.ts` |
| 2 | Tile-based mismatch region extraction | `src/lib/render/compare.ts`, `compare.test.ts` |
| 3 | Full test suite verification | No file changes |
