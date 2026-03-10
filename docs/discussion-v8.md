# v8 Discussion: History, Decisions, and Remaining Work

This document consolidates the v8 design discussion, implementation decisions, intentional divergences from the original spec, and remaining backlog. For the current design spec, see `design-v8.md`.

## Origin

After replicating 10 slides from an external HTML presentation into the YAML framework (`content/replicate-iran-war-2026`), we found significant gaps in the framework's expressive power and PPTX export fidelity. 28 commits, 145 files changed (+15,089/-1,387 lines). The analysis identified core limitations: no transforms, no rich text, no auto-layout, prop-by-prop CSS patching, and silent PPTX export failures.

~85% of the code changes were genuinely generic. The main hacks were (1) no rotation forcing clipPath abuse, and (2) no auto-layout forcing verbose freeform YAML.

## Design Principles

1. **CSS-OOXML intersection** — every IR property has both a CSS rendering and an OOXML rendering
2. **Typed values, CSS-standard names** — `borderRadius`, `opacity` with typed values instead of raw CSS strings
3. **Consolidated, not scattered** — visual properties on a unified `ElementBase`, not per-element
4. **Web-only escape hatch** — `cssStyle?: Record<string, string>` for properties outside the intersection
5. **Auto-layout resolves to absolute** — flex/grid compute absolute `Rect` positions before rendering; both renderers receive concrete coordinates

## Implementation Status

### Phase 1: Transform + Rich Text — Done

- `TransformDef` on `ElementBase`: `rotate`, `scaleX`, `scaleY`, `flipH`, `flipV`
- `RichText = string | TextRun[]` on `TextElement` and 8 text-bearing components
- `TextRun` supports: bold, italic, underline, strikethrough, color, fontSize, fontFamily, letterSpacing, highlight, superscript, subscript
- Both web renderer (`<span>` per run) and PPTX exporter (`text: [{text, options}]`) handle rich text
- Markdown shorthand (`**bold**`, `*italic*`) still works with `highlightColor`

### Phase 2: Component Passthrough + Style Mixin — Done (Partial)

Shared mixin on all 18 component types provides: `entranceType`, `entranceDelay`, `opacity`, `transform`, `effects`, `borderRadius`, `clipPath`, `cssStyle`, `width`, `height`, `margin`, `position`, `x`, `y`.

Component-specific duplicates removed: `borderRadius` on Image/Video/Iframe/Box, `entranceType` on Box.

**Not done:** `fill`, `stroke`, `zIndex` passthrough — blocked on FillDef/StrokeDef type migration (see Deferred section).

### Phase 3: Auto-Layout — Done

- `auto-layout.ts` engine: flex-row, flex-column, grid with `resolveLayouts()` pre-pass
- `GroupElement.layout?: LayoutMode` (flex or grid)
- `BoxComponent.layout` with full flex/grid support
- `justify`: start, center, end, space-between, space-around (both directions)
- `align`: start, center, end, stretch
- `wrap?: boolean` on flex-row
- `rowGap`/`columnGap` on grid
- `position: "absolute"` on any child — opts out of flow, keeps rects unchanged, z-order preserved
- Spacer component: defaults to `flex: true` when no height given (fills remaining space)

### Phase 5: Shape Presets — Done

6 presets added: `arrow`, `triangle`, `chevron`, `diamond`, `star`, `callout`. Mapped to OOXML `<a:prstGeom>` presets and CSS/SVG for web.

### Base Layout Layer Removal — Done

Removed `full-compose.ts`, `split-compose.ts`, `freeform.ts`, `stacker.ts`. All templates now output component trees directly. `SlideData` is `ComponentSlideData & SlideBaseFields` — no discriminated union.

- `full-compose` = root Box, `layout: { type: flex, direction: column }`, slide-sized
- `split-compose` = root Box, `layout: { type: flex, direction: row }`, two child Boxes with ratio
- `freeform` = children with absolute rects

Boxes without explicit `layout` default to `flex-column` (16px gap).

### PPTX Fidelity Fixes — Done

- Rotation: `<a:xfrm rot>` with center-of-rect calculation
- Group rotation: per-child rotation around group center
- clipPath polygon: `parsePolygon()` + `<a:custGeom>` post-processing
- Dashed strokes: `<a:prstDash val="dash/dot/dashDot">`
- Text underline/strikethrough: `<a:rPr u="sng" strike="sngStrike">`
- Rich text runs in PPTX: PptxGenJS `text: [{text, options}]` format
- Card rotation, group glow, childless box support

## CSS-OOXML Intersection Reference

### Transform

