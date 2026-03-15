---
name: create-slides
description: Use when generating presentation slides, creating a deck, or building a presentation. Default output is freeform scene YAML with explicit geometry. Templates (bullets, stats, cover, etc.) are available as concise shortcuts when content naturally fits. Prefer this for most slide generation tasks.
---

# Slide Generation

Generate presentation slides as scene YAML — explicit geometry on a 1920×1080 canvas. Templates available as shortcuts when content fits a standard layout.

See [reference.md](reference.md) for full syntax of all templates, scene node types, and themes.

## Generation Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Auto** (default) | No preference stated | Route each slide: template if natural fit, scene if not |
| **Scene-only** | "generate freely" / "no templates" / "freeform" | All slides as freeform scene YAML |
| **Template-only** | "use templates" / "only templates" | Pick best-fit template for each slide |

### Auto-Routing Decision Tree

```
What does this slide need?

Content naturally fits a template?
  Title + subtitle                         → cover
  Title + 3-5 bullet points               → bullets
  2-4 numbers with labels                  → stats
  Single quote + attribution               → quote
  Code block with optional title           → code
  Before/after comparison                  → comparison
  Simple image + text                      → image-text
  Section break with big text              → section-divider / statement

Content needs custom composition?
  Custom multi-panel layouts               → scene
  Mixed content in non-standard arrangement → scene
  Visual/creative with overlapping elements → scene
  Data-heavy with custom positioning       → scene
  Anything that would require fighting a template → scene
```

All slides compile to `mode: "scene"`. Templates are shortcuts that expand into scene nodes via DSL.

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
Plan the visual arc. For each slide, decide template or scene. Vary slide types:

- **Title/Section** — `cover`, `section-divider`, or `statement` template; or scene with bold typography
- **Content** — `bullets` template; or scene with text nodes in a stack layout
- **Data** — `stats` template; or scene with large stat text + label groups
- **Comparison** — `comparison` template; or scene with two-panel group layout
- **Visual** — scene with overlapping shapes, rotated decorative elements, layered compositions
- **Cards** — scene with grid layout group containing styled card groups
- **Closing** — `end` template or scene statement slide

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

**Scene slide structure:**
```yaml
- mode: scene
  background: { type: solid, color: "theme.bg" }  # or string, or image bg
  guides:                            # named alignment points
    x: { content-left: 160, split: 960 }
    y: { top: 80 }
  presets:                           # reusable style defaults
    myPreset:
      style: { fontFamily: heading, fontSize: 48, fontWeight: 700, color: "theme.heading" }
  children:                          # scene nodes: text, shape, image, group, ir
    - kind: text
      id: title
      preset: myPreset
      frame: { left: "@x.content-left", top: "@y.top", w: 1000 }
      text: "Slide Title"
      entrance: { type: fade-up, delay: 0, duration: 600 }
```

**Key scene concepts:**
- `frame` uses FrameSpec — partial constraints (`left`, `right`, `centerX`, `w`, `h`, etc.) compiled to absolute Rect
- Guides — named x/y alignment points referenced as `@x.name` or `@y.name`
- Anchors — reference compiled siblings: `@sibling-id.right`, `{ ref: "@sibling-id.bottom", offset: 24 }`
- Theme tokens — `theme.accent`, `theme.bg`, `theme.heading`, `theme.fontBody`, etc.
- `kind: ir` — escape hatch wrapping a raw LayoutElement (for code, table, list, video, iframe)

### Phase 5: Review
Check content density limits (see reference.md). If a slide feels crowded, split into two.

## Examples

### Example 1: Template usage (concise)

```yaml
- template: bullets
  title: "Key Challenges"
  bullets:
    - "Rising infrastructure costs across all regions"
    - "Talent retention in competitive markets"
    - "Regulatory compliance across jurisdictions"
```

### Example 2: Two-panel scene layout with guides

