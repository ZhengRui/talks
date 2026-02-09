import type { FreeformSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import { CANVAS_W, CANVAS_H, backgroundImage } from "../helpers";

export function layoutFreeform(
  slide: FreeformSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];

  // Background image + overlay (same pattern as other templates)
  if (slide.backgroundImage) {
    const overlay = slide.overlay ?? "none";
    elements.push(...backgroundImage(slide.backgroundImage, imageBase, overlay));
  }

  // Pass through all elements as-is — caller provides absolute coordinates
  elements.push(...slide.elements);

  return {
    width: CANVAS_W,
    height: CANVAS_H,
    background: slide.background ?? theme.bg,
    backgroundImage: slide.backgroundImage,
    overlay: slide.overlay,
    elements,
  };
}
