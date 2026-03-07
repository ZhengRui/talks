# Backlog

## PPTX Fidelity Gap

Identified from `content/replicate-iran-war-2026` — first 10 slides look dramatically different after PPTX export. These are fundamental CSS-vs-OOXML gaps, not IR design issues.

### High Impact, Low Effort

**Font fallback map** — Staatliches and Figtree are not in `pptx-helpers.ts` fallback map. PowerPoint substitutes system fonts, destroying the visual hierarchy on large dramatic titles (77-134px). Fix: add Staatliches → Impact, Figtree → Calibri mappings.

**`repeating-linear-gradient` parser** — `parseCssGradients()` only handles `linear-gradient(` and `radial-gradient(`. Repeating variants (`repeating-linear-gradient` for grid/scan-line patterns) fall through to `extractSolidColor()` and render as flat backgrounds. Fix: extend regex to match `repeating-*` variants.

### Medium Impact, Medium Effort

**Stacked radial gradients** — Slide backgrounds use multiple `radial-gradient()` layers (e.g., `radial-gradient(ellipse at 20% 80%, rgba(255,45,45,0.2)...), radial-gradient(ellipse at 80% 20%,...), #080808`). Each becomes a separate OOXML shape; opacity blending between layers is approximate. Could improve alpha math in `buildCssGradFillXml()`.

**clipPath polygon** — Glitch title effect uses `clipPath: "polygon(0 0, 100% 0, 100% 35%, 0 35%)"` to slice text into layers. No OOXML equivalent for arbitrary polygon clipping. Could approximate by adjusting element rects or using OOXML `<a:custGeom>` custom geometry.

### Medium Impact, High Effort

**Group rotation in PPTX** — `transform.rotate` on compose components (boxes, columns) creates rotated `GroupElement`s. The PPTX exporter renders groups as flat children (no `<p:grpSp>`), so rotation is lost. Recommended approach: per-child rotation — rotate each child element's position around the group center mathematically, add group rotation to each child's own rotation. Works within current flat-rendering model. Alternative: OOXML post-processing to wrap children in `<p:grpSp>` with `<a:xfrm rot=...>` — pixel-perfect but very invasive.

### Not Feasible in PPTX

**`flipH` on text elements** — PowerPoint's `flipH="1"` attribute on `<a:xfrm>` flips shape geometry but preserves text readability — text inside a flipped text box still renders left-to-right. CSS `transform: scaleX(-1)` mirrors everything including text. This is a fundamental PowerPoint text rendering behavior. `flipV` works as expected (text renders upside down). Shapes without text flip correctly.

**Continuous/looping animations** — `float-up 6s infinite`, `drift`, `pulse-ring`, `glitch-anim` are CSS keyframe loops. PPTX's OOXML timing model only supports one-shot entrance/exit animations triggered on click or after delay. Looping animations are architecturally impossible in PowerPoint.

## FillDef / StrokeDef / EffectsDef — Deferred

Originally scoped for v8 Phase 2 but deferred — code aesthetics, not capability gaps. Revisit when real need arises.

**FillDef union** — Replace `style.fill`, `style.gradient`, `style.patternFill` with `fill: FillDef | FillDef[]` discriminated union. Eliminates ambiguity when multiple fill types set, enables multi-layer fills. Revisit if Phase 4 multi-layer backgrounds need it — that would provide real motivation instead of speculative refactoring.

**StrokeDef** — Unify `border: BorderDef` and `style.stroke/strokeWidth`. Currently these serve different purposes (`border` has `sides` for CSS box-model borders, `stroke` is shape outline). Merging loses that distinction. Skip unless a concrete use case demands it.

**EffectsDef** — Consolidate `effects`, `shadow`, `opacity` into one type. All three already live on `ElementBase` as separate fields — consistent and accessible. Wrapping in another object adds indirection without new capability.

## ~~Component/DSL Template Layer Redesign~~ (Resolved — v8 Phase 2)

Resolved by v8 Phase 2: style passthrough mixin adds `transform`, `effects`, `borderRadius`, `clipPath`, `cssStyle` to all 18 component types. RichText (`string | TextRun[]`) accepted by 8 text-bearing components. Compose templates are now as expressive as freeform.

**Remaining cleanup:** 5 component-specific fields are now redundant with the mixin:

- `ImageComponent.borderRadius`, `VideoComponent.borderRadius`, `IframeComponent.borderRadius`, `BoxComponent.borderRadius` → mixin `borderRadius`
- `BoxComponent.entranceType` → mixin `entranceType`

Migrate existing YAML, remove redundant fields from interfaces, simplify resolver code (remove component-specific borderRadius handling, remove box entranceType special-case at `resolvers.ts:1217`).
