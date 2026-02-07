import type { VideoSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  makeSlide,
  titleBlock,
  makeAnimation,
  headingStyle,
  mutedStyle,
} from "../helpers";

export function layoutVideo(
  slide: VideoSlideData,
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

  // Placeholder rectangle representing the video area
  const placeholderW = 1400;
  const placeholderH = 600;
  const placeholderX = (CANVAS_W - placeholderW) / 2;
  const remainingH = CANVAS_H - contentY - 60;
  const placeholderY = contentY + (remainingH - placeholderH) / 2;

  // Background shape (simulating video player area)
  elements.push({
    kind: "shape",
    id: "video-placeholder",
    rect: { x: placeholderX, y: placeholderY, w: placeholderW, h: placeholderH },
    shape: "rect",
    style: {
      fill: theme.bgSecondary,
      borderRadius: theme.radius,
      shadow: theme.shadow,
    },
    border: theme.cardBorder,
    animation: makeAnimation("fade-in", 200),
  });

  // Play icon (triangle-like text placeholder)
  const playSize = 80;
  elements.push({
    kind: "text",
    id: "play-icon",
    rect: {
      x: (CANVAS_W - playSize) / 2,
      y: placeholderY + (placeholderH - playSize) / 2 - 40,
      w: playSize,
      h: playSize,
    },
    text: "\u25B6",
    style: {
      fontFamily: theme.fontBody,
      fontSize: 64,
      fontWeight: 400,
      color: theme.accent,
      lineHeight: 1,
      textAlign: "center",
      verticalAlign: "middle",
    },
    animation: makeAnimation("scale-up", 300),
  });

  // "Video" label
  elements.push({
    kind: "text",
    id: "video-label",
    rect: {
      x: (CANVAS_W - 600) / 2,
      y: placeholderY + (placeholderH - playSize) / 2 + 50,
      w: 600,
      h: 36,
    },
    text: "Video",
    style: headingStyle(theme, 28, { textAlign: "center" }),
    animation: makeAnimation("fade-up", 350),
  });

  // URL text
  elements.push({
    kind: "text",
    id: "video-url",
    rect: {
      x: (CANVAS_W - 1000) / 2,
      y: placeholderY + (placeholderH - playSize) / 2 + 100,
      w: 1000,
      h: 32,
    },
    text: slide.src,
    style: mutedStyle(theme, 22, { textAlign: "center" }),
    animation: makeAnimation("fade-up", 400),
  });

  return makeSlide(theme, elements);
}
