# Slide Generation Reference

Complete syntax spec for shortcut templates and scene slide authoring.

## Presentation Structure

```yaml
title: "Presentation Title"
author: "Speaker Name"           # shown on home page listing
theme: modern                    # see Theme Palettes below
slides:
  - template: cover              # shortcut template
    title: "..."
  - template: bullets
    title: "..."
    bullets: [...]
  - mode: scene                  # scene slide (custom layout)
    background: "theme.bg"
    children:
      - kind: text
        id: title
        frame: { left: 160, top: 120, w: 900 }
        text: "Custom Slide"
        style: { fontFamily: heading, fontSize: 54, fontWeight: 700, color: "theme.heading" }
```

**Save to**: `content/<slug>/slides.yaml`. Images in `content/<slug>/images/`. Run `bun run sync-content` after adding images.

---

## Shortcut Templates

Concise YAML for standard layouts. Each has specific props — internally they emit scene slides via DSL.

### Title & Section

#### cover
```yaml
- template: cover
  title: "Presentation Title"
  subtitle: "Optional subtitle"       # optional
  author: "Speaker Name"              # optional
  image: "bg.jpg"                     # optional background
```

#### statement
```yaml
- template: statement
  statement: "One powerful sentence."
  subtitle: "Supporting context"       # optional
  image: "bg.jpg"                     # optional background
```

#### section-divider
```yaml
- template: section-divider
  title: "Part Two"
  subtitle: "The Journey Continues"    # optional
  image: "section-bg.jpg"             # optional background
```

#### end
```yaml
- template: end
  title: "Thank You"                  # optional
  subtitle: "Questions?"              # optional
  image: "bg.jpg"                     # optional background
```

### Content

#### bullets
```yaml
- template: bullets
  title: "Key Points"
  bullets:
    - "First point"
    - "Second point"
  image: "bg.jpg"                     # optional background
```

#### numbered-list
```yaml
- template: numbered-list
  title: "Steps to Follow"
  items:
    - "Research the problem"
    - "Design the solution"
```

#### comparison
```yaml
- template: comparison
  title: "Before vs After"            # optional
  left:
    heading: "Before"
    items: ["Slow", "Manual", "Error-prone"]
  right:
    heading: "After"
    items: ["Fast", "Automated", "Reliable"]
```

#### definition
```yaml
- template: definition
  title: "Key Terms"
  definitions:
    - term: "Latency"
      description: "Time delay between request and response"
    - term: "Throughput"
      description: "Number of operations per unit time"
```

#### agenda
```yaml
- template: agenda
  title: "Today's Agenda"
  items:
    - "Introduction"
    - "Key Findings"
    - "Next Steps"
  activeIndex: 1                      # optional, highlights one item
```

#### highlight-box
```yaml
- template: highlight-box
  title: "Important Note"             # optional
  body: "This is critical information that deserves emphasis."
  variant: info                       # optional: info | warning | success
```

#### qa
```yaml
- template: qa
  question: "What is the main takeaway?"
  answer: "Automation reduces costs by 40% while improving quality."
```

#### quote
```yaml
- template: quote
  quote: "The best way to predict the future is to invent it."
  attribution: "Alan Kay"             # optional
  image: "bg.jpg"                     # optional background
```

### Data & Technical

#### stats
```yaml
- template: stats
  title: "Key Metrics"                # optional
  stats:
    - value: "500K"
      label: "Active Users"
    - value: "99.9%"
      label: "Uptime"
    - value: "42ms"
      label: "Avg Latency"
```

#### code
```yaml
- template: code
  title: "Implementation"             # optional
  code: "const greeting = 'Hello';\nconsole.log(greeting);"
  language: typescript                # optional
```

#### code-comparison
```yaml
- template: code-comparison
  title: "Refactoring"               # optional
  before:
    code: "for (let i = 0; i < arr.length; i++) {}"
    label: "Before"                   # optional
    language: javascript              # optional
  after:
    code: "arr.forEach(item => {})"
    label: "After"
    language: javascript
```

