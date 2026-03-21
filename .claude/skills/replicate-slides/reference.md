# Slide Replication Reference

This repo is fully on the v9 scene-first path.

- `SlideData` is scene-only
- the legacy component/autolayout path is gone
- replication should default to scene authoring with explicit geometry
- built-in templates still exist, but they are now scene-backed shortcuts

Primary replication goal: extract reusable templates — at **slide level and block level** — whenever the source layout is shareable, then instantiate the replicated slide from those templates.

Use this reference for replication-specific guidance. For full template coverage, see the built-in templates in `src/lib/layout/templates/`.

---

## Template System

### Two scopes

Templates have `scope: slide` (whole-slide composition) or `scope: block` (reusable fragment/group).

Both use identical header syntax. The body contains just `children:` plus scope-appropriate config — the system injects `mode: scene` or `kind: group` based on `scope`.

### Template references

Slide templates are referenced at slide level with nested `params:`:

```yaml
- template: split-stat-rail
  params:
    title: "The Fall of an Empire"
    stats: [...]
  style:
    accent: "#ff6b35"
```

Block templates are referenced inside children as `kind: block` nodes:

```yaml
- kind: block
  id: stat-card-1
  template: stat-card
  frame: { x: 100, y: 200, w: 300, h: 150 }
  params:
    value: "42%"
    label: "Growth"
```

A slide template can use block templates in its body via `kind: block` nodes.

### Reuse hierarchy

- **Presets** — node-level style defaults (no children, no content). Supports `extends`.
- **Macros** — Nunjucks-time scene node fragments (compile-time only, in `src/lib/dsl/macros/scene/`). Best for template-internal composition.
- **Block templates** (`scope: block`) — reusable scene fragments (a group with children). Referenced as `kind: block` nodes. Best for cross-template reuse and UI-driven extraction.
- **Slide templates** (`scope: slide`) — whole-slide composition. May contain macros and/or block template references.

---

## Two-Layer Model

### Layer 1: Core Replication Contract

This is the default mode. It is the right model for an API or service.

- Input: screenshot or visual source, optional markup, optional user corrections
- Output: analysis, reusable template YAML (slide + block), slide instance YAML, verification plan
- No arbitrary repo reads
- No file writes
- No invented slugs, decks, or scratch paths

Use this layer unless the caller explicitly wants repo integration.

### Layer 2: Repo Adapter

This is the repo-specific wrapper around Layer 1.

- Input: Layer 1 inputs plus slug and target slide or explicit repo path
- Output: files written under `content/<slug>/...`, plus repo verification artifacts
- Minimal allowed reads: target `slides.yaml`, target template file if updating, target deck assets
- Minimal allowed writes: target templates (slide + block), target slide entry, optional overlay refs
- Verification surfaces: `/workbench/replicate` and `bun run slide:diff`

Do not enter Layer 2 just because the repo is available. Enter it only when the user asks for repo changes or provides a concrete target deck.

---

## Replication Workflow

### 0. Choose The Layer

- If the user asked for a service-style result, API payload, or did not provide a concrete slug or output path, stay in Layer 1.
- If the user explicitly asked for repo edits or provided a real deck target, use Layer 2.
- If slug or path is missing, do not invent one. Return Layer 1 output instead.

### 1. Prepare The Reference

- Prefer a cropped slide screenshot with no browser chrome.
- If the source includes extra margins or UI, crop it first or measure the slide bounds precisely.
- Record the reference image size. That becomes `sourceSize` when authoring in screenshot-space.

### 2. Choose The Coordinate Space

- For screenshot replication, `sourceSize` is the default.
- If you are measuring directly from the screenshot, keep those measurements and set `sourceSize`.
- If exact 1920x1080 coordinates were explicitly provided or already normalized outside the skill, omit `sourceSize`.
- Do not manually rescale twice.

### 3. Author The Scene

- Start with background and largest panels.
- Add `guides` for repeated edges, splits, and baselines.
- Use `frame` constraints plus anchors for local relationships.
- Use `stack`, `row`, and `grid` only where the source is actually regular.
- Use `kind: ir` as an escape hatch when scene-native nodes are not enough.
- **Identify block template candidates**: any sub-region that repeats 2+ times or would be useful across different slides.

### 4. Extract Templates

