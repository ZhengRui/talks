import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import type { SlideData, ThemeName } from "@/lib/types";
import type { LayoutPresentation, LayoutSlide } from "./types";
import { resolveTheme } from "./theme";
import { resolveColor } from "./theme-tokens";
import { applyDecorators } from "./decorators";
import { backgroundImageElements } from "./helpers";
import { compileSceneSlide } from "@/lib/scene/compiler";

export function layoutSlide(
  slide: SlideData,
  theme: ThemeName | undefined,
  imageBase: string,
  slideIndex = 0,
): LayoutSlide {
  const resolved = resolveTheme(slide.theme ?? theme);
  const backgroundOverride = typeof slide.background === "string"
    ? resolveColor(slide.background, resolved, resolved.bg)
    : undefined;
  const result = compileSceneSlide(slide, resolved, imageBase);
  if (backgroundOverride) {
    result.background = backgroundOverride;
  }

  if (result.backgroundImage) {
    const bgElements = backgroundImageElements(result.backgroundImage, result.overlay);
    result.elements = [...bgElements, ...result.elements];
    delete result.backgroundImage;
    delete result.overlay;
  }

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
  if (process.env.NODE_ENV !== "production") {
    try {
      const slug = imageBase.replace(/^\//, "");
      const contentDir = resolve(process.cwd(), "content", slug);
      const slidesYaml = resolve(contentDir, "slides.yaml");
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
export type { LayoutPresentation, LayoutSlide, LayoutElement, ResolvedTheme } from "./types";
