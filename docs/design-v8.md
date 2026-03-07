# Design v8: Comprehensive Style Model, Auto-Layout, and PPTX Fidelity

## Motivation

v7 achieved 35 DSL-based templates with composable components. But replicating a real-world HTML presentation exposed fundamental IR limitations: no rotation, no rich text, no auto-layout, prop-by-prop patching of CSS capabilities, and silent PPTX export failures.

v8 addresses this systematically: define the IR's visual capabilities as the **CSS-OOXML intersection** — every property the IR supports must render correctly in both web and PPTX. Add auto-layout so freeform slides don't require manual rect calculations. The result: maximum expressiveness with guaranteed PPTX fidelity.

## Design Principles

1. **CSS-OOXML intersection** — every IR property has both a CSS rendering and an OOXML rendering. No property is web-only without explicit marking.
2. **Typed values, CSS-standard names** — use CSS property names (`borderRadius`, `opacity`, `boxShadow`) but with typed values (numbers, enums, typed objects) instead of raw CSS strings.
3. **Consolidated, not scattered** — visual properties live in a unified style model, not spread across element-specific interfaces.
4. **Web-only escape hatch** — `cssStyle?: Record<string, string>` for properties outside the intersection. Explicitly marked, PPTX exporter warns.
5. **Auto-layout resolves to absolute** — flex/grid layout modes compute absolute `Rect` positions in a pre-pass before rendering. Both renderers receive concrete coordinates.

## The CSS-OOXML Intersection

Comprehensive audit of what both renderers can express:

### Transform

| Property | CSS | OOXML | Notes |
|----------|-----|-------|-------|
| Rotation | `transform: rotate(Ndeg)` | `<a:xfrm rot="N*60000">` | OOXML unit = 60,000ths of a degree |
| Scale X/Y | `transform: scale(x, y)` | Adjusted `<a:ext cx/cy>` | Scale applied to dimensions |
| Flip H/V | `transform: scaleX(-1)` | `<a:xfrm flipH="1">` | Native in both |
| Origin | `transform-origin` | Implicit from `<a:off>` offset | Compute adjusted offset |

