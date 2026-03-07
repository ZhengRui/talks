---
name: create-slides
description: Use when generating presentation slides, creating a deck, or building a presentation. This is the primary slide generation skill — it can use shortcut templates (bullets, stats, cover, etc.), composable templates (split-compose, full-compose with typed components), or freeform templates (pixel-level control). Prefer this for most slide generation tasks.
---

# Slide Generation

Generate presentation slides using the best approach for each slide. Three approaches are available — choose based on what the slide needs.

See [reference.md](reference.md) for full syntax of all templates, components, element types, and themes.

## Choosing an Approach

```
What does this slide need?

Standard layout with known structure?
  → Shortcut template (cover, bullets, stats, comparison, etc.)
  → Concise YAML, proven layouts

Custom composition mixing content types?
  → Compose template (split-compose, full-compose)
  → tag + heading + bullets + stats + quote in any combination

Full creative control with precise positioning?
  → Freeform template
  → Overlapping elements, unusual layouts, layered compositions

Need one custom element inside a compose slide?
  → Use raw component (escape hatch within compose)
```

| Approach | When to use | YAML verbosity |
|----------|-------------|----------------|
| Shortcut templates | Standard layouts (title + bullets, stats grid, comparison) | Low — just fill in props |
| Compose templates | Custom content combinations, two-panel layouts with mixed types | Medium — declare components |
| Freeform | Hero slides, visual inventions, pixel-precise layouts | High — position every element |

Mix all three in one presentation. Use shortcuts for standard slides, compose for custom compositions, freeform for hero/statement slides.

## Design Philosophy

**Be distinctive, not generic.** Vary compositions across the presentation — don't repeat the same layout on consecutive slides.

- **Alternate slide types** — split, full, data, statement, grid
- **Vary panel ratios** — 60/40 and 70/30 splits are more dynamic than 50/50
- **Mix component types** — tag + heading + divider + bullets on one side, stats + quote on the other
- **Use theme tokens** — `theme.accent`, `theme.bgSecondary` keep presentations theme-switchable
- **Contrast light and dark panels** — dark background with light text creates drama
- **Color restraint** — accent color on 1-2 elements per slide, not everything

## Workflow

### Phase 1: Understand the Request
What topic, audience, mood, and length? If not specified, ask:
- **Mood**: Confident/Bold | Calm/Elegant | Energetic/Playful | Technical/Precise
- **Length**: Short (3-5 slides) | Medium (8-12) | Long (15-20+)

### Phase 2: Choose a Visual Direction
Pick a theme. See [reference.md](reference.md) for full palette details.

| Mood | Themes | Feel |
|------|--------|------|
| Confident/Bold | `bold`, `bold-signal`, `electric-studio` | Heavy weights, punchy stats |
| Calm/Elegant | `elegant`, `paper-ink`, `vintage-editorial` | Serif headings, generous spacing |
| Warm/Organic | `dark-botanical`, `notebook-tabs` | Natural tones, soft borders |
| Energetic/Playful | `creative-voltage`, `split-pastel`, `pastel-geometry` | Mixed weights, pill tags |
| Technical/Precise | `dark-tech`, `terminal-green`, `swiss-modern` | Monospace accents, grid |
| Futuristic | `neon-cyber` | Glowing accents, deep purples |

### Phase 3: Plan Slide Compositions
Plan the visual arc. Vary slide types:

- **Title/Section** — `cover`, `section-divider`, or `statement` shortcut
- **Content** — `bullets` or `numbered-list` shortcut, or compose with heading + bullets + quote
- **Data** — `stats` shortcut, or compose with stat components
- **Comparison** — `comparison` shortcut, or split-compose with different content per panel
- **Visual** — freeform for hero slides, layered compositions
- **Cards** — compose `full-compose` with heading + card + card + card
- **Closing** — `end` shortcut or compose statement slide

### Phase 4: Write the YAML

**Save to**: `content/<slug>/slides.yaml` (kebab-case slug). Create the directory if needed. Images go in `content/<slug>/images/`. Run `bun run sync-content` after adding images.

### Phase 5: Review
Check content density limits (see reference.md). If a slide feels crowded, split into two.

## Examples

### Example 1: Shortcut template (concise)

```yaml
- template: bullets
  title: "Key Challenges"
  bullets:
    - "Rising infrastructure costs across all regions"
    - "Talent retention in competitive markets"
    - "Regulatory compliance across jurisdictions"
```

### Example 2: Compose template (custom composition)

```yaml
- template: split-compose
  ratio: 0.55
  left:
    background: theme.bg
    children:
      - type: tag
        text: "Chapter 1"
        color: theme.accent
      - type: heading
        text: "The Fall of Tang"
      - type: divider
        variant: gradient
      - type: bullets
        items:
          - "The An Lushan Rebellion weakened central authority"
          - "Regional military governors became autonomous"
  right:
    background: "#1a1714"
    textColor: "#e8e0d0"
    children:
      - type: stat
        value: "907"
        label: "Year of Tang's Fall"
      - type: stat
        value: "8"
        label: "Years of Civil War"
```

### Example 3: Freeform (full creative control)

```yaml
- template: freeform
  background: "#0a0a0a"
  elements:
    - kind: text
      id: hero-stat
      rect: { x: 160, y: 200, w: 800, h: 300 }
      text: "4.2B"
      style: { fontFamily: "Inter, sans-serif", fontSize: 180, fontWeight: 900, color: "#f5f5f5", lineHeight: 1.0 }
      entrance: { type: scale-up, delay: 0, duration: 600 }
    - kind: shape
      id: accent
      rect: { x: 160, y: 500, w: 200, h: 3 }
      shape: rect
      style: { fill: "#ff6b35" }
      entrance: { type: fade-in, delay: 300, duration: 400 }
    - kind: text
      id: label
      rect: { x: 160, y: 520, w: 800, h: 40 }
      text: "global internet users"
      style: { fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 400, color: "#64648c", lineHeight: 1.4, textTransform: uppercase, letterSpacing: 2 }
      entrance: { type: fade-up, delay: 400, duration: 500 }
```
