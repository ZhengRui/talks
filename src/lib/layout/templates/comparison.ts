import type { ComparisonSlideData } from "@/lib/types";
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
  headingStyle,
  bodyStyle,
  estimateTextHeight,
} from "../helpers";

export function layoutComparison(
  slide: ComparisonSlideData,
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

  // Two columns
  const gap = 32;
  const cardPadding = 32;
  const cols = columnLayout(2, gap, CONTENT_X, CONTENT_W);
  const cardTop = contentY;
  const maxCardH = CANVAS_H - contentY - 60;
  const headingH = 44;
  const headingGap = 20;
  const itemGap = 10;
  const fontSize = 30;
  const textW = cols[0].w - cardPadding * 2 - 40; // account for card padding + list indent

  // Estimate list heights based on content
  const leftItems = slide.left.items;
  const rightItems = slide.right.items;
  const leftListH = leftItems.reduce((sum, item) =>
    sum + estimateTextHeight(item, fontSize, 1.6, textW) + itemGap, 0);
  const rightListH = rightItems.reduce((sum, item) =>
    sum + estimateTextHeight(item, fontSize, 1.6, textW) + itemGap, 0);
  const maxListH = Math.max(leftListH, rightListH);
  const cardH = Math.min(maxCardH, headingH + headingGap + maxListH + cardPadding * 2 + 16);

  // Left card (green accent)
  const leftChildren: LayoutElement[] = [
    {
      kind: "text",
      id: "left-heading",
      rect: { x: 0, y: 0, w: cols[0].w, h: headingH },
      text: slide.left.heading,
      style: headingStyle(theme, 36, { textAlign: "left" }),
    },
    {
      kind: "list",
      id: "left-items",
      rect: { x: 0, y: headingH + headingGap, w: cols[0].w, h: cardH - headingH - headingGap - cardPadding * 2 },
      items: leftItems,
      ordered: false,
      itemStyle: bodyStyle(theme, fontSize),
      bulletColor: theme.text,
      itemSpacing: itemGap,
    },
  ];

  const leftCard = cardElement("left-card", { x: cols[0].x, y: cardTop, w: cols[0].w, h: cardH }, leftChildren, theme, {
    accentTop: true,
    accentColor: "#22c55e",
  });
  leftCard.animation = makeAnimation("slide-left", 200);
  elements.push(leftCard);

  // Right card (red accent)
  const rightChildren: LayoutElement[] = [
    {
      kind: "text",
      id: "right-heading",
      rect: { x: 0, y: 0, w: cols[1].w, h: headingH },
      text: slide.right.heading,
      style: headingStyle(theme, 36, { textAlign: "left" }),
    },
    {
      kind: "list",
      id: "right-items",
      rect: { x: 0, y: headingH + headingGap, w: cols[1].w, h: cardH - headingH - headingGap - cardPadding * 2 },
      items: rightItems,
      ordered: false,
      itemStyle: bodyStyle(theme, fontSize),
      bulletColor: theme.text,
      itemSpacing: itemGap,
    },
  ];

  const rightCard = cardElement("right-card", { x: cols[1].x, y: cardTop, w: cols[1].w, h: cardH }, rightChildren, theme, {
    accentTop: true,
    accentColor: "#ef4444",
  });
  rightCard.animation = makeAnimation("slide-right", 200);
  elements.push(rightCard);

  return makeSlide(theme, elements);
}