| Property | CSS | OOXML |
|----------|-----|-------|
| Rotation | `transform: rotate(Ndeg)` | `<a:xfrm rot="N*60000">` |
| Scale X/Y | `transform: scale(x, y)` | Adjusted `<a:ext cx/cy>` |
| Flip H/V | `transform: scaleX(-1)` | `<a:xfrm flipH="1">` |

**Not in intersection:** `skew` (no OOXML), `translate` (use rect offset), `originX`/`originY` (no use case yet).

### Fill

| Fill Type | CSS | OOXML |
|-----------|-----|-------|
| Solid + alpha | `background: rgba(r,g,b,a)` | `<a:solidFill>` + `<a:alpha>` |
| Linear gradient | `linear-gradient(angle, stops)` | `<a:gradFill><a:lin ang="N">` |
| Radial gradient | `radial-gradient(at X% Y%, stops)` | `<a:gradFill><a:path path="circle">` |
| Pattern | SVG/CSS patterns | `<a:pattFill prst="preset">` (10 presets implemented) |
| Image | `background-image` + `background-size` | `<a:blipFill>` + `<a:srcRect>` |
| Multi-layer | Multiple CSS backgrounds | Multiple stacked shapes |

### Stroke / Border

| Property | CSS | OOXML |
|----------|-----|-------|
| Color + width | `border: Npx solid color` | `<a:ln w="N"><a:solidFill>` |
| Dash style | `border-style: dashed/dotted` | `<a:prstDash val="dash/dot">` |
| Per-side | `border-top`, etc. | Separate line shapes per side |
| Radius (uniform) | `border-radius: Npx` | `<a:prstGeom prst="roundRect">` + `<a:avLst>` |

### Effects

| Effect | CSS | OOXML |
|--------|-----|-------|
| Outer shadow | `box-shadow: x y blur spread color` | `<a:outerShdw>` |
| Glow | `box-shadow: 0 0 R color` | `<a:glow rad="N">` |
| Soft edge | `mask-image` gradient | `<a:softEdge rad="N">` |
| Blur | `filter: blur(Npx)` | `<a:blur rad="N">` |
| Opacity | `opacity: N` | Shape/fill alpha |

### Text (Per-Run)

| Property | CSS `<span>` | OOXML `<a:rPr>` |
|----------|-------------|-----------------|
| Font family | `font-family` | `<a:latin typeface>` |
| Font size | `font-size` | `sz` (hundredths of pt) |
| Bold/Italic | `font-weight`/`font-style` | `b`/`i` |
| Color | `color` | `<a:solidFill>` |
| Underline | `text-decoration: underline` | `u="sng"` |
| Strikethrough | `text-decoration: line-through` | `strike="sngStrike"` |
| Letter spacing | `letter-spacing` | `spc` (hundredths of pt) |
| Highlight | `background-color` on span | `<a:highlight>` |

### Clipping

| Property | CSS | OOXML |
|----------|-----|-------|
| Clip to rect | `overflow: hidden` | `<a:xfrm>` bounds |
| Clip path polygon | `clip-path: polygon(...)` | `<a:custGeom>` custom path |
| Circle clip | `clip-path: circle(50%)` | `<a:prstGeom prst="ellipse">` |

### CSS-Only (Web Escape Hatch)

No OOXML equivalent. Available via `cssStyle`:

- `mix-blend-mode`, `backdrop-filter`, `filter: brightness/contrast/grayscale/sepia`
- CSS transitions and animations (continuous/looping)
- `mask-image`, `calc()`, `clamp()`, CSS custom properties

## PPTX Fidelity Audit

| Feature | Status |
|---------|--------|
| Solid/gradient/pattern/image fill | Complete |
| Multi-layer fill | Complete (stacked shapes) |
| Stroke (solid + dashed) | Complete |
| Border per-side | Complete (separate line shapes) |
| Border radius (uniform) | Complete (roundRect) |
| Rotation | Complete |
| Scale | Complete (adjusted dimensions) |
| Flip H/V | Complete (shapes only — text elements preserve readability in PPT) |
| Opacity | Complete (fill/shape alpha) |
| Outer shadow | Complete |
| Glow | Complete |
| Soft edge | Complete |
| Blur | Complete |
| clipPath (polygon) | Complete |
| clipPath (circle) | Complete (ellipse preset) |
| Overflow hidden | Complete (group clipping) |
| Text: bold/italic/color/size/family | Complete |
| Text: underline/strikethrough | Complete |
| Text: letter spacing/text-transform | Complete |
| Text: vertical align | Complete |
| Rich text runs | Complete |
| Entrance animations | Complete (OOXML timing) |
| Shape presets (6 types) | Complete |
| zIndex | Complete (shape ordering) |
| Auto-layout | N/A (resolves to rects before rendering) |
| Inner shadow | Not implemented (rare) |
| Border radius per-corner | Not implemented (needs custGeom) |
| Reflection | Not implemented (OOXML-only, low priority) |
| CSS animations | N/A (web-only, not exportable) |

