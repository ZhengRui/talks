# Scene Authoring Reference

This repo is fully on the v9 scene-first path. All slides use `mode: scene`. The legacy component/autolayout path is gone.

Templates use explicit styles (colors, fonts, sizes) for pixel-faithful reproduction. Suffix template names with the deck slug or a unique string to avoid name collisions (e.g., `hero-panel-dynasties`, not `hero-panel`).

Primary goal: extract reusable templates at slide and block level, then instantiate the replicated slide from those templates.

Use this reference for scene authoring guidance. For repo integration (file paths, verification), see `integration.md`. For extraction-specific policy (built-in template/theme avoidance), see `SKILL.md`.

---

## Template System

### Two scopes

Templates have `scope: slide` (whole-slide composition) or `scope: block` (reusable fragment/group).

Both use identical header syntax (`name`, `scope`, `params`, `style`). The body contains `children:` plus scope-appropriate config. Do NOT include `mode: scene` or `kind: group` in template bodies -- the system injects them based on `scope`.

### Template references

Slide templates are referenced at slide level with nested `params:`:

```yaml
- template: split-stat-rail-dynasties
  fit: contain
  align: center
  params:
    title: "The Fall of an Empire"
    stats: [...]
  style:
    accent: "#ff6b35"
```

Block templates are referenced inside children as `kind: block` nodes:

```yaml
- kind: block
  id: stat-card-0
  template: stat-card-dynasties
  frame: { x: 100, y: 200, w: 300, h: 150 }
  params:
    value: "42%"
    label: "Growth"
```

### Reuse hierarchy

- **Presets** -- node-level style defaults (no children, no content). Supports `extends` inheritance.
- **Macros** -- Nunjucks-time scene node fragments (compile-time only, in `src/lib/dsl/macros/scene/`).
- **Block templates** (`scope: block`) -- reusable scene fragments (a group with children). Referenced as `kind: block` nodes.
- **Slide templates** (`scope: slide`) -- whole-slide composition. May contain macros and block template references.

---

## Coordinate Space

`sourceSize` declares the authoring coordinate space. Set it to the screenshot's pixel dimensions:

```yaml
sourceSize: { w: 1366, h: 768 }
```

When `sourceSize` is present, the compiler scales all geometry and visual metrics to the target canvas — frame values, guide positions, font sizes, letter spacing, border widths, border radii, shadow offsets/blur, effect radii, and `kind: ir` element rects/styles.

The presentation declares the target canvas via `canvasSize`. Each slide can override it. `fit` and `align` are set per-slide (on the instance, NOT in templates). The cascade: slide value >> presentation value >> built-in default.

```yaml
# Presentation-level defaults
canvasSize: { w: 1600, h: 900 }
fit: contain
align: center
slides:
  - template: my-template       # inherits canvasSize, fit, align
    params: { ... }
  - template: square-card        # overrides per-slide
    canvasSize: { w: 1080, h: 1080 }
    fit: cover
    align: center
    params: { ... }
```

- `fit` modes: `contain` (preserve aspect, fit inside), `cover` (preserve aspect, fill and crop), `stretch` (independent X/Y), `none` (no scaling)
- `align`: `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`

When `sourceSize` and the canvas share the same aspect ratio, `contain` fills perfectly. When they differ, `contain` produces letterboxing and `align` controls placement.

If the reference is a clean slide screenshot, use its native pixel size as `sourceSize`.

---

## Scene Nodes

There are 6 node kinds: 5 primitive kinds documented below, plus `block` (template references, documented in the Template System section). All share a common base (`SceneNodeBase`): `id`, `preset?`, `frame?`, `opacity?`, `borderRadius?`, `shadow?`, `effects?`, `border?`, `entrance?`, `animation?`, `clipPath?`, `transform?`, `cssStyle?`.

### text

`text` accepts plain strings, markdown-style strings (`"The **Fall** of *Tang*"`), or `TextRun[]` for mixed inline styling.

```yaml
- kind: text
  id: title
  frame: { left: 96, top: 64, w: 560 }
  text: "Title"
  style:
    fontFamily: heading
    fontSize: 54
    fontWeight: 700
    color: "#ffffff"
    lineHeight: 1.1
    textAlign: left
```

