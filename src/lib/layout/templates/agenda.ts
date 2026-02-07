import type { AgendaSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_H,
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  titleBlock,
  makeAnimation,
  staggerDelay,
  bodyStyle,
  estimateTextHeight,
} from "../helpers";

export function layoutAgenda(
  slide: AgendaSlideData,
  theme: ResolvedTheme,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];

  // Title + accent line (left-aligned)
  const { elements: titleEls, bottomY } = titleBlock(slide.title, theme, {
    align: "left",
    fontSize: 56,
    accentWidth: 80,
  });
  elements.push(...titleEls);

  // Agenda items (stacked, with left accent border and conditional styling)
  const itemPadding = 16;
  const itemFontSize = 30;
  const itemLineH = 1.5;
  const itemGap = 12;
  const textW = CONTENT_W - 48;
  const hasActiveIndex = slide.activeIndex !== undefined;

  // Calculate per-item heights
  const itemHeights = slide.items.map((item) =>
    estimateTextHeight(item, itemFontSize, itemLineH, textW) + itemPadding * 2,
  );

  // Scale down if total exceeds available space
  const totalH = itemHeights.reduce((s, h) => s + h, 0) + (slide.items.length - 1) * itemGap;
  const availableH = CANVAS_H - bottomY - 60;
  const scale = totalH > availableH ? availableH / totalH : 1;

  let y = bottomY;
  slide.items.forEach((item, i) => {
    const itemH = Math.round(itemHeights[i] * scale);
    const isActive = slide.activeIndex === undefined || i === slide.activeIndex;
    const opacity = hasActiveIndex ? (isActive ? 1 : 0.5) : 1;
    const fontWeight = isActive && hasActiveIndex ? 600 : 400;
    const showBorder = hasActiveIndex ? isActive : true;
    const showBg = isActive && hasActiveIndex;

    elements.push({
      kind: "group",
      id: `agenda-${i}`,
      rect: { x: CONTENT_X, y, w: CONTENT_W, h: itemH },
      children: [
        {
          kind: "text",
          id: `agenda-${i}-text`,
          rect: { x: 24, y: itemPadding, w: textW, h: itemH - itemPadding * 2 },
          text: item,
          style: bodyStyle(theme, itemFontSize, {
            lineHeight: itemLineH,
            fontWeight,
          }),
        },
      ],
      style: {
        fill: showBg ? theme.bgSecondary : "transparent",
        borderRadius: theme.radiusSm,
        opacity,
      },
      border: showBorder
        ? { width: 3, color: theme.accent, sides: ["left"] }
        : { width: 3, color: "transparent", sides: ["left"] },
      animation: makeAnimation("fade-up", staggerDelay(i, 200)),
    });

    y += itemH + Math.round(itemGap * scale);
  });

  return makeSlide(theme, elements);
}