- Prefer reusable templates unless the slide is clearly one-off.
- Extract **block-scope templates** for repeating sub-regions (stat cards, feature rows, quote blocks).
- Extract a **slide-scope template** for the overall layout, using `kind: block` to reference the block templates.
- In Layer 2, write templates into `content/<slug>/templates/`.
- Promote the stable layout skeleton into the slide template:
  - guides
  - region frames
  - z-order
  - recurring chrome
  - presets
  - local layout rules
- Parameterize what should vary:
  - text
  - arrays
  - image paths
  - optional regions
  - meaningful style knobs
- Instantiate the original replicated slide from the template in `slides.yaml` when in Layer 2.
- In Layer 1, return the template body and slide instance body without writing files.

### 5. Verify

- In Layer 1, return a verification plan and recommended commands or URLs.
- In Layer 2, use the repo's named verification surfaces:
  - interactive review: `/workbench/replicate`
  - overlay viewer:
    - `/<slug>?slide=12&chrome=0&overlay=refs/slide-12.png&overlayOpacity=0.5`
    - `/<slug>?slide=12&chrome=0&overlayDir=refs&overlayPattern=slide-{n}.png&overlayOpacity=0.5`
  - CLI diff:
    - `bun run slide:diff -- --slug <slug> --slide <n> --reference /absolute/path/to/reference.png`

Use `overlay` for alignment and spacing. Use `diff` for fast mismatch inspection.
If `slide:diff` is used, describe it by that name even though the script uses Playwright internally. Do not present a raw Playwright screenshot loop as the public workflow.

---

## Service-Safe Rules

### Default Read Boundary

In Layer 1, only read:

- the provided screenshot or reference asset
- the provided HTML/CSS or markup, if any
- this skill and its reference

Do not read:

- unrelated `slides.yaml` files
- existing decks just to infer format
- solver or engine internals
- arbitrary theme files or implementation code

### When Repo Reads Are Allowed

In Layer 2, read only what is minimally necessary:

- `content/<slug>/slides.yaml`
- `content/<slug>/templates/<template-name>.template.yaml` if updating rather than creating
- target deck assets or `public/<slug>/refs/` if verification setup needs them

Only inspect implementation code if:

- the skill/reference is insufficient to produce valid v9 scene YAML, or
- repo integration fails and you are debugging a compile or runtime issue

### Write Boundary

- Layer 1: no writes
- Layer 2: write only the requested templates (slide + block), slide instance, and verification support files
- Never invent a scratch slug or temporary deck unless the user explicitly asked for one
- If creating a new `slides.yaml`, write a full presentation wrapper with at least `title` and `slides`
- `theme` is optional; do not invent an invalid theme name
- If no repo theme is a good match, omit `theme` and rely on explicit scene styles for fidelity

### Output Contract

Layer 1 should return:

1. analysis (including block template candidates)
2. authoring decision
3. block-scope template YAML (if any)
4. slide-scope template YAML
5. slide instance YAML
6. verification plan

Layer 2 should return:

1. analysis
2. authoring decision
3. template file contents (slide + block)
4. slide instance YAML
5. concrete file paths written
6. verification method and, if run, diff result

---

## Repo Adapter Workflow

When Layer 2 is active:

1. run Layer 1 logic first
2. write or update block template files (if any)
3. write or update the slide template file
4. write or update the slide instance
5. set up overlay refs only if needed
6. verify with `/workbench/replicate` or `bun run slide:diff`

---

## Template-First Heuristics

### Extract Block Templates When

- a sub-region repeats 2+ times in the slide (e.g., stat cards, feature rows)
- a sub-region would be useful across different slides (e.g., quote block, chart card)
- the sub-region has its own internal structure (children, layout)

### Create A Slide Template When

- the composition could reasonably appear in more than one slide
- the slide belongs to a family in the source deck
- the structure is stable but content varies
- the slide uses recognizable recurring regions

### Use An Inline Scene Only When

- the composition is highly bespoke and not worth parameterizing
- almost every node would stay hardcoded anyway
- extracting a template would create a fake abstraction with no reuse value

### Use A Built-In Template When

- the source is already a close match
- built-in params and style controls cover the needed fidelity
- introducing a deck-local template would duplicate an existing built-in shape

For replication, scene with extracted templates should be the default choice.

