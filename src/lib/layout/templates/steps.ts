import type { StepsSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_H,
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  titleBlock,
  makeAnimation,
  staggerDelay,
  cardElement,
  headingStyle,
  mutedStyle,
} from "../helpers";

export function layoutSteps(
  slide: StepsSlideData,
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

  // Steps — vertical list with badge numbers and connector lines
  const count = slide.steps.length;
  const badgeSize = 48;
  const stepGap = 24;
  const connectorW = 3;
  const connectorGap = 24; // gap between badge column and card

  // Calculate step height to fill available space
  const availableH = CANVAS_H - contentY - 60;
  const stepH = Math.min(120, (availableH - (count - 1) * stepGap) / count);

  // Badge column x and card x
  const badgeX = CONTENT_X;
  const cardX = CONTENT_X + badgeSize + connectorGap;
  const cardW = CONTENT_W - badgeSize - connectorGap;

  slide.steps.forEach((step, i) => {
    const y = contentY + i * (stepH + stepGap);
    const delay = staggerDelay(i, 200, 150);

    // Badge circle (accent background, number inside)
    elements.push({
      kind: "group",
      id: `badge-${i}`,
      rect: { x: badgeX, y: y + (stepH - badgeSize) / 2, w: badgeSize, h: badgeSize },
      children: [
        {
          kind: "text",
          id: `badge-${i}-num`,
          rect: { x: 0, y: 0, w: badgeSize, h: badgeSize },
          text: String(i + 1),
          style: {
            fontFamily: theme.fontBody,
            fontSize: 24,
            fontWeight: 700,
            color: theme.bg,
            lineHeight: 1,
            textAlign: "center",
            verticalAlign: "middle",
          },
        },
      ],
      style: {
        fill: theme.accent,
        borderRadius: 100,
      },
      animation: makeAnimation("scale-up", delay),
    });

    // Connector line (between badges, except after last)
    if (i < count - 1) {
      const lineX = badgeX + badgeSize / 2 - connectorW / 2;
      const lineY = y + (stepH + badgeSize) / 2;
      const lineH = stepGap + (stepH - badgeSize);

      elements.push({
        kind: "shape",
        id: `connector-${i}`,
        rect: { x: lineX, y: lineY, w: connectorW, h: lineH },
        shape: "rect",
        style: { fill: theme.border.color },
        animation: makeAnimation("fade-in", delay + 100),
      });
    }

    // Step card with label and description
    const cardChildren: LayoutElement[] = [
      {
        kind: "text",
        id: `step-${i}-label`,
        rect: { x: 0, y: 0, w: cardW, h: 36 },
        text: step.label,
        style: headingStyle(theme, 30, { textAlign: "left" }),
      },
    ];

    if (step.description) {
      cardChildren.push({
        kind: "text",
        id: `step-${i}-desc`,
        rect: { x: 0, y: 40, w: cardW, h: 32 },
        text: step.description,
        style: mutedStyle(theme, 24, { textAlign: "left" }),
      });
    }

    const card = cardElement(
      `step-card-${i}`,
      { x: cardX, y, w: cardW, h: stepH },
      cardChildren,
      theme,
      { padding: 24 },
    );
    card.animation = makeAnimation("fade-up", delay + 50);
    elements.push(card);
  });

  return makeSlide(theme, elements);
}
