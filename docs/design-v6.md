# Design v6: Composable Component Layer

## Motivation

v5 identified that our 35 monolithic templates cannot match the expressiveness of freeform HTML generation. Each template produces a fixed layout — `items: string[]` treats a stat, a quote, and a bullet identically. Users cannot mix component types within a slide (e.g., tag + bullets + stat + seal in one panel).

Our Level 2 IR (`LayoutElement`) can already express any visual element — a seal is a rotated ShapeElement + TextElement in a GroupElement. But nothing between YAML and Level 2 lets you compose these building blocks freely.

v6 adds a **component layer**: new composable templates that accept typed component lists, resolved to Level 2 IR by a vertical stacking engine. Existing rigid templates remain unchanged.

## Architecture

```
content/[slug]/slides.yaml
    |
loadPresentation()
    |
PresentationData
    |
layoutPresentation()
  |-- resolveTheme(themeName)
  |-- layoutSlide(slide, theme)
  |     |-- rigid templates (35 existing)     → LayoutSlide
  |     |-- split-compose / full-compose      → component resolver → LayoutSlide
  |     |-- freeform                          → passthrough → LayoutSlide
    |
LayoutPresentation (JSON)
    |-- Web:  LayoutRenderer.tsx
    |-- PPTX: exportPptx()
```

## Composable Templates

Two new container templates accept typed component lists:

### split-compose

Two-panel layout. Each panel has a `children` list of typed components.

```yaml
- template: split-compose
  ratio: 0.5                          # optional, default 0.5
  left:
    background: theme.bgSecondary
    textColor: theme.text
    children:
      - type: tag
        text: "总览"
        color: theme.accent
      - type: heading
        text: "何为五代十国？"
      - type: divider
        variant: gradient
      - type: bullets
        items: ["唐朝灭亡...", "中原先后..."]
  right:
    background: "#1a1714"
    textColor: "#e8e0d0"
    children:
      - type: stat
        value: "72"
        label: "年（907-979）"
      - type: stat
        value: "5"
        label: "中原王朝"
```

The resolver splits the 1920×1080 canvas into left (0..960) and right (960..1920) panels at the given ratio, then stacks each panel's children vertically.

### full-compose

Single centered content area.

```yaml
- template: full-compose
  background: theme.bg
  align: center                       # optional: left | center (default)
  children:
    - type: heading
      text: "时代背景"
    - type: divider
      variant: solid
    - type: bullets
      items: ["安史之乱后...", "地方藩镇..."]
    - type: quote
      text: "天子，兵强马壮者当为之"
      attribution: "安重荣"
```

Content area uses standard margins (CONTENT_X=160, CONTENT_W=1600, PADDING_Y=60).

## Component Types

```typescript
type SlideComponent =
  | { type: "heading"; text: string; level?: 1 | 2 | 3 }
  | { type: "body"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "stat"; value: string; label: string }
  | { type: "tag"; text: string; color?: string }
  | { type: "divider"; variant?: "solid" | "gradient" | "ink" }
  | { type: "quote"; text: string; attribution?: string }
  | { type: "card"; title: string; body: string; dark?: boolean }
  | { type: "image"; src: string; height?: number }
  | { type: "code"; code: string; language?: string }
  | { type: "spacer"; height: number }
  | { type: "raw"; height: number; elements: LayoutElement[] }
```

Each component resolves to `LayoutElement[]`:

| Component | Resolves to |
|---|---|
| `heading` | TextElement with headingStyle at level-appropriate fontSize |
| `body` | TextElement with bodyStyle |
| `bullets` | ListElement or Group of TextElements with left accent border |
| `stat` | Group: large TextElement (value) + small TextElement (label) |
| `tag` | Group: ShapeElement (pill) + TextElement (label) |
| `divider` | ShapeElement (line, optionally with gradient) |
| `quote` | Group: accent mark + italic TextElement + attribution TextElement |
| `card` | Group: ShapeElement (background) + TextElements (title, body) |
| `image` | ImageElement |
| `code` | CodeElement |
| `spacer` | No elements — advances vertical position only |
| `raw` | Passthrough — LayoutElement[] with coordinates offset to bounding box |

This vocabulary grows as recurring `raw` patterns are promoted to named components (see Phase 3 in implementation plan).

## Component Resolver

The resolver converts a component tree into positioned `LayoutElement[]`:

1. **Split canvas** — `split-compose`: two panels at the given ratio. `full-compose`: single content area with standard margins.
2. **Apply panel backgrounds** — each panel's `background` becomes a ShapeElement (full panel rect).
3. **Stack children vertically** — flexbox-column model. Start at top of panel (with padding), place each component, advance y by component height + gap (default ~30px).
4. **Resolve components** — each typed component maps to `LayoutElement[]` using the active theme. Elements use absolute coordinates on the 1920×1080 canvas.
5. **Apply animations** — stagger delays based on component index in the stack.

### Height estimation

The stacker needs each component's height before positioning the next:

- **Fixed-height** (tag, divider, spacer, stat): known constants
- **Text-dependent** (heading, body, bullets, quote, card): existing `estimateTextHeight()` with CJK awareness
- **Explicit** (image, code, raw): `height` prop required, or sensible defaults (e.g., image 400px, code 300px)

