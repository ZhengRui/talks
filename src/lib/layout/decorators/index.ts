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

export { splitBackground } from "./split-background";
export { edgeTabs } from "./edge-tabs";
export { sectionNumber } from "./section-number";
export { geometricAccent } from "./geometric-accent";
export { accentLine } from "./accent-line";
export { binderHoles } from "./binder-holes";
export { borderedBox } from "./bordered-box";

type DecoratorFn = (theme: ResolvedTheme, slideIndex: number) => LayoutElement[];

const DECORATOR_REGISTRY: Record<DecoratorId, DecoratorFn> = {
  "split-bg": (theme) => splitBackground(theme),
  "edge-tabs": (theme) => edgeTabs(theme),
  "section-number": (theme, slideIndex) => sectionNumber(theme, slideIndex),
  "geometric-accent": (theme) => geometricAccent(theme),
  "accent-line": (theme) => accentLine(theme),
  "binder-holes": (theme) => binderHoles(theme),
  "bordered-box": (theme) => borderedBox(theme),
};

/**
 * Apply all decorators declared in the theme.
 * Returns background-layer elements (to prepend) and foreground elements (to append).
 * split-bg goes behind content; everything else goes on top.
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
    if (id === "split-bg") {
      background.push(...elements);
    } else {
      foreground.push(...elements);
    }
  }

  return { background, foreground };
}