**Not in intersection:** `skew` (CSS has it, OOXML doesn't natively), `translate` (use rect offset instead).

### Fill

| Fill Type | CSS | OOXML |
|-----------|-----|-------|
| Solid + alpha | `background: rgba(r,g,b,a)` | `<a:solidFill>` + `<a:alpha>` |
| Linear gradient | `linear-gradient(angle, stops)` | `<a:gradFill><a:lin ang="N">` |
| Radial gradient | `radial-gradient(at X% Y%, stops)` | `<a:gradFill><a:path path="circle">` |
| Pattern | SVG/CSS pattern backgrounds | `<a:pattFill prst="preset">` (40+ presets) |
| Image | `background-image` + `background-size` | `<a:blipFill>` + `<a:srcRect>` |
| No fill | `background: transparent` | `<a:noFill/>` |
| Multi-layer | Multiple CSS backgrounds | Multiple stacked shapes |

### Stroke / Border

| Property | CSS | OOXML |
|----------|-----|-------|
| Color + width | `border: Npx solid color` | `<a:ln w="N"><a:solidFill>` |
| Dash style | `border-style: dashed/dotted` | `<a:prstDash val="dash/dot">` |
| Per-side | `border-top`, etc. | Separate line shapes per side |
| Radius (uniform) | `border-radius: Npx` | `<a:prstGeom prst="roundRect">` + `<a:avLst>` |
| Radius (per-corner) | `border-radius: a b c d` | Custom `<a:custGeom>` path |

### Effects

| Effect | CSS | OOXML |
|--------|-----|-------|
| Outer shadow | `box-shadow: x y blur spread color` | `<a:outerShdw>` |
| Inner shadow | `box-shadow: inset x y blur color` | `<a:innerShdw>` |
| Glow | `box-shadow: 0 0 R color` (no offset) | `<a:glow rad="N">` |
| Soft edge | `mask-image` gradient fade | `<a:softEdge rad="N">` |
| Gaussian blur | `filter: blur(Npx)` | `<a:blur rad="N">` |
| Reflection | No clean CSS equivalent | `<a:reflection>` |
| Opacity | `opacity: N` | Shape-level alpha or fill alpha |

### Text (Per-Run Formatting)

| Property | CSS `<span>` | OOXML `<a:rPr>` |
|----------|-------------|-----------------|
| Font family | `font-family` | `<a:latin typeface="N">` |
| Font size | `font-size` | `sz="N"` (hundredths of point) |
| Bold | `font-weight: 700` | `b="1"` |
| Italic | `font-style: italic` | `i="1"` |
| Color | `color` | `<a:solidFill>` |
| Underline | `text-decoration: underline` | `u="sng"` |
| Strikethrough | `text-decoration: line-through` | `strike="sngStrike"` |
| Superscript | `vertical-align: super` + small font | `baseline="30000"` |
| Subscript | `vertical-align: sub` + small font | `baseline="-25000"` |
| Letter spacing | `letter-spacing` | `spc="N"` (hundredths of point) |
| Highlight | `background-color` on span | `<a:highlight>` |

### Paragraph Style

| Property | CSS | OOXML `<a:pPr>` |
|----------|-----|-----------------|
| Alignment | `text-align` | `algn="l/ctr/r/just"` |
| Line height | `line-height` | `<a:lnSpc>` |
| Space before | `margin-top` | `<a:spcBef>` |
| Space after | `margin-bottom` | `<a:spcAft>` |
| Indent | `text-indent` | `indent="N"` |
| Vertical align | `vertical-align` on container | `anchor="t/ctr/b"` |
| Text transform | `text-transform: uppercase` | Render as uppercase in text content |

### Clipping

| Property | CSS | OOXML |
|----------|-----|-------|
| Clip to rect | `overflow: hidden` | `<a:xfrm>` bounds |
| Clip path | `clip-path: polygon(...)` | `<a:custGeom>` custom path |
| Circle clip | `clip-path: circle(50%)` or `border-radius: 50%` | `<a:prstGeom prst="ellipse">` |

### CSS-Only (Web Escape Hatch)

These have no OOXML equivalent. Available via `cssStyle` but won't export to PPTX:

- `mix-blend-mode`
- `backdrop-filter` (frosted glass)
- `filter: brightness/contrast/grayscale/sepia`
- CSS transitions and animations (continuous)
- `mask-image`
- `calc()`, `clamp()`
- CSS custom properties

## Type Definitions

### Transform

```typescript
interface TransformDef {
  rotate?: number;      // degrees (positive = clockwise)
  scaleX?: number;      // default 1.0
  scaleY?: number;      // default 1.0
  flipH?: boolean;
  flipV?: boolean;
  originX?: number;     // 0-1 fraction of width, default 0.5
  originY?: number;     // 0-1 fraction of height, default 0.5
}
```

### Fill

```typescript
type FillDef =
  | string                              // shorthand: color string -> solid fill
  | { type: "solid"; color: string }
  | { type: "linear"; angle: number; stops: GradientStop[] }
  | { type: "radial"; centerX: number; centerY: number; stops: GradientStop[] }
  | { type: "pattern"; preset: PatternPreset; fgColor: string; bgColor: string;
      fgOpacity?: number; bgOpacity?: number }
  | { type: "image"; src: string; sizing: "cover" | "contain" | "stretch" }
  | { type: "none" }

interface GradientStop {
  color: string;        // CSS color (hex, rgba, named)
  position: number;     // 0-1
}

// Multiple fills stack (bottom to top):
// fill: [{ type: "image", src: "bg.jpg", sizing: "cover" },
//        { type: "linear", angle: 180, stops: [...] }]
// -> image underneath, gradient overlay on top
```

### Stroke

```typescript
interface StrokeDef {
  color: string;
  width: number;                                    // px
  dash?: "solid" | "dash" | "dot" | "dashDot";     // default "solid"
  sides?: ("top" | "right" | "bottom" | "left")[];  // default all sides
}
```

### Effects

```typescript
interface EffectsDef {
  shadow?: ShadowDef | ShadowDef[];
  glow?: { color: string; radius: number; opacity?: number };
  softEdge?: number;          // feather radius in px
  blur?: number;              // Gaussian blur radius in px
  reflection?: {
    offset: number;           // gap in px
    fade: number;             // 0-1 fade length
  };
  opacity?: number;           // 0-1, default 1
}

interface ShadowDef {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread?: number;
  color: string;
  inset?: boolean;            // inner shadow
}
```

### Rich Text

```typescript
// Text content: either a plain string or an array of styled runs
type RichText = string | TextRun[];

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;             // override paragraph color
  fontSize?: number;          // override paragraph size
  fontFamily?: string;        // override paragraph font
  letterSpacing?: number;
  highlight?: string;         // background color on this run
  superscript?: boolean;
  subscript?: boolean;
}

// Markdown shorthand: "The **Fall** of *Tang*"
// Parsed to: [{text:"The "}, {text:"Fall", bold:true}, {text:" of "}, {text:"Tang", italic:true}]
// With highlightColor: bold runs get the highlight color applied
//
// For full control, use TextRun[] directly:
// text:
//   - text: "Revenue: "
//   - text: "$4.2B"
//     bold: true
//     color: "#22c55e"
//     fontSize: 48
```

### Paragraph Style

```typescript
interface ParagraphStyle {
  fontFamily?: string;        // default from theme
  fontSize?: number;          // px
  fontWeight?: number;        // 100-900
  fontStyle?: "normal" | "italic";
  color?: string;
  lineHeight?: number;        // multiplier (1.0, 1.4, etc.)
  textAlign?: "left" | "center" | "right" | "justify";
  verticalAlign?: "top" | "middle" | "bottom";
  letterSpacing?: number;     // px
  textTransform?: "uppercase" | "lowercase" | "none";
  textShadow?: string;        // CSS text-shadow (web-only for now)
  highlightColor?: string;    // color for **bold** markdown runs
  spaceBefore?: number;       // px
  spaceAfter?: number;        // px
  indent?: number;            // first-line indent in px
}
```

### Unified Element Base

```typescript
// All elements share these properties
interface ElementBase {
  id: string;
  rect?: Rect;                // optional when parent group uses auto-layout
  zIndex?: number;            // stacking order (default: array index)
  transform?: TransformDef;
  fill?: FillDef | FillDef[];
  stroke?: StrokeDef;
  borderRadius?: number | [number, number, number, number];  // uniform or per-corner
  effects?: EffectsDef;
  clipPath?: string;          // CSS clip-path value
  overflow?: "hidden" | "visible";
  entrance?: EntranceDef;
  animation?: string;         // CSS animation shorthand (web-only)
  cssStyle?: Record<string, string>;  // web-only escape hatch
}
```

### Element Types (Revised)

```typescript
interface TextElement extends ElementBase {
  kind: "text";
  text: RichText;             // string or TextRun[]
  style: ParagraphStyle;
}

interface ImageElement extends ElementBase {
  kind: "image";
  src: string;
  objectFit: "cover" | "contain";
  // borderRadius, opacity, clipPath etc. inherited from ElementBase
}

interface ShapeElement extends ElementBase {
  kind: "shape";
  shape: "rect" | "circle" | "line" | "pill"
    | "arrow-right" | "arrow-left" | "arrow-up" | "arrow-down"
    | "triangle" | "diamond" | "star" | "callout";
  // fill, stroke, borderRadius etc. inherited from ElementBase
}

interface GroupElement extends ElementBase {
  kind: "group";
  layout?: LayoutMode;        // auto-layout (see below), default: absolute
  children: LayoutElement[];
  clipContent?: boolean;      // clip children to group bounds
}

interface CodeElement extends ElementBase {
  kind: "code";
  code: string;
  language?: string;
  style: {
    fontFamily?: string;      // default: theme mono font
    fontSize: number;
    color: string;
    background: string;
    borderRadius: number;
    padding: number;
  };
}

interface TableElement extends ElementBase {
  kind: "table";
  headers: RichText[];        // now supports styled runs in headers
  rows: RichText[][];         // and in cells
  headerStyle: ParagraphStyle & { background: string };
  cellStyle: ParagraphStyle & { background: string; altBackground: string };
  borderColor: string;
}

interface ListElement extends ElementBase {
  kind: "list";
  items: RichText[];          // supports styled runs per item
  ordered: boolean;
  itemStyle: ParagraphStyle;
  bulletColor?: string;
  itemSpacing: number;
}

interface VideoElement extends ElementBase {
  kind: "video";
  src: string;
  poster?: string;
}

interface IframeElement extends ElementBase {
  kind: "iframe";
  src: string;
}
```

### Key Differences from v7

1. **`fill` replaces** `style.fill`, `style.gradient`, `style.patternFill` — single discriminated union field on `ElementBase`
2. **`stroke` replaces** both `style.stroke`/`style.strokeWidth` and `border: BorderDef` — one field, supports dash styles
3. **`effects` consolidates** `shadow`, `glow`, `softEdge`, `blur`, `opacity` — currently scattered across `ShapeStyle`, `ElementEffects`, and element-level props
4. **`transform`** — new, covers rotation/scale/flip
5. **`borderRadius`** — moved to `ElementBase`, supports per-corner
6. **`zIndex`** — explicit stacking order (currently implicit from array position)
7. **`cssStyle`** — explicit web-only escape hatch, PPTX exporter ignores with warning
8. **`rect` optional** — when parent group uses auto-layout
9. **`text: RichText`** — supports plain string or `TextRun[]` for per-run styling
10. **Shape presets expanded** — arrows, triangle, diamond, star, callout (all OOXML preset geometries)
11. **`overflow`** — clip children to bounds (currently only on GroupElement as `clipContent`)
12. **Element-specific style props removed** — `ImageElement.opacity`, `ImageElement.borderRadius`, `ImageElement.clipCircle` → use `effects.opacity`, `borderRadius`, `clipPath` from `ElementBase`

## Auto-Layout on Groups

### The Problem

Freeform slides require manual `rect` calculations for every element. A row of 3 stats in a 1720px-wide area needs:
```yaml
# Current: calculate each x manually
- rect: { x: 100, y: 400, w: 540, h: 200 }   # 100
- rect: { x: 660, y: 400, w: 540, h: 200 }   # 100 + 540 + 20
- rect: { x: 1220, y: 400, w: 540, h: 200 }  # 100 + 540 + 20 + 540 + 20
```

### The Solution

Add layout modes to `GroupElement`. A pre-rendering pass resolves layout rules to absolute rects.

```typescript
type LayoutMode =
  | { type: "absolute" }          // default: children use rect (current behavior)
  | FlexLayout
  | GridLayout

interface FlexLayout {
  type: "flex";
  direction: "row" | "column";   // main axis
  gap?: number;                   // px between items
  align?: "start" | "center" | "end" | "stretch";      // cross-axis
  justify?: "start" | "center" | "end" | "space-between" | "space-around";  // main-axis
  wrap?: boolean;                 // wrap to next row/column
  padding?: number | [number, number, number, number];  // inner padding
}

interface GridLayout {
  type: "grid";
  columns: number;               // number of columns
  gap?: number;                   // uniform gap (or use rowGap/columnGap)
  rowGap?: number;
  columnGap?: number;
  padding?: number | [number, number, number, number];
}
```

### Resolution Strategy

**Key principle:** Layout resolution happens **before** rendering. A pre-pass computes absolute `Rect` for every element. Both web and PPTX renderers receive only concrete positions — they never need to implement flex/grid logic.

```
slides.yaml -> loadPresentation() -> layoutPresentation()
                                         |
                                    resolveLayouts()  <-- NEW pre-pass
                                         |
                                    LayoutPresentation (all rects absolute)
                                         |
                              +-----------+-----------+
                              |                       |
                        LayoutRenderer           exportPptx()
                          (web)                   (PPTX)
```

Resolution rules:

1. **Flex row:** Distribute group width among children. If child has explicit `w`, use it. Otherwise, distribute remaining space equally among children without `w`. Apply `gap` between items. Compute `x` offsets. Cross-axis alignment adjusts `y`.

2. **Flex column:** Same logic on the vertical axis. This is what the component stacker already does — generalized to the IR level.

3. **Grid:** Compute cell width = `(groupW - (columns-1)*gap) / columns`. Row height = max child height in that row (or explicit `h` if provided). Place children left-to-right, top-to-bottom.

4. **Children with partial rect:** A child in a flex/grid group can specify `w` and `h` but omit `x` and `y` (the layout computes position). Or omit all four (layout computes everything).

### YAML Examples

```yaml
# Flex row — 3 stats evenly distributed
- kind: group
  id: stats-row
  rect: { x: 100, y: 400, w: 1720, h: 200 }
  layout: { type: flex, direction: row, gap: 40, align: center }
  children:
    - kind: text
      id: stat-1
      text: "4.2B"
      style: { fontSize: 72, fontWeight: 900, color: "#f5f5f5" }
    - kind: text
      id: stat-2
      text: "180+"
      style: { fontSize: 72, fontWeight: 900, color: "#f5f5f5" }
    - kind: text
      id: stat-3
      text: "99.9%"
      style: { fontSize: 72, fontWeight: 900, color: "#f5f5f5" }
# Each child gets w=546, h=200, x computed from layout

# Flex column — vertical stack with spacing
- kind: group
  id: content-stack
  rect: { x: 100, y: 100, w: 800, h: 800 }
  layout: { type: flex, direction: column, gap: 24 }
  children:
    - kind: text
      id: title
      text: "Key Findings"
      style: { fontSize: 48, fontWeight: 700, color: "#ffffff" }
      rect: { h: 60 }     # explicit height, x/y/w from layout
    - kind: shape
      id: divider
      shape: rect
      rect: { w: 80, h: 3 }  # explicit size, position from layout
      fill: "#ff6b35"
    - kind: text
      id: body
      text: "The analysis reveals..."
      style: { fontSize: 24, color: "#a0a0a0", lineHeight: 1.6 }
# Children stack top-to-bottom with 24px gaps

# Grid — 2x2 card layout
- kind: group
  id: card-grid
  rect: { x: 100, y: 300, w: 1720, h: 600 }
  layout: { type: grid, columns: 2, gap: 24 }
  children:
    - kind: group
      id: card-1
      fill: "#1a1a2e"
      borderRadius: 12
      children: [...]
    - kind: group
      id: card-2
      fill: "#1a1a2e"
      borderRadius: 12
      children: [...]
    - kind: group
      id: card-3
      fill: "#1a1a2e"
      borderRadius: 12
      children: [...]
    - kind: group
      id: card-4
      fill: "#1a1a2e"
      borderRadius: 12
      children: [...]
# Each card gets w=848, h=288, positioned in 2x2 grid
```

### Interaction with Component Stacker

The component stacker (`src/lib/layout/components/stacker.ts`) already implements vertical stacking for compose templates. With auto-layout on groups:

- **Compose templates** continue using the stacker (it's their layout engine)
- **Freeform slides** can now use `layout: { type: flex, direction: column }` on groups for the same vertical stacking behavior
- The stacker could eventually be reimplemented as a flex-column layout resolver, unifying the two systems

## Multi-Layer Backgrounds

### The Problem

`LayoutSlide.background` is a raw CSS string. When it contains `"radial-gradient(...), radial-gradient(...), #080808"`, the PPTX exporter has to parse CSS at export time — fragile and error-prone.

### The Solution

Replace with typed background layers. The slide background uses the same `FillDef` type as element fills:

```typescript
interface LayoutSlide {
  width: 1920;
  height: 1080;
  backgroundLayers: FillDef[];    // bottom to top
  backgroundImage?: string;       // kept for convenience (shorthand for image fill)
  overlay?: string;               // kept for convenience (shorthand for solid overlay)
  elements: LayoutElement[];
}
```

### YAML

```yaml
# Current (CSS string — fragile):
background: "radial-gradient(at 20% 80%, rgba(255,140,0,0.15) 0%, transparent 50%), radial-gradient(at 80% 20%, rgba(255,140,0,0.1) 0%, transparent 40%), #080808"

# Proposed (typed layers):
backgroundLayers:
  - { type: solid, color: "#080808" }
  - { type: radial, centerX: 20, centerY: 80,
      stops: [{ color: "rgba(255,140,0,0.15)", position: 0 }, { color: transparent, position: 0.5 }] }
  - { type: radial, centerX: 80, centerY: 20,
      stops: [{ color: "rgba(255,140,0,0.1)", position: 0 }, { color: transparent, position: 0.4 }] }
```

Both renderers get structured data. No CSS parsing needed.

## PPTX Fidelity Audit

Current export status for every IR feature:

| Feature | Web | PPTX | Status |
|---------|-----|------|--------|
| Solid fill | Yes | Yes | Complete |
| Linear gradient fill | Yes | Yes | Complete (post-processing) |
| Radial gradient fill | Yes | Yes | Complete (post-processing) |
| Pattern fill | Yes | Yes | Complete (post-processing) |
| Image fill (cover/contain) | Yes | Yes | Complete (srcRect post-processing) |
| Multi-layer fill | Yes | Yes | Via stacked shapes |
| Stroke (solid) | Yes | Yes | Complete |
| Stroke (dashed/dotted) | Yes | **No** | **Needs implementation** |
| Border per-side | Yes | Partial | Via separate line shapes |
| Border radius (uniform) | Yes | Yes | Via roundRect preset |
| Border radius (per-corner) | Yes | **No** | **Needs custGeom path** |
| Rotation | Yes | Yes | **Needs implementation** (native OOXML support) |
| Scale | Yes | Yes | Compute adjusted dimensions |
| Flip H/V | Yes | Yes | **Needs implementation** (native OOXML support) |
| Opacity (element) | Yes | Yes | Via fill/shape alpha |
| Outer shadow | Yes | Yes | Complete (effectLst) |
| Inner shadow | Yes | **No** | **Needs implementation** |
| Glow | Yes | Yes | Complete (effectLst) |
| Soft edge | Yes | Yes | Complete (effectLst) |
| Blur | Yes | Yes | Complete (effectLst) |
| Reflection | **No** | Yes | OOXML-only, low priority |
| clipPath (polygon) | Yes | **No** | **Needs custGeom mapping** |
| clipPath (circle) | Yes | Yes | Via ellipse preset |
| Overflow hidden | Yes | Yes | Group clipping |
| Text: bold/italic | Yes | Yes | Complete |
| Text: color | Yes | Yes | Complete |
| Text: size/family | Yes | Yes | Complete |
| Text: underline | Yes | **No** | **Needs implementation** |
| Text: strikethrough | Yes | **No** | **Needs implementation** |
| Text: letter spacing | Yes | Yes | Complete |
| Text: text-transform | Yes | Yes | Render uppercase |
| Text: vertical align | Yes | Yes | anchor property |
| Rich text runs | **No** | **No** | **v8 new feature** |
| Entrance animations | Yes | Yes | Complete (OOXML timing) |
| CSS animations | Yes | N/A | Web-only (inherently not exportable) |
| zIndex | Yes | Yes | Shape ordering in slide XML |
| Auto-layout (flex/grid) | **No** | **No** | **v8 new feature** (resolves to rects before rendering) |
| Shape presets (arrow, star) | **No** | **No** | **v8 new feature** |

### Priority Fixes (High Impact)

1. **Rotation** — native OOXML `<a:xfrm rot>`, trivial to implement
2. **Rich text runs** — PptxGenJS `text: [{text, options}]`, straightforward
3. **clipPath polygon** — map to OOXML `<a:custGeom>` path commands
4. **Dashed/dotted stroke** — `<a:prstDash val="dash">`
5. **Text underline/strikethrough** — `<a:rPr u="sng" strike="sngStrike">`

### Low Priority (Rare in Presentations)

- Inner shadow
- Per-corner border radius
- Reflection (OOXML-only)

## Component Layer Updates

### The Problem: Components as Bottleneck

A powerful IR alone doesn't help if the "easy path" (templates + components) can't access it:

```
DSL templates (35) → Components (18) → IR (v8, powerful) → Renderers
                           ↑
                      bottleneck
```

Template authors use components, not raw IR. If components don't expose v8 capabilities (transforms, rich text, gradient fills, auto-layout), authors hit the same wall and drop to freeform. The IR is more powerful but unreachable through the easy path. The result: freeform usage stays high, template accumulation stays hard.

### Change 1: Style Passthrough on All Components

Any `ElementBase` prop can be added to any component. The resolver generates its default elements, then merges passthrough props on top.

```typescript
// Component base type gains passthrough fields
type SlideComponent = (
  TextComponent | HeadingComponent | ... | BoxComponent | GridComponent
) & {
  // Existing mixins
  entranceType?: EntranceType;
  entranceDelay?: number;
  opacity?: number;
  // NEW: v8 style passthrough — applied to the component's root element
  transform?: TransformDef;
  fill?: FillDef | FillDef[];
  stroke?: StrokeDef;
  effects?: EffectsDef;
  borderRadius?: number | [number, number, number, number];
  clipPath?: string;
  zIndex?: number;
  cssStyle?: Record<string, string>;
};
```

**DSL template usage:**

```yaml
# Rotated tag — today requires freeform (~15 lines), now 3 lines:
- type: tag
  text: "Chapter 1"
  transform: { rotate: -5 }

# Heading with glow effect:
- type: heading
  text: "Revenue Growth"
  effects: { glow: { color: "#ff6b35", radius: 15, opacity: 0.4 } }

# Card with gradient background:
- type: card
  title: "Key Insight"
  body: "Revenue doubled year over year"
  fill: { type: linear, angle: 135, stops: [{ color: "#1a1a2e", position: 0 }, { color: "#2d1b4e", position: 1 }] }

# Stat with custom border:
- type: stat
  value: "4.2B"
  label: "Global Users"
  stroke: { color: "#ff6b35", width: 2, dash: dash }
  borderRadius: 12
```

**Resolver implementation:** One merge step added to the base `resolveComponent` function. After the component-specific resolver produces its `ResolveResult`, the passthrough props are applied to the root element(s):

```typescript
function resolveComponent(component: SlideComponent, ctx: ResolveContext): ResolveResult {
  // 1. Component-specific resolution (existing logic)
  const result = resolveByType(component, ctx);

  // 2. Apply passthrough props to root element (NEW)
  if (result.elements.length > 0) {
    const root = result.elements[0];
    if (component.transform) root.transform = component.transform;
    if (component.fill) root.fill = component.fill;
    if (component.stroke) root.stroke = component.stroke;
    if (component.effects) root.effects = { ...root.effects, ...component.effects };
    if (component.borderRadius != null) root.borderRadius = component.borderRadius;
    if (component.clipPath) root.clipPath = component.clipPath;
    if (component.zIndex != null) root.zIndex = component.zIndex;
    if (component.cssStyle) root.cssStyle = component.cssStyle;
  }

  return result;
}
```

One change, all 18 components gain v8 capabilities.

### Change 2: Rich Text Flows Through Components

Every component that takes `text: string` accepts `text: RichText` (string or `TextRun[]`). This is the biggest single expressiveness improvement — most "drop to freeform" cases during replication were about inline text styling.

```typescript
// Updated component interfaces
interface HeadingComponent {
  type: "heading";
  text: RichText;        // was: string
  // ... rest unchanged
}

interface BodyComponent {
  type: "body";
  text: RichText;        // was: string
  // ...
}

interface TextComponent {
  type: "text";
  text: RichText;        // was: string
  // ...
}

interface StatComponent {
  type: "stat";
  value: RichText;       // was: string
  label: RichText;       // was: string
  // ...
}

interface BulletsComponent {
  type: "bullets";
  items: RichText[];     // was: string[]
  // ...
}

interface QuoteComponent {
  type: "quote";
  text: RichText;        // was: string
  // ...
}

interface CardComponent {
  type: "card";
  title: RichText;       // was: string
  body: RichText;        // was: string
  // ...
}
```

**DSL template usage:**

```yaml
# Colored word in heading — today requires freeform with multiple text elements:
- type: heading
  text:
    - "The Fall of "
    - text: "Tang"
      color: "#ff6b35"
      bold: true

# Stat with styled value:
- type: stat
  value:
    - text: "$4.2"
      color: "#22c55e"
    - text: "B"
      color: "#22c55e"
      fontSize: 48
  label: "Annual Revenue"

# Bullet with inline emphasis:
- type: bullets
  items:
    - - "Revenue grew "
      - text: "47%"
        bold: true
        color: "#22c55e"
      - " year over year"
    - "Operating costs remained flat"

# Markdown shorthand still works for simple cases:
- type: heading
  text: "The **Fall** of Tang"
  # With highlightColor set, **bold** gets the accent color
```

**Backward compatible:** Plain strings work exactly as before. `RichText = string | TextRun[]` — the resolver checks the type and handles both paths. Existing templates and content YAML don't change.

**Resolver update:** Each text-bearing resolver wraps its text rendering to handle both `string` and `TextRun[]`:

```typescript
function resolveHeading(c: HeadingComponent, ctx: ResolveContext): ResolveResult {
  // ... existing logic unchanged ...
  const el: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-heading`,
    rect: { x: 0, y: 0, w, h },
    text: c.text,        // now RichText — web renderer and PPTX exporter handle both forms
    style: { ... },
  };
  return { elements: [el], height: h };
}
```

The change is mostly in the **renderers** (web: `<span>` per run, PPTX: `text: [{text, options}]`), not in the resolvers. Resolvers just pass through the `RichText` value.

### Change 3: Box Gets Auto-Layout

The `box` component gains a `layout` prop, eliminating most `raw` block usage in DSL templates. Children in a layout box don't need manual positioning — the resolver computes rects from the layout rules.

```typescript
interface BoxComponent {
  type: "box";
  children: SlideComponent[];
  // Existing props (padding, accentTop, variant, etc.) unchanged