#### table
```yaml
- template: table
  title: "Performance Comparison"     # optional
  headers: ["Metric", "v1", "v2"]
  rows:
    - ["Latency", "120ms", "42ms"]
    - ["Throughput", "1K/s", "5K/s"]
```

#### timeline
```yaml
- template: timeline
  title: "Project History"            # optional
  events:
    - date: "2023"
      label: "Founded"
      description: "Started with 3 engineers"   # optional
    - date: "2024"
      label: "Series A"
```

#### steps
```yaml
- template: steps
  title: "Process"                    # optional
  steps:
    - label: "Research"
      description: "Identify user needs"        # optional
    - label: "Design"
      description: "Create prototypes"
    - label: "Build"
```

#### diagram
```yaml
- template: diagram
  title: "Architecture"              # optional
  image: "arch-diagram.png"
  caption: "System overview"         # optional
```

#### chart-placeholder
```yaml
- template: chart-placeholder
  title: "Growth Over Time"
  image: "chart.png"
  caption: "Source: Internal data"   # optional
```

### Media

#### image-text
```yaml
- template: image-text
  title: "Our Product"
  image: "product.jpg"
  imagePosition: left                # optional: left | right (default left)
  body: "Description text"           # optional
  bullets:                           # optional (instead of body)
    - "Feature one"
    - "Feature two"
```

#### image-caption
```yaml
- template: image-caption
  image: "photo.jpg"
  caption: "Photo description"
  title: "Optional Title"            # optional
```

#### image-grid
```yaml
- template: image-grid
  title: "Gallery"                   # optional
  columns: 2                         # optional: 2 | 3 (default 2)
  images:
    - src: "img1.jpg"
      caption: "First"              # optional
    - src: "img2.jpg"
```

#### image-comparison
```yaml
- template: image-comparison
  title: "Before and After"          # optional
  before:
    image: "before.jpg"
    label: "Before"                  # optional
  after:
    image: "after.jpg"
    label: "After"
```

#### image-gallery
```yaml
- template: image-gallery
  title: "Team Photos"              # optional
  images:
    - src: "photo1.jpg"
      caption: "Event 1"           # optional
    - src: "photo2.jpg"
```

#### full-image
```yaml
- template: full-image
  image: "hero.jpg"
  title: "Optional Overlay Title"    # optional
  body: "Optional overlay text"      # optional
  overlay: dark                      # optional: dark | light
```

### Layout

#### two-column
```yaml
- template: two-column
  title: "Two Perspectives"          # optional
  left: "Left column content."
  right: "Right column content."
```

#### three-column
```yaml
- template: three-column
  title: "Three Pillars"            # optional
  columns:
    - icon: "🔒"                    # optional
      heading: "Security"           # optional
      body: "Enterprise-grade encryption"
    - icon: "⚡"
      heading: "Speed"
      body: "Sub-millisecond response"
    - icon: "🌍"
      heading: "Scale"
      body: "Global infrastructure"
```

#### sidebar
```yaml
- template: sidebar
  title: "Deep Dive"                # optional
  sidebar: "Context or navigation content"
  main: "Primary content goes here."
  sidebarPosition: left             # optional: left | right (default left)
```

#### top-bottom
```yaml
- template: top-bottom
  title: "Cause and Effect"         # optional
  top: "Top section content"
  bottom: "Bottom section content"
```

### Special

#### profile
```yaml
- template: profile
  name: "Jane Smith"
  title: "CEO & Founder"            # optional
  image: "jane.jpg"                 # optional
  bio: "20 years of experience..."  # optional
```

#### icon-grid
```yaml
- template: icon-grid
  title: "Our Services"             # optional
  columns: 3                        # optional: 2 | 3 | 4
  items:
    - icon: "🎨"
      label: "Design"
    - icon: "💻"
      label: "Development"
```

