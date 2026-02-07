import type { CoverSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  makeSlide,
  backgroundImage,
  makeAnimation,
  estimateTextHeight,
  pillElement,
} from "../helpers";

export function layoutCover(
  slide: CoverSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const hasImage = !!slide.image;
  const elements: LayoutElement[] = [];

  // Background image + overlay
  if (hasImage) {
    elements.push(...backgroundImage(slide.image!, imageBase));
  }

  // Title (centered, large)
  const titleColor = hasImage ? "#ffffff" : undefined;
  const titleShadow = "0 2px 20px rgba(0,0,0,0.5)";
  const maxW = 1400;
  const titleFontSize = 80;
  const titleHeight = estimateTextHeight(slide.title, titleFontSize, 1.1, maxW);

  // Vertically center the content block
  let subtitleHeight = 0;
  let authorHeight = 0;
  const gap = 16;
  const accentH = 4;

  if (slide.subtitle) {
    subtitleHeight = estimateTextHeight(slide.subtitle, 42, 1.3, 1200);
  }
  if (slide.author) {
    authorHeight = 44; // pill height
  }

  const totalContentH =
    titleHeight +
    gap +
    accentH +
    gap * 2.5 +
    (subtitleHeight > 0 ? subtitleHeight + gap : 0) +
    (authorHeight > 0 ? authorHeight + gap : 0);

  let y = (CANVAS_H - totalContentH) / 2;
  const titleX = (CANVAS_W - maxW) / 2;

  elements.push({
    kind: "text",
    id: "title",
    rect: { x: titleX, y, w: maxW, h: titleHeight },
    text: slide.title,
    style: {
      fontFamily: theme.fontHeading,
      fontSize: titleFontSize,
      fontWeight: 700,
      color: titleColor ?? theme.heading,
      lineHeight: 1.1,
      textAlign: "center",
      textShadow: hasImage ? titleShadow : undefined,
    },
    animation: makeAnimation("fade-up", 0),
  });

  y += titleHeight + gap;

  // Accent line (wide, 120px)
  const accentW = 120;
  elements.push({
    kind: "shape",
    id: "accent-line",
    rect: { x: (CANVAS_W - accentW) / 2, y, w: accentW, h: accentH },
    shape: "rect",
    style: { gradient: theme.accentGradient, borderRadius: 2 },
    animation: makeAnimation("fade-up", 150),
  });

  y += accentH + gap * 2.5;

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
        fontSize: 42,
        fontWeight: 400,
        color: hasImage ? "rgba(255,255,255,0.85)" : theme.textMuted,
        lineHeight: 1.3,
        textAlign: "center",
        textShadow: hasImage ? "0 2px 12px rgba(0,0,0,0.4)" : undefined,
      },
      animation: makeAnimation("fade-up", 300),
    });
    y += subtitleHeight + gap;
  }

  // Author pill
  if (slide.author) {
    const pillW = Math.max(160, slide.author.length * 14 + 40);
    const pill = pillElement("author", slide.author, theme, {
      x: (CANVAS_W - pillW) / 2,
      y,
      w: pillW,
      h: authorHeight,
    }, hasImage
      ? { color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.15)", borderColor: "rgba(255,255,255,0.2)" }
      : {},
    );
    pill.animation = makeAnimation("fade-up", 450);
    elements.push(pill);
  }

  return makeSlide(theme, elements);
}