  // NEW: auto-layout mode for children
  layout?: {
    type: "flex" | "grid";
    direction?: "row" | "column";    // flex only, default "column"
    columns?: number;                 // grid only
    gap?: number;
    rowGap?: number;                  // grid only
    columnGap?: number;               // grid only
    align?: "start" | "center" | "end" | "stretch";
    justify?: "start" | "center" | "end" | "space-between" | "space-around";
    wrap?: boolean;                   // flex only
  };
}
```

**DSL template usage — replacing `raw` blocks:**

```yaml
# TODAY: table template uses raw with 50+ lines of manual rects
- type: raw
  height: 400
  elements:
    - kind: shape
      rect: { x: 0, y: 0, w: 1720, h: 48 }
      shape: rect
      style: { fill: "#2d1b4e", borderRadius: 8 }
    - kind: text
      rect: { x: 20, y: 10, w: 560, h: 28 }
      text: "Header 1"
      style: { fontFamily: "Inter", fontSize: 18, fontWeight: 700, color: "#ffffff", lineHeight: 1.4 }
    # ... 40 more lines for cells ...

# WITH AUTO-LAYOUT: same table, using components
- type: box
  layout: { type: grid, columns: 3, gap: 1 }
  fill: theme.bgTertiary
  borderRadius: 8
  children:
    # Header row
    - type: text
      text: "Header 1"
      fontWeight: bold
      fill: theme.accent
      padding: [10, 20]
    - type: text
      text: "Header 2"
      fontWeight: bold
      fill: theme.accent
      padding: [10, 20]
    - type: text
      text: "Header 3"
      fontWeight: bold
      fill: theme.accent
      padding: [10, 20]
    # Data rows
    - type: text
      text: "Cell 1"
      padding: [10, 20]
    # ...

