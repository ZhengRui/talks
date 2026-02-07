import type { StatsSlideData } from "@/lib/types";
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
} from "../helpers";

export function layoutStats(
  slide: StatsSlideData,
  theme: ResolvedTheme,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];
  let contentY = 60;

  // Optional title
  if (slide.title) {
    const { elements: titleEls, bottomY } = titleBlock(slide.title, theme, {
      align: "center",
      startY: contentY,
    });
    elements.push(...titleEls);
    contentY = bottomY;
  }

  // Stats grid
  const count = slide.stats.length;
  const gap = 32;
  const cardH = 200;

  // Distribute cards horizontally, capping at 4 per row
  const perRow = Math.min(count, 4);
  const maxCardW = 380;
  const totalAvailW = CONTENT_W;
  const cardW = Math.min(maxCardW, (totalAvailW - gap * (perRow - 1)) / perRow);
  const rowW = perRow * cardW + (perRow - 1) * gap;
  const startX = (CANVAS_W - rowW) / 2;

  // Center cards vertically in remaining space
  const rows = Math.ceil(count / perRow);
  const totalGridH = rows * cardH + (rows - 1) * gap;
  const gridY = contentY + (CANVAS_H - contentY - 60 - totalGridH) / 2;

  slide.stats.forEach((stat, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const x = startX + col * (cardW + gap);
    const y = gridY + row * (cardH + gap);

    const card = cardElement(
      `stat-${i}`,
      { x, y, w: cardW, h: cardH },
      [
        {
          kind: "text",
          id: `stat-${i}-value`,
          rect: { x: 0, y: 0, w: cardW, h: 90 },
          text: stat.value,
          style: {
            fontFamily: theme.fontHeading,
            fontSize: 72,
            fontWeight: 700,
            color: theme.accent,
            lineHeight: 1.1,
            textAlign: "center",
            verticalAlign: "middle",
          },
        },
        {
          kind: "text",
          id: `stat-${i}-label`,
          rect: { x: 0, y: 100, w: cardW, h: 40 },
          text: stat.label,
          style: {
            fontFamily: theme.fontBody,
            fontSize: 26,
            fontWeight: 400,
            color: theme.textMuted,
            lineHeight: 1.5,
            textAlign: "center",
          },
        },
      ],
      theme,
      { accentTop: true },
    );
    card.animation = makeAnimation("count-up", staggerDelay(i, 200, 150));
    elements.push(card);
  });

  return makeSlide(theme, elements);
}
