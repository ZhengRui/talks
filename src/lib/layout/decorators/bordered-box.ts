// Bordered box — decorative empty rectangle with visible border.
// Used by: Vintage Editorial, Swiss Modern

import type { LayoutElement, ResolvedTheme } from "../types";

/**
 * Produces a decorative bordered rectangle in the bottom-left area.
 * Stroke-only, no fill — creates a clean geometric accent.
 */
export function borderedBox(theme: ResolvedTheme): LayoutElement[] {
  return [
    {
      kind: "shape",
      id: "deco-bordered-box",
      rect: { x: 120, y: 860, w: 200, h: 140 },
      shape: "rect",
      style: {
        stroke: theme.accent,
        strokeWidth: 2,
        opacity: 0.25,
        borderRadius: theme.radiusSm,
      },
    },
  ];
}
