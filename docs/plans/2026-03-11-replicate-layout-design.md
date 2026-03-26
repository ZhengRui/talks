# Replicate-Layout Skill Design

**Goal:** Create a `replicate-layout` skill that replicates the spatial skeleton of a slide as a pure component tree wireframe — no content, just positioned/sized boxes with colored fills and labels.

**Motivation:** Layout accuracy is the hardest part of slide replication. Isolating it lets us verify spatial proportions (centering, splits, spacing, gaps) before filling in content. Solves the vertical centering problem we hit with pure raw IR.

## Pipeline Position

```
Screenshot → replicate-layout → wireframe YAML → replicate-slides → final slide
```

## Input

Same as `replicate-slides`: screenshot, optional HTML file, optional verbal description. Priority: description > HTML > screenshot.

## Output

Valid `slides.yaml` YAML that renders as a colored wireframe. Every visual region is a `box` component with:
- A muted colored fill (by region type)
- A text label inside ("HEADING", "CARD 1", "BODY TEXT", etc.)
- Correct position, size, padding, gaps matching the original

### Color Coding

| Region type | Fill color |
|-------------|-----------|
| Primary content area | `#2a2a3a` |
| Secondary panel | `#1a1a2a` |
| Card/item | `#3a3a4a` |
| Decorative accent | `#4a3a2a` |
| Image placeholder | `#2a3a2a` |

## Process: Two Phases

### Phase 1: Analyze Layout

Identify every visual region and spatial relationships:

```
LAYOUT ANALYSIS:
  Canvas: 1920×1080
  Structure: [single-column | two-panel (ratio) | grid | hero-centered | freeform]
  Regions:
    - [region name] → [approximate rect or relationship] → [box purpose]
    - ...
  Vertical distribution: [how content is vertically positioned — centered, top-aligned, distributed]
  Gaps: [key spacing values in px]
  Decorative elements: [gradient strips, accent lines, watermarks — noted for replicate-slides later]
```

### Phase 2: Build Skeleton

Translate analysis to pure component tree:

1. Top-level `box` (variant: flat, padding: 0, height: 1080) — slide container
2. Use `layout: { type: flex, direction: row }` for panel splits
3. Use `layout: { type: grid, columns: N, gap: N }` for card grids
4. Use `verticalAlign: center` for centered content
5. Use `padding` for edge spacing
6. Every leaf region = `box` with colored fill + `text` label child
7. Decorative elements (gradient strips, accents) = simple colored `box` placeholders (will become raw IR in replicate-slides)

### Pure Components — No Raw IR

The skeleton uses only `box`, `text`, and `spacer` components. No raw IR elements. The skeleton's job is spatial accuracy — where things are, how big, how spaced. Content-specific decisions (what becomes raw vs component) happen in `replicate-slides`.

## Approach

**Approach C: Pure components for structure.** Components handle centering, spacing, and distribution automatically via `verticalAlign`, `layout`, `padding`, `gap`. This solves the centering problem by design.

## Reference

The skill will share `reference.md` with `replicate-slides` (or link to it) for box behavior rules, component defaults, and layout mode semantics.

## Success Criteria

1. Rendered wireframe visually matches the original slide's spatial proportions
2. Skeleton YAML is valid and renderable
3. Skeleton can be filled in by `replicate-slides` without restructuring
