---
name: replicate-slides
description: Use when replicating an existing slide from a screenshot, HTML/CSS source, or other visual reference. Analyze the source, then author a v9 scene slide with explicit geometry, guides, anchors, and optional IR escape hatches. Prefer this over create-slides when fidelity to an existing visual source matters.
---

# Slide Replication

Replicate slides from visual sources into the repo's v9 scene system.

This repo is scene-only. Do not use the removed component tree (`box`, `raw`, `heading`, `stat`, etc.). Built-in templates exist for slide generation but are not used for extraction. Always extract fresh templates with explicit styles.

Primary goal: do not just reproduce one slide. Learn reusable templates from the source — at **slide level and block level** — then instantiate the replicated slide from those templates.

See [reference.md](reference.md) for scene authoring, template syntax, and node types. See [integration.md](integration.md) for repo integration, file paths, and verification tooling.

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
- Set `sourceSize` in templates from the reference image dimensions
- Set `fit`/`align` on slide instances, not in templates
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

Capture: source dimensions, alignment lines, z-order, typography, palette, spacing, image crops, decorative shapes, and **block template candidates** (repeating sub-regions).

### 2. Choose The Authoring Path

- Always create fresh reusable templates:
  - One slide-scope template for the overall layout
  - Block-scope templates for repeating sub-regions
- Use an inline scene slide only if the composition is too idiosyncratic to template.

### 3. Build The Scene

- Set `sourceSize` to the reference image size in the template. Set `fit: contain` and `align: center` on the slide instance.
- Add biggest regions first: background, panels, major images.
- Add guides for repeated edges, splits, and baselines.
- Add text, shapes, images, and groups in back-to-front order.
- Use `stack`, `row`, or `grid` only inside genuinely regular subregions.
- Use anchors to place elements relative to already-defined siblings.
- Use presets for repeated text and chrome styles.
- Use `kind: ir` for code, table, list, video, iframe.
- Use `kind: block` to reference block-scope templates for repeating sub-regions.
- Parameterize content that varies (text, arrays, images, style knobs).
- Hardcode the stable skeleton (guides, layering, recurring chrome).

### 4. Instantiate

- Output both the template files and the slide instance.
- In Layer 1, return YAML only. Do not write files.
- In Layer 2, write templates and instance into the requested deck.
- If creating a new `slides.yaml`, include at least `title` and `slides`.
- If no repo theme is a good match, omit `theme` and use explicit colors/fonts.

### 5. Verify

- Layer 1: return a verification plan. Do not run verification.
- Layer 2: use `/workbench/replicate` or `bun run slide:diff`.
- Iterate until layout, spacing, typography, and visual weight are close.

## Replication Heuristics

- Prefer reusable templates (slide + block) over one-off inline scenes.
- Always extract fresh templates. Do not use built-in templates for extraction.
- Prefer screenshot-space authoring over manual rescaling.
- Use guides for repeated alignment lines.
- Use multiple text nodes or rich text runs for mixed emphasis.
- Keep ids unique; anchors only target previously compiled siblings.
- Later children render on top.
- Do not force a screenshot into `row` or `grid` if the source is guide-based.
- Identify block template candidates: any sub-region that appears 2+ times or would be useful across slides.

## Output Format

Return:

1. a concise analysis block (including block template candidates)
2. a short build note: layer, reusable vs one-off, `sourceSize` decision
3. block-scope template YAML files (if any)
4. the slide-scope template YAML file
5. the final slide instance YAML
6. if in Layer 2, the full `slides.yaml` wrapper and file paths written

If blocked on missing slug or output path, do not invent one. Return Layer 1 payload instead.
