---
name: create-slides
description: Use when generating presentation slides, creating a deck, or building a presentation. This is the primary slide generation skill — it can use shortcut templates (bullets, stats, cover, etc.), composable templates (split-compose, full-compose with typed components), or freeform templates (pixel-level control). Prefer this for most slide generation tasks.
---

# Slide Generation

Generate presentation slides. Two modes available — choose based on what each slide needs.

See [reference.md](reference.md) for full syntax of all templates, components, element types, and themes.

## Choosing an Approach

| Approach | When to use | YAML verbosity |
|----------|-------------|----------------|
| Shortcut templates | Standard layouts (cover, bullets, stats, comparison, timeline) | Low — fill in props |
| Component trees | Custom compositions, multi-panel layouts, pixel-precise designs | Medium to high |

```
What does this slide need?

Standard layout with known structure?
  → Shortcut template (cover, bullets, stats, comparison, etc.)
  → 35 templates, concise YAML, proven layouts

Custom composition mixing content types?
  → Component tree with Box + auto-layout
  → tag + heading + bullets + stats in any arrangement

Two-panel layout?
  → Component tree: root Box with layout: { type: flex, direction: row }
  → Two child Boxes with different backgrounds

Pixel-precise element placement?
  → Component tree with position: absolute, or raw component for IR elements
  → Overlapping elements, layered compositions, creative layouts
```

All slides are component trees. Templates are shortcuts that expand into components.

## Design Philosophy

**Be distinctive, not generic.** Vary compositions across the presentation — don't repeat the same layout on consecutive slides.

**Principles:**
- **Asymmetry over symmetry** — 70/30 splits are more dynamic than 50/50. Off-center creates tension.
- **Scale contrast** — A 120px number next to 18px body text creates hierarchy through drama, not just weight.
- **Whitespace is a design element** — Don't fill every pixel. Empty space draws the eye to what matters.
- **Layering creates depth** — Semi-transparent shapes behind text, overlapping elements at different scales.
- **Vary compositions** — Never repeat the same layout on consecutive slides. Alternate split, full, grid, statement.
- **Color restraint** — Accent color on 1-2 elements per slide. Let neutral tones dominate.
- **Use theme tokens** — `theme.accent`, `theme.bgSecondary` keep presentations theme-switchable.

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

- **Title/Section** — `cover`, `section-divider`, or `statement` template
- **Content** — `bullets` template, or component tree with heading + bullets + quote
- **Data** — `stats` template, or component tree with stat components
- **Comparison** — `comparison` template, or two-panel Box layout
- **Visual** — component tree with absolute positioning for layered compositions
- **Cards** — component tree with heading + grid/columns of cards
- **Closing** — `end` template or statement component tree

**Composition vocabulary** (mix at least 3-4 types in a deck):
- **Hero**: One giant element (number, word, image) dominates. Supporting text is small.
- **Split**: Two panels. Content on each side tells a different story.
- **Layered**: Background shape + semi-transparent overlay + foreground text at different scales.
- **Grid**: Cards arranged in a grid. Not all cards need equal size.
- **Statement**: Single sentence, huge text, lots of whitespace.
- **Data**: Stats, numbers, or a table. Dramatic scale for the key number.
- **Collage**: Mixed elements at different sizes arranged asymmetrically.

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

### Example 2: Component tree — two-panel layout with auto-layout

```yaml
- children:
    - type: box
      variant: flat
      layout: { type: flex, direction: row }
      padding: 0
      height: 1080
      children:
        # Left panel (55%)
        - type: box
          variant: flat
          width: 1056
          padding: [80, 60]
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
        # Right panel (45%)
        - type: box
          background: "#1a1714"
          padding: [80, 60]
          verticalAlign: center
          children:
            - type: stat
              value: "907"
              label: "Year of Tang's Fall"
              color: "#ff2d2d"
            - type: stat
              value: "8"
              label: "Years of Civil War"
```

### Example 3: Component tree — mixed auto-layout + absolute positioning

```yaml
- backgroundImage: "stadium.jpg"
  overlay: "rgba(0,0,0,0.72)"
  children:
    - type: box
      variant: flat
      padding: [300, 160, 80, 160]
      height: 1080
      children:
        # Gradient strip — positioned absolutely, outside normal flow
        - type: raw
          position: "absolute"
          x: 0
          y: 0
          width: 1920
          height: 5
          elements:
            - kind: shape
              id: strip
              rect: { x: 0, y: 0, w: 1920, h: 5 }
              shape: rect
              style:
                gradient: { type: linear, angle: 90, stops: [{ color: "#ff6b35", position: 0 }, { color: "#00d4ff", position: 1 }] }
        # Content flows vertically (default flex-column)
        - type: heading
          text: "SUPER BOWL"
          fontSize: 120
          fontWeight: 900
          color: "#ffffff"
          entranceType: fade-up
        - type: heading
          text: "LX"
          level: 2
          fontSize: 72
          color: theme.accent
          entranceType: fade-up
          entranceDelay: 200
```

### Example 4: Component tree — rich text with inline styling

```yaml
- children:
    - type: box
      variant: flat
      padding: [100, 160]
      children:
        - type: heading
          text:
            - "The "
            - text: "Fall"
              color: "#c41e3a"
              bold: true
            - " of Tang"
        - type: body
          text: "A dynasty that lasted **289 years** crumbled in a decade."
```

### Example 5: Creative techniques with raw IR elements

```yaml
# Giant background text as decorative element
- children:
    - type: raw
      position: "absolute"
      x: -50
      y: 100
      width: 1000
      height: 600
      elements:
        - kind: text
          id: bg-number
          rect: { x: 0, y: 0, w: 1000, h: 600 }
          text: "01"
          style: { fontFamily: "Inter, sans-serif", fontSize: 400, fontWeight: 900, color: "rgba(0,0,0,0.03)", lineHeight: 1.0 }
    - type: box
      variant: flat
      padding: [200, 160]
      children:
        - type: heading
          text: "Introduction"
          fontSize: 54
        - type: body
          text: "Setting the stage for what comes next."
```