# TODAY: hub-spoke needs 100 lines of freeform
# WITH AUTO-LAYOUT: nested flex boxes
- type: box
  layout: { type: flex, direction: row, gap: 40, align: center }
  children:
    - type: box
      layout: { type: flex, direction: column, gap: 20 }
      children:
        - type: card
          title: "USA"
          body: "Naval forces"
        - type: card
          title: "ISRAEL"
          body: "Air strikes"
    - type: stat
      value: "IRAN"
      label: "IRGC"
      fill: theme.accent
      borderRadius: 100
    - type: box
      layout: { type: flex, direction: column, gap: 20 }
      children:
        - type: card
          title: "HOUTHIS"
          body: "Maritime"
        - type: card
          title: "IRAQ"
          body: "Militias"

# TODAY: steps template uses raw with badge groups + connectors
# WITH AUTO-LAYOUT:
- type: box
  layout: { type: flex, direction: row, gap: 32, align: start }
  children:
    {% for step in steps %}
    - type: box
      layout: { type: flex, direction: column, gap: 12, align: center }
      children:
        - type: stat
          value: "{{ loop.index }}"
          fontSize: 28
          fill: theme.accent
          borderRadius: 100
          stroke: { color: theme.accent, width: 2 }
        - type: heading
          text: "{{ step.title }}"
          fontSize: 20
          textAlign: center
        - type: body
          text: "{{ step.description }}"
          fontSize: 16
          textAlign: center
    {% endfor %}
