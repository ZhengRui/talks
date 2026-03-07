import type { FullComposeSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../../types";
import { CANVAS_W, CANVAS_H, CONTENT_X, PADDING_Y, backgroundImage } from "../../helpers";
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

  // Content area — custom padding overrides default margins
  let padTop = PADDING_Y, padRight = CONTENT_X, padBottom = PADDING_Y, padLeft = CONTENT_X;
  if (slide.padding != null) {
    const p = slide.padding;
    if (typeof p === "number") {
      padTop = padRight = padBottom = padLeft = p;
    } else if (p.length === 2) {
      padTop = padBottom = p[0];
      padLeft = padRight = p[1];
    } else if (p.length === 4) {
      [padTop, padRight, padBottom, padLeft] = p;
    }
  }

  const panel = {
    x: padLeft,
    y: padTop,
    w: CANVAS_W - padLeft - padRight,
    h: CANVAS_H - padTop - padBottom,
  };

  const elements = stackComponents(slide.children, panel, theme, {
    imageBase,
    verticalAlign: slide.verticalAlign,
    gap: slide.gap,
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
