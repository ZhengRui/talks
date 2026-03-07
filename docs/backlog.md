# Backlog

## PPTX Fidelity Gap

Identified from `content/replicate-iran-war-2026` — first 10 slides look dramatically different after PPTX export. These are fundamental CSS-vs-OOXML gaps, not IR design issues.

### High Impact, Low Effort

**Font fallback map** — Staatliches and Figtree are not in `pptx-helpers.ts` fallback map. PowerPoint substitutes system fonts, destroying the visual hierarchy on large dramatic titles (77-134px). Fix: add Staatliches → Impact, Figtree → Calibri mappings.

**`repeating-linear-gradient` parser** — `parseCssGradients()` only handles `linear-gradient(` and `radial-gradient(`. Repeating variants (`repeating-linear-gradient` for grid/scan-line patterns) fall through to `extractSolidColor()` and render as flat backgrounds. Fix: extend regex to match `repeating-*` variants.

### Medium Impact, Medium Effort

**Stacked radial gradients** — Slide backgrounds use multiple `radial-gradient()` layers (e.g., `radial-gradient(ellipse at 20% 80%, rgba(255,45,45,0.2)...), radial-gradient(ellipse at 80% 20%,...), #080808`). Each becomes a separate OOXML shape; opacity blending between layers is approximate. Could improve alpha math in `buildCssGradFillXml()`.

**clipPath polygon** — Glitch title effect uses `clipPath: "polygon(0 0, 100% 0, 100% 35%, 0 35%)"` to slice text into layers. No OOXML equivalent for arbitrary polygon clipping. Could approximate by adjusting element rects or using OOXML `<a:custGeom>` custom geometry.

### Not Feasible in PPTX

**`flipH` on text elements** — PowerPoint's `flipH="1"` attribute on `<a:xfrm>` flips shape geometry but preserves text readability — text inside a flipped text box still renders left-to-right. CSS `transform: scaleX(-1)` mirrors everything including text. This is a fundamental PowerPoint text rendering behavior. `flipV` works as expected (text renders upside down). Shapes without text flip correctly.

**Continuous/looping animations** — `float-up 6s infinite`, `drift`, `pulse-ring`, `glitch-anim` are CSS keyframe loops. PPTX's OOXML timing model only supports one-shot entrance/exit animations triggered on click or after delay. Looping animations are architecturally impossible in PowerPoint.

## Component/DSL Template Layer Redesign

Phase 1 (v8) exposed `transform` and `TextRun[]` at the IR level, but the component layer and DSL templates can't surface them. Current limitations:

- Component types (`BulletsComponent`, `StatComponent`, etc.) output plain strings, not `RichText`
- No `transform` param on any component or template
- DSL `.template.yaml` files can only express what the component types support
- Freeform is the only way to access full IR expressiveness

This limits the framework's expressive power — the IR can do more than the template layer can express. Future redesign should consider:

- Allowing `transform` on any component via a shared base field
- Supporting `RichText` (TextRun arrays) in component text fields
- Possibly a more flexible component model that doesn't require rigid type interfaces for every combination
