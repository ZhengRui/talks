import type { TopBottomSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  titleBlock,
  makeAnimation,
  cardElement,
  bodyStyle,
} from "../helpers";

export function layoutTopBottom(
  slide: TopBottomSlideData,
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

  // Divide remaining space into top card, divider, bottom card
  const dividerH = 4;
  const dividerPadding = 16;
  const totalAvailH = CANVAS_H - contentY - 60;
  const cardH = (totalAvailH - dividerH - dividerPadding * 2) / 2;

  // Top card
  const topCard = cardElement(
    "top-card",
    { x: CONTENT_X, y: contentY, w: CONTENT_W, h: cardH },
    [
      {
        kind: "text",
        id: "top-text",
        rect: { x: 0, y: 0, w: CONTENT_W, h: cardH },
        text: slide.top,
        style: bodyStyle(theme, 30),
      },
    ],
    theme,
  );
  topCard.animation = makeAnimation("fade-up", 200);
  elements.push(topCard);

  // Accent divider line (wide, centered between cards)
  const dividerY = contentY + cardH + dividerPadding;
  const accentW = 200;
  elements.push({
    kind: "shape",
    id: "divider-line",
    rect: { x: (CANVAS_W - accentW) / 2, y: dividerY, w: accentW, h: dividerH },
    shape: "rect",
    style: { gradient: theme.accentGradient, borderRadius: 2 },
    animation: makeAnimation("fade-up", 300),
  });

  // Bottom card
  const bottomY = dividerY + dividerH + dividerPadding;
  const bottomCard = cardElement(
    "bottom-card",
    { x: CONTENT_X, y: bottomY, w: CONTENT_W, h: cardH },
    [
      {
        kind: "text",
        id: "bottom-text",
        rect: { x: 0, y: 0, w: CONTENT_W, h: cardH },
        text: slide.bottom,
        style: bodyStyle(theme, 30),
      },
    ],
    theme,
  );
  bottomCard.animation = makeAnimation("fade-up", 400);
  elements.push(bottomCard);

  return makeSlide(theme, elements);
}
