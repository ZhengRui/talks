import { resolve } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { isSceneSlideData, type SlideData, type ThemeName } from "@/lib/types";
import type { LayoutPresentation, LayoutSlide, LayoutElement } from "./types";
import { resolveTheme } from "./theme";
import { applyDecorators } from "./decorators";
import { CANVAS_W, CANVAS_H, backgroundImage, backgroundImageElements } from "./helpers";
import { resolveLayouts } from "./auto-layout";
import { resolveComponent } from "./components/resolvers";
import { resolveColor } from "./components/theme-tokens";
import { compileSceneSlide } from "@/lib/scene/compiler";

function layoutComponentSlide(
  slide: Exclude<SlideData, { mode: "scene" }>,
  resolvedTheme: ReturnType<typeof resolveTheme>,
  imageBase: string,
): LayoutSlide {
  const hasImage = !!slide.backgroundImage;
  const bg = resolveColor(slide.background, resolvedTheme, resolvedTheme.bg);

  const bgElements: LayoutElement[] = [];
  if (hasImage) {
    const overlay = slide.overlay ?? "dark";
    bgElements.push(...backgroundImage(slide.backgroundImage!, imageBase, overlay));
  }

  // When there's a dark overlay image, force white text + shadow
  const darkOverlay = hasImage && slide.overlay !== "light";
  const textColor = darkOverlay ? "#ffffff" : undefined;
  const textShadow = darkOverlay ? "0 2px 12px rgba(0,0,0,0.7)" : undefined;

  const elements: LayoutElement[] = [];
  (slide.children ?? []).forEach((child, i) => {
    const result = resolveComponent(child, {
      theme: resolvedTheme,
      panel: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H },
      idPrefix: `s-c${i}`,
      animate: true,
      imageBase,
      textColor,
      textShadow,
    });
    elements.push(...result.elements);
  });

  return {
    width: CANVAS_W,
    height: CANVAS_H,
    background: bg,
    elements: [...bgElements, ...elements],
  };
}

export function layoutSlide(
  slide: SlideData,
  theme: ThemeName | undefined,
  imageBase: string,
  slideIndex = 0,
): LayoutSlide {
  const resolved = resolveTheme(slide.theme ?? theme);
  const result = isSceneSlideData(slide)
    ? compileSceneSlide(slide, resolved, imageBase)
    : layoutComponentSlide(slide, resolved, imageBase);

  if (isSceneSlideData(slide) && result.backgroundImage) {
    const bgElements = backgroundImageElements(result.backgroundImage, result.overlay);
    result.elements = [...bgElements, ...result.elements];
    delete result.backgroundImage;
    delete result.overlay;
  }

  // Resolve auto-layout groups (flex/grid → absolute rects)
  result.elements = resolveLayouts(result.elements);

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
