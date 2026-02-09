// Glow accent — neon-glowing shapes behind content.
// Used by: Neon Cyber, Creative Voltage

import type { LayoutElement, ResolvedTheme } from "../types";
import { CANVAS_W, CANVAS_H } from "../helpers";

/**
 * Produces 2-3 accent-colored circles with glow effects,
 * positioned as ambient background decoration.
 */
export function glowAccent(theme: ResolvedTheme): LayoutElement[] {
  return [
    // Large glow circle — top right
    {
      kind: "shape",
      id: "deco-glow-1",
      rect: { x: CANVAS_W - 500, y: -100, w: 400, h: 400 },
      shape: "circle",
      style: { fill: theme.accent, opacity: 0.18 },
      effects: {
        glow: { color: theme.accent, radius: 100, opacity: 0.7 },
        softEdge: 20,
      },
    },
    // Smaller glow circle — bottom left
    {
      kind: "shape",
      id: "deco-glow-2",
      rect: { x: 100, y: CANVAS_H - 400, w: 280, h: 280 },
      shape: "circle",
      style: { fill: theme.accent2, opacity: 0.14 },
      effects: {
        glow: { color: theme.accent2, radius: 80, opacity: 0.6 },
        softEdge: 15,
      },
    },
  ];
}
