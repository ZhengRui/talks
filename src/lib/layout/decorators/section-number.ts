// Section number — large, faded number watermark.
// Used by: Bold Signal

import type { LayoutElement, ResolvedTheme } from "../types";
import { CANVAS_H } from "../helpers";

/**
 * Produces a large, low-opacity section number positioned in the bottom-right.
 * The number is formatted as zero-padded (01, 02, etc.).
 */
export function sectionNumber(
  theme: ResolvedTheme,
  slideIndex: number,
): LayoutElement[] {
  const num = String(slideIndex + 1).padStart(2, "0");
  return [
    {
      kind: "text",
      id: "deco-section-num",
      rect: { x: 1500, y: CANVAS_H - 320, w: 380, h: 280 },
      text: num,
      style: {
        fontFamily: theme.fontHeading,
        fontSize: 220,
        fontWeight: 900,
        color: theme.accent,
        lineHeight: 1,
        textAlign: "right",
        verticalAlign: "bottom",
      },
    },
    // Opacity overlay to fade the number
    {
      kind: "shape",
      id: "deco-section-num-fade",
      rect: { x: 1500, y: CANVAS_H - 320, w: 380, h: 280 },
      shape: "rect",
      style: { fill: theme.bg, opacity: 0.85 },
    },
  ];
}
