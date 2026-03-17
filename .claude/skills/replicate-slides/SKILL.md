---
name: replicate-slides
description: Use when replicating an existing slide from a screenshot, HTML/CSS source, or other visual reference. Analyze the source, then author a v9 scene slide with explicit geometry, guides, anchors, and optional IR escape hatches. Prefer this over create-slides when fidelity to an existing visual source matters.
---

# Slide Replication

Replicate slides from visual sources into the repo's v9 scene system.

This repo is scene-only. Do not use the removed component tree (`box`, `raw`, `heading`, `stat`, etc.). Built-in templates still exist, but for screenshot replication they are only for exact structural matches.

Primary goal: do not just reproduce one slide. Learn reusable templates from the source — at **slide level and block level** — then instantiate the replicated slide from those templates.

See [reference.md](reference.md) for the replication workflow, scene authoring subset, and verification tooling.

## Template System

### Two scopes

Templates have `scope: slide` (whole-slide composition) or `scope: block` (reusable fragment/group).

Both use identical syntax:

```yaml
name: <template-name>
scope: slide | block
params:
  <name>: { type: string|number|array, required: true }
style:
  <name>: { type: string|number, default: <value> }

# body — just children + config (no mode: scene / kind: group needed)
children:
  - kind: text
    id: ...
```

The system injects `mode: scene` or `kind: group` based on `scope` — do not include them in the body.

### Template references

Slide templates are referenced at slide level in `slides.yaml`:

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

Macros and block templates both produce scene fragments but differ in mechanism:
- Macros are Nunjucks code, expanded at template render time, live inside template files
- Block templates are standalone `.template.yaml` files, expanded after template rendering, discoverable by the UI

Prefer macros for internal template composition. Prefer block templates for reusable patterns that should be shared across templates or extracted by the UI.

## Two Layers

### Layer 1: Core Replication Contract

This is the default layer. It is service-safe and repo-agnostic.

- Input: screenshot or visual source, optional markup, optional corrections, optional explicit output schema
- Output: analysis, authoring decision, reusable template YAML (slide + block), slide instance YAML, verification plan
- Do not read arbitrary repo files, existing deck files, or implementation code
- Do not write files
- Do not invent slugs, paths, or scratch decks
- Do not inspect solver internals unless the user explicitly asks to debug the platform

Use this layer whenever the user wants replication as a capability, API, or service.

### Layer 2: Repo Adapter

This layer applies only when the user explicitly wants repo changes or provides a real deck target.

- Input: Layer 1 inputs plus slug and target slide or target file path
- Output: deck-local template files (slide + block), slide instance in `slides.yaml`, repo-specific verification
- May write into `content/<slug>/templates/` and `content/<slug>/slides.yaml`
- May use `/workbench/replicate` and `bun run slide:diff`
- Still should not inspect unrelated repo files or implementation internals unless blocked

Default rule: start in Layer 1. Enter Layer 2 only when the user clearly asks for repo edits or provides a concrete repo target.

## Inputs

Accept any combination:

- Screenshot or reference image path (preferred)
- Optional HTML/CSS/markup for exact measurements and colors
- Optional verbal corrections from the user
- Optional presentation slug and target slide
- Optional source dimensions if they are not obvious from the image

When inputs conflict: verbal correction > HTML/CSS > screenshot.

If the reference includes browser chrome, page margins, or other non-slide regions, crop or measure the actual slide bounds first.

If slug or output path is missing, stay in Layer 1 and return the template plus slide YAML as payload. Do not create a scratch slug such as `test-replicate`.

## Default Output

- Prefer reusable templates — both slide-scope and block-scope
- In Layer 1, return the template YAML and slide instance YAML without writing files
- In Layer 2, write deck-local templates in `content/<slug>/templates/<template-name>.template.yaml`
- In Layer 2, instantiate the replicated slide from those templates in `content/<slug>/slides.yaml`
- Prefer explicit `frame` geometry, guides, and anchors in the template output
- For screenshot replication, use `sourceSize` from the reference image by default
- Use `kind: ir` only when native scene nodes are not enough
- Use `kind: block` to reference block-scope templates from within a slide template
- Fall back to an inline scene slide only when the composition is clearly one-off and not worth templating

## Replication Strategy

### 1. Analyze

Produce a concise inventory before writing YAML:

```text
ANALYSIS:
  sourceSize: 1366x768
  crop: full slide
  major guides:
    - left edge 96
    - split 910
    - top baseline 64
  background:
    - solid #0f0a05
    - right panel #1a1714
  typography:
    - heading: 52 / 700 / #ffffff / Inter
    - body: 20 / 400 / #b0a898 / Inter
  assets:
    - no external images
  structure:
    - 4px gradient strip
    - left text stack
    - right stat column (→ block template candidate)
  block candidates:
    - stat-card: value + label pair, repeats 3x
  verification:
    - overlay against refs/slide-3.png
```

Capture:

- source dimensions and crop bounds
- major alignment lines and split ratios
- z-order
- typography, palette, and spacing
- image crops and decorative shapes
- which parts should be scene-native vs `kind: ir`
- **which sub-regions are block template candidates** (repeating or reusable patterns)

