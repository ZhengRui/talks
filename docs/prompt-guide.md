# Slide Prompt Guide

How to prompt the slide skills to get the best results. Two skills, two purposes:

- **`create-slides`** — generate slides from intent ("make a pitch deck about X")
- **`replicate-slides`** — reproduce slides from visual sources (screenshots, HTML, descriptions)

---

# Part 1: Creating Slides

How to prompt `create-slides` to get different kinds of slides. The more specific your intent, the smarter the output.

---

## Quick Reference

| What you say in the prompt | What it triggers |
|---|---|
| Topic + bullet points | Shortcut templates (`bullets`, `stats`) |
| "compare X vs Y" | `comparison` template or two-panel Box |
| Specific numbers / metrics | `stat` components in component trees |
| "dramatic / striking / creative" | Component trees with layering, scale contrast |
| "overlapping / layered / absolute" | `raw` IR elements + `position: absolute` |
| Theme name (e.g. "dark-tech") | Sets the visual direction immediately |
| Mood keyword (e.g. "technical") | Guides theme selection if no theme given |
| "N slides" | Controls deck length |
| Rich content description | Mixed approach — templates where they fit, components where they don't |
| "fancy / magazine / editorial" | Multi-technique compositions (see Creative section) |

---

## Prompt Patterns by Situation

### 1. Minimal — the skill asks follow-ups

```
make slides about our Q1 results
```

The skill will ask: mood, length, key data points. You'll get mostly shortcut templates (`cover`, `stats`, `bullets`, `end`).

```
create a presentation
```

Too vague — the skill asks what topic, audience, mood, length before doing anything.

---

### 2. Shortcut-heavy — concise, fast

```
make a 5-slide deck about Rust memory safety. Theme: dark-tech. Mood: technical.
```

Expected: all shortcut templates — `cover` → `bullets` → `comparison` (Rust vs C++) → `stats` → `end`. Minimal YAML, fast output.

```
create slides for a team standup: 3 wins, 2 blockers, next steps
```

Expected: `cover` → `bullets` (wins) → `bullets` (blockers) → `bullets` (next steps). Pure templates, nothing custom needed.

---

### 3. Mixed — templates + component trees

```
make a pitch deck for a fintech startup. We process $2B in transactions,
have 50K users, grew 300% YoY. Include a two-panel slide comparing us
vs competitors.
```

Expected:
- `cover` template for title
- Component tree with `stat` components for the big numbers (dramatic scale)
- `bullets` template for value props
- Component tree: root Box `flex-row` → left panel (our features) + right panel (competitor gaps)
- `end` template for CTA

The data triggers component trees (stats need drama), the comparison triggers a two-panel Box layout, everything else stays as templates.

---

### 4. Design-forward — component trees dominate

```
create a visually striking presentation about the history of the Tang Dynasty.
Use bold-signal theme. I want layered compositions, dramatic numbers, and
asymmetric layouts. 8 slides.
```

Expected: mostly component trees —
- Hero cover with giant "TANG" text + background decorative number
- Two-panel splits (text + stats)
- Layered compositions with `raw` IR shapes behind content
- `statement` template for pivotal quotes
- Rich text with inline colored words for emphasis

Keywords like "visually striking", "layered", "asymmetric" push toward component trees.

---

### 5. Pixel-precise — raw IR elements

```
make a single slide with a gradient strip across the top, a giant '01' watermark
behind the content, and a centered heading with staggered entrance animations
```

Expected: full component tree with `raw` elements for the gradient strip and watermark, `heading`/`body` with `entranceType` and `entranceDelay`, absolute positioning.

---

## The Most Effective Prompt Pattern

> Create a **[length]** presentation about **[topic]** for **[audience]**. Theme: **[theme]**. Key points: **[1, 2, 3]**. Include **[specific slide types]**. Mood: **[mood]**.

Example:

> Create an 8-slide presentation about WebAssembly adoption for a developer conference. Theme: electric-studio. Key points: performance benchmarks, browser support matrix, migration path from JS. Include a comparison slide and a stats slide with dramatic numbers. Mood: energetic.

---

## Making Slides More Creative

The difference between "good" and "great" slides is layering, contrast, and surprise. Here's how to push slides from template defaults into distinctive compositions.

### Prompting for Creativity

Add these phrases to any prompt to unlock more advanced techniques:

