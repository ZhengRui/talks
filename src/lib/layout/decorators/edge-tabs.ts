// Edge tabs / pills — colored strips along the right edge.
// Used by: Notebook Tabs (section tabs), Pastel Geometry (vertical pills)

import type { LayoutElement, ResolvedTheme } from "../types";
import { CANVAS_W } from "../helpers";

const TAB_W = 24;
const TAB_GAP = 12;
const TAB_START_Y = 160;

/**
 * Produces 4-5 colored rectangular tabs along the right edge of the slide.
 * Heights vary to create visual rhythm. Colors alternate between accent and accent2.
 */
export function edgeTabs(theme: ResolvedTheme): LayoutElement[] {
  const tabs = [
    { h: 100, color: theme.accent },
    { h: 70, color: theme.accent2 },
    { h: 90, color: theme.accent },
    { h: 60, color: theme.accent2 },
    { h: 80, color: theme.accent },
  ];

  let y = TAB_START_Y;
  return tabs.map((tab, i) => {
    const el: LayoutElement = {
      kind: "shape",
      id: `deco-tab-${i}`,
      rect: { x: CANVAS_W - TAB_W, y, w: TAB_W, h: tab.h },
      shape: "rect",
      style: {
        fill: tab.color,
        borderRadius: theme.radiusSm,
        opacity: 0.7 + i * 0.06,
      },
    };
    y += tab.h + TAB_GAP;
    return el;
  });
}
