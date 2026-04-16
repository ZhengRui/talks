export type BBox = { x: number; y: number; width: number; height: number };

export function box2dToPixelBbox(
  box2d: [number, number, number, number],
  imageWidth: number,
  imageHeight: number,
): BBox {
  const [y1, x1, y2, x2] = box2d;
  const x = (x1 / 1000) * imageWidth;
  const y = (y1 / 1000) * imageHeight;
  const width = ((x2 - x1) / 1000) * imageWidth;
  const height = ((y2 - y1) / 1000) * imageHeight;
  return { x, y, width, height };
}
