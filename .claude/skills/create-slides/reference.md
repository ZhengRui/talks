# Slide Generation Reference

Complete syntax spec for shortcut templates and component tree slides.

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
  - children:                    # component tree (no template field)
      - type: heading
        text: "Custom Slide"
      - type: bullets
        items: [...]
```

**Save to**: `content/<slug>/slides.yaml`. Images in `content/<slug>/images/`. Run `bun run sync-content` after adding images.

---

## Shortcut Templates

Concise YAML for standard layouts. Each has specific props — internally they expand to component trees via DSL.

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

## Component Tree Slides

Slides without a `template` field are component trees. They have `children` (array of components) and optional `background`, `backgroundImage`, `overlay`.

```yaml
- background: "#0a0a0a"
  backgroundImage: "hero.jpg"        # optional
  overlay: "rgba(0,0,0,0.5)"        # optional
  children:
    - type: heading
      text: "Hello World"
    - type: body
      text: "This is a component tree slide."
```

Top-level children are wrapped in a slide-sized Box with default flex-column layout (16px gap, 60px padding).

### Shared Mixin

All 18 component types accept these props. Applied to the component's root element after component-specific resolution.

```yaml
# Style passthrough
entranceType: fade-up              # fade-up | fade-in | slide-left | slide-right | scale-up | count-up | none
entranceDelay: 200                 # ms offset
opacity: 0.8                      # 0-1
transform: { rotate: -5 }         # rotate (degrees), scaleX, scaleY, flipH, flipV
effects: { glow: { color: "#ff6b35", radius: 15, opacity: 0.4 } }  # glow, softEdge, blur
borderRadius: 12                   # px
clipPath: "polygon(0 0, 100% 0, 100% 85%, 0 100%)"  # CSS clip-path
cssStyle: { mixBlendMode: "overlay" }  # web-only CSS overrides

# Layout control
width: 600                         # explicit width (enables justify in flex-row)
height: 400                        # explicit height
margin: [20, 0]                    # CSS-style: number | [vert, horiz] | [top, right, bottom, left]
position: "absolute"               # opt out of parent flow layout
x: 100                            # absolute x position within parent
y: 200                            # absolute y position within parent
```

### Rich Text

All text-bearing components (`text`, `heading`, `body`, `bullets`, `stat`, `tag`, `quote`, `card`) accept `RichText` — either a plain string or an array of styled runs.

```yaml
# Plain string (backward compatible)
text: "Simple text"

# Markdown shorthand — **bold** and *italic* parsed by renderers
text: "The **Fall** of *Tang*"

# Styled runs — full control per segment
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

For `bullets`, each item can be RichText:
```yaml
- type: bullets
  items:
    - "Plain bullet"
    - - "Revenue grew "
      - text: "47%"
        bold: true
        color: "#22c55e"
      - " year over year"
```

### Components

#### text
```yaml
- type: text
  text: "Custom styled text"          # RichText
  fontSize: 24                       # optional
  fontWeight: 700                    # optional: 100-900
  color: theme.accent               # optional, theme token or hex
  textAlign: left                    # optional: left | center | right
  fontStyle: italic                  # optional: normal | italic
  fontFamily: heading                # optional: heading | body | mono (maps to theme fonts)
  lineHeight: 1.4                    # optional
  letterSpacing: 2                   # optional, px
  textTransform: uppercase           # optional: uppercase | lowercase | none
  textShadow: "0 2px 4px rgba(0,0,0,0.3)"  # optional, string or false to suppress
  maxWidth: 800                      # optional, centered within panel
```

#### heading
```yaml
- type: heading
  text: "Title Text"                 # RichText
  level: 1                          # optional: 1 (54px), 2 (42px), 3 (34px)
  fontSize: 54                      # optional, overrides level default
  textAlign: left                   # optional: left | center | right
  color: theme.heading              # optional
  fontFamily: heading               # optional, theme token or raw CSS font-family
  fontWeight: 700                   # optional
  letterSpacing: -1                 # optional, px
  textTransform: uppercase          # optional
```

#### body
```yaml
- type: body
  text: "Paragraph text."           # RichText
  fontSize: 28                      # optional
  color: theme.text                 # optional
  textAlign: left                   # optional
  lineHeight: 1.6                   # optional
```

