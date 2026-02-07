import type { CodeSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_H,
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  titleBlock,
  makeAnimation,
} from "../helpers";

export function layoutCode(
  slide: CodeSlideData,
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

  // Code block — size to content, capped at available space
  const codeX = CONTENT_X;
  const codeW = CONTENT_W;
  const codePadding = 32;
  const codeFontSize = 24;
  const codeLineH = 1.6;
  const lineCount = slide.code.split("\n").length;
  const codeContentH = lineCount * codeFontSize * codeLineH + codePadding * 2;
  const maxCodeH = CANVAS_H - contentY - 60;
  const codeH = Math.min(maxCodeH, codeContentH + 24);

  // Language label above the code (if provided)
  if (slide.language) {
    elements.push({
      kind: "text",
      id: "code-label",
      rect: { x: codeX + 24, y: contentY + 12, w: 200, h: 24 },
      text: slide.language,
      style: {
        fontFamily: theme.fontMono,
        fontSize: 18,
        fontWeight: 400,
        color: theme.textMuted,
        lineHeight: 1.4,
        textAlign: "left",
        textTransform: "uppercase",
        letterSpacing: 1,
      },
    });
  }

  elements.push({
    kind: "code",
    id: "code-block",
    rect: { x: codeX, y: contentY, w: codeW, h: codeH },
    code: slide.code,
    language: slide.language,
    style: {
      fontFamily: theme.fontMono,
      fontSize: 24,
      color: theme.codeText,
      background: theme.codeBg,
      borderRadius: theme.radius,
      padding: 32,
    },
    animation: makeAnimation("fade-in", 200),
  });

  return makeSlide(theme, elements);
}