---

## Deck-Local Template Output

File location:

```text
content/<slug>/templates/<template-name>.template.yaml
```

The loader checks deck-local templates before built-ins, so no registry update is needed.

Typical replication output is:

1. block template files (if any)
2. slide template file
3. slide instance in `content/<slug>/slides.yaml`

This section applies to Layer 2 only. In Layer 1, return the same material as payload rather than writing files.

### Parameterization Rules

Always parameterize:

- titles, body, labels, captions
- arrays of repeated items
- image paths
- optional blocks
- the values that actually vary across sibling slides

Parameterize as `style` defaults when useful:

- split widths
- panel padding
- font sizes
- accent colors that define the template family
- repeated spacing values

Usually hardcode:

- the guide system
- the overall composition skeleton
- layer ordering
- the default local layout types
- stable chrome and decorative geometry

When the slide does not fit an existing repo theme well:

- omit top-level `theme` rather than forcing a poor match
- prefer explicit colors over theme tokens
- prefer explicit font-family strings over `heading` / `body` / `mono` tokens when typography fidelity matters

---

## Scene Template Skeletons

### Slide-Scope Template

```yaml
name: split-stat-rail
scope: slide
params:
  eyebrow: { type: string }
  title: { type: string, required: true }
  body: { type: string, required: true }
  stats: { type: array, required: true }
style:
  split: { type: number, default: 910 }
  accent: { type: string, default: "#ff6b35" }

sourceSize: { w: 1366, h: 768 }
fit: contain
align: center
background: { type: solid, color: "#0f0a05" }
guides:
  x: { left: 96, split: {{ style.split }}, stats: 1000 }
  y: { top: 64 }
presets:
  titleText:
    style:
      fontFamily: heading
      fontSize: 52
      fontWeight: 700
      color: "#ffffff"
      lineHeight: 1.1
  bodyText:
    style:
      fontFamily: body
      fontSize: 20
      fontWeight: 400
      color: "#b0a898"
      lineHeight: 1.6
children:
  - kind: shape
    id: right-panel
    frame: { left: "@x.split", top: 0, right: 0, bottom: 0 }
    shape: rect
    style: { fill: "#1a1714" }
  - kind: text
    id: title
    preset: titleText
    frame: { left: "@x.left", top: "@y.top", w: 560 }
    text: "{{ title | yaml_string }}"
  - kind: text
    id: body
    preset: bodyText
    frame: { left: "@x.left", top: 220, w: 560 }
    text: "{{ body | yaml_string }}"
  - kind: group
    id: stats
    frame: { left: "@x.stats", top: 180, w: 220, h: 300 }
    layout: { type: stack, gap: 36 }
    children:
{% for stat in stats %}
      - kind: block
        id: stat-{{ loop.index0 }}
        template: stat-card
        frame: { w: 220, h: 84 }
        params:
          value: "{{ stat.value | yaml_string }}"
          label: "{{ stat.label | yaml_string }}"
{% endfor %}
```

### Block-Scope Template

```yaml
name: stat-card
scope: block
params:
  value: { type: string, required: true }
  label: { type: string, required: true }
style:
  valueColor: { type: string, default: "#ff6b35" }

layout: { type: stack, gap: 8 }
children:
  - kind: text
    id: value
    frame: { w: 220 }
    text: "{{ value | yaml_string }}"
    style:
      fontFamily: heading
      fontSize: 56
      fontWeight: 700
      color: "{{ style.valueColor }}"
      lineHeight: 1
  - kind: text
    id: label
    frame: { w: 220 }
    text: "{{ label | yaml_string }}"
    style:
      fontFamily: body
      fontSize: 16
      fontWeight: 400
      color: "#8a8078"
      lineHeight: 1.3
```

### Slide Instance (nested params)

```yaml
- template: split-stat-rail
  params:
    eyebrow: "CHAPTER 03"
    title: "The Fall of an Empire"
    body: "Regional warlords, rebellions, and fiscal strain fractured an empire that had lasted nearly three centuries."
    stats:
      - value: "907 CE"
        label: "Year of collapse"
      - value: "289"
        label: "Years of reign"
```

---

## Scene Skeleton