Dev mode emits a warning when total content height exceeds the panel.

## Theme Tokens

Component props that accept colors can use theme references:

```yaml
background: theme.bgSecondary     # → resolvedTheme.bgSecondary → "#ffffff"
textColor: theme.text              # → resolvedTheme.text → "#1a1a2e"
color: theme.accent                # → resolvedTheme.accent → "#4f6df5"
```

The resolver parses `theme.*` strings and substitutes concrete values from the `ResolvedTheme`. Presentations remain theme-switchable without regeneration.

Hardcoded hex values (e.g., `"#1a1714"`) pass through unchanged.

## Raw Escape Hatch

For visual elements not in the component menu, `raw` embeds `LayoutElement[]` directly:

```yaml
- type: raw
  height: 65
  elements:
      - kind: shape
        rect: { x: 0, y: 0, w: 65, h: 65 }
        shape: rect
        style: { fill: "transparent", stroke: "#c41e3a", strokeWidth: 2 }
        rotation: 5
      - kind: text
        rect: { x: 0, y: 12, w: 65, h: 40 }
        text: "史"
        style: { fontSize: 28, color: "#c41e3a", textAlign: center }
```

Coordinates are **relative to the component's bounding box**. The resolver offsets them to the box's absolute position in the vertical stack.

`height` is required — the stacker cannot infer it from raw elements.

## Freeform Passthrough

For maximum flexibility, `template: freeform` accepts `LayoutElement[]` directly with no component resolver:

```yaml
- template: freeform
  background: "#1a1714"
  elements:
    - kind: text
      rect: { x: 100, y: 200, w: 760, h: 60 }
      text: "何为五代十国？"
      style: { fontFamily: "Noto Serif SC", fontSize: 32, color: "#e8e0d0" }
    - kind: shape
      rect: { x: 960, y: 0, w: 960, h: 1080 }
      shape: rect
      style: { fill: "#0d0b09" }
```

Elements use absolute coordinates on the 1920×1080 canvas. No stacking, no component resolution. This is a direct passthrough to Level 2 IR — useful for one-off slides or when Claude generates full layouts.

## Type Changes

### New slide types in SlideData union

```typescript
interface FreeformSlideData {
  template: "freeform";
  background?: string;
  backgroundImage?: string;
  overlay?: string;
  elements: LayoutElement[];
}

interface SplitComposeSlideData {
  template: "split-compose";
  ratio?: number;
  left: PanelDef;
  right: PanelDef;
}

interface FullComposeSlideData {
  template: "full-compose";
  background?: string;
  align?: "left" | "center";
  children: SlideComponent[];
}

interface PanelDef {
  background?: string;
  textColor?: string;
  children: SlideComponent[];
}
```

## File Structure

```
src/lib/layout/
  components/
    types.ts                           -- SlideComponent union, PanelDef
    resolvers.ts                       -- one resolver function per component type
    stacker.ts                         -- vertical stacking engine
    theme-tokens.ts                    -- theme.* string → concrete value resolver
  templates/
    index.ts                           -- registry (38 templates)
    freeform.ts                        -- passthrough layout function
    split-compose.ts                   -- two-panel composable layout
    full-compose.ts                    -- single-area composable layout
    ... (35 existing templates)        -- unchanged
```

## Backward Compatibility

- All 35 existing templates work without changes
- Existing `slides.yaml` files are fully compatible
- Both renderers (`LayoutRenderer`, `exportPptx`) are unchanged — they consume `LayoutSlide` regardless of how it was produced
- `LayoutElement` types unchanged — no new element kinds
- `ResolvedTheme` unchanged — component resolvers use existing theme slots

## Design Decisions

- **Extend YAML, not a new format** — Composable templates coexist with rigid templates in the same `slides.yaml`. One loader, one code path. Presentations can freely mix rigid and composable slides.
- **Resolver handles spatial math, Claude handles composition** — Common patterns (heading + bullets + stat) get automatic positioning. Novel components use `raw` with explicit coordinates.
- **Theme tokens for colors** — `theme.accent` instead of `"#4f6df5"` keeps presentations theme-switchable. Resolver substitutes concrete values at layout time.
- **Dual-target constraint maintained** — Everything resolves to `LayoutElement[]`. Composition freedom is the goal, not new visual capabilities beyond our 7 element types.
- **Best-effort height estimation** — Perfect font metrics is impractical without a browser. Accept imprecision and warn on overflow rather than blocking on a hard problem.
- **Freeform as escape valve** — When composable templates aren't enough, `template: freeform` provides full Level 2 IR access with no abstraction layer.
- **Three rendering paths coexist** — Old templates produce IR directly (most expressive), compose templates use components + stacker (automated layout), freeform passes IR through (full manual control). No migration needed — each path serves a different use case.

## Status

- **Phase 1** (Freeform Passthrough): Complete. Skill: `freeform-slides`.
- **Phase 2** (Composable Templates): Complete. Unified into `create-slides` skill (covers old templates, compose, and freeform).
- **Phase 3** (Evolve Vocabulary): Not started. Data-driven — requires usage analysis before extending components.