#### video
```yaml
- template: video
  src: "demo.mp4"                    # .mp4/.webm or YouTube/Vimeo URL
  title: "Product Demo"             # optional
  poster: "thumbnail.jpg"           # optional
  style:
    height: 600                     # optional
```

#### iframe
```yaml
- template: iframe
  src: "https://example.com"
  title: "Live Demo"                # optional
  style:
    height: 600                     # optional
```

#### blank
```yaml
- template: blank
  image: "bg.jpg"                   # optional background
```

---

## Scene Slide Syntax

Scene slides use `mode: scene` and contain a tree of positioned nodes. This is the default authoring format for custom layouts.

### Slide Structure

```yaml
- mode: scene
  background: { type: solid, color: "theme.bg" }  # or string, or { type: image, src: "bg.jpg", overlay: "rgba(0,0,0,0.5)" }
  guides:                                          # optional named alignment points
    x: { content-left: 160, split: 1200 }
    y: { top: 120, bottom: 960 }
  presets:                                         # optional reusable style defaults
    sectionTitle:
      style: { fontFamily: heading, fontWeight: 700, color: "theme.heading", lineHeight: 1.15 }
  sourceSize: { w: 1920, h: 1080 }               # optional, author in different pixel space
  fit: contain                                     # optional: contain | cover | stretch | none
  align: center                                    # optional: top-left | top | top-right | left | center | right | bottom-left | bottom | bottom-right
  children: [...]                                  # scene nodes
```

### Scene Node Types

#### text
```yaml
- kind: text
  id: title
  preset: sectionTitle           # optional, inherits style defaults
  frame: { left: 160, top: 120, w: 900 }
  text: "Title Text"             # string or TextRun[]
  style:
    fontFamily: heading           # heading | body | mono | CSS font-family
    fontSize: 56
    fontWeight: 700
    color: "theme.heading"        # theme token or hex
    lineHeight: 1.15
    textAlign: left               # left | center | right
    # also: fontStyle, letterSpacing, textTransform, verticalAlign, highlightColor, textShadow
  entrance: { type: fade-up, delay: 0, duration: 600 }  # optional
```

#### shape
```yaml
- kind: shape
  id: panel
  frame: { left: "@x.split", top: 0, right: 0, bottom: 0 }
  shape: rect                     # rect | circle | line | pill | arrow | triangle | chevron | diamond | star | callout
  style:
    fill: "theme.bgSecondary"
    # also: gradient, stroke, strokeWidth, strokeDash, patternFill
  borderRadius: 16               # optional
  transform: { rotate: 25 }     # optional
```

#### image
```yaml
- kind: image
  id: photo
  frame: { x: 0, y: 0, w: 960, h: 1080 }
  src: "photo.jpg"                # relative to content/[slug]/images/
  objectFit: cover                # cover | contain
  clipCircle: false               # optional
```

#### group (layout container)
```yaml
- kind: group
  id: content-stack
  frame: { left: 160, top: 120, w: 900, h: 800 }
  layout:
    type: stack                   # stack | row | grid
    gap: 24
    align: start                  # start | center | end | stretch
    justify: center               # stack only: start | center | end
    padding: [20, 24, 20, 24]     # optional
  style: { fill: "theme.cardBg" } # optional group background
  clipContent: true               # optional
  children: [...]
```

**Layout types:**
- `stack` — vertical, children flow top-to-bottom, explicit gap
- `row` — horizontal, explicit tracks: `tracks: [400, "1fr", 300]` or equal-width with gap
- `grid` — fixed columns: `columns: 3`, optional `tracks` for column widths, `rowGap`/`columnGap`

