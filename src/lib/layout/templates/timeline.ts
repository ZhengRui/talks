import type { TimelineSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_H,
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  titleBlock,
  makeAnimation,
  staggerDelay,
  headingStyle,
  mutedStyle,
} from "../helpers";

export function layoutTimeline(
  slide: TimelineSlideData,
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

  // Timeline layout — horizontal line with dots and event info below
  const count = slide.events.length;
  const lineY = contentY + 18; // center of dots (dot is 16px, so center at +8, but CSS uses top:18px)
  const dotSize = 16;
  const dotBorderSize = 3;

  // Horizontal connector line spanning full content width
  elements.push({
    kind: "shape",
    id: "timeline-line",
    rect: { x: CONTENT_X, y: lineY - 1, w: CONTENT_W, h: 3 },
    shape: "rect",
    style: { fill: theme.border.color },
    animation: makeAnimation("fade-in", 100),
  });

  // Distribute events horizontally
  const eventW = CONTENT_W / count;
  const eventStartX = CONTENT_X;

  slide.events.forEach((event, i) => {
    const centerX = eventStartX + i * eventW + eventW / 2;
    const dotX = centerX - dotSize / 2;
    const dotY = lineY - dotSize / 2 + 1;
    const delay = staggerDelay(i, 200, 150);

    // Dot (circle with accent color and border)
    // Outer ring
    elements.push({
      kind: "shape",
      id: `dot-ring-${i}`,
      rect: { x: dotX - 2, y: dotY - 2, w: dotSize + 4, h: dotSize + 4 },
      shape: "circle",
      style: { fill: theme.accent },
      animation: makeAnimation("scale-up", delay),
    });

    // Inner dot (bg color to simulate border effect)
    elements.push({
      kind: "shape",
      id: `dot-inner-${i}`,
      rect: {
        x: dotX + dotBorderSize - 2,
        y: dotY + dotBorderSize - 2,
        w: dotSize - (dotBorderSize - 2) * 2,
        h: dotSize - (dotBorderSize - 2) * 2,
      },
      shape: "circle",
      style: { fill: theme.bg },
      animation: makeAnimation("scale-up", delay),
    });

    // Core accent dot
    elements.push({
      kind: "shape",
      id: `dot-core-${i}`,
      rect: {
        x: dotX + 1,
        y: dotY + 1,
        w: dotSize - 2,
        h: dotSize - 2,
      },
      shape: "circle",
      style: { fill: theme.accent },
      animation: makeAnimation("scale-up", delay),
    });

    // Date text (accent color, below dot)
    const textX = centerX - eventW / 2 + 16;
    const textW = eventW - 32;
    const dateY = dotY + dotSize + 16;

    elements.push({
      kind: "text",
      id: `date-${i}`,
      rect: { x: textX, y: dateY, w: textW, h: 32 },
      text: event.date,
      style: {
        fontFamily: theme.fontBody,
        fontSize: 26,
        fontWeight: 700,
        color: theme.accent,
        lineHeight: 1.2,
        textAlign: "center",
      },
      animation: makeAnimation("fade-up", delay + 50),
    });

    // Label text (bold heading)
    const labelY = dateY + 40;
    elements.push({
      kind: "text",
      id: `label-${i}`,
      rect: { x: textX, y: labelY, w: textW, h: 32 },
      text: event.label,
      style: headingStyle(theme, 26, { textAlign: "center", fontWeight: 700 }),
      animation: makeAnimation("fade-up", delay + 100),
    });

    // Description text (muted, optional)
    if (event.description) {
      const descY = labelY + 40;
      const descH = Math.min(100, CANVAS_H - descY - 40);
      elements.push({
        kind: "text",
        id: `desc-${i}`,
        rect: { x: textX, y: descY, w: textW, h: descH },
        text: event.description,
        style: mutedStyle(theme, 24, { textAlign: "center" }),
        animation: makeAnimation("fade-up", delay + 150),
      });
    }
  });

  return makeSlide(theme, elements);
}