```yaml
- mode: scene
  sourceSize: { w: 1366, h: 768 }     # optional, author in reference-image coordinates
  fit: contain                        # optional: contain | cover | stretch | none
  align: center                       # optional: top-left | top | top-right | left | center | right | bottom-left | bottom | bottom-right
  background: { type: solid, color: "#0b1020" }
  guides:
    x: { left: 96, split: 910, right: 1240 }
    y: { top: 64, baseline: 312 }
  presets:
    title:
      style:
        fontFamily: heading
        fontSize: 54
        fontWeight: 700
        color: "#ffffff"
        lineHeight: 1.1
  children:
    - kind: shape
      id: panel
      frame: { left: "@x.split", top: 0, right: 0, bottom: 0 }
      shape: rect
      style: { fill: "#171b26" }
    - kind: text
      id: title
      preset: title
      frame: { left: "@x.left", top: "@y.top", w: 560 }
      text: "Replication Example"
```

---

## Coordinate Normalization

### `sourceSize`

`sourceSize` declares the pixel space you are authoring in.

```yaml
sourceSize: { w: 1366, h: 768 }
```

When `sourceSize` is present, the compiler scales geometry and visual metrics into the final 1920x1080 slide:

- `frame` values
- guide positions
- font sizes
- letter spacing
- border widths
- border radii
- shadow offsets and blur
- effect radii
- `kind: ir` element rects and styles

### `fit`

- `contain`: preserve aspect ratio, fit fully inside 1920x1080
- `cover`: preserve aspect ratio, fill 1920x1080 and crop overflow
- `stretch`: scale X and Y independently
- `none`: no scaling, just place the source-space scene inside the 1920x1080 canvas

Recommended default for replication: `fit: contain`.

### `align`

Controls where the scaled source-space scene sits inside the 1920x1080 canvas.

Common default: `align: center`.

### Practical Rules

- If the reference is a clean slide screenshot, use its native pixel size as `sourceSize`.
- If the reference contains browser chrome, crop first. Do not rely on `fit` to hide chrome.
- If the source is already 16:9, `contain` will usually be the right default.

---

## Backgrounds

Use the v9 background spec. Do not use legacy top-level `backgroundImage` fields.

```yaml
background: "theme.bg"
background: { type: solid, color: "#0b1020" }
background: { type: image, src: "hero.jpg", overlay: "dark" }
background: { type: image, src: "hero.jpg", overlay: "rgba(0,0,0,0.45)" }
```

`overlay` supports `dark`, `light`, `none`, or a custom color string.

---

## Scene Nodes

### `text`

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

`text` accepts:

- plain strings
- markdown-style strings such as `"The **Fall** of *Tang*"`
- `TextRun[]` for mixed inline styling

Text style fields:

- `fontFamily`: `heading` | `body` | `mono` | CSS font-family string
- `fontSize`
- `fontWeight`
- `fontStyle`
- `color`
- `lineHeight`
- `textAlign`
- `textShadow`
- `letterSpacing`
- `textTransform`
- `verticalAlign`
- `highlightColor`

### `shape`

```yaml
- kind: shape
  id: strip
  frame: { x: 0, y: 0, w: 1366, h: 4 }
  shape: rect
  style:
    gradient:
      type: linear
      angle: 90
      stops:
        - { color: "#ff6b35", position: 0 }
        - { color: "#00d4ff", position: 1 }
```

Supported shapes:

- `rect`
- `circle`
- `line`
- `pill`
- `arrow`
- `triangle`
- `chevron`
- `diamond`
- `star`
- `callout`

### `image`

```yaml
- kind: image
  id: photo
  frame: { x: 960, y: 0, w: 406, h: 768 }
  src: "hero.jpg"
  objectFit: cover
  borderRadius: 16
```

Image fields:

- `src`
- `objectFit`: `cover` | `contain`
- `clipCircle`

### `group`

Use `group` for a local scene subtree. It can be purely absolute or use a local layout.

```yaml
- kind: group
  id: stats
  frame: { x: 1000, y: 180, w: 240, h: 260 }
  layout: { type: stack, gap: 48 }
  children: [...]
```

#### `stack`

```yaml
layout:
  type: stack
  gap: 24
  align: start          # start | center | end | stretch
  justify: center       # start | center | end
  padding: [20, 24, 20, 24]
```

#### `row`