#### ir (escape hatch)
```yaml
- kind: ir
  id: code-block
  frame: { x: 160, y: 400, w: 1600, h: 400 }
  element:
    kind: code
    id: code-element
    rect: { x: 0, y: 0, w: 1600, h: 400 }
    code: "const x = 42;"
    language: typescript
    style: { fontFamily: "theme.fontMono", fontSize: 24, color: "theme.codeText", background: "theme.codeBg", borderRadius: 12, padding: 32 }
```

Use `kind: ir` when you need code blocks, tables, lists, video, or iframe elements that don't have native scene node equivalents. The `element` wraps a raw LayoutElement (see IR Element Types below). The `frame` participates in scene geometry (guides, anchors, scaling).

### FrameSpec (Positioning)

Scene nodes use `frame` instead of `rect`. FrameSpec supports partial geometry — specify only what you need, the compiler resolves the rest.

```yaml
# Explicit position and size
frame: { x: 160, y: 120, w: 900, h: 400 }

# Edge-pinned (stretches to fill)
frame: { left: 160, top: 0, right: 0, bottom: 0 }

# Centered
frame: { centerX: 960, centerY: 540, w: 600, h: 400 }

# Width only (height auto, position from parent/layout)
frame: { w: 900 }

# Guide references
frame: { left: "@x.content-left", top: "@y.top", w: 900 }

# Anchor references (relative to sibling)
frame: { left: "@panel.right", top: "@panel.top", w: 500, h: 400 }
frame: { top: { ref: "@title.bottom", offset: 24 }, left: 160, w: 900 }
```

**Available constraints:** `x`, `y`, `w`, `h`, `left`, `right`, `top`, `bottom`, `centerX`, `centerY`

### Guides

Named alignment points referenced with `@x.name` or `@y.name` in FrameSpec values.

```yaml
guides:
  x: { content-left: 160, content-right: 1760, split: 1200 }
  y: { top: 120, bottom: 960 }
```

### Anchors

Reference the compiled rect of a previously defined sibling node. The referenced node must appear earlier in the children array.

```yaml
children:
  - kind: shape
    id: panel
    frame: { left: 0, top: 0, w: 960, h: 1080 }
    shape: rect
    style: { fill: "theme.bgSecondary" }
  - kind: text
    id: title
    frame: { left: { ref: "@panel.right", offset: 80 }, top: 120, w: 800 }
    text: "Title next to panel"
    style: { fontFamily: heading, fontSize: 48, color: "theme.heading" }
```

### Presets

Reusable style defaults applied to nodes via the `preset` field. Presets support `extends` for inheritance.

```yaml
presets:
  baseText:
    style: { fontFamily: body, fontWeight: 400, color: "theme.text", lineHeight: 1.6 }
  sectionTitle:
    extends: baseText
    style: { fontFamily: heading, fontWeight: 700, fontSize: 48, color: "theme.heading", lineHeight: 1.15 }
  bodyText:
    extends: baseText
    style: { fontSize: 28 }
```

Node-level style overrides merge on top of preset defaults:
```yaml
- kind: text
  id: title
  preset: sectionTitle
  frame: { w: 900 }
  text: "Custom Title"
  style: { fontSize: 64 }         # overrides preset's fontSize, keeps other preset styles
```

### Rich Text

Text nodes accept plain strings or TextRun arrays for inline styling:

```yaml
# Plain string
text: "Simple text"

# Markdown shorthand
text: "The **Fall** of *Tang*"

# TextRun array — full control per segment
text:
  - "The "
  - text: "Fall"
    color: "#c41e3a"
    bold: true
  - " of Tang"

# TextRun properties:
# bold, italic, underline, strikethrough, color, fontSize, fontFamily,
# letterSpacing, highlight (background color), superscript, subscript
```

### Common Node Properties

All scene nodes support:

```yaml
opacity: 0.8                        # 0-1
borderRadius: 12                     # px
shadow: { offsetX: 0, offsetY: 4, blur: 24, color: "rgba(0,0,0,0.1)" }
effects:
  glow: { color: "#ff6b35", radius: 15, opacity: 0.6 }
  softEdge: 8
  blur: 4
border: { width: 2, color: "#c41e3a", sides: ["left"], dash: "dash" }
entrance: { type: fade-up, delay: 0, duration: 500 }
transform: { rotate: 45, scaleX: 1.2, flipH: true }
clipPath: "polygon(0 0, 100% 0, 100% 85%, 0 100%)"
cssStyle: { mixBlendMode: "overlay" }  # web-only
```

### Background Spec

```yaml
# Solid color (theme token or hex)
background: "theme.bg"
background: { type: solid, color: "theme.bg" }

# Image with optional overlay
background: { type: image, src: "hero.jpg", overlay: "rgba(0,0,0,0.5)" }
```

---

## IR Element Types

Used inside `kind: ir` scene nodes and for understanding the underlying layout model. Each element has `kind`, `id`, `rect: {x, y, w, h}`, and type-specific props.

**Canvas**: 1920 x 1080 px. **Safe area**: x: 160..1760, y: 60..1020. **Center**: (960, 540).

### Common props (ElementBase)

All elements support:

```yaml
opacity: 0.8                        # 0-1
borderRadius: 12                     # px
shadow: { offsetX: 0, offsetY: 4, blur: 24, color: "rgba(0,0,0,0.1)" }
effects:
  glow: { color: "#ff6b35", radius: 15, opacity: 0.6 }
  softEdge: 8                        # feather radius
  blur: 4                            # Gaussian blur radius
border: { width: 2, color: "#c41e3a", sides: ["left"], dash: "dash" }  # dash: solid | dash | dot | dashDot
entrance: { type: fade-up, delay: 0, duration: 500 }
animation: "float 4s infinite"       # CSS animation (web-only)
clipPath: "polygon(0 0, 100% 0, 100% 85%, 0 100%)"
transform: { rotate: 45, scaleX: 1.2, flipH: true }
cssStyle: { mixBlendMode: "overlay" }  # web-only
```

### text
```yaml
- kind: text
  id: unique-id
  rect: { x: 160, y: 200, w: 700, h: 80 }
  text: "Your text"                  # string or TextRun[]
  style:
    fontFamily: "Inter, sans-serif"
    fontSize: 42
    fontWeight: 700
    color: "#1a1a2e"
    lineHeight: 1.2
    textAlign: left                  # left | center | right
    fontStyle: italic                # optional
    letterSpacing: 2                 # optional, px
    textTransform: uppercase         # optional
    verticalAlign: middle            # optional: top | middle | bottom
    highlightColor: "#ff6b35"        # optional, color for **bold** segments
```

### shape
```yaml
- kind: shape
  id: unique-id
  rect: { x: 0, y: 0, w: 200, h: 200 }
  shape: rect                        # rect | circle | line | pill | arrow | triangle | chevron | diamond | star | callout
  style:
    fill: "#1a1714"
    gradient:                        # alternative to fill
      type: linear
      angle: 90
      stops:
        - { color: "#c41e3a", position: 0 }
        - { color: "#c8a96e", position: 1 }
    stroke: "#ffffff"                # optional
    strokeWidth: 2                   # optional
    strokeDash: dash                 # optional: solid | dash | dot | dashDot
    patternFill:                     # optional, alternative to fill/gradient
      preset: narHorz               # narHorz | narVert | smGrid | lgGrid | dotGrid | pct5 | pct10 | dnDiag | upDiag | diagCross
      fgColor: "#ffffff"
      fgOpacity: 0.1
```

### image
```yaml
- kind: image
  id: unique-id
  rect: { x: 0, y: 0, w: 400, h: 300 }
  src: "photo.jpg"
  objectFit: cover                   # cover | contain
  clipCircle: true                   # optional
```

