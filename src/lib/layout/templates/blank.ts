import type { BlankSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import { makeSlide, backgroundImage } from "../helpers";

export function layoutBlank(
  slide: BlankSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];

  // Background image (full-bleed, no overlay)
  if (slide.image) {
    // Use backgroundImage helper but only take the image element (no overlay)
    const bgEls = backgroundImage(slide.image, imageBase, "none");
    elements.push(...bgEls);
  }

  return makeSlide(theme, elements);
}
