import sharp from "sharp";
import type { CropBounds } from "@/lib/render/crop";

export interface RefineDiffCanvasSize {
  w: number;
  h: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export async function buildRefineDiffArtifactImage(
  referenceImage: Buffer,
  annotatedDiffImage: Buffer,
  canvasSize: RefineDiffCanvasSize,
  contentBounds: CropBounds | null | undefined,
): Promise<Buffer> {
  if (!contentBounds) {
    return annotatedDiffImage;
  }

  const background = await sharp(referenceImage)
    .resize(canvasSize.w, canvasSize.h)
    .grayscale()
    .ensureAlpha()
    .png()
    .toBuffer();

  const left = clamp(Math.round(contentBounds.x), 0, canvasSize.w);
  const top = clamp(Math.round(contentBounds.y), 0, canvasSize.h);

  return sharp(background)
    .composite([{ input: annotatedDiffImage, left, top }])
    .png()
    .toBuffer();
}
