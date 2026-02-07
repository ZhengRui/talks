import type { BulletSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_H,
  CONTENT_X,
  CONTENT_W,
  PADDING_Y,
  makeSlide,
  backgroundImage,
  titleBlock,
  makeAnimation,
  staggerDelay,
  estimateTextHeight,
} from "../helpers";

export function layoutBullets(
  slide: BulletSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];

  // Background image + overlay (optional)
  if (slide.image) {
    elements.push(...backgroundImage(slide.image, imageBase));
  }

  // Title + accent line (left-aligned)
  const { elements: titleEls, bottomY } = titleBlock(slide.title, theme, {
    align: "left",
    fontSize: 56,
    accentWidth: 80,
    startY: PADDING_Y,
  });
  elements.push(...titleEls);

  // Bullet cards (stacked vertically, left-aligned)
  const bulletGap = 16;
  const bulletPadding = 16;
  const bulletFontSize = 30;
  const bulletLineH = 1.6;
  const bulletX = CONTENT_X;
  const bulletW = CONTENT_W;
  const textW = bulletW - 48;

  // Calculate per-bullet heights
  const bulletHeights = slide.bullets.map((b) =>
    estimateTextHeight(b, bulletFontSize, bulletLineH, textW) + bulletPadding * 2,
  );

  // Scale down if total exceeds available space
  const totalH = bulletHeights.reduce((s, h) => s + h, 0) + (slide.bullets.length - 1) * bulletGap;
  const availableH = CANVAS_H - bottomY - 60;
  const scale = totalH > availableH ? availableH / totalH : 1;

  let y = bottomY;
  slide.bullets.forEach((bullet, i) => {
    const bulletH = Math.round(bulletHeights[i] * scale);
    const textH = bulletH - bulletPadding * 2;

    elements.push({
      kind: "group",
      id: `bullet-${i}`,
      rect: { x: bulletX, y, w: bulletW, h: bulletH },
      children: [
        {
          kind: "text",
          id: `bullet-${i}-text`,
          rect: { x: 24, y: bulletPadding, w: textW, h: textH },
          text: bullet,
          style: {
            fontFamily: theme.fontBody,
            fontSize: bulletFontSize,
            fontWeight: 400,
            color: theme.text,
            lineHeight: bulletLineH,
            textAlign: "left",
          },
        },
      ],
      style: {
        fill: theme.bgSecondary,
        borderRadius: theme.radiusSm,
      },
      border: { width: 3, color: theme.accent, sides: ["left"] },
      animation: makeAnimation("fade-up", staggerDelay(i, 200)),
    });

    y += bulletH + Math.round(bulletGap * scale);
  });

  return makeSlide(theme, elements);
}
