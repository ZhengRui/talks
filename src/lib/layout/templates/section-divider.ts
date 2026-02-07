import type { SectionDividerSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  makeSlide,
  backgroundImage,
  makeAnimation,
  estimateTextHeight,
} from "../helpers";

export function layoutSectionDivider(
  slide: SectionDividerSlideData,
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
  const titleFontSize = 80;
  const maxW = 1400;
  const titleHeight = estimateTextHeight(
    slide.title,
    titleFontSize,
    1.1,
    maxW,
  );

  // Accent line dimensions
  const accentW = 120;
  const accentH = 4;
  const gap = 16;

  // Calculate subtitle height
  let subtitleHeight = 0;
  if (slide.subtitle) {
    subtitleHeight = estimateTextHeight(slide.subtitle, 32, 1.3, 1200);
  }

  // Total content height for vertical centering
  const totalContentH =
    titleHeight +
    gap +
    accentH +
    (subtitleHeight > 0 ? gap * 2 + subtitleHeight : 0);

  let y = (CANVAS_H - totalContentH) / 2;

  const textColor = hasImage ? "#ffffff" : undefined;
  const textShadow = hasImage ? "0 2px 12px rgba(0,0,0,0.7)" : undefined;

  elements.push({
    kind: "text",
    id: "title",
    rect: { x: (CANVAS_W - maxW) / 2, y, w: maxW, h: titleHeight },
    text: slide.title,
    style: {
      fontFamily: theme.fontHeading,
      fontSize: titleFontSize,
      fontWeight: 700,
      color: textColor ?? theme.heading,
      lineHeight: 1.1,
      textAlign: "center",
      textShadow,
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
    animation: makeAnimation("fade-up", 150),
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
        fontSize: 32,
        fontWeight: 400,
        color: hasImage ? "rgba(255,255,255,0.85)" : theme.textMuted,
        lineHeight: 1.3,
        textAlign: "center",
        textShadow: hasImage ? "0 2px 12px rgba(0,0,0,0.4)" : undefined,
      },
      animation: makeAnimation("fade-up", 300),
    });
  }

  return makeSlide(theme, elements);
}