```yaml
layout:
  type: row
  gap: 32
  tracks: [480, 720]    # numbers or percentages, not fr units
  align: stretch        # start | center | end | stretch
  padding: 24
```

`tracks` support:

- numbers, such as `480`
- percentages, such as `"35%"`

Do not use `1fr`. That is not part of the scene layout model.

#### `grid`

```yaml
layout:
  type: grid
  columns: 3
  columnGap: 24
  rowGap: 24
  rowHeight: 180
  tracks: ["30%", "40%", "30%"]
  padding: 24
```

**Important:** When grid children use `bottom` or `centerY` constraints, set `rowHeight` or give each child an explicit `frame.h`. Without these, `bottom` resolves against the full grid container height, not the cell height.

### `block`

Use `kind: block` to reference a block-scope template from within a slide or slide template.

```yaml
- kind: block
  id: stat-card-1
  template: stat-card
  frame: { x: 100, y: 200, w: 300, h: 150 }
  params:
    value: "42%"
    label: "Growth"
  style:
    valueColor: "#00ff88"
```

Block nodes support all `SceneNodeBase` properties (frame, opacity, entrance, etc.) plus:

- `template`: name of the block-scope template to expand
- `params`: template parameter values
- `style`: template style overrides

The system expands block nodes before compilation:
- Child IDs are prefixed with the block node's ID (e.g., `stat-card-1.value`)
- Block presets are namespaced (e.g., `stat-card-1.presetName`)
- The expanded group inherits frame, entrance, and other props from the block node

### `ir`

Use `kind: ir` when you need a raw `LayoutElement` subtree inside a scene slide.

Typical cases:

- code
- table
- list
- video
- iframe
- a low-level raw IR subtree that is easier to reuse than rebuilding in scene nodes

```yaml
- kind: ir
  id: code-block
  frame: { x: 96, y: 420, w: 720, h: 220 }
  element:
    kind: code
    id: code-element
    rect: { x: 0, y: 0, w: 720, h: 220 }
    code: "const x = 42;"
    language: typescript
    style:
      fontFamily: "theme.fontMono"
      fontSize: 24
      color: "theme.codeText"
      background: "theme.codeBg"
      borderRadius: 12
      padding: 24
```

---

## FrameSpec

Scene nodes use `frame`, not `rect`.

Available constraints:

- `x`, `y`, `w`, `h`
- `left`, `top`, `right`, `bottom`
- `centerX`, `centerY`

Examples:

```yaml
frame: { x: 96, y: 64, w: 560, h: 120 }
frame: { left: 96, top: 64, right: 64, h: 4 }
frame: { centerX: 683, centerY: 384, w: 600, h: 200 }
frame: { w: 560 }  # width only; height may be inferred for text
```

---

## Guides And Anchors

### Guides

Guides are named alignment points:

```yaml
guides:
  x: { left: 96, split: 910, right: 1240 }
  y: { top: 64, baseline: 312 }
```

Reference them with:

```yaml
frame: { left: "@x.left", top: "@y.top", w: 560 }
```

When `sourceSize` is present, guide values should be in source pixels.

### Anchors

Anchor references target already-compiled siblings in the same container.

```yaml
frame: { left: "@panel.right", top: "@panel.top", w: 240, h: 120 }
frame: { top: { ref: "@title.bottom", offset: 24 }, left: 96, w: 560 }
```

Supported anchor fields:

- `left`, `right`, `centerX`, `x`, `w`, `width`
- `top`, `bottom`, `centerY`, `y`, `h`, `height`

Rules:

- the target node must appear earlier in the same `children` array
- ids must be unique across the whole slide

---

## Presets

Use `presets` for repeated styles in a slide.

```yaml
presets:
  baseBody:
    style: { fontFamily: body, fontSize: 20, fontWeight: 400, color: "#b0a898", lineHeight: 1.6 }
  title:
    extends: baseBody
    style: { fontFamily: heading, fontSize: 52, fontWeight: 700, color: "#ffffff", lineHeight: 1.1 }
```

Node-level overrides merge on top of preset defaults.

---

## Template Vs Scene

### Prefer Templates Only For Near-Exact Matches

Good candidates:

