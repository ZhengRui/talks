# Slide Generation Reference

Complete syntax spec for all three approaches: shortcut templates, compose templates, and freeform.

## Presentation Structure

```yaml
title: "Presentation Title"
author: "Speaker Name"           # shown on home page listing
theme: modern                    # see Theme Palettes below
slides:
  - template: cover              # shortcut, compose, or freeform
    title: "..."
  - template: bullets
    title: "..."
    bullets: [...]
  - template: split-compose      # compose
    left: { ... }
    right: { ... }
  - template: freeform           # freeform
    elements: [...]
```

**Save to**: `content/<slug>/slides.yaml`. Images in `content/<slug>/images/`. Run `bun run sync-content` after adding images.

---

## Shortcut Templates

Concise YAML for standard layouts. Each has specific props — internally they expand to compose templates via DSL.

### Title & Section Slides

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

### Content Slides

#### bullets
```yaml
- template: bullets
  title: "Key Points"
  bullets:
    - "First point"
    - "Second point"
    - "Third point"
  image: "bg.jpg"                     # optional background
```

#### numbered-list
```yaml
- template: numbered-list
  title: "Steps to Follow"
  items:
    - "Research the problem"
    - "Design the solution"
    - "Implement and test"
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

### Data & Technical Slides

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
    - date: "2025"
      label: "Global Launch"
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

### Media Slides

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
      caption: "Second"
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

### Layout Slides

#### two-column
```yaml
- template: two-column
  title: "Two Perspectives"          # optional
  left: "Left column content as a paragraph."
  right: "Right column content as a paragraph."
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
  main: "Primary content goes here with more detail."
  sidebarPosition: left             # optional: left | right (default left)
```

#### top-bottom
```yaml
- template: top-bottom
  title: "Cause and Effect"         # optional
  top: "Top section content"
  bottom: "Bottom section content"
```

### Special Slides

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
    - icon: "📊"
      label: "Analytics"
```

#### blank
```yaml
- template: blank
  image: "bg.jpg"                   # optional background
```

#### video
```yaml
- template: video
  src: "demo.mp4"                    # .mp4/.webm → <video>, YouTube/Vimeo → <iframe> embed
  title: "Product Demo"             # optional
  poster: "thumbnail.jpg"           # optional preview image
  style:
    height: 600                     # optional, omit to fill available space
```

#### iframe
```yaml
- template: iframe
  src: "https://example.com"
  title: "Live Demo"                # optional
  style:
    height: 600                     # optional, omit to fill available space
```

---

## Compose Templates

Declare typed components — the layout engine handles spacing, positioning, and animation automatically.

### split-compose

Two-panel layout with configurable ratio.

```yaml
- template: split-compose
  ratio: 0.55                        # left panel width (0.0-1.0), default 0.5
  left:
    background: theme.bg             # theme token or hex
    textColor: "#e8e0d0"            # override text color for panel
    verticalAlign: center            # optional: top | center | bottom
    fill: false                      # optional: true = edge-to-edge, no padding
    padding: 60                      # optional: number or [vert, horiz] or [top, right, bottom, left]
    gap: 28                          # optional: override default stacker gap
    children: []                     # SlideComponent[]
  right:
    background: "#1a1714"
    textColor: "#e8e0d0"
    children: []
```

- 60px padding on all sides per panel (unless `fill: true` or custom `padding`)
- Right panel animations start with 300ms base delay

### full-compose

Single content area, full width or centered.

```yaml
- template: full-compose
  background: theme.bg               # theme token or hex
  backgroundImage: "hero.jpg"        # optional background image
  overlay: dark                      # optional: dark | light | "rgba(0,0,0,0.5)"
  align: left                        # left (1600px wide) | center (1200px wide)
  verticalAlign: center              # optional: top | center | bottom
  children: []                       # SlideComponent[]
```

### Components

All components are positioned automatically by the vertical stacker (28px gap, staggered fade-up animations).

**Common props** (available on all components):
```yaml
  entranceType: fade-up             # optional: fade-up | fade-in | slide-left | slide-right | scale-up | count-up | none
  entranceDelay: 200                # optional: ms offset
  opacity: 0.8                      # optional: 0-1
```

#### text
```yaml
- type: text
  text: "Custom styled text"
  fontSize: 24                       # optional
  fontWeight: bold                   # optional: normal | bold
  color: theme.accent               # optional, theme token or hex
  textAlign: left                    # optional: left | center | right
  fontStyle: italic                  # optional: normal | italic
  fontFamily: heading                # optional: heading | body | mono (maps to theme fonts)
  lineHeight: 1.4                    # optional
  maxWidth: 800                      # optional, centered within panel
  margin: [20, 0]                    # optional, CSS-style: number | [vert, horiz] | [top, right, bottom, left]
```