| Phrase | What it unlocks |
|--------|----------------|
| "make it feel like a magazine spread" | Asymmetric splits, editorial typography, whitespace |
| "use dramatic scale" | Giant numbers (120-400px), tiny labels, extreme size contrast |
| "layer elements" | Decorative shapes behind text, overlapping compositions |
| "add depth" | Semi-transparent backgrounds, rotated accents, gradient dividers |
| "vary every slide" | Forces different compositions — hero, split, grid, statement, collage |
| "use the accent color sparingly" | Color restraint — accent on 1-2 elements max per slide |
| "stagger the animations" | Entrance delays that ripple across elements (100-150ms increments) |
| "off-center everything" | Asymmetric padding, 65/35 splits, left-aligned text in wide panels |
| "add watermarks" | Giant transparent background numbers or text (fontSize: 300-500, opacity: 0.03) |
| "editorial style" | Tag + divider + heading + quote patterns, serif fonts, generous margins |

### Creative Technique Recipes

#### Giant Watermark Numbers

Huge, nearly invisible numbers behind the content create depth and visual anchoring. Each section slide gets a sequential number.

**Prompt fragment:** "number each section with a giant background watermark"

What gets generated:
```yaml
- type: raw
  position: "absolute"
  x: -50
  y: 80
  width: 1000
  height: 600
  elements:
    - kind: text
      id: bg-number
      rect: { x: 0, y: 0, w: 1000, h: 600 }
      text: "01"
      style:
        fontFamily: "Inter, sans-serif"
        fontSize: 400
        fontWeight: 900
        color: "rgba(0,0,0,0.03)"    # barely visible
        lineHeight: 1.0
```

---

#### Decorative Accent Shapes

Rotated, semi-transparent geometric shapes add energy without competing with content. Place them in corners or behind text blocks.

**Prompt fragment:** "add decorative geometric accents"

```yaml
# Rotated square in top-right corner
- type: raw
  position: "absolute"
  x: 1400
  y: -100
  width: 400
  height: 400
  elements:
    - kind: shape
      id: rotated-accent
      rect: { x: 0, y: 0, w: 400, h: 400 }
      shape: rect
      style: { fill: "rgba(79,109,245,0.05)", borderRadius: 24 }
      transform: { rotate: 25 }

# Soft circle behind a stat
- type: raw
  position: "absolute"
  x: 700
  y: 300
  width: 300
  height: 300
  elements:
    - kind: shape
      id: glow-circle
      rect: { x: 0, y: 0, w: 300, h: 300 }
      shape: circle
      style: { fill: "rgba(255,107,53,0.06)" }
```

---

#### Gradient Strips and Dividers

Thin gradient lines create visual rhythm — across the top of a slide, between panels, or as section separators.

**Prompt fragment:** "add a gradient strip at the top"

```yaml
# Full-width gradient strip (5px tall)
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
        gradient:
          type: linear
          angle: 90
          stops:
            - { color: "#ff6b35", position: 0 }
            - { color: "#00d4ff", position: 1 }

# Vertical gradient divider between two panels
- type: raw
  position: "absolute"
  x: 1247
  y: 80
  width: 3
  height: 920
  elements:
    - kind: shape
      id: divider
      rect: { x: 0, y: 0, w: 3, h: 920 }
      shape: rect
      style:
        gradient:
          type: linear
          angle: 180
          stops:
            - { color: theme.accent, position: 0 }
            - { color: "rgba(79,109,245,0)", position: 1 }
```

---

#### Asymmetric Two-Panel Splits

65/35 or 70/30 splits are far more dynamic than 50/50. The larger panel carries the main content; the smaller panel holds a stat, image, or accent color.

**Prompt fragment:** "use a 65/35 split with a dark right panel"

```yaml
- children:
    - type: box
      variant: flat
      layout: { type: flex, direction: row }
      padding: 0
      height: 1080
      children:
        # Main panel — 65%
        - type: box
          variant: flat
          width: 1250
          padding: [100, 80]
          children:
            - type: tag
              text: "Overview"
              color: theme.accent
            - type: heading
              text: "Why This Matters"
            - type: divider
              variant: gradient
              width: 30
            - type: body
              text: "Context and explanation..."
        # Accent panel — 35%
        - type: box
          background: "#0a0a0a"
          padding: [100, 60]
          verticalAlign: center
          children:
            - type: stat
              value: "3.2×"
              label: "Performance Gain"
              color: "#ff6b35"
              fontSize: 80
```