```

**Resolver implementation:** The box resolver checks for `layout` and delegates to the auto-layout pre-pass (same `resolveLayouts()` used at the IR level). The layout resolver computes child rects, then each child component is resolved within its computed rect. This unifies auto-layout at the IR level with auto-layout at the component level — same engine, same resolution rules.

### Impact on Template Ecosystem

With these three changes, the threshold for needing freeform rises dramatically:

| Slide pattern | Before v8 components | After v8 components |
|---------------|---------------------|---------------------|
| Rotated accent shapes | Freeform only | `type: shape` + `transform: { rotate: 45 }` |
| Inline colored text | Freeform (multiple text elements) | `text: [{text: "word", color: "#f00"}]` |
| Gradient-filled cards | Freeform only | `type: card` + `fill: { type: linear, ... }` |
| Data tables | `raw` block (50+ lines) | `box` with `grid` layout (~15 lines) |
| Hub-spoke diagrams | Freeform (100+ lines) | Nested `box` with `flex` layout (~30 lines) |
| Step sequences | `raw` block (80+ lines) | `box` with `flex` + `stat` badges (~20 lines) |
| Timelines | `raw` block (60+ lines) | `box` with `flex` + `divider` + transforms |
| Glowing elements | Freeform only | Any component + `effects: { glow: {...} }` |
| Dashed borders | Not possible | Any component + `stroke: { dash: "dash" }` |

**DSL templates that currently use `raw` blocks** (table, steps, timeline, video, iframe) can be rewritten to use component composition with auto-layout. This makes them:
- More readable (component names vs. raw element kinds)
- Theme-aware (components resolve theme tokens automatically)
- Easier to parameterize (component props vs. pixel coordinates)
- Better candidates for template accumulation

**The template accumulation payoff:** When a new presentation pattern is replicated using components (not freeform), the YAML is already close to a template. Components are inherently parameterizable — their props map directly to `{{ }}` template variables. Freeform YAML with hardcoded coordinates doesn't parameterize cleanly.

```
New slide encountered
    ↓
