---
name: freeform-slides
description: Use when generating presentation slides using the freeform template, creating custom slide layouts with manually positioned elements, or when the user asks to create slides, a presentation, or a deck with direct control over element placement on a 1920x1080 canvas.
---

# Freeform Slide Generation

Generate distinctive, visually rich presentation slides using `template: freeform`. Each slide is a 1920x1080 canvas where you control every element's position, size, style, and animation.

## Design Philosophy

**Be distinctive, not generic.** Every presentation should feel custom-crafted. Avoid the "AI slide" look: centered title + 3 equal cards + blue accent. Instead, create visual surprise through asymmetry, scale contrast, layering, and intentional whitespace.

**Principles:**
- **Asymmetry over symmetry** — 70/30 splits are more dynamic than 50/50. Off-center titles create tension.
- **Scale contrast** — A 120px number next to 18px body text creates hierarchy through drama, not just weight.
- **Whitespace is a design element** — Don't fill every pixel. Empty space draws the eye to what matters.
- **Layering creates depth** — Semi-transparent shapes behind text, overlapping elements at different scales.
- **Vary your compositions** — Never repeat the same layout on consecutive slides. Alternate between split, full-bleed, centered, asymmetric, grid.
- **Color restraint** — Use accent color sparingly (1-2 elements per slide). Let neutral tones dominate.

## Workflow

### Phase 1: Understand the Request
What topic, audience, mood, and length? If the user hasn't specified a style, ask:
- **Mood**: Confident/Bold | Calm/Elegant | Energetic/Playful | Technical/Precise
- **Length**: Short (3-5 slides) | Medium (8-12) | Long (15-20+)

### Phase 2: Choose a Visual Direction
Pick a theme as a starting palette, or define custom colors. Don't just use theme defaults — adapt them. See [reference.md](reference.md) for theme table and color palettes.

**Mood-to-style mapping:**
| Mood | Themes | Typography Feel | Animation Feel |
|------|--------|----------------|---------------|
| Confident/Bold | `bold`, `bold-signal` | Heavy weights, uppercase tags, tight leading | Fast fade-up, scale-up for stats |
| Calm/Elegant | `elegant`, `paper-ink` | Serif headings, generous spacing, italic accents | Slow fade-in (600ms), minimal motion |
| Energetic/Playful | `creative-voltage`, `split-pastel` | Mixed weights, large display type, pill tags | Slide-left/right, staggered reveals |
| Technical/Precise | `dark-tech`, `terminal-green`, `swiss-modern` | Monospace accents, grid alignment, small type | Fade-up with tight stagger (80ms) |

### Phase 3: Plan Slide Compositions
Before writing YAML, plan the visual arc of the presentation. Vary slide types:

**Composition vocabulary** (mix at least 3-4 different types):
- **Hero**: One giant element (number, word, image) dominates. Supporting text is small.
- **Split**: Two panels (not always 50/50). Content on each side tells a different story.
- **Layered**: Background shape + semi-transparent overlay + foreground text at different scales.
- **Grid**: 2-6 cards/items arranged in a grid. Not all cards need to be equal size.
- **Statement**: Single sentence, huge text, lots of whitespace. Let the words breathe.
- **Data**: Stats, numbers, or a table. Use dramatic scale for the key number.
- **Collage**: Mixed elements at different sizes — a quote, a stat, a tag, an accent shape — arranged asymmetrically.

**Visual arc example (10-slide deck):**
1. Hero title (statement + accent shape)
2. Split (context on left, stats on right)
3. Grid (3 key points as cards)
4. Statement (one powerful sentence)
5. Layered (data with background decoration)
6. Split (deep dive, reversed panel sides)
7. Collage (multiple supporting points)
8. Hero (key number, full-bleed)
9. Grid (action items)
10. Statement (closing thought + seal)

### Phase 4: Write the YAML
Use `template: freeform` with an `elements` array. Each element needs `kind`, `id`, `rect`, and type-specific props.

**Save to**: `content/<slug>/slides.yaml` where `<slug>` is kebab-case (e.g. `content/ai-strategy/slides.yaml`). Create the directory if needed. Images go in `content/<slug>/images/`. If adding images, run `bun run sync-content`.

### Phase 5: Add Animations
Animate thoughtfully, not uniformly. Not every element needs animation.

**Animation as storytelling:**
- **Stagger to guide the eye**: Title first (delay 0), then supporting elements (100-150ms increments).
- **Match animation to meaning**: Stats scale-up (they grow), content slides-in from the direction it refers to.
- **Background shapes: no animation or fade-in only**. They're scenery, not actors.
- **One hero element per slide gets the slowest, most dramatic entrance** (scale-up at 600ms).
- **Leave some elements static** — contrast between animated and static creates rhythm.

