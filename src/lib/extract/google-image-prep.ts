import sharp from "sharp";

const MAX_EDGE = 1920;

export interface PreparedImage {
  buffer: Buffer;
  width: number;
  height: number;
  mediaType: string;
}

export async function resizeForGoogle(
  buffer: Buffer,
  width: number,
  height: number,
  originalMediaType: string,
): Promise<PreparedImage> {
  const longerEdge = Math.max(width, height);
  if (longerEdge <= MAX_EDGE) {
    return { buffer, width, height, mediaType: originalMediaType };
  }
  const scale = MAX_EDGE / longerEdge;
  const resized = await sharp(buffer)
    .resize({
      width: width >= height ? MAX_EDGE : undefined,
      height: height > width ? MAX_EDGE : undefined,
      fit: "inside",
    })
    .png()
    .toBuffer();
  return {
    buffer: resized,
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    mediaType: "image/png",
  };
}
