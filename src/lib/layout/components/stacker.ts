import type { LayoutElement, ResolvedTheme, Rect } from "../types";
import type { SlideComponent } from "./types";
import { resolveComponent, type ResolveContext, type ResolveResult } from "./resolvers";
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
  /** Vertical alignment of stacked content within the panel (default: "top"). */
  verticalAlign?: "top" | "center" | "bottom";
}

/**
 * Stack a list of SlideComponents vertically within a panel rect.
 *
 * Returns absolute-positioned LayoutElement[] on the 1920×1080 canvas.
 * Supports flex spacers that expand to fill remaining vertical space.
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

  // --- Pass 1: resolve all components, measure fixed content ---
  interface Resolved {
    result: ResolveResult;
    effectiveGap: number; // gap before this component (0 for first)
    animIdx: number;      // stagger index (skips spacers)
  }

  const resolved: Resolved[] = [];
  let fixedH = 0;
  let flexCount = 0;
  let prevGapAfter: number | undefined;
  let animIdx = 0;

  components.forEach((component, idx) => {
    const isSpacer = component.type === "spacer";
    const curAnimIdx = isSpacer ? animIdx : animIdx++;

    const ctx: ResolveContext = {
      theme,
      panel: { x: panel.x, y: panel.y, w: panel.w, h: panel.h },
      textColor: opts.textColor,
      idPrefix: `${opts.idPrefix ?? "c"}${idx}`,
      imageBase,
      animate,
      animationDelay: staggerDelay(curAnimIdx, baseDelay),
    };

    const result = resolveComponent(component, ctx);

    let effectiveGap = 0;
    if (idx > 0) {
      effectiveGap = result.gapBefore ?? prevGapAfter ?? gap;
    }

    resolved.push({ result, effectiveGap, animIdx: curAnimIdx });
    fixedH += effectiveGap + result.height;
    if (result.flex) flexCount++;
    prevGapAfter = result.gapAfter;
  });

  // --- Compute flex spacer height ---
  const flexH = flexCount > 0 ? Math.max(0, (panel.h - fixedH) / flexCount) : 0;

  // --- Pass 2: position everything ---
  const allElements: LayoutElement[] = [];
  let cursorY = 0;

  resolved.forEach(({ result, effectiveGap, animIdx: aIdx }) => {
    cursorY += effectiveGap;

    const height = result.flex ? flexH : result.height;

    // Offset from component-local (0,0) to absolute canvas position
    const positioned = offsetElements(result.elements, panel.x, panel.y + cursorY);

    // Apply staggered animation to top-level elements
    if (animate) {
      positioned.forEach((el) => {
        if (!el.animation) {
          (el as { animation: unknown }).animation = makeAnimation(
            "fade-up",
            staggerDelay(aIdx, baseDelay),
          );
        }
      });
    }

    allElements.push(...positioned);
    cursorY += height;
  });

  // Warn on overflow in development
  if (cursorY > panel.h) {
    console.warn(
      `[stacker] Content height (${Math.round(cursorY)}px) exceeds panel height (${Math.round(panel.h)}px). ` +
        `Overflow of ${Math.round(cursorY - panel.h)}px.`,
    );
  }

  // Apply vertical alignment offset
  const vAlign = opts.verticalAlign ?? "top";
  if (vAlign !== "top" && cursorY < panel.h) {
    const dy = vAlign === "center"
      ? (panel.h - cursorY) / 2
      : panel.h - cursorY; // bottom
    allElements.forEach((el) => {
      el.rect = { ...el.rect, y: el.rect.y + dy };
    });
  }

  return allElements;
}
