import type { FullComposeSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../../types";
import { CANVAS_W, CANVAS_H, CONTENT_X, CONTENT_W, PADDING_Y, backgroundImage } from "../../helpers";
import { stackComponents } from "../../components/stacker";
import { resolveColor } from "../../components/theme-tokens";

export function layoutFullCompose(
  slide: FullComposeSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const hasImage = !!slide.backgroundImage;
  const bg = resolveColor(slide.background, theme, theme.bg);

  // Background image + overlay elements (rendered behind content)
  const bgElements: LayoutElement[] = [];
  if (hasImage) {
    const overlay = slide.overlay ?? "dark";
    bgElements.push(...backgroundImage(slide.backgroundImage!, imageBase, overlay));
  }

  // Content area with standard margins
  const contentW = CONTENT_W;
  const contentX = CONTENT_X;

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
    textColor: hasImage && slide.overlay !== "light" ? "#ffffff" : undefined,
    textShadow: hasImage && slide.overlay !== "light" ? "0 2px 12px rgba(0,0,0,0.7)" : undefined,
  });

  return {
    width: CANVAS_W,
    height: CANVAS_H,
    background: bg,
    elements: [...bgElements, ...elements],
  };
}