Also decide which layer applies:

- Layer 1 if the user did not explicitly request repo edits or provide a real deck target
- Layer 2 only if the user did explicitly request repo edits or provide a concrete slug / output path

### 2. Choose The Authoring Path

- Use an exact built-in template only if the source already matches it closely.
- Otherwise create reusable templates by default:
  - One slide-scope template for the overall layout
  - Block-scope templates for repeating sub-regions
- In Layer 2, write them as deck-local templates.
- Use an inline scene slide only if the composition is too idiosyncratic to make a useful reusable template.
- For screenshot replication, scene is the default path whether the final artifact is a template or an inline slide.

### 3. Build The Scene

- Start from the reusable structure, not just the one slide's content.
- If the input is a screenshot or visual reference, set `sourceSize` to the reference image size unless the user already supplied exact 1920x1080 coordinates.
- Use source-coordinate measurements in `frame` and `guides`.
- Default to `fit: contain` and `align: center` when mapping source space into 1920x1080.
- Omit `sourceSize` only when exact 1920x1080 measurements were explicitly given or already derived outside the skill.
- Add biggest regions first: background, panels, major images.
- Add guides for repeated edges, splits, and baselines.
- Add text, shapes, images, and groups in back-to-front order.
- Use local `stack`, `row`, or `grid` only inside genuinely regular subregions.
- Use anchors to place elements relative to already-defined siblings.
- Use presets for repeated text and chrome styles.
- Use `kind: ir` for code, table, list, video, iframe, or low-level raw IR reuse.
- Use `kind: block` to reference block-scope templates for repeating sub-regions.
- Parameterize the parts that should vary across future slides: text, arrays, images, optional blocks, and meaningful style knobs.
- Hardcode the stable composition skeleton: guides, layering, region layout, and recurring chrome.

### 4. Instantiate

- If using a built-in template, output the slide instance only.
- If creating reusable templates, output all of them:
  - the slide-scope template file
  - any block-scope template files
  - the slide instance that uses them
- Keep the first replicated slide as proof that the extracted templates actually reproduce the source faithfully.
- In Layer 1, return YAML only. Do not write files.
- In Layer 2, write the templates and slide instance into the requested deck.
- If Layer 2 creates a new `content/<slug>/slides.yaml`, write a full presentation document, not a bare slide or bare slide array.
- A new presentation file must include at minimum:
  - `title`
  - `slides`
- Include `theme` when provided by the user or when you are preserving an existing deck choice.
- If no theme was provided and there is no existing deck to inherit from, either:
  - omit `theme` and let the repo default apply, or
  - use a valid existing theme name only if you state that choice explicitly
- Do not invent invalid theme names.
- If no repo theme is a good visual match, prefer omitting `theme` rather than forcing a weak match.
- When omitting `theme` for fidelity reasons, do not rely on theme-specific visual identity for the replicated slide:
  - use explicit colors
  - use explicit font-family strings where fidelity matters more than theme-switchability
  - use template/style params for recurring design knobs instead of theme assumptions

### 5. Verify

- Layer 1:
  - return a verification plan
  - if repo tooling is unavailable, do not substitute an ad hoc Playwright screenshot loop and present it as the workflow
- Layer 2:
  - interactive: open `/workbench/replicate`, use `overlay` for alignment and spacing, use `diff` for quick mismatch inspection
  - CLI: `bun run slide:diff -- --base-url http://127.0.0.1:3000 --slug <slug> --slide <n> --reference /absolute/path/to/reference.png`
- If `slide:diff` is used, refer to it by name even though its implementation may use Playwright internally.
- Iterate until layout, spacing, typography, crops, and visual weight are close.

## File And Asset Rules

- Slide YAML: `content/<slug>/slides.yaml`
- Deck-local templates: `content/<slug>/templates/<template-name>.template.yaml`
- Slide assets used in the deck: `content/<slug>/images/`, then run `bun run sync-content`
- Reference screenshots for overlay review:
  - upload them in `/workbench/replicate`, or
  - place them in `public/<slug>/refs/` and reference `refs/slide-12.png`

`sync-content` copies `content/<slug>/images/` into `public/<slug>/`. It does not copy `refs/`.

These file rules apply only in Layer 2.

## Replication Heuristics

- Prefer reusable templates (slide + block) over one-off inline scenes.
- Prefer scene over built-in templates unless there is a close structural match.
- Prefer screenshot-space authoring over manual rescaling.
- Use guides for repeated alignment lines.
- Use multiple text nodes or rich text runs for mixed emphasis.
- Keep ids unique and ordered; anchors only target previously compiled siblings in the same container.
- Later children render on top.
- Do not force a screenshot into `row` or `grid` if the source is really guide-based.
- Do not recreate the removed v7/v8 component syntax.
- If replicating several slides from one source deck, stabilize the templates after the first good slide and reuse them for the rest.
- Do not read existing deck files or solver code just to infer output shape; the skill should already define the contract.
- Do not inspect repo internals unless the user explicitly asked for repo edits and the skill/reference is insufficient.
- **Identify block template candidates**: any sub-region that appears 2+ times or would be useful across different slides.

