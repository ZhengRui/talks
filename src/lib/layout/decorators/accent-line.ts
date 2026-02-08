// Accent line — thin vertical or horizontal decorative line.
// Used by: Dark Botanical (vertical), Paper & Ink (horizontal)

import type { LayoutElement, ResolvedTheme } from "../types";
import { CANVAS_H, CONTENT_X } from "../helpers";

/**
 * Produces a thin vertical accent line on the left side of the content area.
 * The line has a gradient fade achieved via opacity.
 */
export function accentLine(theme: ResolvedTheme): LayoutElement[] {
  return [
    {
      kind: "shape",
      id: "deco-accent-line",
      rect: { x: CONTENT_X - 40, y: 120, w: 2, h: CANVAS_H - 240 },
      shape: "rect",
      style: {
        fill: theme.accent,
        opacity: 0.2,
      },
    },
  ];
}
