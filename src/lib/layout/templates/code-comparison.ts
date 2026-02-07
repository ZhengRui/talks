import type { CodeComparisonSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_H,
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  titleBlock,
  columnLayout,
  makeAnimation,
  mutedStyle,
} from "../helpers";

export function layoutCodeComparison(
  slide: CodeComparisonSlideData,
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

  // Two columns for before/after
  const gap = 32;
  const cols = columnLayout(2, gap, CONTENT_X, CONTENT_W);
  const labelH = 30;
  const labelGap = 12;

  // Before column
  let beforeCodeY = contentY;
  if (slide.before.label) {
    elements.push({
      kind: "text",
      id: "before-label",
      rect: { x: cols[0].x, y: contentY, w: cols[0].w, h: labelH },
      text: slide.before.label,
      style: mutedStyle(theme, 24, { textAlign: "center" }),
      animation: makeAnimation("slide-left", 200),
    });
    beforeCodeY = contentY + labelH + labelGap;
  }

  // Size code blocks to content, capped at available space
  const codePadding = 24;
  const codeFontSize = 22;
  const codeLineH = 1.6;
  const maxCodeH = CANVAS_H - beforeCodeY - 60;
  const beforeLines = slide.before.code.split("\n").length;
  const afterLines = slide.after.code.split("\n").length;
  const maxLines = Math.max(beforeLines, afterLines);
  const codeContentH = maxLines * codeFontSize * codeLineH + codePadding * 2;
  const codeH = Math.min(maxCodeH, codeContentH + 16);

  elements.push({
    kind: "code",
    id: "before-code",
    rect: { x: cols[0].x, y: beforeCodeY, w: cols[0].w, h: codeH },
    code: slide.before.code,
    language: slide.before.language,
    style: {
      fontFamily: theme.fontMono,
      fontSize: 22,
      color: theme.codeText,
      background: theme.codeBg,
      borderRadius: theme.radius,
      padding: 24,
    },
    animation: makeAnimation("slide-left", 200),
  });

  // After column
  let afterCodeY = contentY;
  if (slide.after.label) {
    elements.push({
      kind: "text",
      id: "after-label",
      rect: { x: cols[1].x, y: contentY, w: cols[1].w, h: labelH },
      text: slide.after.label,
      style: mutedStyle(theme, 24, { textAlign: "center" }),
      animation: makeAnimation("slide-right", 200),
    });
    afterCodeY = contentY + labelH + labelGap;
  }

  elements.push({
    kind: "code",
    id: "after-code",
    rect: { x: cols[1].x, y: afterCodeY, w: cols[1].w, h: codeH },
    code: slide.after.code,
    language: slide.after.language,
    style: {
      fontFamily: theme.fontMono,
      fontSize: 22,
      color: theme.codeText,
      background: theme.codeBg,
      borderRadius: theme.radius,
      padding: 24,
    },
    animation: makeAnimation("slide-right", 200),
  });

  return makeSlide(theme, elements);
}
