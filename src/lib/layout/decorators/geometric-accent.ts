// Geometric accent — circle outline + thin line + small dot.
// Used by: Vintage Editorial

import type { LayoutElement, ResolvedTheme } from "../types";

/**
 * Produces a decorative geometric composition in the top-right area:
 * a circle outline, a thin vertical line, and a small filled dot.
 */
export function geometricAccent(theme: ResolvedTheme): LayoutElement[] {
  const baseX = 1680;
  const baseY = 80;

  return [
    // Circle outline
    {
      kind: "shape",
      id: "deco-geo-circle",
      rect: { x: baseX, y: baseY, w: 80, h: 80 },
      shape: "circle",
      style: {
        stroke: theme.accent,
        strokeWidth: 2,
        opacity: 0.4,
      },
    },
    // Thin vertical line
    {
      kind: "shape",
      id: "deco-geo-line",
      rect: { x: baseX + 100, y: baseY + 10, w: 2, h: 60 },
      shape: "rect",
      style: { fill: theme.accent, opacity: 0.3 },
    },
    // Small filled dot
    {
      kind: "shape",
      id: "deco-geo-dot",
      rect: { x: baseX + 120, y: baseY + 30, w: 12, h: 12 },
      shape: "circle",
      style: { fill: theme.accent, opacity: 0.5 },
    },
  ];
}
