import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import type { SlideData, ThemeName } from "@/lib/types";
import type { LayoutPresentation, LayoutSlide } from "./types";
import { resolveTheme } from "./theme";
import { getLayoutFunction } from "./templates";
import { applyDecorators } from "./decorators";
import { CANVAS_W, CANVAS_H } from "./helpers";

export function layoutSlide(
  slide: SlideData,
  theme: ThemeName | undefined,
  imageBase: string,
  slideIndex = 0,
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

  const result = layoutFn(slide, resolved, imageBase);

  // Apply theme decorators (background elements go first, foreground last)
  const { background, foreground } = applyDecorators(resolved, slideIndex);
  if (background.length > 0 || foreground.length > 0) {
    result.elements = [...background, ...result.elements, ...foreground];
  }

  return result;
}

export function layoutPresentation(
  title: string,
  slides: SlideData[],
  theme: ThemeName | undefined,
  imageBase: string,
  author?: string,
): LayoutPresentation {
  const layout: LayoutPresentation = {
    title,
    author,
    slides: slides.map((slide, i) => layoutSlide(slide, theme, imageBase, i)),
  };

  // Persist layout JSON for debugging/inspection (dev only)
  // Only write when the content directory already exists (real presentations)
  if (process.env.NODE_ENV !== "production") {
    try {
      const slug = imageBase.replace(/^\//, "");
      const contentDir = resolve(process.cwd(), "content", slug);
      const slidesYaml = resolve(contentDir, "slides.yaml");
      // Only write if this is a real presentation (has slides.yaml)
      // Skip write if content unchanged to avoid triggering Next.js fast refresh loop
      if (existsSync(slidesYaml)) {
        const outPath = resolve(contentDir, "layout.json");
        const json = JSON.stringify(layout, null, 2);
        const existing = existsSync(outPath) ? readFileSync(outPath, "utf8") : "";
        if (json !== existing) {
          writeFileSync(outPath, json);
        }
      }
    } catch {
      // Silently ignore — non-critical debug artifact
    }
  }

  return layout;
}

export { resolveTheme } from "./theme";
export { getLayoutFunction } from "./templates";
export type { LayoutPresentation, LayoutSlide, LayoutElement, ResolvedTheme } from "./types";
