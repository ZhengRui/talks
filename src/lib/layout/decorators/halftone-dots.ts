// Halftone dots — subtle dot texture overlay.
// Used by: Creative Voltage

import type { LayoutElement, ResolvedTheme } from "../types";
import { CANVAS_W, CANVAS_H } from "../helpers";

/**
 * Produces a single full-slide shape with a 5% dot pattern fill,
 * creating a subtle halftone/print texture. One shape.
 */
export function halftoneDots(theme: ResolvedTheme): LayoutElement[] {
  return [
    {
      kind: "shape",
      id: "deco-halftone",
      rect: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H },
      shape: "rect",
      style: {
        patternFill: {
          preset: "pct10",
          fgColor: theme.accent,
          fgOpacity: 0.25,
          bgColor: "transparent",
          bgOpacity: 0,
        },
      },
    },
  ];
}