---

#### Rich Text with Inline Color

Color individual words to draw the eye to key terms. Use sparingly — one or two colored words per heading.

**Prompt fragment:** "highlight key words in the accent color"

```yaml
- type: heading
  text:
    - "The "
    - text: "Fall"
      color: "#c41e3a"
      bold: true
    - " of Tang"

- type: body
  text: "A dynasty that lasted **289 years** crumbled in a decade."
  # **bold** segments auto-render with highlightColor if set
```

---

#### Staggered Entrance Animations

Elements that appear one after another (100-150ms apart) create a storytelling rhythm. Use `autoEntrance` on a Box to stagger all children automatically.

**Prompt fragment:** "stagger the animations so elements appear sequentially"

```yaml
# Automatic stagger — the easy way
- type: box
  variant: flat
  padding: [80, 160]
  autoEntrance:
    type: fade-up
    stagger: 120
    baseDelay: 0
  children:
    - type: heading
      text: "Three Principles"      # appears at 0ms
    - type: card
      title: "Simplicity"           # appears at 120ms
      body: "Less is more"
    - type: card
      title: "Clarity"              # appears at 240ms
      body: "Say what you mean"
    - type: card
      title: "Impact"               # appears at 360ms
      body: "Make it count"

# Manual stagger — full control
- type: heading
  text: "SUPER BOWL"
  fontSize: 120
  entranceType: fade-up
  entranceDelay: 0
- type: heading
  text: "LX"
  level: 2
  fontSize: 72
  color: theme.accent
  entranceType: fade-up
  entranceDelay: 200
- type: body
  text: "February 7, 2026"
  entranceType: fade-in
  entranceDelay: 400
```

---

#### Overlapping Elements for Depth

Position shapes behind text using absolute positioning + normal-flow text. The shape sits behind; the text flows on top.

**Prompt fragment:** "layer a shape behind the main heading"

```yaml
- children:
    - type: box
      variant: flat
      padding: [120, 160]
      children:
        # Background accent block (absolutely positioned)
        - type: raw
          position: "absolute"
          x: 100
          y: 60
          width: 500
          height: 300
          elements:
            - kind: shape
              id: accent-block
              rect: { x: 0, y: 0, w: 500, h: 300 }
              shape: rect
              style: { fill: "rgba(79,109,245,0.08)", borderRadius: 20 }
        # Text flows over the shape
        - type: heading
          text: "Design is how it works."
          fontSize: 64
          margin: [80, 0, 0, 40]
```

---

#### Scale Contrast (Hero Numbers)

One giant element (number, word, image) dominates. Supporting text is small. The size gap creates instant hierarchy.

**Prompt fragment:** "make the key metric huge, like a hero number"

```yaml
- type: stat
  value: "$2.4B"
  label: "Total Transaction Volume"
  fontSize: 140           # giant
  labelFontSize: 22       # tiny by comparison
  color: theme.accent
  labelColor: theme.textMuted
  textAlign: left
  letterSpacing: 3
  textTransform: uppercase
  entranceType: scale-up
```

---

#### Multi-Technique Composition

The most impressive slides combine multiple techniques. Here's a full slide that uses watermark + gradient strip + asymmetric split + rich text + staggered animations:

**Prompt:** "create one stunning slide about our $2B milestone with editorial style, layered elements, and dramatic typography"