#### heading
```yaml
- type: heading
  text: "Title Text"
  level: 1                          # optional: 1 (54px), 2 (42px), 3 (34px)
  fontSize: 54                      # optional, overrides level default
  textAlign: left                   # optional: left | center | right
  color: theme.heading              # optional, theme token or hex
```

#### body
```yaml
- type: body
  text: "Paragraph text that can wrap across multiple lines."
  fontSize: 28                      # optional
  color: theme.text                 # optional, theme token or hex
  textAlign: left                   # optional: left | center | right
  lineHeight: 1.6                   # optional
  margin: [20, 0]                   # optional, CSS-style: number | [vert, horiz] | [top, right, bottom, left]
```

#### bullets
```yaml
- type: bullets
  items:
    - "Point one"
    - "Point two"
    - "Point three"
  fontSize: 26                      # optional
  gap: 16                           # optional, spacing between items
  ordered: false                    # optional: true = numbered circles, false = accent bars
  variant: card                     # optional: card | plain | list (list = native bullet dots)
```

#### stat
```yaml
- type: stat
  value: "907"
  label: "Year of Tang's Fall"
  textAlign: left                   # optional: left | center
  fontSize: 64                      # optional, value font size
  labelFontSize: 24                 # optional, label font size
  color: "#ff2d2d"                  # optional, value color (default: theme.accent)
```

#### tag
```yaml
- type: tag
  text: "Chapter 1"
  color: theme.accent               # optional, theme token or hex
  align: left                       # optional: left | center
```

#### divider
```yaml
- type: divider
  variant: gradient                  # optional: solid | gradient | ink | border
  width: 80                         # optional, percentage of panel width
  align: left                       # optional: left | center
  margin: [16, 0, 40, 0]            # optional, CSS-style: number | [vert, horiz] | [top, right, bottom, left]
```

#### quote
```yaml
- type: quote
  text: "The empire, long united, must divide."
  attribution: "Romance of the Three Kingdoms"   # optional
  textAlign: left                   # optional: left | center | right
  fontSize: 30                      # optional, quote text font size
  attributionFontSize: 22           # optional
  decorative: true                  # optional, large opening quote mark above text
```

#### card
```yaml
- type: card
  title: "Card Title"
  body: "Card description text."
  dark: false                        # optional, uses dark background variant
```

#### image
```yaml
- type: image
  src: "photo.jpg"                   # relative to content/[slug]/images/
  height: 400                        # optional, omit to fill remaining space
  objectFit: cover                   # optional: cover | contain
  clipCircle: false                  # optional, circular crop
  borderRadius: 12                   # optional, overrides theme default
```

#### video
```yaml
- type: video
  src: "demo.mp4"                    # .mp4/.webm → <video>, YouTube/Vimeo → <iframe> embed
  poster: "thumbnail.jpg"           # optional preview image
  height: 500                        # optional, omit to fill remaining space
  borderRadius: 12                   # optional, overrides theme default
```

#### iframe
```yaml
- type: iframe
  src: "https://example.com"
  height: 500                        # optional, omit to fill remaining space
  borderRadius: 12                   # optional, overrides theme default
```

#### code
```yaml
- type: code
  code: "const x = 42;\nconsole.log(x);"
  language: typescript               # optional
  fontSize: 24                       # optional, default 24
  padding: 32                        # optional, default 32
```

#### spacer
```yaml
- type: spacer
  height: 200                        # px, optional
  flex: true                         # optional, fills remaining vertical space
```

#### box (container)
```yaml
- type: box
  variant: card                      # optional: card (bg+shadow+border) | flat (transparent) | panel (bg+radius, no shadow)
  maxWidth: 800                      # optional, centered within panel
  height: 300                        # optional, fixed height (content vertically centered)
  fill: false                        # optional, expand to fill available panel height
  verticalAlign: top                 # optional: top | center | bottom
  padding: 28                        # optional: number or [vert, horiz] or [top, right, bottom, left]
  background: theme.cardBg           # optional, theme token or hex
  accentTop: true                    # optional, 3px accent bar on top
  accentColor: theme.accent          # optional, accent bar color
  borderColor: "#ccc"               # optional, custom border color
  borderWidth: 2                     # optional, custom border width
  borderSides: [left]               # optional: top | right | bottom | left
  marginTop: 20                      # optional, overrides stacker gap
  marginBottom: 20                   # optional
  children:
    - type: heading
      text: "Inside a box"
    - type: body
      text: "Box children are stacked vertically."
```

#### columns (horizontal split)
```yaml
- type: columns
  gap: 32                            # optional, default 32
  ratio: 0.3                         # optional, first column width fraction (for 2-column)
  equalHeight: true                  # optional, stretch all columns to same height
  children:
    - type: stat
      value: "100"
      label: "First"
    - type: stat
      value: "200"
      label: "Second"
```