## Output Format

Return:

1. a concise analysis block (including block template candidates)
2. a short build note: Layer 1 vs Layer 2, built-in template vs reusable templates vs one-off scene, `sourceSize` decision, verification path
3. block-scope template YAML files (if any)
4. the slide-scope template YAML file
5. the final slide instance YAML
6. if in Layer 2 and creating a new deck file, the full `slides.yaml` presentation wrapper
7. if in Layer 2, the concrete file paths written

If blocked on missing slug or output path, do not invent one. Return Layer 1 payload instead.

## Examples

### Example: Slide Template with Block Templates

Block template file: `content/history-deck/templates/stat-card.template.yaml`

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

Slide template file: `content/history-deck/templates/split-stat-rail.template.yaml`

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
  bodyText:
    style:
      fontFamily: body
      fontSize: 20
      fontWeight: 400
      color: "#b0a898"
      lineHeight: 1.6
children:
  - kind: shape
    id: top-strip
    frame: { x: 0, y: 0, w: 1366, h: 4 }
    shape: rect
    style:
      gradient:
        type: linear
        angle: 90
        stops:
          - { color: "{{ style.accent }}", position: 0 }
          - { color: "#00d4ff", position: 1 }
  - kind: shape
    id: right-panel
    frame: { left: "@x.split", top: 0, right: 0, bottom: 0 }
    shape: rect
    style: { fill: "#1a1714" }
  - kind: text
    id: eyebrow
    frame: { left: "@x.left", top: "@y.top", w: 560 }
    text: "{{ eyebrow | yaml_string }}"
    style:
      fontFamily: body
      fontSize: 14
      fontWeight: 700
      color: "{{ style.accent }}"
      letterSpacing: 2
      textTransform: uppercase
      lineHeight: 1
  - kind: text
    id: title
    frame: { left: "@x.left", top: 104, w: 560 }
    text: "{{ title | yaml_string }}"
    style:
      fontFamily: heading
      fontSize: 52
      fontWeight: 700
      color: "#ffffff"
      lineHeight: 1.1
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

Slide instance in `content/history-deck/slides.yaml`:

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

### Example: One-Off Scene Fallback

```yaml
- mode: scene
  sourceSize: { w: 1366, h: 768 }
  fit: contain
  align: center
  background: { type: solid, color: "#0f0a05" }
  guides:
    x: { left: 96, split: 910, stats: 1000 }
    y: { top: 64 }
  presets:
    eyebrow:
      style:
        fontFamily: body
        fontSize: 14
        fontWeight: 700
        color: "#ff6b35"
        letterSpacing: 2
        textTransform: uppercase
        lineHeight: 1
    title:
      style:
        fontFamily: heading
        fontSize: 52
        fontWeight: 700
        color: "#ffffff"
        lineHeight: 1.1
    body:
      style:
        fontFamily: body
        fontSize: 20
        fontWeight: 400
        color: "#b0a898"
        lineHeight: 1.6
  children:
    - kind: shape
      id: top-strip
      frame: { x: 0, y: 0, w: 1366, h: 4 }
      shape: rect
      style:
        gradient:
          type: linear
          angle: 90
          stops:
            - { color: "#ff6b35", position: 0 }
            - { color: "#00d4ff", position: 1 }
    - kind: shape
      id: right-panel
      frame: { left: "@x.split", top: 0, right: 0, bottom: 0 }
      shape: rect
      style: { fill: "#1a1714" }
    - kind: group
      id: left-copy
      frame: { left: "@x.left", top: "@y.top", w: 560, h: 420 }
      layout: { type: stack, gap: 24 }
      children:
        - kind: text
          id: chapter
          preset: eyebrow
          frame: { w: 560 }
          text: "CHAPTER 03"
        - kind: text
          id: title
          preset: title
          frame: { w: 560 }
          text:
            - text: "The Fall of an "
            - text: "Empire"
              color: "#ff6b35"
        - kind: shape
          id: divider
          frame: { w: 120, h: 4 }
          shape: rect
          style:
            gradient:
              type: linear
              angle: 90
              stops:
                - { color: "#ff6b35", position: 0 }
                - { color: "#00d4ff", position: 1 }
        - kind: text
          id: body
          preset: body
          frame: { w: 560 }
          text: "Regional warlords, rebellions, and fiscal strain fractured an empire that had lasted nearly three centuries."
    - kind: group
      id: stats
      frame: { left: "@x.stats", top: 180, w: 240, h: 260 }
      layout: { type: stack, gap: 48 }
      children:
        - kind: text
          id: stat-1
          frame: { w: 240 }
          text: "907 CE"
          style: { fontFamily: heading, fontSize: 56, fontWeight: 700, color: "#ff6b35", lineHeight: 1 }
        - kind: text
          id: stat-2
          frame: { w: 240 }
          text: "289 years"
          style: { fontFamily: heading, fontSize: 56, fontWeight: 700, color: "#ff6b35", lineHeight: 1 }
```
