import type { TableSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  titleBlock,
  makeAnimation,
} from "../helpers";

export function layoutTable(
  slide: TableSlideData,
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

  // Table element
  const tableX = CONTENT_X;
  const tableW = CONTENT_W;
  const rowH = 68;
  const headerH = 72;
  const tableH = headerH + slide.rows.length * rowH;

  // Place table near the top of remaining space (small gap, not full centering)
  const tableY = contentY;

  elements.push({
    kind: "table",
    id: "table",
    rect: { x: tableX, y: tableY, w: tableW, h: tableH },
    headers: slide.headers,
    rows: slide.rows,
    headerStyle: {
      fontFamily: theme.fontHeading,
      fontSize: 26,
      fontWeight: 600,
      color: theme.bg,
      lineHeight: 1.4,
      textAlign: "left",
      background: theme.accent,
    },
    cellStyle: {
      fontFamily: theme.fontBody,
      fontSize: 26,
      fontWeight: 400,
      color: theme.text,
      lineHeight: 1.4,
      textAlign: "left",
      background: theme.cardBg,
      altBackground: theme.bgTertiary,
    },
    borderColor: theme.border.color,
    animation: makeAnimation("fade-in", 200),
  });

  return makeSlide(theme, elements);
}