```yaml
- mode: scene
  background: { type: solid, color: "theme.bg" }
  guides:
    x: { content-left: 160, split: 1200, right-content: 1280 }
    y: { top: 120 }
  presets:
    sectionTitle:
      style:
        fontFamily: heading
        fontWeight: 700
        color: "theme.heading"
        lineHeight: 1.15
    bodyText:
      style:
        fontFamily: body
        fontWeight: 400
        color: "theme.text"
        lineHeight: 1.6
  children:
    - kind: shape
      id: right-panel
      frame: { left: "@x.split", top: 0, right: 0, bottom: 0 }
      shape: rect
      style: { fill: "theme.bgSecondary" }
    - kind: group
      id: left-content
      frame: { left: "@x.content-left", top: "@y.top", w: 900, h: 800 }
      layout: { type: stack, gap: 28 }
      children:
        - kind: text
          id: eyebrow
          frame: { w: 900 }
          text: "CHAPTER ONE"
          style:
            fontFamily: body
            fontSize: 18
            fontWeight: 700
            color: "theme.accent"
            letterSpacing: 2
            textTransform: uppercase
        - kind: text
          id: title
          preset: sectionTitle
          frame: { w: 900 }
          text: "The Fall of Tang"
          style: { fontSize: 56 }
          entrance: { type: fade-up, delay: 0, duration: 600 }
        - kind: shape
          id: divider
          frame: { w: 120, h: 4 }
          shape: rect
          style:
            gradient: { type: linear, angle: 90, stops: [{ color: "theme.accent", position: 0 }, { color: "theme.accent2", position: 1 }] }
        - kind: text
          id: body
          preset: bodyText
          frame: { w: 700 }
          text: "A dynasty that lasted 289 years crumbled in a decade. Regional military governors became autonomous warlords."
          style: { fontSize: 28 }
    - kind: group
      id: stats
      frame: { x: "@x.right-content", top: "@y.top", w: 480, h: 400 }
      layout: { type: stack, gap: 36 }
      children:
        - kind: text
          id: stat-year
          frame: { w: 480 }
          text: "907"
          style: { fontFamily: heading, fontSize: 72, fontWeight: 700, color: "theme.accent", lineHeight: 1 }
          entrance: { type: scale-up, delay: 200 }
        - kind: text
          id: stat-label
          frame: { w: 480 }
          text: "Year of Tang's Fall"
          style: { fontFamily: body, fontSize: 24, color: "theme.textMuted", lineHeight: 1.4 }
```

### Example 3: Creative scene with overlapping shapes and layering

```yaml
- mode: scene
  background: { type: solid, color: "theme.bg" }
  children:
    # Giant background text as decorative element
    - kind: text
      id: bg-number
      frame: { x: -80, y: 60, w: 1200, h: 700 }
      text: "01"
      style:
        fontFamily: heading
        fontSize: 500
        fontWeight: 900
        color: "rgba(255,255,255,0.03)"
        lineHeight: 1.0
    # Overlapping accent shape — semi-transparent
    - kind: shape
      id: accent-blob
      frame: { x: 1300, y: -120, w: 800, h: 800 }
      shape: circle
      style: { fill: "theme.accent@0.08" }
    # Rotated decorative diamond
    - kind: shape
      id: diamond-deco
      frame: { x: 1500, y: 700, w: 200, h: 200 }
      shape: diamond
      style: { fill: "theme.accent2@0.12" }
      transform: { rotate: 25 }
    # Foreground content
    - kind: group
      id: content
      frame: { x: 160, y: 280, w: 1100, h: 600 }
      layout: { type: stack, gap: 32 }
      children:
        - kind: text
          id: eyebrow
          frame: { w: 1100 }
          text: "INTRODUCTION"
          style:
            fontFamily: body
            fontSize: 16
            fontWeight: 700
            color: "theme.accent"
            letterSpacing: 3
            textTransform: uppercase
          entrance: { type: fade-up, delay: 0, duration: 600 }
        - kind: text
          id: title
          frame: { w: 1100 }
          text: "Setting the Stage"
          style:
            fontFamily: heading
            fontSize: 64
            fontWeight: 700
            color: "theme.heading"
            lineHeight: 1.15
          entrance: { type: fade-up, delay: 100, duration: 600 }
        - kind: shape
          id: divider
          frame: { w: 80, h: 4 }
          shape: rect
          style: { fill: "theme.accent" }
          borderRadius: 2
        - kind: text
          id: body
          frame: { w: 900 }
          text: "Every great transformation begins with a single moment of clarity. This is that moment."
          style:
            fontFamily: body
            fontSize: 28
            fontWeight: 400
            color: "theme.text"
            lineHeight: 1.7
          entrance: { type: fade-up, delay: 200, duration: 600 }
```

### Example 4: Rich text with inline styling