### group
```yaml
- kind: group
  id: card
  rect: { x: 160, y: 300, w: 760, h: 180 }
  children:
    - kind: text
      id: card-title
      rect: { x: 24, y: 20, w: 712, h: 40 }  # relative to group
      text: "Title"
      style: { fontFamily: "Inter", fontSize: 24, fontWeight: 700, color: "#1a1a2e" }
  style: { fill: "#ffffff" }
  clipContent: true                  # optional
  layout:                            # optional auto-layout
    type: flex
    direction: row
    gap: 16
```

### code
```yaml
- kind: code
  id: unique-id
  rect: { x: 0, y: 0, w: 600, h: 300 }
  code: "const x = 42;"
  language: typescript               # optional
  style:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: 18
    color: "#cdd6f4"
    background: "#1e1e2e"
    borderRadius: 12
    padding: 32
```

### table
```yaml
- kind: table
  id: unique-id
  rect: { x: 0, y: 0, w: 600, h: 300 }
  headers: ["Name", "Score"]
  rows:
    - ["Alice", "95"]
    - ["Bob", "87"]
  headerStyle: { fontFamily: "Inter", fontSize: 18, fontWeight: 700, color: "#fff", background: "#4f6df5" }
  cellStyle: { fontFamily: "Inter", fontSize: 16, color: "#1a1a2e", background: "#fff", altBackground: "#f8f9fc" }
  borderColor: "rgba(0,0,0,0.06)"
```

### list
```yaml
- kind: list
  id: unique-id
  rect: { x: 0, y: 0, w: 600, h: 300 }
  items: ["First", "Second", "Third"]
  ordered: false
  itemStyle: { fontFamily: "Inter", fontSize: 22, color: "#1a1a2e", lineHeight: 1.6 }
  bulletColor: "#4f6df5"
  itemSpacing: 16
```

### video
```yaml
- kind: video
  id: unique-id
  rect: { x: 0, y: 0, w: 800, h: 450 }
  src: "demo.mp4"
  poster: "thumbnail.jpg"           # optional
```

### iframe
```yaml
- kind: iframe
  id: unique-id
  rect: { x: 0, y: 0, w: 800, h: 450 }
  src: "https://example.com"
```

---

## Animations

| Type | Effect | Best for |
|------|--------|----------|
| `fade-up` | Fade in + slide up 30px | Titles, body text, cards |
| `fade-in` | Fade in (no motion) | Background shapes, images |
| `slide-left` | Fade + slide from left 60px | Left-panel content |
| `slide-right` | Fade + slide from right 60px | Right-panel content |
| `scale-up` | Fade + scale from 85% to 100% | Stats, hero numbers |
| `count-up` | Number count-up (web only) | Stat values |
| `none` | No animation | Static elements |

**Stagger**: Increment delay by 100-150ms between sequential elements using the `entrance.delay` property on scene nodes.

---

## Theme Palettes

### Light Themes

**`modern`** — Clean, professional. Blue accent on near-white.
- bg: `#f8f9fc`, bgSecondary: `#f0f1f5`, text: `#1a1a2e`, accent: `#4f6df5`, accent2: `#a855f7`
- Fonts: Inter (heading + body), JetBrains Mono (code). Radius: 12.

**`elegant`** — Warm, refined. Gold on parchment.
- bg: `#faf8f5`, bgSecondary: `#f5f0ea`, text: `#2d2a26`, accent: `#b8860b`, accent2: `#6b4c8a`
- Fonts: Playfair Display (heading), Inter (body). Radius: 6.

**`paper-ink`** — Literary, thoughtful. Crimson on warm paper.
- bg: `#faf9f7`, bgSecondary: `#f5f0e8`, text: `#1a1a1a`, accent: `#c41e3a`, accent2: `#8b0000`
- Fonts: Cormorant Garamond (heading), Source Serif 4 (body). Radius: 2.

**`swiss-modern`** — Precise, minimal. Red on pure white.
- bg: `#ffffff`, bgSecondary: `#f5f5f5`, text: `#1a1a1a`, accent: `#e63946`, accent2: `#1d3557`
- Fonts: Helvetica Neue. Radius: 0.

