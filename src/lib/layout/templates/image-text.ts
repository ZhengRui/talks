import type { ImageTextSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  CONTENT_X,
  makeSlide,
  titleBlock,
  makeAnimation,
  staggerDelay,
  bodyStyle,
} from "../helpers";

export function layoutImageText(
  slide: ImageTextSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];
  const position = slide.imagePosition ?? "left";
  const gap = 40;
  const colW = (CANVAS_W - CONTENT_X * 2 - gap) / 2; // two equal columns within content area
  const leftX = CONTENT_X;
  const rightX = CONTENT_X + colW + gap;

  const imgX = position === "left" ? leftX : rightX;
  const textX = position === "left" ? rightX : leftX;
  const imgAnim = position === "left" ? "slide-left" : "slide-right";
  const textAnim = position === "left" ? "slide-right" : "slide-left";

  // Image column — full height
  elements.push({
    kind: "image",
    id: "image",
    rect: { x: imgX, y: 0, w: colW, h: CANVAS_H },
    src: `${imageBase}/${slide.image}`,
    objectFit: "cover",
    borderRadius: theme.radius,
    animation: makeAnimation(imgAnim, 200),
  });

  // Text column — vertically centered content
  let textY = 60;

  // Title + accent line (left-aligned within text column)
  const { elements: titleEls, bottomY } = titleBlock(slide.title, theme, {
    align: "left",
    fontSize: 48,
    accentWidth: 80,
    startY: CANVAS_H * 0.25,
    maxWidth: colW,
  });

  // Offset title elements to text column x position
  const offsetTitleEls = titleEls.map((el) => ({
    ...el,
    rect: { ...el.rect, x: textX + (el.rect.x - CONTENT_X) },
  }));
  offsetTitleEls.forEach((el) => {
    if (el.animation) {
      el.animation = makeAnimation(el.animation.type as "fade-up", el.animation.delay, el.animation.duration);
    }
  });
  elements.push(...offsetTitleEls);
  textY = bottomY + (CANVAS_H * 0.25 - 60);

  // Body text
  if (slide.body) {
    elements.push({
      kind: "text",
      id: "body",
      rect: { x: textX, y: textY, w: colW, h: 120 },
      text: slide.body,
      style: bodyStyle(theme, 28, { lineHeight: 1.7 }),
      animation: makeAnimation(textAnim, 300),
    });
    textY += 140;
  }

  // Bullets
  if (slide.bullets) {
    elements.push({
      kind: "list",
      id: "bullets",
      rect: { x: textX, y: textY, w: colW, h: slide.bullets.length * 44 },
      items: slide.bullets,
      ordered: false,
      itemStyle: bodyStyle(theme, 26),
      bulletColor: theme.accent,
      itemSpacing: 8,
      animation: makeAnimation("fade-up", staggerDelay(0, 400)),
    });
  }

  return makeSlide(theme, elements);
}
