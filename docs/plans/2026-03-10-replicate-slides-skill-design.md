# Replicate Slides Skill — Design

## Summary

A Claude skill that replicates slides from visual sources (screenshots, HTML, descriptions) into the YAML presentation system. Produces three outputs: structured analysis, a reusable DSL template, and an instantiated slide YAML.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Template storage | Per-presentation (`content/[slug]/templates/`) | Scoped, low-risk, loader already supports this path |
| Input format | Any combination (screenshot, HTML, description) | Flexible — Claude adapts analysis to available inputs |
| Parameterization | Claude decides per template | Most natural — stats slide parameterizes stat count, hero slide parameterizes background |
| Template matching | Structure + visual fidelity required | Only reuse existing template if pixel-level match achievable with style overrides |
| Template naming | Descriptive (`hero-stat-split`, `editorial-quote`) | Readable, no prefix needed |
| Approach | Three-output sequential (single invocation) | Simple, predictable, no back-and-forth overhead |

## Input

User provides any combination of:
- **Screenshot** — path or pasted image. Claude analyzes visually.
- **HTML file** — Claude extracts exact CSS values (colors, fonts, sizes, padding, layout).
- **Description** — verbal cues ("left panel is 65%", "accent is coral").

When multiple inputs overlap, priority: description overrides > HTML exact values > screenshot visual analysis.

Required context: presentation slug (for template storage path).

## Three-Phase Pipeline

### Phase 1: Analysis

Structured text output describing every visual element detected.

```
## Slide Analysis

**Layout:** Two-panel split (65/35), full-bleed
**Background:** Left: #faf8f5, Right: #1a1714

### Elements
1. Tag — "Chapter 3", top-left, accent-colored border, uppercase
2. Heading — "The Fall of Tang", 54px, serif, rich text ("Fall" in #c41e3a)
3. Divider — gradient, 30% width, left-aligned
4. Bullets — 3 items, card variant, 26px
5. Stat — "907" at 72px in #ff2d2d, right panel, centered
6. Stat — "8" at 72px, right panel

### Typography
- Heading: serif (Playfair Display), Body: sans-serif (Inter)
- Tag: 14px uppercase, 2px letter-spacing

### Colors
- Accent: #c41e3a, Text: #2d2a26, Right bg: #1a1714

### Spacing
- Left padding: 80px vert, 60px horiz
- Element gap: 16px default
```

### Phase 2: Template Decision

**Matching logic:**
1. Compare analysis against all 35 built-in templates
2. Match requires: same structural layout AND style params can control any visual differences
3. Match found → use existing template with style overrides
4. No match → create new `.template.yaml`

**New template creation:**
- Text content → `params` (always)
- Structural choices (split ratio, padding, font sizes) → `style` with defaults from original
- Colors → `style` when distinctive, theme tokens when matching theme
- Repetitive elements (stats, cards) → `{% for %}` loop over array param
- Optional elements (tag, subtitle) → `{% if %}` conditional blocks
- File saved to `content/[slug]/templates/<descriptive-name>.template.yaml`

### Phase 3: Instantiation

Concrete slide YAML using the template's param interface:

```yaml
- template: editorial-split-stats
  tag: "Chapter 3"
  title:
    - "The "
    - text: "Fall"
      color: "#c41e3a"
      bold: true
    - " of Tang"
  bullets:
    - "The An Lushan Rebellion weakened central authority"
    - "Regional military governors became autonomous"
  stats:
    - value: "907"
      label: "Year of Tang's Fall"
    - value: "8"
      label: "Years of Civil War"
```

Ready to paste into `content/[slug]/slides.yaml`.

## Skill File Structure

```
.claude/skills/replicate-slides/
├── SKILL.md           # Workflow, matching logic, parameterization guide, examples
└── reference.md       # Analysis format, template conventions, 35-template structural signatures
```

## Relationship to Other Skills

- **create-slides** — generates from intent ("make a pitch deck"). Complementary.
- **replicate-slides** — generates from visual source ("copy this slide"). Same template system and component vocabulary.
- No code changes needed — DSL loader already supports per-presentation templates.

## Implementation

The skill is purely a Claude workflow (SKILL.md + reference.md). No runtime code changes. Claude reads inputs, writes `.template.yaml`, outputs YAML.