Style fields: `fontFamily` (heading | body | mono | CSS string), `fontSize`, `fontWeight`, `fontStyle` (normal | italic), `color`, `lineHeight`, `textAlign` (left | center | right), `textShadow`, `letterSpacing`, `textTransform` (uppercase | lowercase | none), `verticalAlign` (top | middle | bottom), `highlightColor`.

### shape

```yaml
- kind: shape
  id: panel
  frame: { left: "@x.split", top: 0, right: 0, bottom: 0 }
  shape: rect
  style: { fill: "#1a1714" }
```

Shapes: `rect`, `circle`, `line`, `pill`, `arrow`, `triangle`, `chevron`, `diamond`, `star`, `callout`.

Style fields: `fill`, `stroke`, `strokeWidth`, `strokeDash` (solid | dash | dot | dashDot), `gradient` (`{ type: linear, angle, stops: [{ color, position }] }`), `patternFill` (`{ preset, fgColor, fgOpacity?, bgColor?, bgOpacity? }`).

### image

```yaml
- kind: image
  id: photo
  frame: { x: 960, y: 0, w: 406, h: 768 }
  src: "hero.jpg"
  objectFit: cover
  borderRadius: 16
```

Fields: `src`, `objectFit` (cover | contain), `clipCircle`, `borderRadius`.

### group

Groups hold child nodes and optionally apply a local layout.

```yaml
- kind: group
  id: stats
  frame: { x: 1000, y: 180, w: 240, h: 260 }
  layout: { type: stack, gap: 48 }
  children:
    - kind: text
      id: stat-0
      frame: { w: 240 }
      text: "42%"
      style: { fontFamily: heading, fontSize: 56, fontWeight: 700, color: "#ff6b35", lineHeight: 1 }
```

Fields: `children` (SceneNode[]), `style?` (ShapeStyle -- fill, stroke, etc.), `clipContent?`, `layout?` (stack | row | grid). See the Layouts section.

### ir

Escape hatch wrapping a raw `LayoutElement` for code, table, list, video, or iframe. See the IR Elements section.

```yaml
- kind: ir
  id: code-block
  frame: { x: 96, y: 420, w: 720, h: 220 }
  element:
    kind: code
    id: code-el
    rect: { x: 0, y: 0, w: 720, h: 220 }
    code: "const x = 42;"
    language: typescript
    style:
      fontFamily: "Fira Code, monospace"
      fontSize: 24
      color: "#e0e0e0"
      background: "#1e1e2e"
      borderRadius: 12
      padding: 24
```

---

## IR Elements

### Two-layer geometry

The scene node has a `frame` (FrameSpec) positioned by the solver like any scene node. Inside, the `element` has its own `rect` ({x, y, w, h}). The solver fits/scales the element into the resolved frame.

Author the outer `frame` for positioning within the slide. Set the inner `element.rect` as the local coordinate space, typically `{ x: 0, y: 0, w, h }` matching the frame dimensions.

When `sourceSize` is present, both the frame and the element rect/styles are scaled.

### IR-only element kinds

All inherit `ElementBase`: `rect`, `opacity?`, `borderRadius?`, `shadow?`, `effects?`, `border?`, `entrance?`, `animation?`, `clipPath?`, `transform?`.

**code**

```yaml
element:
  kind: code
  id: snippet
  rect: { x: 0, y: 0, w: 800, h: 300 }
  code: "function hello() { return 'world'; }"
  language: javascript
  style: { fontFamily: "Fira Code", fontSize: 20, color: "#e0e0e0", background: "#1e1e2e", borderRadius: 12, padding: 24 }
```

**table**

Fields: `headers` (RichText[]), `rows` (RichText[][]), `headerStyle` (TextStyle & { background }), `cellStyle` (TextStyle & { background, altBackground }), `borderColor`.

**list**

Fields: `items` (RichText[]), `ordered` (boolean), `itemStyle` (TextStyle), `bulletColor?`, `itemSpacing` (number).

**video**

Fields: `src`, `poster?`.

