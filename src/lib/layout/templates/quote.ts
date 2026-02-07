import type { QuoteSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  makeSlide,
  backgroundImage,
  makeAnimation,
  estimateTextHeight,
} from "../helpers";

export function layoutQuote(
  slide: QuoteSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const hasImage = !!slide.image;
  const elements: LayoutElement[] = [];

  // Background image + dark overlay
  if (hasImage) {
    elements.push(...backgroundImage(slide.image!, imageBase));
  }

  // Quote mark
  const quoteMarkSize = 120;
  const gap = 24;

  // Quote text
  const quoteFontSize = 36;
  const maxW = 1200;
  const quoteHeight = estimateTextHeight(slide.quote, quoteFontSize, 1.6, maxW);

  // Attribution
  let attrHeight = 0;
  if (slide.attribution) {
    attrHeight = estimateTextHeight(slide.attribution, 26, 1.5, maxW);
  }

  // Total content height for vertical centering
  const totalContentH =
    quoteMarkSize +
    gap +
    quoteHeight +
    (attrHeight > 0 ? gap + attrHeight : 0);

  let y = (CANVAS_H - totalContentH) / 2;

  const textColor = hasImage ? "#ffffff" : undefined;

  // Opening quote mark
  elements.push({
    kind: "text",
    id: "quote-mark",
    rect: { x: (CANVAS_W - maxW) / 2, y, w: maxW, h: quoteMarkSize },
    text: "\u201C",
    style: {
      fontFamily: theme.fontHeading,
      fontSize: 120,
      fontWeight: 700,
      color: theme.accent,
      lineHeight: 1,
      textAlign: "center",
    },
    animation: makeAnimation("fade-in", 0),
  });

  y += quoteMarkSize + gap;

  // Quote text
  elements.push({
    kind: "text",
    id: "quote",
    rect: { x: (CANVAS_W - maxW) / 2, y, w: maxW, h: quoteHeight },
    text: slide.quote,
    style: {
      fontFamily: theme.fontBody,
      fontSize: quoteFontSize,
      fontWeight: 400,
      fontStyle: "italic",
      color: textColor ?? theme.text,
      lineHeight: 1.6,
      textAlign: "center",
    },
    animation: makeAnimation("scale-up", 150),
  });

  y += quoteHeight + gap;

  // Attribution
  if (slide.attribution) {
    elements.push({
      kind: "text",
      id: "attribution",
      rect: { x: (CANVAS_W - maxW) / 2, y, w: maxW, h: attrHeight },
      text: `\u2014 ${slide.attribution}`,
      style: {
        fontFamily: theme.fontBody,
        fontSize: 26,
        fontWeight: 400,
        color: hasImage ? "rgba(255,255,255,0.7)" : theme.textMuted,
        lineHeight: 1.5,
        textAlign: "center",
      },
      animation: makeAnimation("fade-up", 400),
    });
  }

  return makeSlide(theme, elements);
}
