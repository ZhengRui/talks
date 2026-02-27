import type { FullComposeSlideData } from "@/lib/types";
import type { LayoutSlide, ResolvedTheme } from "../types";
import { CANVAS_W, CANVAS_H, CONTENT_X, CONTENT_W, PADDING_Y } from "../helpers";
import { stackComponents } from "../components/stacker";
import { resolveColor } from "../components/theme-tokens";

export function layoutFullCompose(
  slide: FullComposeSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const bg = resolveColor(slide.background, theme, theme.bg);
  const align = slide.align ?? "left";

  // Content area with standard margins
  const contentW = align === "center" ? 1200 : CONTENT_W;
  const contentX = align === "center" ? (CANVAS_W - contentW) / 2 : CONTENT_X;

  const panel = {
    x: contentX,
    y: PADDING_Y,
    w: contentW,
    h: CANVAS_H - PADDING_Y * 2,
  };

  const elements = stackComponents(slide.children, panel, theme, {
    imageBase,
    verticalAlign: slide.verticalAlign,
    animationBaseDelay: 0,
  });

  return {
    width: CANVAS_W,
    height: CANVAS_H,
    background: bg,
    elements,
  };
}