**iframe**

Fields: `src`.

---

## FrameSpec

Scene nodes use `frame` for geometry constraints, not `rect`. Available constraints:

- Position: `x`, `y`, `left`, `top`, `right`, `bottom`, `centerX`, `centerY`
- Size: `w`, `h`

Partial specs are valid -- the solver resolves missing values from container bounds. Text nodes can omit `h` (auto-estimated from font metrics).

Values can be numbers, guide references (`"@x.left"`), or anchor references (`"@title.bottom"`, `{ ref: "@title.bottom", offset: 24 }`).

```yaml
frame: { x: 96, y: 64, w: 560, h: 120 }            # fully specified
frame: { left: 96, top: 64, right: 64, h: 4 }       # left+right edges, fixed height
frame: { centerX: 683, centerY: 384, w: 600, h: 200 } # centered
frame: { left: "@x.left", top: "@y.top", w: 560 }   # guide references, auto height
frame: { left: "@panel.right", top: { ref: "@title.bottom", offset: 24 }, w: 400 } # anchors
```

---

## Guides & Anchors

### Guides

Named alignment points declared at slide level in `guides.x` and `guides.y` maps:

```yaml
guides:
  x: { left: 96, split: 910, right: 1240 }
  y: { top: 64, baseline: 312 }
```

Reference in frame values with `"@x.name"` or `"@y.name"`:

```yaml
frame: { left: "@x.left", top: "@y.top", w: 560 }
```

When `sourceSize` is present, guide values are in source pixels (they get scaled with everything else).

### Anchors

Reference already-compiled siblings using `"@nodeId.property"`:

```yaml
frame: { left: "@panel.right", top: "@panel.top", w: 240, h: 120 }
frame: { top: { ref: "@title.bottom", offset: 24 }, left: 96, w: 560 }
```

Supported properties: `left`, `right`, `centerX`, `x`, `w`, `width`, `top`, `bottom`, `centerY`, `y`, `h`, `height`.

Rules:
- The target node must appear earlier in the same `children` array
- IDs must be unique across the whole slide (block expansion prefixes child ids automatically)

---

## Presets

Named style defaults defined in `presets:` at slide level. Nodes reference them with `preset:`. Node-level properties merge on top.

```yaml
presets:
  baseBody:
    style: { fontFamily: body, fontSize: 20, fontWeight: 400, color: "#b0a898", lineHeight: 1.6 }
  title:
    extends: baseBody
    style: { fontFamily: heading, fontSize: 52, fontWeight: 700, color: "#ffffff", lineHeight: 1.1 }
children:
  - kind: text
    id: heading
    preset: title
    frame: { left: "@x.left", top: 64, w: 560 }
    text: "Chapter One"
    style: { color: "#ff6b35" }   # overrides just color from preset
```

---

## Layouts

Group nodes can use `layout` for automatic child positioning.

### stack

Vertical stack. Children are laid out top-to-bottom.

```yaml
layout: { type: stack, gap: 24, align: start, justify: center, padding: [20, 24, 20, 24] }
```

Fields: `gap`, `align` (start | center | end | stretch), `justify` (start | center | end), `padding` (number or [top, right, bottom, left]).

### row

Horizontal row. Children are laid out left-to-right.

```yaml
layout: { type: row, gap: 32, tracks: [480, 720], align: stretch, padding: 24 }
```

Fields: `gap`, `tracks` (numbers or percentages like `"35%"` -- no `1fr`), `align` (start | center | end | stretch), `padding`.

### grid

Multi-column grid. Children fill cells left-to-right, top-to-bottom.

```yaml
layout: { type: grid, columns: 3, columnGap: 24, rowGap: 24, rowHeight: 180, tracks: ["30%", "40%", "30%"], padding: 24 }
```

Fields: `columns`, `columnGap`, `rowGap`, `rowHeight`, `tracks`, `padding`.

Grid pitfall: `bottom`/`centerY` constraints without `rowHeight` resolve against the full container height, not cell height. Use `rowHeight` or explicit `frame.h` on grid children.

---

## Backgrounds

Use the v9 background spec. Three forms:

