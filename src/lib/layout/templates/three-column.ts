import type { ThreeColumnSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_H,
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  titleBlock,
  columnLayout,
  makeAnimation,
  staggerDelay,
  cardElement,
  headingStyle,
  bodyStyle,
  estimateTextHeight,
} from "../helpers";

export function layoutThreeColumn(
  slide: ThreeColumnSlideData,
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

  // Column layout (use actual column count from data, typically 3)
  const colCount = slide.columns.length;
  const gap = 32;
  const cardPadding = 32;
  const cols = columnLayout(colCount, gap, CONTENT_X, CONTENT_W);
  const maxCardH = CANVAS_H - contentY - 60;

  // Compute needed height per column to determine card height
  const colContentHeights = slide.columns.map((col, i) => {
    let h = 0;
    if (col.icon) h += 56 + 16;
    if (col.heading) h += 40 + 12;
    h += estimateTextHeight(col.body, 28, 1.6, cols[i].w - cardPadding * 2);
    return h;
  });
  const maxContentH = Math.max(...colContentHeights);
  const cardH = Math.min(maxCardH, maxContentH + cardPadding * 2 + 16);

  slide.columns.forEach((col, i) => {
    const colDef = cols[i];
    const children: LayoutElement[] = [];
    let innerY = 0;

    // Optional icon (centered, large text)
    if (col.icon) {
      children.push({
        kind: "text",
        id: `col-${i}-icon`,
        rect: { x: 0, y: innerY, w: colDef.w, h: 56 },
        text: col.icon,
        style: {
          fontFamily: theme.fontBody,
          fontSize: 48,
          fontWeight: 400,
          color: theme.accent,
          lineHeight: 1.2,
          textAlign: "center",
          verticalAlign: "middle",
        },
      });
      innerY += 56 + 16;
    }

    // Optional heading
    if (col.heading) {
      children.push({
        kind: "text",
        id: `col-${i}-heading`,
        rect: { x: 0, y: innerY, w: colDef.w, h: 40 },
        text: col.heading,
        style: headingStyle(theme, 32, { textAlign: "center" }),
      });
      innerY += 40 + 12;
    }

    // Body text
    const bodyH = cardH - cardPadding * 2 - innerY;
    children.push({
      kind: "text",
      id: `col-${i}-body`,
      rect: { x: 0, y: innerY, w: colDef.w, h: bodyH },
      text: col.body,
      style: bodyStyle(theme, 28, { textAlign: "center" }),
    });

    const card = cardElement(
      `col-${i}-card`,
      { x: colDef.x, y: contentY, w: colDef.w, h: cardH },
      children,
      theme,
      { accentTop: true },
    );
    card.animation = makeAnimation("fade-up", staggerDelay(i, 200));
    elements.push(card);
  });

  return makeSlide(theme, elements);
}