#### bullets
```yaml
- type: bullets
  items:                             # RichText[]
    - "Point one"
    - "Point two"
  fontSize: 26                      # optional
  gap: 16                           # optional, spacing between items
  ordered: false                    # optional: true = numbered, false = accent bars
  variant: card                     # optional: card | plain | list
  bulletColor: theme.accent         # optional
  highlightColor: "#ff6b35"         # optional, color for **bold** segments
```

#### stat
```yaml
- type: stat
  value: "907"                       # RichText
  label: "Year of Tang's Fall"      # RichText
  textAlign: left                   # optional: left | center
  fontSize: 64                      # optional, value font size
  labelFontSize: 24                 # optional
  color: theme.accent               # optional, value color
  labelColor: theme.textMuted       # optional
  fontFamily: heading               # optional, value font
  labelFontWeight: 400              # optional
  letterSpacing: 2                  # optional, label letter-spacing
  textTransform: uppercase          # optional, label text-transform
```

#### tag
```yaml
- type: tag
  text: "Chapter 1"                 # RichText
  color: theme.accent               # optional
  align: left                       # optional: left | center
  fontSize: 20                      # optional
  padding: [12, 20]                 # optional, CSS-style
  borderWidth: 1                    # optional, set 0 for no border
  borderColor: "#ccc"               # optional
  letterSpacing: 2                  # optional, px
```

#### divider
```yaml
- type: divider
  variant: gradient                  # optional: solid | gradient | ink | border
  width: 80                         # optional, percentage of panel width
  color: theme.accent               # optional
  align: left                       # optional: left | center
```

#### quote
```yaml
- type: quote
  text: "The empire, long united, must divide."  # RichText
  attribution: "Romance of the Three Kingdoms"   # optional
  textAlign: left                   # optional: left | center | right
  fontSize: 30                      # optional
  attributionFontSize: 22           # optional
  decorative: true                  # optional, large opening quote mark
```

#### card
```yaml
- type: card
  title: "Card Title"               # RichText
  body: "Card description."         # RichText
  dark: false                        # optional, dark background variant
```

#### image
```yaml
- type: image
  src: "photo.jpg"                   # relative to content/[slug]/images/
  height: 400                        # optional, omit to fill remaining space
  objectFit: cover                   # optional: cover | contain
  clipCircle: false                  # optional, circular crop
```

#### video
```yaml
- type: video
  src: "demo.mp4"                    # .mp4/.webm or YouTube/Vimeo URL
  poster: "thumbnail.jpg"           # optional
  height: 500                        # optional
```

#### iframe
```yaml
- type: iframe
  src: "https://example.com"
  height: 500                        # optional
```

#### code
```yaml
- type: code
  code: "const x = 42;\nconsole.log(x);"
  language: typescript               # optional
  fontSize: 24                       # optional
  padding: 32                        # optional
```

#### spacer
```yaml
- type: spacer
  height: 200                        # optional, px
  flex: true                         # optional, fills remaining vertical space
```

#### box (layout container)

The primary layout container. Children stack vertically by default (flex-column, 16px gap). Use `layout` for flex-row or grid arrangements.

```yaml
- type: box
  variant: card                      # optional: card | flat | panel
  padding: 28                        # optional: number | [vert, horiz] | [top, right, bottom, left]
  background: theme.cardBg           # optional
  maxWidth: 800                      # optional, centered
  height: 300                        # optional, fixed height
  fill: false                        # optional, expand to fill panel height
  verticalAlign: top                 # optional: top | center | bottom
  accentTop: true                    # optional, 3px accent bar
  accentColor: theme.accent          # optional
  borderColor: "#ccc"               # optional
  borderWidth: 2                     # optional
  borderSides: [left]               # optional: top | right | bottom | left
  autoEntrance:                      # optional, stagger animations on children
    type: fade-up
    stagger: 100                     # ms per child
    baseDelay: 0                     # ms
  layout:                            # optional, default is flex-column
    type: flex                       # flex | grid
    direction: row                   # flex only: row | column (default column)
    gap: 24                          # px between items
    align: center                    # cross-axis: start | center | end | stretch
    justify: space-between           # main-axis: start | center | end | space-between | space-around
    wrap: true                       # flex-row only: wrap to next row
    columns: 3                       # grid only: items per row
    rowGap: 16                       # grid only
    columnGap: 24                    # grid only
  children:
    - type: heading
      text: "Inside a box"
    - type: body
      text: "Children stack vertically by default."
```

**Layout examples:**

