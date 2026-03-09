# Backlog

## PPTX Fidelity Gap

Identified from `content/replicate-iran-war-2026` — first 10 slides look dramatically different after PPTX export. These are fundamental CSS-vs-OOXML gaps, not IR design issues.

### High Impact, Low Effort

**Font fallback map** — Staatliches and Figtree are not in `pptx-helpers.ts` fallback map. PowerPoint substitutes system fonts, destroying the visual hierarchy on large dramatic titles (77-134px). Fix: add Staatliches → Impact, Figtree → Calibri mappings.

**`repeating-linear-gradient` parser** — `parseCssGradients()` only handles `linear-gradient(` and `radial-gradient(`. Repeating variants (`repeating-linear-gradient` for grid/scan-line patterns) fall through to `extractSolidColor()` and render as flat backgrounds. Fix: extend regex to match `repeating-*` variants.

### Medium Impact, Medium Effort

**Stacked radial gradients** — Slide backgrounds use multiple `radial-gradient()` layers (e.g., `radial-gradient(ellipse at 20% 80%, rgba(255,45,45,0.2)...), radial-gradient(ellipse at 80% 20%,...), #080808`). Each becomes a separate OOXML shape; opacity blending between layers is approximate. Could improve alpha math in `buildCssGradFillXml()`.

~~**clipPath polygon**~~ — Done. `parsePolygon()` + `<a:custGeom>` post-processing in `pptx-effects.ts`.

### Medium Impact, High Effort

~~**Group rotation in PPTX**~~ — Done. Per-child rotation approach: each child's position rotated around group center, group rotation added to child's own rotation. Both standard and side-border backing-shape paths handle rotation.

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

## Auto-Layout — Phase 3 Loose Ends

Core auto-layout engine is complete (`auto-layout.ts`, pipeline integration, `BoxComponent.layout`).

~~**`justify` in BoxComponent resolver**~~ — Done. Implemented for flex-row: start, center, end, space-between, space-around.

~~**`rowGap`/`columnGap` on BoxComponent.layout**~~ — Done. Added to type and wired through grid resolver.

~~**`wrap` on FlexLayout**~~ — Done. `wrap?: boolean` on `FlexLayout`. Splits children into rows when total width exceeds container.

**Box flex-column → auto-layout** — `resolveBox` flex-column path currently uses manual two-pass stacking instead of delegating to `resolveLayouts()` like flex-row does. Fix: route flex-column through the same placeholder→`resolveLayouts()`→map-back pattern. Gives vertical box layouts full justify/align support. Also add mixed absolute+flow positioning: children with `position: "absolute"` opt out of flow and keep their explicit rects, like HTML. Works at any nesting depth since the resolver is recursive.

~~**Stacker unification**~~ — Superseded by "Remove base layout layer" (see below). No point rewriting the stacker when the plan is to remove it entirely.

**Template switchover** — `steps-v2` and `timeline-v2` templates created as auto-layout comparisons. Need visual + PPTX comparison before replacing originals. Table template rewrite deferred — complex layered backgrounds (accent rect, alternating row stripes, border lines) don't benefit from auto-layout.

## v8 Design Divergences (Intentional)

Differences between `docs/design-v8.md` and actual implementation, with rationale:

**`rect` required (not optional)** — Design says `rect?: Rect` when parent has layout. Implementation keeps `rect: Rect` always required. `ensureRects()` fills `{x:0,y:0,w:0,h:0}`, `resolveLayouts()` overwrites. Same behavior, avoids type changes across every renderer and template.

**No `{ type: "absolute" }` in LayoutMode** — Design includes absolute as explicit mode. Implementation: absence of `layout` = absolute. Simpler types.

**`TextStyle` not `ParagraphStyle`** — Same shape, different name. Missing `spaceBefore`, `spaceAfter`, `indent` from design spec.

**`borderRadius` number only** — Design has `number | [number, number, number, number]`. Per-corner requires OOXML `<a:custGeom>` path. No use case yet.

**`zIndex` not on ElementBase** — Array order determines stacking. Sufficient for all current templates.

**`overflow` not on ElementBase** — Only `clipContent?: boolean` on `GroupElement`. Narrower scope, works.

**`TransformDef` missing `originX`/`originY`** — No templates use non-center transform origin.

**`ImageElement.clipCircle` not removed** — Design says use `clipPath` instead. Kept for backward compat with existing templates.

**Component passthrough missing `fill`/`stroke`/`zIndex`** — Blocked on FillDef/StrokeDef migration. Will add when those types exist.

## Remove Base Layout Layer

The current architecture has a rigid base layout layer between templates and components:

```
Templates → Base Layouts (full-compose/split-compose/freeform) → Components → IR
```

This forces templates to pick a layout mode upfront. When a slide doesn't fit neatly into full-compose or split-compose, templates need hacks. The base layout layer limits the expressive power of templates.

**Target architecture:** Everything is freeform. Components and IR elements are composed with auto-layout (flex/grid) or absolute positioning — just like HTML.

```
Templates → Components (with auto-layout) → IR
```

- **full-compose** = root Box, `layout: { type: flex, direction: column }`, slide-sized
- **split-compose** = root Box, `layout: { type: flex, direction: row }`, two child Boxes with ratio
- **freeform** = children with absolute rects (already works this way)

**Prerequisites:**
1. Box flex-column delegates to `resolveLayouts()` (see Auto-Layout section above)
2. DSL `base` field becomes optional — templates can output a root component tree directly
3. Existing templates migrated gradually (old `base:` templates coexist with new ones)

**Files to eventually remove:** `src/lib/layout/templates/bases/full-compose.ts`, `split-compose.ts`, `stacker.ts`. `freeform.ts` may remain as a thin helper for absolute-positioned elements.

## Phase 4 Prerequisite

Phase 4 (Multi-Layer Backgrounds) wants `backgroundLayers: FillDef[]` on `LayoutSlide`. This depends on `FillDef` existing — currently deferred (see "FillDef / StrokeDef / EffectsDef" section above). Options:

1. Implement FillDef first (prerequisite, ~35 files)
2. Design Phase 4 with a simpler typed background that doesn't use FillDef
3. Skip Phase 4, move to Phase 5 (shape presets, independent)
