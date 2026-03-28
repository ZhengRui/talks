import sharp from "sharp";

export interface CropBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function cropToContentBounds(
  image: Buffer,
  contentBounds: CropBounds | null | undefined,
): Promise<Buffer> {
  if (!contentBounds) return image;

  const meta = await sharp(image).metadata();
  const imgW = meta.width;
  const imgH = meta.height;
  if (!imgW || !imgH) return image;

  const left = Math.max(0, Math.round(contentBounds.x));
  const top = Math.max(0, Math.round(contentBounds.y));
  const width = Math.min(Math.round(contentBounds.w), imgW - left);
  const height = Math.min(Math.round(contentBounds.h), imgH - top);

  if (width <= 0 || height <= 0) return image;

  return sharp(image)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
}
