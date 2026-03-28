import sharp from "sharp";

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

interface DecodedImage {
  data: Buffer;
  width: number;
  height: number;
}

interface RankedRegion extends DiffRegion {
  mismatchPixels: number;
}

const DEFAULT_THRESHOLD = 24;
const DEFAULT_MAX_REGIONS = 5;
const TILE_SIZE = 32;
const TILE_DENSITY_THRESHOLD = 0.08;
const TILE_PIXEL_THRESHOLD = 64;

async function decodeImage(buffer: Buffer): Promise<DecodedImage> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
  };
}

function computePixelDelta(
  a: Buffer,
  b: Buffer,
  offset: number,
): number {
  const dr = Math.abs(a[offset] - b[offset]);
  const dg = Math.abs(a[offset + 1] - b[offset + 1]);
  const db = Math.abs(a[offset + 2] - b[offset + 2]);
  const da = Math.abs(a[offset + 3] - b[offset + 3]);

  return Math.max(dr, dg, db, da);
}

function buildDiffData(
  original: Buffer,
  replica: Buffer,
  width: number,
  height: number,
  threshold: number,
): { diffData: Buffer; mismatchPixels: number } {
  const totalPixels = width * height;
  const diffData = Buffer.alloc(totalPixels * 4);
  let mismatchPixels = 0;

  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    const delta = computePixelDelta(original, replica, offset);

    if (delta > threshold) {
      mismatchPixels += 1;
      diffData[offset] = 255;
      diffData[offset + 1] = 64;
      diffData[offset + 2] = 64;
      diffData[offset + 3] = 255;
      continue;
    }

    const tone = Math.round(
      (original[offset] + original[offset + 1] + original[offset + 2]) / 3,
    );
    diffData[offset] = tone;
    diffData[offset + 1] = tone;
    diffData[offset + 2] = tone;
    diffData[offset + 3] = 40;
  }

  return { diffData, mismatchPixels };
}

function extractMismatchRegions(
  original: Buffer,
  replica: Buffer,
  width: number,
  height: number,
  threshold: number,
  maxRegions: number,
): DiffRegion[] {
  const cols = Math.ceil(width / TILE_SIZE);
  const rows = Math.ceil(height / TILE_SIZE);
  const tileCount = rows * cols;
  const tileMismatchCount = new Uint32Array(tileCount);
  const tileTotalCount = new Uint32Array(tileCount);
  const hot = new Uint8Array(tileCount);
  const visited = new Uint8Array(tileCount);

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
          if (computePixelDelta(original, replica, offset) > threshold) {
            mismatch += 1;
          }
        }
      }

      const idx = ty * cols + tx;
      tileMismatchCount[idx] = mismatch;
      tileTotalCount[idx] = tilePixels;

      const mismatchRatio = tilePixels > 0 ? mismatch / tilePixels : 0;
      if (
        mismatchRatio >= TILE_DENSITY_THRESHOLD ||
        mismatch >= TILE_PIXEL_THRESHOLD
      ) {
        hot[idx] = 1;
      }
    }
  }

  const regions: RankedRegion[] = [];

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const startIdx = ty * cols + tx;
      if (visited[startIdx] || !hot[startIdx]) continue;

      let minTx = tx;
      let maxTx = tx;
      let minTy = ty;
      let maxTy = ty;
      let regionMismatchPixels = 0;
      let regionTotalPixels = 0;
      const queue = [startIdx];
      visited[startIdx] = 1;

      while (queue.length > 0) {
        const idx = queue.pop()!;
        const cy = Math.floor(idx / cols);
        const cx = idx % cols;

        minTx = Math.min(minTx, cx);
        maxTx = Math.max(maxTx, cx);
        minTy = Math.min(minTy, cy);
        maxTy = Math.max(maxTy, cy);
        regionMismatchPixels += tileMismatchCount[idx];
        regionTotalPixels += tileTotalCount[idx];

        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

          const neighborIdx = ny * cols + nx;
          if (!visited[neighborIdx] && hot[neighborIdx]) {
            visited[neighborIdx] = 1;
            queue.push(neighborIdx);
          }
        }
      }

      const x = minTx * TILE_SIZE;
      const y = minTy * TILE_SIZE;
      const w = Math.min((maxTx + 1) * TILE_SIZE, width) - x;
      const h = Math.min((maxTy + 1) * TILE_SIZE, height) - y;

      regions.push({
        x,
        y,
        w,
        h,
        mismatchPixels: regionMismatchPixels,
        mismatchRatio: regionTotalPixels > 0
          ? regionMismatchPixels / regionTotalPixels
          : 0,
      });
    }
  }

  regions.sort((a, b) => {
    if (b.mismatchPixels !== a.mismatchPixels) {
      return b.mismatchPixels - a.mismatchPixels;
    }
    if (b.mismatchRatio !== a.mismatchRatio) {
      return b.mismatchRatio - a.mismatchRatio;
    }
    return b.w * b.h - a.w * a.h;
  });

  return regions.slice(0, maxRegions).map((region) => ({
    x: region.x,
    y: region.y,
    w: region.w,
    h: region.h,
    mismatchRatio: region.mismatchRatio,
  }));
}

export async function compareImages(
  original: Buffer,
  replica: Buffer,
  options: DiffOptions = {},
): Promise<DiffResult> {
  const { threshold = DEFAULT_THRESHOLD, maxRegions = DEFAULT_MAX_REGIONS } = options;

  const [orig, repl] = await Promise.all([
    decodeImage(original),
    decodeImage(replica),
  ]);

  if (orig.width !== repl.width || orig.height !== repl.height) {
    throw new Error(
      `Dimension mismatch: original ${orig.width}x${orig.height}, replica ${repl.width}x${repl.height}`,
    );
  }

  const { width, height } = orig;
  const totalPixels = width * height;
  const { diffData, mismatchPixels } = buildDiffData(
    orig.data,
    repl.data,
    width,
    height,
    threshold,
  );
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
