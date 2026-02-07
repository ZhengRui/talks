import type { SlideData, ThemeName } from "@/lib/types";
import type { LayoutPresentation, LayoutSlide } from "./types";
import { resolveTheme } from "./theme";
import { getLayoutFunction } from "./templates";
import { CANVAS_W, CANVAS_H } from "./helpers";

export function layoutSlide(
  slide: SlideData,
  theme: ThemeName | undefined,
  imageBase: string,
): LayoutSlide {
  const resolved = resolveTheme(slide.theme ?? theme);
  const layoutFn = getLayoutFunction(slide.template);

  if (!layoutFn) {
    // Fallback: blank slide with centered template name (for unconverted templates)
    return {
      width: 1920,
      height: 1080,
      background: resolved.bg,
      elements: [
        {
          kind: "text",
          id: "fallback",
          rect: { x: 0, y: CANVAS_H / 2 - 30, w: CANVAS_W, h: 60 },
          text: `[${slide.template}]`,
          style: {
            fontFamily: resolved.fontBody,
            fontSize: 36,
            fontWeight: 400,
            color: resolved.textMuted,
            lineHeight: 1.4,
            textAlign: "center",
          },
        },
      ],
    };
  }

  return layoutFn(slide, resolved, imageBase);
}

export function layoutPresentation(
  title: string,
  slides: SlideData[],
  theme: ThemeName | undefined,
  imageBase: string,
  author?: string,
): LayoutPresentation {
  return {
    title,
    author,
    slides: slides.map((slide) => layoutSlide(slide, theme, imageBase)),
  };
}

export { resolveTheme } from "./theme";
export { getLayoutFunction } from "./templates";
export type { LayoutPresentation, LayoutSlide, LayoutElement, ResolvedTheme } from "./types";