**`split-pastel`** — Playful, friendly. Soft peach + lavender.
- bg: `#fef7f0`, bgSecondary: `#f0e8f5`, text: `#2d2a3e`, accent: `#e8937a`, accent2: `#9b8ec4`
- Fonts: Outfit. Radius: 16.

**`notebook-tabs`** — Soft, whimsical. Lavender + rose on warm paper.
- bg: `#f8f6f1`, bgSecondary: `#ffffff`, text: `#1a1a1a`, accent: `#c7b8ea`, accent2: `#f4b8c5`
- Fonts: Bodoni Moda (heading), DM Sans (body). Radius: 6.

**`pastel-geometry`** — Cool, structured. Sage green + pink on soft blue.
- bg: `#c8d9e6`, bgSecondary: `#faf9f7`, text: `#2a2a2a`, accent: `#5a7c6a`, accent2: `#f0b4d4`
- Fonts: Plus Jakarta Sans. Radius: 16.

**`vintage-editorial`** — Classic, print-inspired. Warm tones + strong borders.
- bg: `#f5f3ee`, bgSecondary: `#ffffff`, text: `#1a1a1a`, accent: `#e8d4c0`, accent2: `#c45c5c`
- Fonts: Fraunces (heading), Work Sans (body). Radius: 4.

### Dark Themes

**`bold`** — High-impact. Orange on black.
- bg: `#0a0a0a`, bgSecondary: `#1a1a1a`, text: `#f5f5f5`, accent: `#ff6b35`, accent2: `#00d4ff`
- Fonts: Inter. Radius: 4.

**`dark-tech`** — Futuristic. Cyan-green on deep navy.
- bg: `#0a0a12`, bgSecondary: `#12121e`, text: `#e0e0e0`, accent: `#00ffc8`, accent2: `#7b61ff`
- Fonts: JetBrains Mono (heading), Inter (body). Radius: 8.

**`bold-signal`** — Vibrant dark. Coral + electric blue.
- bg: `#1a1a1a`, bgSecondary: `#242424`, text: `#f5f5f5`, accent: `#ff6b6b`, accent2: `#4ecdc4`
- Fonts: Inter. Radius: 8.

**`electric-studio`** — Bold contrast. Blue accent, black/white panels.
- bg: `#0a0a0a`, bgSecondary: `#ffffff`, text: `#ffffff`, accent: `#4361ee`, accent2: `#6b83f2`
- Fonts: Manrope. Radius: 8.

**`creative-voltage`** — Electric, experimental. Lime-green on dark indigo.
- bg: `#1a1a2e`, bgSecondary: `#0066ff`, text: `#ffffff`, accent: `#d4ff00`, accent2: `#0066ff`
- Fonts: Syne (heading), Space Mono (body). Radius: 8.

**`dark-botanical`** — Warm organic. Copper + blush on dark.
- bg: `#0f0f0f`, bgSecondary: `#1a1a1a`, text: `#e8e4df`, accent: `#d4a574`, accent2: `#e8b4b8`
- Fonts: Cormorant (heading), IBM Plex Sans (body). Radius: 8.

**`neon-cyber`** — Futuristic. Magenta on deep purple.
- bg: `#0a0014`, bgSecondary: `#140020`, text: `#e0e0ff`, accent: `#ff00ff`, accent2: `#00ffff`
- Fonts: Orbitron (heading), Inter (body). Radius: 4.

**`terminal-green`** — Hacker aesthetic. Green phosphor on black.
- bg: `#0a0a0a`, bgSecondary: `#111111`, text: `#00ff41`, accent: `#00ff41`, accent2: `#00cc33`
- Fonts: VT323. Radius: 0.

### Theme Token Reference

Use in scene node `color`, `fill`, and style fields:

| Token | Resolves to |
|-------|-------------|
| `theme.bg` | Primary background |
| `theme.bgSecondary` | Secondary background |
| `theme.bgTertiary` | Tertiary background |
| `theme.text` | Primary text color |
| `theme.textMuted` | Muted text color |
| `theme.heading` | Heading text color |
| `theme.accent` | Primary accent |
| `theme.accent2` | Secondary accent |
| `theme.cardBg` | Card background |
| `theme.codeBg` | Code block background |
| `theme.codeText` | Code text color |

---

## Canvas & Sizing

- **Canvas**: 1920 x 1080 px (16:9, fixed)
- **Safe area**: x: 160..1760, y: 60..1020
- **Center**: (960, 540)
- **Estimate text height**: `lines * fontSize * lineHeight`
- **Estimate text width**: ~0.55 * fontSize * characterCount
- **z-order** (scene nodes): Later children render on top. Background shapes first, text last.
- **Group children**: Use FrameSpec within scene groups; coordinates resolve relative to the group's compiled rect origin.

## Content Density Limits

| Slide Type | Maximum Content |
|------------|----------------|
| Hero / Statement | 1 heading + 1 subtitle |
| Content | 1 heading + 4-5 bullets, or 1 heading + 3 cards |
| Data | 1 heading + 3-4 stats, or 1 table |
| Split | 4-5 items per panel |
| Code | 1 heading + 8-10 lines |
| Quote | 1 quote (max 3 lines) + attribution |

**Rule:** If content exceeds limits, split into multiple slides.

## Design Anti-Patterns

- **The AI Grid**: 3 equal cards on every slide. Vary compositions.
- **50/50 everything**: Always equal splits. Use 55/45, 60/40, 70/30.
- **Blue everything**: Accent color on every element. Use sparingly.
- **Same layout twice**: Two consecutive identical compositions. Alternate types.
- **Wall of text**: More than 5 bullets per panel. Split slides.
- **Centered symmetry**: Everything centered. Off-center creates energy.
- **Uniform animation**: Every element with fade-up. Mix types. Leave some static.

## Creative Techniques

### Giant background text
```yaml
- kind: text
  id: bg-number
  frame: { x: -50, y: 100, w: 1000 }
  text: "01"
  style: { fontFamily: "Inter, sans-serif", fontSize: 400, fontWeight: 900, color: "rgba(255,255,255,0.03)", lineHeight: 1.0 }
```

### Overlapping accent shape
```yaml
- kind: shape
  id: accent-block
  frame: { x: 0, y: 250, w: 300, h: 300 }
  shape: rect
  style: { fill: "rgba(79,109,245,0.08)" }
  borderRadius: 16
```

### Rotated decorative shape
```yaml
- kind: shape
  id: rotated-accent
  frame: { x: 1400, y: -100, w: 400, h: 400 }
  shape: rect
  style: { fill: "rgba(79,109,245,0.05)" }
  borderRadius: 24
  transform: { rotate: 25 }
```

### Asymmetric split with gradient divider
```yaml
- mode: scene
  guides:
    x: { split: 1250 }
  children:
    - kind: shape
      id: right-panel
      frame: { left: "@x.split", top: 0, right: 0, bottom: 0 }
      shape: rect
      style: { fill: "#0a0a0a" }
    - kind: shape
      id: divider
      frame: { x: 1247, y: 80, w: 3, h: 920 }
      shape: rect
      style:
        gradient: { type: linear, angle: 180, stops: [{ color: "#4f6df5", position: 0 }, { color: "rgba(79,109,245,0)", position: 1 }] }
    - kind: group
      id: left-content
      frame: { left: 80, top: 100, w: 1090, h: 880 }
      layout: { type: stack, gap: 24 }
      children: [...]
    - kind: group
      id: right-content
      frame: { left: { ref: "@x.split", offset: 60 }, top: 100, w: 530, h: 880 }
      layout: { type: stack, gap: 24, justify: center }
      children: [...]
```
