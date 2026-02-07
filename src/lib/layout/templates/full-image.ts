import type { FullImageSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  makeSlide,
  backgroundImage,
  makeAnimation,
  estimateTextHeight,
} from "../helpers";

export function layoutFullImage(
  slide: FullImageSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const overlay = slide.overlay ?? "dark";
  const elements: LayoutElement[] = [];

  // Background image + overlay
  elements.push(...backgroundImage(slide.image, imageBase, overlay));

  const textColor = overlay === "light" ? theme.heading : "#ffffff";
  const textShadow =
    overlay === "light"
      ? "0 1px 4px rgba(255,255,255,0.6)"
      : "0 2px 12px rgba(0,0,0,0.7)";

  // Calculate content heights for vertical centering
  const gap = 24;
  const maxTitleW = 1400;
  const maxBodyW = 1200;

  let titleHeight = 0;
  let bodyHeight = 0;

  if (slide.title) {
    titleHeight = estimateTextHeight(slide.title, 64, 1.1, maxTitleW);
  }
  if (slide.body) {
    bodyHeight = estimateTextHeight(slide.body, 30, 1.6, maxBodyW);
  }

  const totalContentH =
    titleHeight +
    (titleHeight > 0 && bodyHeight > 0 ? gap : 0) +
    bodyHeight;

  let y = (CANVAS_H - totalContentH) / 2;

  // Title
  if (slide.title) {
    elements.push({
      kind: "text",
      id: "title",
      rect: { x: (CANVAS_W - maxTitleW) / 2, y, w: maxTitleW, h: titleHeight },
      text: slide.title,
      style: {
        fontFamily: theme.fontHeading,
        fontSize: 64,
        fontWeight: 700,
        color: textColor,
        lineHeight: 1.1,
        textAlign: "center",
        textShadow,
      },
      animation: makeAnimation("fade-up", 200),
    });
    y += titleHeight + gap;
  }

  // Body
  if (slide.body) {
    elements.push({
      kind: "text",
      id: "body",
      rect: { x: (CANVAS_W - maxBodyW) / 2, y, w: maxBodyW, h: bodyHeight },
      text: slide.body,
      style: {
        fontFamily: theme.fontBody,
        fontSize: 30,
        fontWeight: 400,
        color: textColor,
        lineHeight: 1.6,
        textAlign: "center",
        textShadow,
      },
      animation: makeAnimation("fade-up", 400),
    });
  }

  return makeSlide(theme, elements);
}
