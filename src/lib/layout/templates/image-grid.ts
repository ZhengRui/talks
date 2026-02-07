import type { ImageGridSlideData } from "@/lib/types";
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

export function layoutImageGrid(
  slide: ImageGridSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];
  const columns = slide.columns ?? 2;
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

  // Grid of images
  const gap = 32;
  const captionH = 40;
  const captionGap = 12;
  const count = slide.images.length;
  const perRow = Math.min(count, columns);
  const rows = Math.ceil(count / perRow);

  // Calculate image height to fill remaining space
  const availableH = CANVAS_H - contentY - 60;
  const rowSlotH = (availableH - (rows - 1) * gap) / rows;
  const imageH = rowSlotH - captionH - captionGap;

  const distributed = distributeHorizontal(perRow, CONTENT_W, gap, CONTENT_X, contentY, imageH);
  const itemW = distributed.length > 0 ? distributed[0].rect.w : CONTENT_W;

  slide.images.forEach((img, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const x = CONTENT_X + col * (itemW + gap);
    const y = contentY + row * (rowSlotH + gap);

    // Image
    elements.push({
      kind: "image",
      id: `image-${i}`,
      rect: { x, y, w: itemW, h: imageH },
      src: `${imageBase}/${img.src}`,
      objectFit: "cover",
      borderRadius: theme.radius,
      animation: makeAnimation("scale-up", staggerDelay(i, 200, 150)),
    });

    // Caption
    if (img.caption) {
      elements.push({
        kind: "text",
        id: `caption-${i}`,
        rect: { x, y: y + imageH + 12, w: itemW, h: captionH },
        text: img.caption,
        style: mutedStyle(theme, 24, { lineHeight: 1.4, textAlign: "center" }),
        animation: makeAnimation("fade-up", staggerDelay(i, 300, 150)),
      });
    }
  });

  return makeSlide(theme, elements);
}
