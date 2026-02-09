// Decorator registry — maps DecoratorId to decorator functions.
// Templates call applyDecorators() to get decorator elements for the active theme.

import type { DecoratorId, LayoutElement, ResolvedTheme } from "../types";
import { splitBackground } from "./split-background";
import { edgeTabs } from "./edge-tabs";
import { sectionNumber } from "./section-number";
import { geometricAccent } from "./geometric-accent";
import { accentLine } from "./accent-line";
import { binderHoles } from "./binder-holes";
import { borderedBox } from "./bordered-box";
import { glowAccent } from "./glow-accent";
import { softGradientCircles } from "./soft-gradient-circles";
import { scanLines } from "./scan-lines";
import { gridOverlay } from "./grid-overlay";
import { halftoneDots } from "./halftone-dots";

export { splitBackground } from "./split-background";
export { edgeTabs } from "./edge-tabs";
export { sectionNumber } from "./section-number";
export { geometricAccent } from "./geometric-accent";
export { accentLine } from "./accent-line";
export { binderHoles } from "./binder-holes";
export { borderedBox } from "./bordered-box";
export { glowAccent } from "./glow-accent";
export { softGradientCircles } from "./soft-gradient-circles";
export { scanLines } from "./scan-lines";
export { gridOverlay } from "./grid-overlay";
export { halftoneDots } from "./halftone-dots";

type DecoratorFn = (theme: ResolvedTheme, slideIndex: number) => LayoutElement[];

/** Decorators that go behind content (background layer). */
const BACKGROUND_DECORATORS: Set<DecoratorId> = new Set([
  "split-bg",
  "soft-gradient-circles",
  "glow-accent",
  "scan-lines",
  "grid-overlay",
  "halftone-dots",
]);

const DECORATOR_REGISTRY: Record<DecoratorId, DecoratorFn> = {
  // Tier 1A — standard shapes
  "split-bg": (theme) => splitBackground(theme),
  "edge-tabs": (theme) => edgeTabs(theme),
  "section-number": (theme, slideIndex) => sectionNumber(theme, slideIndex),
  "geometric-accent": (theme) => geometricAccent(theme),
  "accent-line": (theme) => accentLine(theme),
  "binder-holes": (theme) => binderHoles(theme),
  "bordered-box": (theme) => borderedBox(theme),
  // Tier 1B — effects shapes
  "glow-accent": (theme) => glowAccent(theme),
  "soft-gradient-circles": (theme) => softGradientCircles(theme),
  "scan-lines": (theme) => scanLines(theme),
  "grid-overlay": (theme) => gridOverlay(theme),
  "halftone-dots": (theme) => halftoneDots(theme),
};

/**
 * Apply all decorators declared in the theme.
 * Returns background-layer elements (to prepend) and foreground elements (to append).
 */
export function applyDecorators(
  theme: ResolvedTheme,
  slideIndex: number,
): { background: LayoutElement[]; foreground: LayoutElement[] } {
  const decorators = theme.decorators ?? [];
  const background: LayoutElement[] = [];
  const foreground: LayoutElement[] = [];

  for (const id of decorators) {
    const fn = DECORATOR_REGISTRY[id];
    if (!fn) continue;
    const elements = fn(theme, slideIndex);
    if (BACKGROUND_DECORATORS.has(id)) {
      background.push(...elements);
    } else {
      foreground.push(...elements);
    }
  }

  return { background, foreground };
}
