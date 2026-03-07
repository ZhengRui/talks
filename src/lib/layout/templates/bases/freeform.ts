import type { FreeformSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../../types";
import { CANVAS_W, CANVAS_H, backgroundImage } from "../../helpers";
import { resolveRawTokens } from "../../components/resolvers";
import { resolveColor } from "../../components/theme-tokens";

/** Fill in missing or partial rects with zeros (for children of layout groups). */
function ensureRects(elements: LayoutElement[]): LayoutElement[] {
  return elements.map((el) => {
    const rect = el.rect
      ? { x: el.rect.x ?? 0, y: el.rect.y ?? 0, w: el.rect.w ?? 0, h: el.rect.h ?? 0 }
      : { x: 0, y: 0, w: 0, h: 0 };
    if (el.kind === "group" && el.children) {
      return { ...el, rect, children: ensureRects(el.children) };
    }
    return el.rect ? el : { ...el, rect };
  });
}

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

  // Pass through elements with rect defaulting, image src prefixing, and theme token resolution
  elements.push(...resolveRawTokens(prefixImageSrcs(ensureRects(slide.elements), imageBase), theme));

  return {
    width: CANVAS_W,
    height: CANVAS_H,
    background: resolveColor(slide.background, theme, theme.bg),
    // Note: backgroundImage and overlay are handled as elements via the
    // backgroundImage() helper. Don't set them on LayoutSlide — the PPTX
    // renderer would place the overlay behind the image element.
    elements,
  };
}