## Intentional Design Divergences

Differences between the original `design-v8.md` spec and actual implementation:

| Spec | Implementation | Rationale |
|------|---------------|-----------|
| `rect?: Rect` (optional when parent has layout) | `rect: Rect` always required | `ensureRects()` fills `{x:0,y:0,w:0,h:0}`, `resolveLayouts()` overwrites. Avoids type changes across every renderer. |
| `{ type: "absolute" }` in LayoutMode | Absence of `layout` = absolute | Simpler types. |
| `ParagraphStyle` | `TextStyle` | Same shape, different name. Missing `spaceBefore`/`spaceAfter`/`indent`. |
| `borderRadius: number \| [n,n,n,n]` | `borderRadius: number` only | Per-corner requires OOXML `<a:custGeom>` path. No use case. |
| `zIndex` on ElementBase | Not implemented | Array order determines stacking. Sufficient. |
| `overflow` on ElementBase | `clipContent?: boolean` on GroupElement only | Narrower scope, works. |
| `originX`/`originY` on TransformDef | Not implemented | No templates use non-center transform origin. |
| Remove `ImageElement.clipCircle` | Kept | Backward compat with existing templates. |
| `fill`/`stroke`/`zIndex` on component passthrough | Not implemented | Blocked on FillDef/StrokeDef migration. |

## Deferred Work

### FillDef / StrokeDef / EffectsDef Type Consolidation

Originally scoped for Phase 2 but deferred — code aesthetics, not capability gaps.

- **FillDef union** — Replace `style.fill`, `style.gradient`, `style.patternFill` with `fill: FillDef | FillDef[]` discriminated union. Revisit if Phase 4 multi-layer backgrounds provide real motivation.
- **StrokeDef** — Unify `border: BorderDef` and `style.stroke/strokeWidth`. Currently serve different purposes (`border` has `sides`, `stroke` is shape outline). Skip unless a concrete use case demands it.
- **EffectsDef** — Consolidate `effects`, `shadow`, `opacity` into one type. All three already live on `ElementBase` separately — consistent and accessible. Wrapping adds indirection without new capability.

### Phase 4: Multi-Layer Backgrounds

Replace `LayoutSlide.background: string` with `backgroundLayers: FillDef[]`. Blocked on FillDef existing. Options:

1. Implement FillDef first (~35 files)
2. Design simpler typed background without FillDef
3. Skip Phase 4 — current CSS-string backgrounds work

### PPTX Fidelity Gaps

**High impact, low effort:**
- **Font fallback map** — Staatliches and Figtree not in `pptx-helpers.ts`. Fix: add Staatliches → Impact, Figtree → Calibri.
- **`repeating-linear-gradient` parser** — `parseCssGradients()` doesn't handle repeating variants. Fix: extend regex.

**Medium impact, medium effort:**
- **Stacked radial gradients** — Multiple `radial-gradient()` layers have approximate alpha blending. Could improve in `buildCssGradFillXml()`.

**Not feasible in PPTX:**
- **`flipH` on text elements** — PowerPoint preserves text readability in flipped shapes. CSS mirrors everything. Fundamental PPT behavior.
- **Continuous/looping animations** — CSS keyframe loops. PPTX only supports one-shot entrance/exit. Architecturally impossible.

### Template Switchover

`steps-v2` and `timeline-v2` templates exist as auto-layout comparisons. Need visual + PPTX comparison before replacing originals. Table template rewrite deferred — complex layered backgrounds don't benefit from auto-layout.

## Template Accumulation Vision

The end-state workflow:

```
New slide encountered
    ↓
Compose with components + style passthrough + auto-layout
    ↓
YAML is already parameterizable (component props = template params)
    ↓
Replace concrete values with {{ params }} → .template.yaml
    ↓
Template works with any theme (components use theme tokens)
    ↓
PPTX export works (components → IR → OOXML)
```

With v8 components covering >80% of real-world slides (up from ~50%), the replicate → templatize → accumulate cycle is practical. What still needs freeform: overlapping elements at precise positions, arbitrary paths, pixel-perfect reproductions, non-flex/grid spatial patterns (circular, radial, Bezier connectors).
