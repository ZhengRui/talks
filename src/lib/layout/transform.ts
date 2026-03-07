import type { TransformDef } from "./types";

/**
 * Convert a TransformDef to CSS properties.
 * Returns an object with `transform` string if any transforms apply.
 */
export function transformToCSS(t: TransformDef | undefined): { transform?: string } {
  if (!t) return {};

  const parts: string[] = [];

  if (t.rotate) {
    parts.push(`rotate(${t.rotate}deg)`);
  }

  const sx = (t.scaleX ?? 1) * (t.flipH ? -1 : 1);
  const sy = (t.scaleY ?? 1) * (t.flipV ? -1 : 1);
  const hasScale = t.scaleX !== undefined && t.scaleX !== 1 || t.scaleY !== undefined && t.scaleY !== 1;
  const hasFlip = t.flipH || t.flipV;

  if (hasScale || hasFlip) {
    if (sx !== 1 || sy !== 1) {
      if (!hasScale && sx !== 1 && sy === 1) {
        parts.push(`scaleX(${sx})`);
      } else if (!hasScale && sx === 1 && sy !== 1) {
        parts.push(`scaleY(${sy})`);
      } else {
        parts.push(`scale(${sx}, ${sy})`);
      }
    }
  }

  if (parts.length === 0) return {};
  return { transform: parts.join(" ") };
}
