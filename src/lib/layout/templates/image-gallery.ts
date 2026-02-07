import type { ImageGallerySlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_H,
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  titleBlock,
  makeAnimation,
  staggerDelay,
  distributeHorizontal,
  mutedStyle,
} from "../helpers";

export function layoutImageGallery(
  slide: ImageGallerySlideData,
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

  // Gallery — horizontal row of images with flex-like equal sizing
  const count = slide.images.length;
  const gap = 32;
  const captionH = 36;
  const availableH = CANVAS_H - contentY - 60 - captionH - 12;
  const imageH = availableH;

  const distributed = distributeHorizontal(count, CONTENT_W, gap, CONTENT_X, contentY, imageH);

  slide.images.forEach((img, i) => {
    const { rect } = distributed[i];

    // Image
    elements.push({
      kind: "image",
      id: `gallery-image-${i}`,
      rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
      src: `${imageBase}/${img.src}`,
      objectFit: "cover",
      borderRadius: theme.radius,
      animation: makeAnimation("scale-up", staggerDelay(i, 200, 150)),
    });

    // Caption
    if (img.caption) {
      elements.push({
        kind: "text",
        id: `gallery-caption-${i}`,
        rect: { x: rect.x, y: rect.y + rect.h + 12, w: rect.w, h: captionH },
        text: img.caption,
        style: mutedStyle(theme, 22, { lineHeight: 1.4, textAlign: "center" }),
        animation: makeAnimation("fade-up", staggerDelay(i, 300, 150)),
      });
    }
  });

  return makeSlide(theme, elements);
}
