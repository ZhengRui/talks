import type { IconGridSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  CONTENT_W,
  makeSlide,
  titleBlock,
  makeAnimation,
  staggerDelay,
  cardElement,
  bodyStyle,
} from "../helpers";

export function layoutIconGrid(
  slide: IconGridSlideData,
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

  // Grid of icon cards
  const count = slide.items.length;
  const cols = slide.columns ?? (count <= 4 ? count : 3);
  const gap = 32;
  const perRow = Math.min(count, cols);
  const rows = Math.ceil(count / perRow);

  // Calculate card dimensions
  const totalAvailW = CONTENT_W;
  const cardW = (totalAvailW - gap * (perRow - 1)) / perRow;
  const rowW = perRow * cardW + (perRow - 1) * gap;
  const startX = (CANVAS_W - rowW) / 2;

  const availableH = CANVAS_H - contentY - 60;
  const cardH = Math.min(200, (availableH - (rows - 1) * gap) / rows);

  // Center grid vertically in remaining space
  const totalGridH = rows * cardH + (rows - 1) * gap;
  const gridY = contentY + (availableH - totalGridH) / 2;

  // Icon and label heights within card
  const iconFontSize = 48;
  const iconH = 72;
  const labelFontSize = 26;
  const labelH = 42;
  const innerGap = 4;

  slide.items.forEach((item, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const x = startX + col * (cardW + gap);
    const y = gridY + row * (cardH + gap);
    const delay = staggerDelay(i, 200, 100);

    // Center icon+label block vertically within card (after padding)
    const innerH = cardH - 24 * 2; // padding on both sides
    const contentH = iconH + innerGap + labelH;
    const offsetY = Math.max(0, (innerH - contentH) / 2);

    const cardChildren: LayoutElement[] = [
      // Icon (emoji text, large)
      {
        kind: "text",
        id: `icon-${i}`,
        rect: { x: 0, y: offsetY, w: cardW, h: iconH },
        text: item.icon,
        style: {
          fontFamily: theme.fontBody,
          fontSize: iconFontSize,
          fontWeight: 400,
          color: theme.text,
          lineHeight: 1,
          textAlign: "center",
          verticalAlign: "middle",
        },
      },
      // Label
      {
        kind: "text",
        id: `label-${i}`,
        rect: { x: 0, y: offsetY + iconH + innerGap, w: cardW, h: labelH },
        text: item.label,
        style: bodyStyle(theme, labelFontSize, { fontWeight: 500, textAlign: "center" }),
      },
    ];

    const card = cardElement(
      `icon-card-${i}`,
      { x, y, w: cardW, h: cardH },
      cardChildren,
      theme,
      { padding: 24 },
    );
    card.animation = makeAnimation("scale-up", delay);
    elements.push(card);
  });

  return makeSlide(theme, elements);
}
