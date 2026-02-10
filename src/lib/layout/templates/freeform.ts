import type { FreeformSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import { CANVAS_W, CANVAS_H, backgroundImage } from "../helpers";

/** Prefix relative image src values with imageBase (e.g. "/superbowl"). */
function prefixImageSrcs(elements: LayoutElement[], imageBase: string): LayoutElement[] {
  return elements.map((el) => {
    if (el.kind === "image" && el.src && !el.src.startsWith("/") && !el.src.startsWith("data:") && !el.src.startsWith("http")) {
      return { ...el, src: `${imageBase}/${el.src}` };
    }
    if (el.kind === "group" && el.children) {
      return { ...el, children: prefixImageSrcs(el.children, imageBase) };
    }
    return el;
  });
}

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

  // Pass through elements with image src prefixing
  elements.push(...prefixImageSrcs(slide.elements, imageBase));

  return {
    width: CANVAS_W,
    height: CANVAS_H,
    background: slide.background ?? theme.bg,
    // Note: backgroundImage and overlay are handled as elements via the
    // backgroundImage() helper. Don't set them on LayoutSlide — the PPTX
    // renderer would place the overlay behind the image element.
    elements,
  };
}