```yaml
- mode: scene
  background: { type: solid, color: "theme.bg" }
  children:
    - kind: text
      id: title
      frame: { left: 160, top: 200, w: 1000 }
      text:
        - "The "
        - text: "Fall"
          color: "#c41e3a"
          bold: true
        - " of Tang"
      style:
        fontFamily: heading
        fontSize: 64
        fontWeight: 700
        color: "theme.heading"
        lineHeight: 1.15
      entrance: { type: fade-up, delay: 0, duration: 600 }
    - kind: text
      id: body
      frame:
        left: 160
        top: { ref: "@title.bottom", offset: 40 }
        w: 1000
      text:
        - "A dynasty that lasted "
        - text: "289 years"
          bold: true
          color: "theme.accent"
        - " crumbled in a decade. The "
        - text: "An Lushan Rebellion"
          italic: true
        - " shattered central authority forever."
      style:
        fontFamily: body
        fontSize: 30
        fontWeight: 400
        color: "theme.text"
        lineHeight: 1.7
      entrance: { type: fade-up, delay: 200, duration: 600 }
```

### Example 5: Presets with inheritance for repeated styling

```yaml
- mode: scene
  background: { type: solid, color: "theme.bg" }
  guides:
    x: { left: 160, right-edge: 1760 }
    y: { top: 100, cards: 340 }
  presets:
    cardBase:
      borderRadius: 16
      style: { fill: "theme.cardBg" }
      border: { width: 1, color: "theme.cardBorder.color" }
    cardTitle:
      style:
        fontFamily: heading
        fontSize: 28
        fontWeight: 700
        color: "theme.heading"
        lineHeight: 1.3
    cardBody:
      style:
        fontFamily: body
        fontSize: 20
        fontWeight: 400
        color: "theme.text"
        lineHeight: 1.6
    cardAccentNumber:
      extends: cardTitle
      style:
        fontSize: 48
        color: "theme.accent"
        lineHeight: 1.0
  children:
    - kind: text
      id: title
      frame: { left: "@x.left", top: "@y.top", w: 1600 }
      text: "Three Pillars"
      style:
        fontFamily: heading
        fontSize: 52
        fontWeight: 700
        color: "theme.heading"
        lineHeight: 1.15
      entrance: { type: fade-up, delay: 0, duration: 600 }
    - kind: shape
      id: divider
      frame: { left: "@x.left", top: { ref: "@title.bottom", offset: 20 }, w: 80, h: 4 }
      shape: rect
      style: { fill: "theme.accent" }
      borderRadius: 2
    # Card grid — 3 columns
    - kind: group
      id: card-grid
      frame: { left: "@x.left", top: "@y.cards", w: 1600, h: 600 }
      layout: { type: row, gap: 40, tracks: [1, 1, 1] }
      children:
        - kind: group
          id: card-1
          preset: cardBase
          frame: { h: 360 }
          layout: { type: stack, gap: 16, padding: [32, 28, 32, 28] }
          entrance: { type: fade-up, delay: 100, duration: 600 }
          children:
            - kind: text
              id: card-1-number
              preset: cardAccentNumber
              text: "01"
            - kind: text
              id: card-1-title
              preset: cardTitle
              text: "Resilience"
            - kind: text
              id: card-1-body
              preset: cardBody
              text: "Systems that bend without breaking adapt to unexpected conditions."
        - kind: group
          id: card-2
          preset: cardBase
          frame: { h: 360 }
          layout: { type: stack, gap: 16, padding: [32, 28, 32, 28] }
          entrance: { type: fade-up, delay: 200, duration: 600 }
          children:
            - kind: text
              id: card-2-number
              preset: cardAccentNumber
              text: "02"
            - kind: text
              id: card-2-title
              preset: cardTitle
              text: "Clarity"
            - kind: text
              id: card-2-body
              preset: cardBody
              text: "Removing ambiguity at every layer makes the whole system legible."
        - kind: group
          id: card-3
          preset: cardBase
          frame: { h: 360 }
          layout: { type: stack, gap: 16, padding: [32, 28, 32, 28] }
          entrance: { type: fade-up, delay: 300, duration: 600 }
          children:
            - kind: text
              id: card-3-number
              preset: cardAccentNumber
              text: "03"
            - kind: text
              id: card-3-title
              preset: cardTitle
              text: "Velocity"
            - kind: text
              id: card-3-body
              preset: cardBody
              text: "Speed without direction is waste. Velocity is speed with purpose."
```
