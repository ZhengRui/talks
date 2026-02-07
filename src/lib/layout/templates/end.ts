import type { EndSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  makeSlide,
  backgroundImage,
  makeAnimation,
  estimateTextHeight,
} from "../helpers";

export function layoutEnd(
  slide: EndSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const hasImage = !!slide.image;
  const elements: LayoutElement[] = [];

  // Background image + dark overlay
  if (hasImage) {
    elements.push(...backgroundImage(slide.image!, imageBase));
  }

  // Title
  const titleText = slide.title ?? "Thank You";
  const titleFontSize = 80;
  const maxW = 1400;
  const titleHeight = estimateTextHeight(titleText, titleFontSize, 1.1, maxW);

  // Calculate subtitle height
  let subtitleHeight = 0;
  if (slide.subtitle) {
    subtitleHeight = estimateTextHeight(slide.subtitle, 36, 1.3, 1200);
  }

  // Accent line dimensions
  const accentW = 120;
  const accentH = 4;
  const gap = 16;

  // Total content height for vertical centering
  const totalContentH =
    titleHeight +
    gap +
    accentH +
    (subtitleHeight > 0 ? gap * 2 + subtitleHeight : 0);

  let y = (CANVAS_H - totalContentH) / 2;
  const titleX = (CANVAS_W - maxW) / 2;

  const titleColor = hasImage ? "#ffffff" : undefined;
  const titleShadow = hasImage ? "0 2px 20px rgba(0,0,0,0.5)" : undefined;

  elements.push({
    kind: "text",
    id: "title",
    rect: { x: titleX, y, w: maxW, h: titleHeight },
    text: titleText,
    style: {
      fontFamily: theme.fontHeading,
      fontSize: titleFontSize,
      fontWeight: 700,
      color: titleColor ?? theme.heading,
      lineHeight: 1.1,
      textAlign: "center",
      textShadow: titleShadow,
    },
    animation: makeAnimation("fade-up", 0),
  });

  y += titleHeight + gap;

  // Accent line (wide)
  elements.push({
    kind: "shape",
    id: "accent-line",
    rect: { x: (CANVAS_W - accentW) / 2, y, w: accentW, h: accentH },
    shape: "rect",
    style: { gradient: theme.accentGradient, borderRadius: 2 },
    animation: makeAnimation("fade-up", 200),
  });

  y += accentH + gap * 2;

  // Subtitle
  if (slide.subtitle) {
    const subW = 1200;
    elements.push({
      kind: "text",
      id: "subtitle",
      rect: { x: (CANVAS_W - subW) / 2, y, w: subW, h: subtitleHeight },
      text: slide.subtitle,
      style: {
        fontFamily: theme.fontBody,
        fontSize: 36,
        fontWeight: 400,
        color: hasImage ? "rgba(255,255,255,0.85)" : theme.textMuted,
        lineHeight: 1.3,
        textAlign: "center",
        textShadow: hasImage ? "0 2px 12px rgba(0,0,0,0.4)" : undefined,
      },
      animation: makeAnimation("fade-up", 400),
    });
  }

  return makeSlide(theme, elements);
}
