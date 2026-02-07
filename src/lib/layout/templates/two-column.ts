import type { TwoColumnSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_H,
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  titleBlock,
  columnLayout,
  makeAnimation,
  cardElement,
  bodyStyle,
  estimateTextHeight,
} from "../helpers";

export function layoutTwoColumn(
  slide: TwoColumnSlideData,
  theme: ResolvedTheme,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];
  let contentY = 60;

  // Optional title + accent line
  if (slide.title) {
    const { elements: titleEls, bottomY } = titleBlock(slide.title, theme, {
      align: "center",
      startY: contentY,
    });
    elements.push(...titleEls);
    contentY = bottomY;
  }

  // Two columns — size cards to content
  const gap = 32;
  const cardPadding = 32;
  const cols = columnLayout(2, gap, CONTENT_X, CONTENT_W);
  const maxCardH = CANVAS_H - contentY - 60;
  const leftTextH = estimateTextHeight(slide.left, 30, 1.6, cols[0].w - cardPadding * 2);
  const rightTextH = estimateTextHeight(slide.right, 30, 1.6, cols[1].w - cardPadding * 2);
  const cardH = Math.min(maxCardH, Math.max(leftTextH, rightTextH) + cardPadding * 2 + 16);

  // Left card
  const leftCard = cardElement(
    "left-card",
    { x: cols[0].x, y: contentY, w: cols[0].w, h: cardH },
    [
      {
        kind: "text",
        id: "left-text",
        rect: { x: 0, y: 0, w: cols[0].w, h: cardH - cardPadding * 2 },
        text: slide.left,
        style: bodyStyle(theme, 30),
      },
    ],
    theme,
  );
  leftCard.animation = makeAnimation("slide-left", 200);
  elements.push(leftCard);

  // Right card
  const rightCard = cardElement(
    "right-card",
    { x: cols[1].x, y: contentY, w: cols[1].w, h: cardH },
    [
      {
        kind: "text",
        id: "right-text",
        rect: { x: 0, y: 0, w: cols[1].w, h: cardH - cardPadding * 2 },
        text: slide.right,
        style: bodyStyle(theme, 30),
      },
    ],
    theme,
  );
  rightCard.animation = makeAnimation("slide-right", 200);
  elements.push(rightCard);

  return makeSlide(theme, elements);
}