- `cover`, `statement`, `section-divider`, `end`
- `bullets`, `numbered-list`, `quote`, `stats`
- `code`, `code-comparison`, `table`, `timeline`, `steps`
- `comparison`, `two-column`, `three-column`, `sidebar`, `top-bottom`
- `image-text`, `image-caption`, `diagram`, `chart-placeholder`
- `image-grid`, `image-gallery`, `image-comparison`, `full-image`
- `agenda`, `highlight-box`, `qa`, `profile`, `icon-grid`, `video`, `iframe`, `blank`

### Prefer Scene When The Slide Has

- asymmetric custom splits
- overlapping or layered elements
- watermark text or decorative geometry
- screenshot-space alignment that depends on guides
- mixed local structures that do not fit one built-in template
- exact placement requirements that would fight a template

For replication, scene should be the default choice.

---

## Verification Tooling

### Workbench

Use `/workbench/replicate` for:

- slide selection
- reference upload
- render / reference / overlay / diff / split modes
- viewer URL generation

Reference path conventions:

- per-slide refs in `public/<slug>/refs/slide-12.png` can be entered as `refs/slide-12.png`
- absolute `/shared/...` style paths also work
- uploaded screenshots work without creating a public file

### CLI Diff

```bash
bun run slide:diff -- --slug <slug> --slide <n> --reference /absolute/path/to/reference.png
```

Useful flags:

- `--base-url http://127.0.0.1:3000`
- `--threshold 24`
- `--max-mismatch 0.02`
- `--out-dir .artifacts/slide-diff`

Outputs:

- rendered PNG
- diff PNG
- JSON report with mismatch ratio

`slide:diff` uses Playwright internally. Treat that as an implementation detail, not as a separate public workflow.

---

## Common Patterns

### Asymmetric Split

- add a `split` guide
- create one `shape` for the panel background
- keep copy and stats in separate `group` nodes

### Watermark

- use a large `text` node early in `children`
- set low `opacity`
- keep it behind foreground nodes by order

### Mixed Emphasis In A Heading

- use rich text runs inside one `text` node, or
- split into multiple text nodes if geometry differs

### Regular Subregions

- use `stack` for copy blocks
- use `row` for clear side-by-side panels
- use `grid` for actual repeated cells

### Repeating Sub-Regions (Block Templates)

- extract a block-scope template for patterns like stat cards, feature rows, quote blocks
- reference from the slide template via `kind: block` nodes
- each block instance gets its own `id`, `frame`, and `params`

### Escape Hatch

- if a code/table/list/video/iframe block is already easy to express as raw IR, wrap it in `kind: ir`

---

## Pitfalls

- Do not use old `type: box`, `type: raw`, `type: heading`, `type: stat`, or `verticalAlign` container props.
- Do not use legacy top-level `backgroundImage`.
- Do not use `layout: { type: flex }` in scene groups. Scene layouts are `stack`, `row`, or `grid`.
- Do not use `1fr` tracks.
- Do not anchor to later siblings.
- Do not reuse ids.
- Do not store overlay refs under `content/<slug>/refs/` and expect `sync-content` to publish them.
- Do not read unrelated repo files just to infer format or behavior.
- Do not invent a slug or scratch deck when one was not provided.
- Do not normalize screenshot coordinates to 1920x1080 by default; prefer `sourceSize`.
- Do not present an ad hoc Playwright screenshot loop as the verification workflow.
- Do not include `mode: scene` or `kind: group` in template bodies — the system injects them based on `scope`.
- Do not use flat params on slide template references — use nested `params:`.
- Do not use `bottom`, `centerY`, or height-relative constraints inside grid children unless `rowHeight` is set on the grid layout or the grid children have explicit `frame.h`. Without these, children compile against the full grid container height, not the computed cell height, producing large gaps. Use `top` positioning, anchor references, or explicit `frame.h` on grid children instead.
- Always wrap `{{ param | yaml_string }}` in quotes in template bodies: `text: "{{ title | yaml_string }}"`. Without quotes, text containing colons (e.g. `"warned: if attacked"`) breaks YAML parsing as a nested mapping.
- Always include `{{ loop.index0 }}` in ids inside `{% for %}` loops: `id: value-{{ loop.index0 }}`. Block expansion prefixes child ids with the block node's id (e.g. `stat-rail.value-0`), so different blocks won't collide, but repeated ids within the same block will.
