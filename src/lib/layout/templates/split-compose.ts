import type { SplitComposeSlideData } from "@/lib/types";
import type { PanelDef } from "@/lib/layout/components/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme, ShapeElement } from "../types";
import { CANVAS_W, CANVAS_H } from "../helpers";
import { stackComponents } from "../components/stacker";
import { resolveColor, resolveThemeToken } from "../components/theme-tokens";

const PANEL_PADDING_X = 60;
const PANEL_PADDING_Y = 60;

interface ResolvedPadding { top: number; right: number; bottom: number; left: number }

function resolvePadding(panel: PanelDef): ResolvedPadding {
  if (panel.padding !== undefined) {
    if (typeof panel.padding === "number") {
      return { top: panel.padding, right: panel.padding, bottom: panel.padding, left: panel.padding };
    }
    const p = panel.padding;
    if (p.length === 4) return { top: p[0], right: p[1], bottom: p[2], left: p[3] };
    if (p.length === 2) return { top: p[0], right: p[1], bottom: p[0], left: p[1] };
    return { top: p[0], right: p[0], bottom: p[0], left: p[0] };
  }
  if (panel.fill) return { top: 0, right: 0, bottom: 0, left: 0 };
  return { top: PANEL_PADDING_Y, right: PANEL_PADDING_X, bottom: PANEL_PADDING_Y, left: PANEL_PADDING_X };
}

export function layoutSplitCompose(
  slide: SplitComposeSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const ratio = slide.ratio ?? 0.5;
  const splitX = Math.round(CANVAS_W * ratio);

  const elements: LayoutElement[] = [];

  // --- Left panel background ---
  const leftBg = resolveColor(slide.left.background, theme, theme.bg);
  const leftBgEl: ShapeElement = {
    kind: "shape",
    id: "panel-left-bg",
    rect: { x: 0, y: 0, w: splitX, h: CANVAS_H },
    shape: "rect",
    style: { fill: leftBg },
  };
  elements.push(leftBgEl);

  // --- Right panel background ---
  const rightBg = resolveColor(slide.right.background, theme, theme.bgSecondary);
  const rightBgEl: ShapeElement = {
    kind: "shape",
    id: "panel-right-bg",
    rect: { x: splitX, y: 0, w: CANVAS_W - splitX, h: CANVAS_H },
    shape: "rect",
    style: { fill: rightBg },
  };
  elements.push(rightBgEl);

  // --- Left panel children ---
  const lp = resolvePadding(slide.left);
  const leftPanel = {
    x: lp.left,
    y: lp.top,
    w: splitX - lp.left - lp.right,
    h: CANVAS_H - lp.top - lp.bottom,
  };
  const leftTextColor = resolveThemeToken(slide.left.textColor, theme);
  elements.push(
    ...stackComponents(slide.left.children, leftPanel, theme, {
      gap: slide.left.gap,
      textColor: leftTextColor,
      imageBase,
      idPrefix: "l",
      verticalAlign: slide.left.verticalAlign,
      animationBaseDelay: 0,
    }),
  );

  // --- Right panel children ---
  const rp = resolvePadding(slide.right);
  const rightPanel = {
    x: splitX + rp.left,
    y: rp.top,
    w: CANVAS_W - splitX - rp.left - rp.right,
    h: CANVAS_H - rp.top - rp.bottom,
  };
  const rightTextColor = resolveThemeToken(slide.right.textColor, theme);
  elements.push(
    ...stackComponents(slide.right.children, rightPanel, theme, {
      gap: slide.right.gap,
      textColor: rightTextColor,
      imageBase,
      idPrefix: "r",
      animationBaseDelay: 300, // right panel starts later
      verticalAlign: slide.right.verticalAlign,
    }),
  );

  return {
    width: CANVAS_W,
    height: CANVAS_H,
    background: theme.bg,
    elements,
  };
}