Compose with components + style passthrough + auto-layout
(NOT freeform — components handle most patterns now)
    ↓
YAML is already parameterizable (component props = template params)
    ↓
Replace concrete values with {{ params }} → .template.yaml
    ↓
Template works with any theme (components use theme tokens)
    ↓
PPTX export works (components resolve to IR, IR exports to OOXML)
```

### What Still Needs Freeform

Even with v8 component updates, some patterns require freeform:

- **Overlapping elements at precise positions** — auto-layout distributes; freeform overlaps
- **Arbitrary SVG-like paths** — beyond preset shapes
- **Pixel-perfect reproductions** — when exact coordinates matter
- **Novel spatial patterns** not covered by flex/grid (e.g., circular/radial arrangements, Bezier connector lines)

The `raw` component and `template: freeform` remain as escape hatches. But the goal is that **>80% of real-world slides** are expressible through components, vs. the current ~50%.

## Migration Plan

### Phase 1: Transform + Rich Text (Highest Immediate Value)

**Transform:**
- Add `TransformDef` to `types.ts`
- Add `transform` field to `ElementBase` (all element types)
- Add `transform` to component passthrough mixin
- Web renderer: apply CSS `transform` in `LayoutRenderer.tsx`
- PPTX exporter: compute `<a:xfrm rot="N" flipH="N">` in `pptx.ts`
- Test: rotated shape, rotated text, flipped image

**Rich Text:**
- Add `TextRun` and `RichText` types to `types.ts`
- Update `TextElement.text` from `string` to `RichText`
- Update text-bearing component interfaces to accept `RichText`
- Web renderer: render `TextRun[]` as styled `<span>` elements
- PPTX exporter: use PptxGenJS `text: [{text, options}]` format
- Backward compatible: plain `string` still works as before
- Subsumes `highlightColor` — bold runs with explicit color

**Scope:** ~10 files, backward compatible (new optional fields).

### Phase 2: Consolidated Style Model + Component Passthrough

**Unified `ElementBase`:**
- Move scattered style props into `ElementBase`: `fill`, `stroke`, `effects`, `borderRadius`, `transform`, `clipPath`, `overflow`, `zIndex`, `cssStyle`
- Remove per-element duplicates: `ImageElement.opacity`, `ImageElement.borderRadius`, `ShapeElement.style`, `GroupElement.style`, etc.
- Update all element interfaces to extend `ElementBase`
- Migrate renderers and PPTX exporter to read from `ElementBase` props

**Component passthrough:**
- Add v8 style fields to component base mixin
- Implement passthrough merge in `resolveComponent`
- Update component resolvers to emit v8 style format (mechanical: `style.fill` → `fill`, `border` → `stroke`)

**FillDef union:**
- Replace `background: string`, `style.fill`, `style.gradient`, `style.patternFill` with `fill: FillDef | FillDef[]`
- Update renderers to handle the discriminated union
- Remove CSS gradient parsing hack from PPTX exporter

**StrokeDef:**
- Replace `border: BorderDef` and `style.stroke/strokeWidth` with `stroke: StrokeDef`
- Add dash style support in PPTX exporter

**EffectsDef:**
- Consolidate `ElementEffects`, `BoxShadow`, and element-level `opacity` into `EffectsDef`

**Scope:** Major refactor touching types, renderers, PPTX exporter, component resolvers. ~35 files but mostly mechanical.

### Phase 3: Auto-Layout on Groups + Box Layout Component

**IR-level auto-layout:**
- Add `LayoutMode`, `FlexLayout`, `GridLayout` types
- Add `layout` field to `GroupElement`
- Implement `resolveLayouts()` pre-pass in layout pipeline
- Make `rect` optional on elements when parent has layout
- Test: flex row, flex column, grid 2x2, nested layouts

**Component-level auto-layout:**
- Add `layout` prop to `BoxComponent`
- Box resolver delegates to `resolveLayouts()` for child positioning
- Rewrite `raw`-heavy DSL templates (table, steps, timeline) to use box layout
- Eventually unify component stacker as a flex-column layout resolver

**Scope:** New module (~200 lines), types update, integration into layout pipeline, template rewrites.

### Phase 4: Multi-Layer Backgrounds + PPTX Fidelity Fixes

- Replace `LayoutSlide.background: string` with `backgroundLayers: FillDef[]`
- Remove `extractSolidColor()` and `parseCssGradients()` hacks from PPTX exporter
- Implement remaining PPTX fidelity gaps: rotation, dashed strokes, text underline/strike, clipPath polygon mapping

**Scope:** Types, loaders, renderers, PPTX exporter. Medium refactor.

### Phase 5: Expanded Shape Presets

- Add arrow, triangle, diamond, star, callout to `shape` union
- Map to OOXML `<a:prstGeom>` presets (200+ available)
- Web renderer: SVG paths or CSS shapes
- Start with the most common ~10 presets, expand on demand

**Scope:** Small, incremental additions per preset.

## Summary

v8 shifts from **prop-by-prop patching** to **systematic CSS-OOXML intersection coverage** across all layers:

1. **IR layer** — `ElementBase` with unified `fill`, `stroke`, `effects`, `transform`, `RichText`, auto-layout on groups
2. **Component layer** — style passthrough (any v8 prop on any component), `RichText` on all text-bearing components, auto-layout on `box`
3. **Template layer** — DSL templates gain full v8 expressiveness through components without needing `raw` blocks

Every property in the IR has both a CSS rendering path and an OOXML rendering path. The `cssStyle` escape hatch explicitly marks web-only properties. The PPTX fidelity audit provides a concrete punch-list of implementation gaps.

The **template accumulation payoff**: with components covering >80% of real-world slide patterns (up from ~50%), the replicate → templatize → accumulate workflow becomes practical. Component-based replications parameterize cleanly into `.template.yaml` files. Freeform replications don't.