## Canvas & Content Area

- **Canvas**: 1920 x 1080 px (16:9, fixed)
- **Safe area**: x: 160..1760, y: 60..1020 (160px horizontal, 60px vertical margins)
- **Center**: (960, 540)
- All `rect` values `{x, y, w, h}` in px. `{x,y}` is top-left corner.

## Key Rules

- **IDs**: Must be unique per slide.
- **z-order**: Later elements render on top. Background shapes first, text last.
- **Groups**: Children use coordinates relative to the group's `rect` origin.
- **Animations on groups**: Animate the group, not individual children.
- **PPTX export**: All elements export. Avoid `count-up` (web-only). Duration 400-600ms.
- **Content density**: Max 6-8 text blocks per slide. If it feels crowded, split into two slides.

## Element Types

7 kinds: `text`, `shape`, `image`, `group`, `code`, `table`, `list`.

See [reference.md](reference.md) for full prop reference and YAML examples.

## Creative Techniques

### Giant background text
A word or number at 200px+ with low opacity as a decorative element behind content:
```yaml
- kind: text
  id: bg-number
  rect: { x: -50, y: 100, w: 1000, h: 600 }
  text: "01"
  style: { fontFamily: "Inter, sans-serif", fontSize: 400, fontWeight: 900, color: "rgba(0,0,0,0.03)", lineHeight: 1.0 }
```

### Asymmetric split with accent strip
A thin colored strip between unequal panels:
```yaml
# 65/35 split with accent divider
- kind: shape
  id: dark-panel
  rect: { x: 1250, y: 0, w: 670, h: 1080 }
  shape: rect
  style: { fill: "#0a0a0a" }
- kind: shape
  id: divider
  rect: { x: 1247, y: 80, w: 3, h: 920 }
  shape: rect
  style: { gradient: { type: linear, angle: 180, stops: [{ color: "#4f6df5", position: 0 }, { color: "rgba(79,109,245,0)", position: 1 }] } }
  animation: { type: fade-in, delay: 200, duration: 600 }
```

### Overlapping elements for depth
Text that sits on top of a decorative shape, breaking the grid:
```yaml
- kind: shape
  id: accent-block
  rect: { x: 120, y: 350, w: 300, h: 300 }
  shape: rect
  style: { fill: "rgba(79,109,245,0.08)", borderRadius: 16 }
- kind: text
  id: quote
  rect: { x: 180, y: 300, w: 600, h: 200 }
  text: "Design is not just what it looks like. Design is how it works."
  style: { fontFamily: "Playfair Display, serif", fontSize: 36, fontWeight: 600, color: "#1a1a2e", lineHeight: 1.5, fontStyle: italic }
```

### Dramatic stat with context
A huge number with tiny label, placed off-center:
```yaml
- kind: text
  id: hero-stat
  rect: { x: 160, y: 200, w: 800, h: 300 }
  text: "4.2B"
  style: { fontFamily: "Inter, sans-serif", fontSize: 180, fontWeight: 900, color: "#0f0f23", lineHeight: 1.0 }
  animation: { type: scale-up, delay: 0, duration: 600 }
- kind: shape
  id: stat-underline
  rect: { x: 160, y: 500, w: 200, h: 3 }
  shape: rect
  style: { fill: "#4f6df5" }
  animation: { type: fade-in, delay: 300, duration: 400 }
- kind: text
  id: stat-label
  rect: { x: 160, y: 520, w: 800, h: 40 }
  text: "global internet users as of 2024"
  style: { fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 400, color: "#64648c", lineHeight: 1.4, textTransform: uppercase, letterSpacing: 2 }
  animation: { type: fade-up, delay: 400, duration: 500 }
```

### Floating tag cluster
Multiple pill tags scattered at slight offsets for an organic feel:
```yaml
# Tags at varied positions, not in a perfect row
- kind: group
  id: tag-ai
  rect: { x: 160, y: 200, w: 100, h: 32 }
  children:
    - kind: shape
      id: tag-ai-bg
      rect: { x: 0, y: 0, w: 100, h: 32 }
      shape: pill
      style: { fill: "rgba(79,109,245,0.1)" }
    - kind: text
      id: tag-ai-text
      rect: { x: 0, y: 0, w: 100, h: 32 }
      text: "AI"
      style: { fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "#4f6df5", lineHeight: 1.0, textAlign: center, verticalAlign: middle, textTransform: uppercase, letterSpacing: 1 }
  animation: { type: fade-in, delay: 100, duration: 400 }
- kind: group
  id: tag-ml
  rect: { x: 275, y: 192, w: 140, h: 32 }
  # ... similar, offset vertically by 8px for organic feel
```

See [reference.md](reference.md) for the full element reference, all theme palettes, and component recipes.