```yaml
- background: "#0a0a0a"
  children:
    - type: box
      variant: flat
      layout: { type: flex, direction: row }
      padding: 0
      height: 1080
      children:
        # Giant watermark behind everything
        - type: raw
          position: "absolute"
          x: -80
          y: 100
          width: 1200
          height: 700
          elements:
            - kind: text
              id: watermark
              rect: { x: 0, y: 0, w: 1200, h: 700 }
              text: "$2B"
              style:
                fontFamily: "Inter, sans-serif"
                fontSize: 500
                fontWeight: 900
                color: "rgba(255,255,255,0.02)"
                lineHeight: 1.0

        # Gradient strip across top
        - type: raw
          position: "absolute"
          x: 0
          y: 0
          width: 1920
          height: 4
          elements:
            - kind: shape
              id: strip
              rect: { x: 0, y: 0, w: 1920, h: 4 }
              shape: rect
              style:
                gradient:
                  type: linear
                  angle: 90
                  stops:
                    - { color: "#ff6b35", position: 0 }
                    - { color: "#00d4ff", position: 1 }

        # Left panel — 65%
        - type: box
          variant: flat
          width: 1250
          padding: [120, 100]
          autoEntrance:
            type: fade-up
            stagger: 150
          children:
            - type: tag
              text: "Milestone"
              color: "#ff6b35"
            - type: heading
              text:
                - "We crossed "
                - text: "$2 Billion"
                  color: "#ff6b35"
              fontSize: 64
            - type: divider
              variant: gradient
              width: 25
            - type: body
              text: "In total transaction volume — **faster than any competitor** in our category."
              fontSize: 26
              lineHeight: 1.7

        # Right panel — 35%
        - type: box
          background: "#111111"
          padding: [120, 60]
          verticalAlign: center
          autoEntrance:
            type: scale-up
            stagger: 200
            baseDelay: 300
          children:
            - type: stat
              value: "50K"
              label: "Active Users"
              color: "#00d4ff"
              fontSize: 72
            - type: stat
              value: "300%"
              label: "YoY Growth"
              color: "#ff6b35"
              fontSize: 72
```

---

## Mood → Theme Cheat Sheet

| Mood | Best themes | Feel |
|------|------------|------|
| Confident / Bold | `bold`, `bold-signal`, `electric-studio` | Heavy weights, punchy stats, dark backgrounds |
| Calm / Elegant | `elegant`, `paper-ink`, `vintage-editorial` | Serif headings, generous spacing, warm tones |
| Warm / Organic | `dark-botanical`, `notebook-tabs` | Natural tones, soft borders, copper accents |
| Energetic / Playful | `creative-voltage`, `split-pastel`, `pastel-geometry` | Mixed weights, pill tags, bright accents |
| Technical / Precise | `dark-tech`, `terminal-green`, `swiss-modern` | Monospace accents, grid layouts, minimal decoration |
| Futuristic | `neon-cyber` | Glowing accents, deep purples, sci-fi vibes |

---

## Composition Vocabulary

Mix at least 3-4 of these composition types in any deck:

| Composition | Description | When to use |
|-------------|-------------|-------------|
| **Hero** | One giant element dominates. Supporting text is small. | Opening slides, key metrics, bold statements |
| **Split** | Two panels. Each side tells a different story. | Before/after, pros/cons, text + visual |
| **Layered** | Background shape + semi-transparent overlay + foreground text | Section openers, mood slides, editorial feel |
| **Grid** | Cards or items arranged in a grid. Not all need equal size. | Features, team, services, comparisons |
| **Statement** | Single sentence, huge text, lots of whitespace | Key takeaway, quote, transition between sections |
| **Data** | Stats, numbers, or a table. Dramatic scale for the key number | Metrics, performance, growth |
| **Collage** | Mixed elements at different sizes, arranged asymmetrically | Creative decks, portfolios, mood boards |

---

## Anti-Patterns to Avoid

These kill visual impact. Mention them in your prompt to steer away:

| Anti-pattern | Fix |
|---|---|
| "The AI Grid" — 3 equal cards on every slide | Vary compositions: hero, split, grid, statement |
| 50/50 everything | Use 55/45, 60/40, 65/35, 70/30 splits |
| Accent color on every element | Use it on 1-2 elements per slide max |
| Same layout on consecutive slides | Alternate: split → hero → grid → statement |
| Wall of text (>5 bullets) | Split into multiple slides |
| Centered symmetry everywhere | Off-center heading, left-aligned stats, asymmetric padding |
| Uniform animations | Mix fade-up, scale-up, slide-left. Leave some elements static. |

---

# Part 2: Replicating Slides

How to prompt `replicate-slides` to reproduce existing slides. Give it a visual source, say "replicate", and get back: analysis + reusable template + instantiated YAML.

## Quick Reference

| What you provide | What happens |
|---|---|
| Screenshot only | Claude analyzes visually — layout, approximate colors/sizes/fonts |
| HTML file only | Claude extracts exact CSS values — precise colors, sizes, spacing |
| Screenshot + HTML | Best fidelity — screenshot for composition, HTML for exact numbers |
| Screenshot + corrections | Your verbal overrides take priority over visual detection |
| Description only | Claude builds from your words — no guessing needed |
| Any combination | Claude adapts — more inputs = more precise output |

