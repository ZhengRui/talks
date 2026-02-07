import type { HighlightBoxSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  CONTENT_W,
  makeSlide,
  titleBlock,
  makeAnimation,
  estimateTextHeight,
} from "../helpers";

export function layoutHighlightBox(
  slide: HighlightBoxSlideData,
  theme: ResolvedTheme,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];
  const variant = slide.variant ?? "info";

  // Pick variant colors from theme
  let boxBg: string;
  let boxBorder: string;
  if (variant === "warning") {
    boxBg = theme.highlightWarningBg;
    boxBorder = theme.highlightWarningBorder;
  } else if (variant === "success") {
    boxBg = theme.highlightSuccessBg;
    boxBorder = theme.highlightSuccessBorder;
  } else {
    boxBg = theme.highlightInfoBg;
    boxBorder = theme.highlightInfoBorder;
  }

  let contentStartY: number;

  // Title + accent line (centered)
  if (slide.title) {
    const { elements: titleEls, bottomY } = titleBlock(slide.title, theme, {
      align: "center",
      fontSize: 56,
      accentWidth: 80,
      startY: undefined,
    });
    elements.push(...titleEls);
    contentStartY = bottomY;
  } else {
    contentStartY = CANVAS_H / 2 - 100;
  }

  // Highlight box
  const boxW = Math.min(CONTENT_W, 1200);
  const boxPadding = 48;
  const bodyFontSize = 30;
  const bodyHeight = estimateTextHeight(
    slide.body,
    bodyFontSize,
    1.6,
    boxW - boxPadding * 2,
  );
  const boxH = bodyHeight + boxPadding * 2;
  const boxX = (CANVAS_W - boxW) / 2;

  elements.push({
    kind: "group",
    id: "highlight-box",
    rect: { x: boxX, y: contentStartY, w: boxW, h: boxH },
    children: [
      {
        kind: "text",
        id: "highlight-body",
        rect: {
          x: boxPadding,
          y: boxPadding,
          w: boxW - boxPadding * 2,
          h: bodyHeight,
        },
        text: slide.body,
        style: {
          fontFamily: theme.fontBody,
          fontSize: bodyFontSize,
          fontWeight: 400,
          color: theme.text,
          lineHeight: 1.6,
          textAlign: "left",
        },
      },
    ],
    style: {
      fill: boxBg,
      borderRadius: theme.radius,
    },
    border: { width: 2, color: boxBorder },
    animation: makeAnimation("scale-up", 200),
  });

  return makeSlide(theme, elements);
}
