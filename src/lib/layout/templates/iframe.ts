import type { IframeSlideData } from "@/lib/types";
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

export function layoutIframe(
  slide: IframeSlideData,
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

  // Placeholder rectangle representing the iframe area
  const placeholderW = 1600;
  const remainingH = CANVAS_H - contentY - 60;
  const placeholderH = remainingH;
  const placeholderX = (CANVAS_W - placeholderW) / 2;
  const placeholderY = contentY;

  // Background shape (simulating iframe/browser frame)
  elements.push({
    kind: "shape",
    id: "iframe-placeholder",
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

  // Browser-like top bar
  const barH = 40;
  elements.push({
    kind: "shape",
    id: "iframe-bar",
    rect: { x: placeholderX, y: placeholderY, w: placeholderW, h: barH },
    shape: "rect",
    style: {
      fill: theme.bgTertiary,
      borderRadius: 0,
    },
    animation: makeAnimation("fade-in", 200),
  });

  // Three "dots" in the top bar (simulating browser buttons)
  const dotSize = 12;
  const dotY = placeholderY + (barH - dotSize) / 2;
  const dotColors = ["#ef4444", "#eab308", "#22c55e"];
  dotColors.forEach((color, i) => {
    elements.push({
      kind: "shape",
      id: `browser-dot-${i}`,
      rect: { x: placeholderX + 16 + i * (dotSize + 8), y: dotY, w: dotSize, h: dotSize },
      shape: "circle",
      style: { fill: color },
      animation: makeAnimation("fade-in", 250),
    });
  });

  // Embedded content label
  elements.push({
    kind: "text",
    id: "iframe-label",
    rect: {
      x: (CANVAS_W - 600) / 2,
      y: placeholderY + barH + (placeholderH - barH) / 2 - 40,
      w: 600,
      h: 36,
    },
    text: "Embedded Content",
    style: headingStyle(theme, 28, { textAlign: "center" }),
    animation: makeAnimation("fade-up", 300),
  });

  // URL text
  elements.push({
    kind: "text",
    id: "iframe-url",
    rect: {
      x: (CANVAS_W - 1200) / 2,
      y: placeholderY + barH + (placeholderH - barH) / 2 + 10,
      w: 1200,
      h: 32,
    },
    text: slide.src,
    style: mutedStyle(theme, 22, { textAlign: "center" }),
    animation: makeAnimation("fade-up", 350),
  });

  return makeSlide(theme, elements);
}
