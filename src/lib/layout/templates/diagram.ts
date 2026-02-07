import type { DiagramSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  makeSlide,
  titleBlock,
  makeAnimation,
  mutedStyle,
} from "../helpers";

export function layoutDiagram(
  slide: DiagramSlideData,
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
  const captionH = slide.caption ? 50 : 0;
  const captionGap = slide.caption ? 20 : 0;

  // Diagram image (centered, max ~55vh equivalent = ~594px)
  const maxImgH = Math.min(594, CANVAS_H - contentY - 60 - captionH - captionGap);
  const imgW = 1200;
  const imgX = (CANVAS_W - imgW) / 2;

  elements.push({
    kind: "image",
    id: "diagram-image",
    rect: { x: imgX, y: contentY, w: imgW, h: maxImgH },
    src: `${imageBase}/${slide.image}`,
    objectFit: "contain",
    borderRadius: theme.radius,
    animation: makeAnimation("scale-up", 200),
  });

  // Optional caption
  if (slide.caption) {
    const captionW = 1200;
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
      style: mutedStyle(theme, 24, { textAlign: "center" }),
      animation: makeAnimation("fade-up", 400),
    });
  }

  return makeSlide(theme, elements);
}
