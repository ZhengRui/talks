import type { ImageCaptionSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  makeSlide,
  titleBlock,
  makeAnimation,
  mutedStyle,
} from "../helpers";

export function layoutImageCaption(
  slide: ImageCaptionSlideData,
  theme: ResolvedTheme,
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

  // Caption height reservation
  const captionH = 80;
  const captionGap = 20;

  // Image (centered, max ~60vh equivalent = ~648px)
  const maxImgH = Math.min(648, CANVAS_H - contentY - 60 - captionH - captionGap);
  const imgW = 1200;
  const imgX = (CANVAS_W - imgW) / 2;

  elements.push({
    kind: "image",
    id: "caption-image",
    rect: { x: imgX, y: contentY, w: imgW, h: maxImgH },
    src: `${imageBase}/${slide.image}`,
    objectFit: "contain",
    borderRadius: theme.radius,
    animation: makeAnimation("scale-up", 200),
  });

  // Caption text
  const captionW = 900;
  elements.push({
    kind: "text",
    id: "caption",
    rect: {
      x: (CANVAS_W - captionW) / 2,
      y: contentY + maxImgH + captionGap,
      w: captionW,
      h: captionH,
    },
    text: slide.caption,
    style: mutedStyle(theme, 26, { textAlign: "center", lineHeight: 1.5 }),
    animation: makeAnimation("fade-up", 400),
  });

  return makeSlide(theme, elements);
}
