import type { NumberedListSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  titleBlock,
  makeAnimation,
  staggerDelay,
  headingStyle,
  bodyStyle,
} from "../helpers";

export function layoutNumberedList(
  slide: NumberedListSlideData,
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

  // Numbered items (badge + text, stacked vertically)
  const itemH = 52;
  const itemGap = 20;
  const badgeSize = 44;
  const textX = CONTENT_X + badgeSize + 20; // badge + gap
  const textW = CONTENT_W - badgeSize - 20;

  slide.items.forEach((item, i) => {
    const y = bottomY + i * (itemH + itemGap);

    // Badge (circle with number)
    elements.push({
      kind: "group",
      id: `badge-${i}`,
      rect: { x: CONTENT_X, y, w: badgeSize, h: badgeSize },
      children: [
        {
          kind: "text",
          id: `badge-${i}-text`,
          rect: { x: 0, y: 0, w: badgeSize, h: badgeSize },
          text: String(i + 1),
          style: headingStyle(theme, 24, {
            textAlign: "center",
            color: theme.bg,
            fontWeight: 700,
            verticalAlign: "middle",
          }),
        },
      ],
      style: {
        fill: theme.accent,
        borderRadius: 100,
      },
      animation: makeAnimation("fade-up", staggerDelay(i, 200)),
    });

    // Item text
    elements.push({
      kind: "text",
      id: `item-${i}`,
      rect: { x: textX, y: y + 4, w: textW, h: itemH },
      text: item,
      style: bodyStyle(theme, 30, { lineHeight: 1.5 }),
      animation: makeAnimation("fade-up", staggerDelay(i, 200)),
    });
  });

  return makeSlide(theme, elements);
}
