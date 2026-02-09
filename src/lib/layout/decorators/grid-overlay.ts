// Grid overlay — subtle grid pattern across the slide.
// Used by: Swiss Modern, Neon Cyber

import type { LayoutElement, ResolvedTheme } from "../types";
import { CANVAS_W, CANVAS_H } from "../helpers";

/**
 * Produces a single full-slide shape with a small grid pattern fill.
 * One shape instead of ~100 individual grid lines.
 */
export function gridOverlay(theme: ResolvedTheme): LayoutElement[] {
  return [
    {
      kind: "shape",
      id: "deco-grid-overlay",
      rect: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H },
      shape: "rect",
      style: {
        patternFill: {
          preset: "smGrid",
          fgColor: theme.accent,
          fgOpacity: 0.08,
          bgColor: "transparent",
          bgOpacity: 0,
        },
      },
    },
  ];
}
