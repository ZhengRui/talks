import sharp from "sharp";
import type { DiffRegion } from "./compare";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

export async function annotateDiffImage(
  diffImage: Buffer,
  regions: DiffRegion[],
): Promise<Buffer> {
  if (regions.length === 0) return diffImage;

  const meta = await sharp(diffImage).metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height) return diffImage;

  const overlay = regions.map((region, index) => {
    const x = Math.max(0, Math.min(Math.round(region.x), width - 1));
    const y = Math.max(0, Math.min(Math.round(region.y), height - 1));
    const w = Math.max(1, Math.min(Math.round(region.w), width - x));
    const h = Math.max(1, Math.min(Math.round(region.h), height - y));
    const label = escapeXml(`R${index + 1}: ${Math.round(region.mismatchRatio * 100)}%`);
    const labelWidth = Math.max(52, label.length * 7 + 10);
    const labelY = Math.min(height - 4, y + 13);

    return `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#22d3ee" stroke-width="2" />
      <rect x="${x}" y="${y}" width="${Math.min(labelWidth, width - x)}" height="18" fill="rgba(0,0,0,0.72)" />
      <text x="${x + 4}" y="${labelY}" font-family="monospace" font-size="12" fill="#22d3ee">${label}</text>
    `;
  }).join("");

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${overlay}</svg>`,
  );

  return sharp(diffImage)
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toBuffer();
}