```yaml
background: "theme.bg"                                          # string shorthand
background: { type: solid, color: "#0b1020" }                   # solid color
background: { type: image, src: "hero.jpg", overlay: "dark" }   # image with overlay
```

`overlay` supports: `dark`, `light`, `none`, or a custom color string (e.g., `"rgba(0,0,0,0.45)"`).

---

## Template Skeletons

### Slide-scope template

Templates declare `sourceSize` but NOT `fit`/`align` (those go on the instance).

```yaml
name: split-content-dynasties
scope: slide
params:
  title: { type: string, required: true }
  body: { type: string, required: true }
style:
  split: { type: number, default: 910 }

sourceSize: { w: 1366, h: 768 }
background: { type: solid, color: "#0f0a05" }
guides:
  x: { left: 96, split: {{ style.split }} }
children:
  - kind: shape
    id: panel
    frame: { left: "@x.split", top: 0, right: 0, bottom: 0 }
    shape: rect
    style: { fill: "#1a1714" }
  - kind: text
    id: title
    frame: { left: "@x.left", top: 64, w: 560 }
    text: "{{ title | yaml_string }}"
    style: { fontFamily: heading, fontSize: 52, fontWeight: 700, color: "#ffffff", lineHeight: 1.1 }
  - kind: text
    id: body
    frame: { left: "@x.left", top: { ref: "@title.bottom", offset: 24 }, w: 560 }
    text: "{{ body | yaml_string }}"
    style: { fontFamily: body, fontSize: 20, fontWeight: 400, color: "#b0a898", lineHeight: 1.6 }
```

### Block-scope template

```yaml
name: stat-card-dynasties
scope: block
params:
  value: { type: string, required: true }
  label: { type: string, required: true }

layout: { type: stack, gap: 8 }
children:
  - kind: text
    id: value
    frame: { w: 220 }
    text: "{{ value | yaml_string }}"
    style: { fontFamily: heading, fontSize: 56, fontWeight: 700, color: "#ff6b35", lineHeight: 1 }
  - kind: text
    id: label
    frame: { w: 220 }
    text: "{{ label | yaml_string }}"
    style: { fontFamily: body, fontSize: 16, color: "#8a8078", lineHeight: 1.3 }
```

### Slide instance

`fit` and `align` go here, at the instance level:

```yaml
- template: split-content-dynasties
  fit: contain
  align: center
  params:
    title: "The Fall of an Empire"
    body: "Regional warlords fractured the dynasty."
```

---

## Common Patterns

- **Asymmetric split**: `split` guide + shape panel + separate groups for each region.
- **Watermark**: large text node early in `children` with low `opacity` (renders behind later nodes).
- **Mixed emphasis**: rich text runs inside one text node (markdown or TextRun[]), or separate text nodes if geometry differs.
- **Repeating sub-regions**: extract a block template, reference via `kind: block` nodes inside a group with `stack`/`row`/`grid` layout.
- **Escape hatch**: `kind: ir` for code, table, list, video, or iframe elements.
- **Regular columns**: `row` layout with explicit `tracks` for controlled widths.
- **Card grids**: `grid` layout with `rowHeight` set to avoid constraint issues.

---

## Pitfalls

- No legacy node types (`box`, `raw`, `heading`, `stat`).
- No legacy `backgroundImage` -- use the `background` spec.
- No `flex` layout in scene groups -- use `stack`, `row`, or `grid`.
- No `1fr` tracks -- use numbers or percentages.
- No anchoring to later siblings -- target must appear earlier in `children`.
- No duplicate ids across the slide.
- No `mode: scene` or `kind: group` in template bodies -- the system injects them based on `scope`.
- Use nested `params:` on slide template references, not flat keys.
- Grid: use `rowHeight` or explicit `frame.h` for `bottom`/`centerY` constraints in grid children.
- Quote Nunjucks expressions: `text: "{{ title | yaml_string }}"`. Unquoted text with colons breaks YAML.
- Include `{{ loop.index0 }}` in ids inside `{% for %}` loops: `id: value-{{ loop.index0 }}`.
- `fit`/`align` go on the slide instance, not in the template body.
