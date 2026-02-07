import type { ImageComparisonSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_H,
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  titleBlock,
  makeAnimation,
  columnLayout,
  cardElement,
  bodyStyle,
} from "../helpers";

export function layoutImageComparison(
  slide: ImageComparisonSlideData,
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

  // Two columns for before/after
  const gap = 32;
  const cols = columnLayout(2, gap, CONTENT_X, CONTENT_W);
  const cardH = CANVAS_H - contentY - 60;
  const labelH = 40;
  const imageH = cardH - 24 * 2 - labelH - 16; // padding top/bottom, label, gap

  // Before card (left)
  const beforeChildren: LayoutElement[] = [
    {
      kind: "image",
      id: "before-image",
      rect: { x: 0, y: 0, w: cols[0].w, h: imageH },
      src: `${imageBase}/${slide.before.image}`,
      objectFit: "cover",
      borderRadius: theme.radiusSm,
    },
  ];
  if (slide.before.label) {
    beforeChildren.push({
      kind: "text",
      id: "before-label",
      rect: { x: 0, y: imageH + 16, w: cols[0].w, h: labelH },
      text: slide.before.label,
      style: bodyStyle(theme, 24, { fontWeight: 600, textAlign: "center" }),
    });
  }

  const beforeCard = cardElement(
    "before-card",
    { x: cols[0].x, y: contentY, w: cols[0].w, h: cardH },
    beforeChildren,
    theme,
    { padding: 24 },
  );
  beforeCard.animation = makeAnimation("slide-left", 200);
  elements.push(beforeCard);

  // After card (right)
  const afterChildren: LayoutElement[] = [
    {
      kind: "image",
      id: "after-image",
      rect: { x: 0, y: 0, w: cols[1].w, h: imageH },
      src: `${imageBase}/${slide.after.image}`,
      objectFit: "cover",
      borderRadius: theme.radiusSm,
    },
  ];
  if (slide.after.label) {
    afterChildren.push({
      kind: "text",
      id: "after-label",
      rect: { x: 0, y: imageH + 16, w: cols[1].w, h: labelH },
      text: slide.after.label,
      style: bodyStyle(theme, 24, { fontWeight: 600, textAlign: "center" }),
    });
  }

  const afterCard = cardElement(
    "after-card",
    { x: cols[1].x, y: contentY, w: cols[1].w, h: cardH },
    afterChildren,
    theme,
    { padding: 24 },
  );
  afterCard.animation = makeAnimation("slide-right", 200);
  elements.push(afterCard);

  return makeSlide(theme, elements);
}
