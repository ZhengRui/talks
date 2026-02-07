import type { DefinitionSlideData } from "@/lib/types";
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

export function layoutDefinition(
  slide: DefinitionSlideData,
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

  // Definition items (term + description, separated by border lines)
  const termH = 36;
  const descH = 40;
  const itemPaddingY = 24;
  const itemTotalH = itemPaddingY + termH + 8 + descH + itemPaddingY;

  slide.definitions.forEach((def, i) => {
    const y = bottomY + i * itemTotalH;

    // Term (accent colored, bold)
    elements.push({
      kind: "text",
      id: `term-${i}`,
      rect: { x: CONTENT_X, y: y + itemPaddingY, w: CONTENT_W, h: termH },
      text: def.term,
      style: headingStyle(theme, 30, {
        textAlign: "left",
        color: theme.accent,
        fontWeight: 700,
      }),
      animation: makeAnimation("fade-up", staggerDelay(i, 200)),
    });

    // Description
    elements.push({
      kind: "text",
      id: `desc-${i}`,
      rect: { x: CONTENT_X, y: y + itemPaddingY + termH + 8, w: CONTENT_W, h: descH },
      text: def.description,
      style: bodyStyle(theme, 28, { lineHeight: 1.6 }),
      animation: makeAnimation("fade-up", staggerDelay(i, 200)),
    });

    // Border line between items
    elements.push({
      kind: "shape",
      id: `border-${i}`,
      rect: { x: CONTENT_X, y: y + itemTotalH, w: CONTENT_W, h: 1 },
      shape: "rect",
      style: { fill: theme.border.color },
      animation: makeAnimation("fade-in", staggerDelay(i, 200)),
    });
  });

  return makeSlide(theme, elements);
}
