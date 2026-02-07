import type { QaSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CONTENT_W,
  makeSlide,
  titleBlock,
  makeAnimation,
  estimateTextHeight,
} from "../helpers";

export function layoutQa(
  slide: QaSlideData,
  theme: ResolvedTheme,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];

  // Question as title + accent line (centered)
  const { elements: titleEls, bottomY } = titleBlock(slide.question, theme, {
    align: "center",
    fontSize: 56,
    accentWidth: 80,
  });
  elements.push(...titleEls);

  // Answer card
  const cardW = Math.min(CONTENT_W, 1200);
  const cardPadding = 40;
  const answerFontSize = 30;
  const answerHeight = estimateTextHeight(
    slide.answer,
    answerFontSize,
    1.6,
    cardW - cardPadding * 2,
  );
  const cardH = answerHeight + cardPadding * 2;
  const cardX = (CANVAS_W - cardW) / 2;

  elements.push({
    kind: "group",
    id: "answer-card",
    rect: { x: cardX, y: bottomY, w: cardW, h: cardH },
    children: [
      {
        kind: "text",
        id: "answer-text",
        rect: {
          x: cardPadding,
          y: cardPadding,
          w: cardW - cardPadding * 2,
          h: answerHeight,
        },
        text: slide.answer,
        style: {
          fontFamily: theme.fontBody,
          fontSize: answerFontSize,
          fontWeight: 400,
          color: theme.text,
          lineHeight: 1.6,
          textAlign: "left",
        },
      },
    ],
    style: {
      fill: theme.cardBg,
      borderRadius: theme.radius,
      shadow: theme.shadow,
    },
    border: theme.cardBorder,
    animation: makeAnimation("fade-in", 400),
  });

  return makeSlide(theme, elements);
}
