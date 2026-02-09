// Soft gradient circles — blurred, overlapping decorative orbs.
// Used by: Dark Botanical

import type { LayoutElement, ResolvedTheme } from "../types";
import { CANVAS_W } from "../helpers";

/**
 * Produces 2 large, feathered circles with low opacity,
 * creating a warm ambient glow behind content.
 */
export function softGradientCircles(theme: ResolvedTheme): LayoutElement[] {
  return [
    // Warm accent orb — upper right
    {
      kind: "shape",
      id: "deco-soft-circle-1",
      rect: { x: CANVAS_W - 600, y: -150, w: 600, h: 600 },
      shape: "circle",
      style: { fill: theme.accent, opacity: 0.25 },
      effects: { softEdge: 30 },
    },
    // Cool accent orb — lower left
    {
      kind: "shape",
      id: "deco-soft-circle-2",
      rect: { x: -100, y: 500, w: 500, h: 500 },
      shape: "circle",
      style: { fill: theme.accent2, opacity: 0.2 },
      effects: { softEdge: 25 },
    },
  ];
}