---

## Prompt Patterns

### 1. Screenshot only — fast and easy

```
replicate this slide [attach/paste screenshot]
slug: my-talk
```

Claude reads the image, detects layout structure, estimates colors/fonts/sizes, finds or creates a template, outputs YAML. Good enough for most cases.

---

### 2. Screenshot + verbal corrections — best for screenshots

```
replicate this slide [screenshot]
the left panel is about 65%, the accent color is exactly #b8860b,
and the heading font is Playfair Display
slug: quarterly-review
```

Screenshots compress colors and can't distinguish similar fonts. Your corrections override what Claude detects:
- **Exact colors** — avoids guessing from JPEG compression
- **Font names** — Inter vs Helvetica looks identical in screenshots
- **Split ratios** — hard to measure precisely from a screenshot
- **Spacing values** — "padding is 80px" is more reliable than visual estimation

---

### 3. HTML file — exact values

```
replicate this slide from the HTML: /path/to/slide.html
slug: my-talk
```

Claude reads the markup and extracts exact CSS values — no guessing. Best when you have the source HTML.

---

### 4. Screenshot + HTML — maximum fidelity

```
replicate this slide [screenshot]
here's the HTML for exact values: /path/to/slide.html
slug: quarterly-review
```

Screenshot for visual composition and element identification. HTML for exact colors, sizes, spacing, fonts. Best of both worlds.

---

### 5. Description only — no visual needed

```
replicate a slide with: dark background (#0a0a0a), 65/35 split,
left panel has a tag "Chapter 3", heading "Revenue Growth" with
"Revenue" in gold (#b8860b), gradient divider, 3 bullets.
Right panel is #1a1714 with two stats stacked vertically.
slug: my-talk
```

When you know exactly what you want but don't have a screenshot. Claude builds from your description directly.

---

### 6. Batch replication — multiple slides

```
replicate these slides for my-talk presentation:
1. [screenshot-1.png] — the cover slide
2. [screenshot-2.png] — the stats overview
3. [screenshot-3.png] — the two-panel comparison
```

Claude processes each slide through the 3-phase pipeline. Templates created for earlier slides may be reused for later ones if the structure matches.

---

## The Most Effective Prompt Pattern

> Replicate this slide **[source]** for **[slug]**. **[corrections/overrides]**.

Examples:

> Replicate this slide screenshot.png for my-talk. The accent is #b8860b and the split is 65/35.

> Replicate this slide from the HTML at src/slides/intro.html for quarterly-review. Use the elegant theme.

---

## Key Details That Improve Fidelity

| Detail | Why it helps | Example |
|--------|-------------|---------|
| **Slug** | Required — where to save the template | `slug: my-talk` |
| **Exact hex colors** | Screenshots compress colors | `accent is #b8860b` |
| **Font names** | Can't distinguish from pixels | `heading is Playfair Display` |
| **Split ratios** | Hard to measure visually | `65/35 split` or `left panel is 1250px` |
| **Theme name** | Enables theme tokens instead of hardcoded colors | `use elegant theme` |
| **Spacing values** | Padding/gap precision | `80px vertical padding, 16px gap` |
| **Font sizes** | Approximate from screenshots | `heading is 54px, body is 26px` |

---

## What You Get Back

The skill outputs three things in order:

### 1. Analysis
Structured breakdown of every detected element — layout, typography, colors, spacing. Printed to conversation so you can verify.

### 2. Template
Either an existing template name (if pixel-level match is possible) or a new `.template.yaml` saved to `content/[slug]/templates/`. The template has smart params (text content) and style overrides (colors, sizes, ratios) with defaults matching the original.

### 3. Instantiated YAML
Ready-to-paste slide YAML using the template. All params filled to replicate the source.

---

## Template Accumulation

Each replication potentially creates a new reusable template. Over time:

```
content/my-talk/templates/
├── hero-watermark.template.yaml        # from replicating slide 1
├── split-content-stats.template.yaml   # from replicating slide 3
├── editorial-quote-cards.template.yaml # from replicating slide 7
```

Future slides with similar structures reuse these templates instead of creating new ones. The skill checks existing per-presentation templates before creating duplicates.