#### grid (multi-row)
```yaml
- type: grid
  columns: 3                         # optional, items per row, default 3
  gap: 32                            # optional, default 32
  equalHeight: true                  # optional, stretch cells to same height per row
  children:
    - type: card
      title: "Card 1"
      body: "Description"
    - type: card
      title: "Card 2"
      body: "Description"
    - type: card
      title: "Card 3"
      body: "Description"
```

#### raw (escape hatch)

Embeds LayoutElement[] directly. Coordinates relative to the component's bounding box.

```yaml
- type: raw
  height: 65                         # required
  elements:
    - kind: shape
      id: seal-border
      rect: { x: 0, y: 0, w: 65, h: 65 }
      shape: rect
      style: { fill: "transparent", stroke: "#c41e3a", strokeWidth: 2 }
    - kind: text
      id: seal-char
      rect: { x: 0, y: 10, w: 65, h: 45 }
      text: "唐"
      style: { fontFamily: "Noto Serif SC, serif", fontSize: 28, fontWeight: 700, color: "#c41e3a", textAlign: center }
```

---

## Freeform Template

Full pixel control on the 1920x1080 canvas. Every element has explicit position, size, and style.

```yaml
- template: freeform
  background: "#f5f0e8"             # optional
  backgroundImage: "hero.jpg"       # optional
  overlay: "rgba(0,0,0,0.5)"       # optional
  elements:
    - kind: text
      id: title
      rect: { x: 160, y: 200, w: 700, h: 80 }
      text: "Hello World"
      style: { fontFamily: "Inter, sans-serif", fontSize: 42, fontWeight: 700, color: "#1a1a2e" }
      entrance: { type: fade-up, delay: 0, duration: 500 }
```

**Canvas**: 1920 x 1080 px. **Safe area**: x: 160..1760, y: 60..1020. **Center**: (960, 540).

### LayoutElement Types

#### text
```yaml
- kind: text
  id: unique-id
  rect: { x: 0, y: 0, w: 600, h: 80 }
  text: "Your text"
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
```

#### shape
```yaml
- kind: shape
  id: unique-id
  rect: { x: 0, y: 0, w: 200, h: 200 }
  shape: rect                        # rect | circle | line | pill
  style:
    fill: "#1a1714"
    # Or gradient:
    gradient:
      type: linear
      angle: 90
      stops:
        - { color: "#c41e3a", position: 0 }
        - { color: "#c8a96e", position: 1 }
    stroke: "#ffffff"                # optional
    strokeWidth: 2                   # optional
    borderRadius: 12                 # optional
    opacity: 0.8                     # optional
    shadow: { offsetX: 0, offsetY: 4, blur: 24, color: "rgba(0,0,0,0.1)" }
  border: { width: 2, color: "#c41e3a", sides: ["left"] }   # optional
```

#### image
```yaml
- kind: image
  id: unique-id
  rect: { x: 0, y: 0, w: 400, h: 300 }
  src: "photo.jpg"
  objectFit: cover                   # cover | contain
  borderRadius: 12                   # optional
  clipCircle: true                   # optional
  opacity: 0.9                       # optional
```

#### group
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
    - kind: text
      id: card-body
      rect: { x: 24, y: 68, w: 712, h: 80 }
      text: "Body text"
      style: { fontFamily: "Inter", fontSize: 18, fontWeight: 400, color: "#64648c", lineHeight: 1.6 }
  style: { fill: "#ffffff", borderRadius: 8, shadow: { offsetX: 0, offsetY: 4, blur: 24, color: "rgba(0,0,0,0.06)" } }
  border: { width: 3, color: "#4f6df5", sides: ["left"] }
  clipContent: true                  # optional
```

#### code
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

#### table
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

#### list
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

#### video
```yaml
- kind: video
  id: unique-id
  rect: { x: 0, y: 0, w: 800, h: 450 }
  src: "demo.mp4"                    # .mp4/.webm → <video>, YouTube/Vimeo → <iframe> embed
  poster: "thumbnail.jpg"           # optional
  borderRadius: 12                   # optional
```

#### iframe
```yaml
- kind: iframe
  id: unique-id
  rect: { x: 0, y: 0, w: 800, h: 450 }
  src: "https://example.com"
  borderRadius: 12                   # optional
```

### Animations

| Type | Effect | Best for |
|------|--------|----------|
| `fade-up` | Fade in + slide up 30px | Titles, body text, cards |
| `fade-in` | Fade in (no motion) | Background shapes, images |
| `slide-left` | Fade + slide from left 60px | Left-panel content |
| `slide-right` | Fade + slide from right 60px | Right-panel content |
| `scale-up` | Fade + scale from 85% to 100% | Stats, hero numbers |
| `count-up` | Number count-up (web only) | Stat values |
| `none` | No animation | Static elements |

**Stagger**: Increment delay by 100-150ms between sequential elements. Compose templates handle this automatically.

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

Use in compose template `background`, `textColor`, and `color` fields:

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
