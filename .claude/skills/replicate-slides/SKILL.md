---
name: replicate-slides
description: Use when replicating an existing slide from a screenshot, HTML/CSS source, or other visual reference. Analyze the source, then author a v9 scene slide with explicit geometry, guides, anchors, and optional IR escape hatches. Prefer this over create-slides when fidelity to an existing visual source matters.
---

# Slide Replication

Replicate slides from visual sources into the repo's v9 scene system.

This repo is scene-only. Do not use the removed component tree (`box`, `raw`, `heading`, `stat`, etc.). Built-in templates still exist, but for screenshot replication they are only for exact structural matches.

Primary goal: do not just reproduce one slide. Learn a reusable scene-backed template from the source when practical, then instantiate the replicated slide from that template.

See [reference.md](reference.md) for the replication workflow, scene authoring subset, and verification tooling.

## Two Layers

### Layer 1: Core Replication Contract

This is the default layer. It is service-safe and repo-agnostic.

- Input: screenshot or visual source, optional markup, optional corrections, optional explicit output schema
- Output: analysis, authoring decision, reusable template YAML, slide instance YAML, verification plan
- Do not read arbitrary repo files, existing deck files, or implementation code
- Do not write files
- Do not invent slugs, paths, or scratch decks
- Do not inspect solver internals unless the user explicitly asks to debug the platform

Use this layer whenever the user wants replication as a capability, API, or service.

### Layer 2: Repo Adapter

This layer applies only when the user explicitly wants repo changes or provides a real deck target.

- Input: Layer 1 inputs plus slug and target slide or target file path
- Output: deck-local template file, slide instance in `slides.yaml`, repo-specific verification
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

- Prefer a reusable scene-backed template
- In Layer 1, return the template YAML and slide instance YAML without writing files
- In Layer 2, write a deck-local template in `content/<slug>/templates/<template-name>.template.yaml`
- In Layer 2, instantiate the replicated slide from that template in `content/<slug>/slides.yaml`
- Prefer explicit `frame` geometry, guides, and anchors in the template output
- For screenshot replication, use `sourceSize` from the reference image by default
- Use `kind: ir` only when native scene nodes are not enough
- Fall back to an inline `mode: scene` slide only when the composition is clearly one-off and not worth templating

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
    - right stat column
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

Also decide which layer applies:

- Layer 1 if the user did not explicitly request repo edits or provide a real deck target
- Layer 2 only if the user did explicitly request repo edits or provide a concrete slug / output path

### 2. Choose The Authoring Path

- Use an exact built-in template only if the source already matches it closely.
- Otherwise create a reusable scene template by default. In Layer 2, write it as a deck-local template.
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
- Parameterize the parts that should vary across future slides: text, arrays, images, optional blocks, and meaningful style knobs.
- Hardcode the stable composition skeleton: guides, layering, region layout, and recurring chrome.

### 4. Instantiate

- If using a built-in template, output the slide instance only.
- If creating a reusable template, output both:
  - the template file contents
  - the slide instance that uses it
- Keep the first replicated slide as proof that the extracted template actually reproduces the source faithfully.
- In Layer 1, return YAML only. Do not write files.
- In Layer 2, write the template and slide instance into the requested deck.
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

- Prefer a reusable scene template over a one-off inline scene when the composition is reusable.
- Prefer scene over built-in templates unless there is a close structural match.
- Prefer screenshot-space authoring over manual rescaling.
- Use guides for repeated alignment lines.
- Use multiple text nodes or rich text runs for mixed emphasis.
- Keep ids unique and ordered; anchors only target previously compiled siblings in the same container.
- Later children render on top.
- Do not force a screenshot into `row` or `grid` if the source is really guide-based.
- Do not recreate the removed v7/v8 component syntax.
- If replicating several slides from one source deck, stabilize the template after the first good slide and reuse it for the rest.
- Do not read existing deck files or solver code just to infer output shape; the skill should already define the contract.
- Do not inspect repo internals unless the user explicitly asked for repo edits and the skill/reference is insufficient.

## Output Format

Return:

1. a concise analysis block
2. a short build note: Layer 1 vs Layer 2, built-in template vs reusable template vs one-off scene, `sourceSize` decision, verification path
3. the reusable template YAML
4. the final slide instance YAML
5. if in Layer 2 and creating a new deck file, the full `slides.yaml` presentation wrapper
6. if in Layer 2, the concrete file paths written

If blocked on missing slug or output path, do not invent one. Return Layer 1 payload instead.

## Example

Template-backed replication is the preferred outcome. Inline scene is the fallback for one-off compositions.

### Example: Template-Backed Replication

Template file: `content/history-deck/templates/split-stat-rail.template.yaml`

```yaml
name: split-stat-rail
params:
  eyebrow: { type: string }
  title: { type: string, required: true }
  body: { type: string, required: true }
  stats: { type: array, required: true }
style:
  split: { type: number, default: 910 }
  accent: { type: string, default: "#ff6b35" }

mode: scene
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
  statValue:
    style:
      fontFamily: heading
      fontSize: 56
      fontWeight: 700
      color: "{{ style.accent }}"
      lineHeight: 1
  statLabel:
    style:
      fontFamily: body
      fontSize: 16
      fontWeight: 400
      color: "#8a8078"
      lineHeight: 1.3
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
      - kind: group
        id: stat-{{ loop.index0 }}
        frame: { w: 220, h: 84 }
        layout: { type: stack, gap: 8 }
        children:
          - kind: text
            id: stat-{{ loop.index0 }}-value
            preset: statValue
            frame: { w: 220 }
            text: "{{ stat.value | yaml_string }}"
          - kind: text
            id: stat-{{ loop.index0 }}-label
            preset: statLabel
            frame: { w: 220 }
            text: "{{ stat.label | yaml_string }}"
{% endfor %}
```

Slide instance in `content/history-deck/slides.yaml`:

```yaml
- template: split-stat-rail
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
