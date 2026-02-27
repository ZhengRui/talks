import type { SplitComposeSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme, ShapeElement } from "../types";
import { CANVAS_W, CANVAS_H } from "../helpers";
import { stackComponents } from "../components/stacker";
import { resolveColor, resolveThemeToken } from "../components/theme-tokens";

const PANEL_PADDING_X = 60;
const PANEL_PADDING_Y = 60;

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
  const leftPanel = {
    x: PANEL_PADDING_X,
    y: PANEL_PADDING_Y,
    w: splitX - PANEL_PADDING_X * 2,
    h: CANVAS_H - PANEL_PADDING_Y * 2,
  };
  const leftTextColor = resolveThemeToken(slide.left.textColor, theme);
  elements.push(
    ...stackComponents(slide.left.children, leftPanel, theme, {
      textColor: leftTextColor,
      imageBase,
      idPrefix: "l",
      verticalAlign: slide.left.verticalAlign,
      animationBaseDelay: 0,
    }),
  );

  // --- Right panel children ---
  const rightPanel = {
    x: splitX + PANEL_PADDING_X,
    y: PANEL_PADDING_Y,
    w: CANVAS_W - splitX - PANEL_PADDING_X * 2,
    h: CANVAS_H - PANEL_PADDING_Y * 2,
  };
  const rightTextColor = resolveThemeToken(slide.right.textColor, theme);
  elements.push(
    ...stackComponents(slide.right.children, rightPanel, theme, {
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
