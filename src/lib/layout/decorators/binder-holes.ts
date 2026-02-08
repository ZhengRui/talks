// Binder holes — small circles along the left edge simulating paper punches.
// Used by: Notebook Tabs

import type { LayoutElement, ResolvedTheme } from "../types";

const HOLE_DIAMETER = 20;
const HOLE_X = 60;
const HOLE_POSITIONS_Y = [200, 440, 680]; // 3 evenly-spaced holes

/**
 * Produces 3 small circle shapes on the left edge,
 * simulating paper binder holes.
 */
export function binderHoles(theme: ResolvedTheme): LayoutElement[] {
  return HOLE_POSITIONS_Y.map((y, i) => ({
    kind: "shape" as const,
    id: `deco-hole-${i}`,
    rect: { x: HOLE_X, y, w: HOLE_DIAMETER, h: HOLE_DIAMETER },
    shape: "circle" as const,
    style: {
      fill: theme.bgTertiary,
      stroke: theme.border.color,
      strokeWidth: 1,
    },
  }));
}
