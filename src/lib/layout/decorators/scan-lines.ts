// Scan lines — CRT-style horizontal line overlay.
// Used by: Terminal Green

import type { LayoutElement, ResolvedTheme } from "../types";
import { CANVAS_W, CANVAS_H } from "../helpers";

/**
 * Produces a single full-slide shape with a narrow horizontal pattern fill,
 * creating a CRT scan-line effect. One shape instead of ~270 individual lines.
 */
export function scanLines(theme: ResolvedTheme): LayoutElement[] {
  return [
    {
      kind: "shape",
      id: "deco-scan-lines",
      rect: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H },
      shape: "rect",
      style: {
        patternFill: {
          preset: "narHorz",
          fgColor: theme.accent,
          fgOpacity: 0.06,
          bgColor: "transparent",
          bgOpacity: 0,
        },
      },
    },
  ];
}
