import type { LayoutElement, ResolvedTheme, Rect } from "../types";
import type { SlideComponent } from "./types";
import { resolveComponent, type ResolveContext } from "./resolvers";
import { makeAnimation, staggerDelay } from "../helpers";

const DEFAULT_GAP = 28;

/**
 * Offset all elements' positions by (dx, dy) to convert from
 * component-local coordinates to absolute canvas coordinates.
 */
function offsetElements(elements: LayoutElement[], dx: number, dy: number): LayoutElement[] {
  return elements.map((el) => {
    const offset = {
      ...el,
      rect: {
        x: el.rect.x + dx,
        y: el.rect.y + dy,
        w: el.rect.w,
        h: el.rect.h,
      },
    };
    // Recursively offset group children
    if (el.kind === "group" && "children" in offset) {
      // Group children are relative to the group rect, no extra offset needed
    }
    return offset;
  });
}

export interface StackOptions {
  gap?: number;
  imageBase?: string;
  /** Apply staggered entrance animations to each component */
  animate?: boolean;
  /** Base delay for animation stagger (ms) */
  animationBaseDelay?: number;
  /** Prefix for component element IDs (default: "c"). Use distinct values per panel to avoid key collisions. */
  idPrefix?: string;
}

/**
 * Stack a list of SlideComponents vertically within a panel rect.
 *
 * Returns absolute-positioned LayoutElement[] on the 1920×1080 canvas.
 * Warns if total content height exceeds the panel.
 */
export function stackComponents(
  components: SlideComponent[],
  panel: Rect,
  theme: ResolvedTheme,
  opts: StackOptions & { textColor?: string } = {},
): LayoutElement[] {
  const gap = opts.gap ?? DEFAULT_GAP;
  const imageBase = opts.imageBase ?? "";
  const animate = opts.animate ?? true;
  const baseDelay = opts.animationBaseDelay ?? 100;

  const allElements: LayoutElement[] = [];
  let cursorY = 0;

  components.forEach((component, idx) => {
    const ctx: ResolveContext = {
      theme,
      panel: {
        x: panel.x,
        y: panel.y + cursorY,
        w: panel.w,
        h: panel.h - cursorY,
      },
      textColor: opts.textColor,
      idPrefix: `${opts.idPrefix ?? "c"}${idx}`,
      imageBase,
    };

    const { elements, height } = resolveComponent(component, ctx);

    // Offset from component-local (0,0) to absolute canvas position
    const positioned = offsetElements(elements, panel.x, panel.y + cursorY);

    // Apply staggered animation to top-level elements
    if (animate) {
      positioned.forEach((el) => {
        if (!el.animation) {
          (el as { animation: unknown }).animation = makeAnimation(
            "fade-up",
            staggerDelay(idx, baseDelay),
          );
        }
      });
    }

    allElements.push(...positioned);
    cursorY += height + (idx < components.length - 1 ? gap : 0);
  });

  // Warn on overflow in development
  if (cursorY > panel.h) {
    console.warn(
      `[stacker] Content height (${Math.round(cursorY)}px) exceeds panel height (${Math.round(panel.h)}px). ` +
        `Overflow of ${Math.round(cursorY - panel.h)}px.`,
    );
  }

  return allElements;
}
