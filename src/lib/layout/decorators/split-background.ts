// Split background — two-tone vertical split behind content.
// Used by: Electric Studio, Creative Voltage, Split Pastel

import type { LayoutElement, ResolvedTheme } from "../types";
import { CANVAS_W, CANVAS_H } from "../helpers";

/**
 * Produces two full-height ShapeElements side-by-side, splitting
 * the slide into a primary-color left panel and secondary-color right panel.
 * Should be inserted at the START of the elements array (behind everything).
 */
export function splitBackground(theme: ResolvedTheme): LayoutElement[] {
  const halfW = CANVAS_W / 2;
  return [
    {
      kind: "shape",
      id: "deco-split-left",
      rect: { x: 0, y: 0, w: halfW, h: CANVAS_H },
      shape: "rect",
      style: { fill: theme.bg },
    },
    {
      kind: "shape",
      id: "deco-split-right",
      rect: { x: halfW, y: 0, w: halfW, h: CANVAS_H },
      shape: "rect",
      style: { fill: theme.bgSecondary },
    },
  ];
}