```yaml
# Flex row — horizontal arrangement
- type: box
  variant: flat
  layout: { type: flex, direction: row, gap: 32, align: center }
  children:
    - type: stat
      value: "100"
      label: "First"
      width: 300
    - type: stat
      value: "200"
      label: "Second"
      width: 300

# Grid — 2x2 card layout
- type: box
  variant: flat
  layout: { type: grid, columns: 2, gap: 24 }
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
    - type: card
      title: "Card 4"
      body: "Description"

# Flex column with justify center (vertically centered)
- type: box
  variant: flat
  height: 800
  layout: { type: flex, direction: column, gap: 24, justify: center }
  children:
    - type: heading
      text: "Centered Content"
    - type: body
      text: "This group is vertically centered."
```

**Absolute positioning within a box:**

Children with `position: "absolute"` are taken out of flow. They use `x`/`y` coordinates relative to the box's content area. Other children flow normally.

```yaml
- type: box
  variant: flat
  children:
    # This decorative shape is positioned absolutely
    - type: raw
      position: "absolute"
      x: 0
      y: 0
      width: 200
      height: 200
      elements:
        - kind: shape
          id: accent
          rect: { x: 0, y: 0, w: 200, h: 200 }
          shape: circle
          style: { fill: "rgba(79,109,245,0.08)" }
    # These children flow normally
    - type: heading
      text: "Title"
    - type: body
      text: "Content flows around the absolute element."
```

#### columns (horizontal split)
```yaml
- type: columns
  gap: 32                            # optional, default 32
  ratio: 0.3                         # optional, first column width fraction (2-column)
  equalHeight: true                  # optional
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
  columns: 3                         # optional, default 3
  gap: 32                            # optional, default 32
  equalHeight: true                  # optional
  children:
    - type: card
      title: "Card 1"
      body: "Description"
    - type: card
      title: "Card 2"
      body: "Description"
```

#### raw (IR element escape hatch)

Embeds raw `LayoutElement[]` directly. Coordinates relative to the component's bounding box. Use for pixel-precise elements within a component tree.

```yaml
- type: raw
  height: 65                         # required (unless position: absolute)
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

### Two-Panel Layout Pattern

The old `split-compose` template is now a component tree pattern:

```yaml
- children:
    - type: box
      variant: flat
      layout: { type: flex, direction: row }
      padding: 0
      height: 1080
      children:
        - type: box
          width: 1056                  # 55% of 1920
          padding: [80, 60]
          variant: flat
          children: [...]              # left panel content
        - type: box
          background: "#1a1714"
          padding: [80, 60]
          verticalAlign: center
          children: [...]              # right panel content
```

### Full-Width Centered Layout Pattern

The old `full-compose` template is now:

```yaml
- children:
    - type: box
      variant: flat
      padding: [80, 160]
      maxWidth: 1200                   # or omit for full width (1600px with padding)
      children: [...]
```

---

## IR Element Types

Used inside `raw` components and for understanding the underlying layout model. Each element has `kind`, `id`, `rect: {x, y, w, h}`, and type-specific props.

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

**Stagger**: Increment delay by 100-150ms between sequential elements. Compose templates handle this automatically. Use `autoEntrance` on Box for automatic staggering.

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

Use in component `color`, `background`, and style fields:

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
- **z-order** (raw elements): Later elements render on top. Background shapes first, text last.
- **Group children**: Coordinates relative to the group's `rect` origin.

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
```

### Overlapping elements for depth
```yaml
- type: raw
  position: "absolute"
  x: 0
  y: 250
  width: 300
  height: 300
  elements:
    - kind: shape
      id: accent-block
      rect: { x: 0, y: 0, w: 300, h: 300 }
      shape: rect
      style: { fill: "rgba(79,109,245,0.08)", borderRadius: 16 }
# Text that flows over the shape via normal layout
- type: heading
  text: "Design is how it works."
  margin: [60, 0, 0, 0]
```

### Rotated accent shape
```yaml
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
```

### Asymmetric split with gradient divider
```yaml
- children:
    - type: box
      variant: flat
      layout: { type: flex, direction: row }
      padding: 0
      height: 1080
      children:
        - type: box
          variant: flat
          width: 1250
          padding: [100, 80]
          children: [...]
        # Gradient divider
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
                gradient: { type: linear, angle: 180, stops: [{ color: "#4f6df5", position: 0 }, { color: "rgba(79,109,245,0)", position: 1 }] }
        - type: box
          background: "#0a0a0a"
          padding: [100, 60]
          verticalAlign: center
          children: [...]
```
