# Freeform Slide Generation

Generate presentation slides using the `freeform` template. This template gives you direct control over every element's position, size, style, and animation on a 1920x1080 canvas.

## Slide Structure

```yaml
slides:
  - template: freeform
    background: "#f5f0e8"        # optional, defaults to theme bg
    backgroundImage: "hero.jpg"  # optional, fills canvas
    overlay: "rgba(0,0,0,0.5)"  # optional, over background image
    elements:
      - kind: text
        id: my-title
        rect: { x: 160, y: 200, w: 700, h: 80 }
        text: "Hello World"
        style: { fontFamily: "Inter, sans-serif", fontSize: 42, fontWeight: 700, color: "#1a1a2e", lineHeight: 1.2 }
        animation: { type: fade-up, delay: 0, duration: 500 }
```

## Canvas & Content Area

- **Canvas**: 1920 x 1080 px (16:9)
- **Safe content area**: x: 160..1760, y: 60..1020 (160px horizontal margin, 60px vertical)
- **Center point**: (960, 540)
- All `rect` values are in px. `{x, y}` is top-left corner, `{w, h}` is width/height.

## Element Types

### text

```yaml
- kind: text
  id: unique-id
  rect: { x: 160, y: 200, w: 1600, h: 80 }
  text: "Your text content"
  style:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 42          # px
    fontWeight: 700        # 400=regular, 600=semibold, 700=bold
    color: "#1a1a2e"
    lineHeight: 1.2        # multiplier
    textAlign: left        # left | center | right
    # Optional:
    fontStyle: italic      # normal | italic
    letterSpacing: 2       # px
    textTransform: uppercase  # uppercase | lowercase | none
    verticalAlign: middle  # top | middle | bottom
  animation: { type: fade-up, delay: 0, duration: 500 }
```

### shape

```yaml
- kind: shape
  id: unique-id
  rect: { x: 960, y: 0, w: 960, h: 1080 }
  shape: rect             # rect | circle | line | pill
  style:
    fill: "#1a1714"
    # Or gradient:
    gradient:
      type: linear
      angle: 90
      stops:
        - { color: "#c41e3a", position: 0 }
        - { color: "#c8a96e", position: 1 }
    # Optional:
    stroke: "#ffffff"
    strokeWidth: 2
    borderRadius: 12
    opacity: 0.8
    shadow: { offsetX: 0, offsetY: 4, blur: 24, color: "rgba(0,0,0,0.1)" }
  border: { width: 2, color: "#c41e3a", sides: ["left"] }  # optional
  animation: { type: fade-in, delay: 100, duration: 500 }
```

### image

```yaml
- kind: image
  id: unique-id
  rect: { x: 960, y: 0, w: 960, h: 1080 }
  src: "photo.jpg"         # relative to content/[slug]/images/
  objectFit: cover          # cover | contain
  borderRadius: 12          # optional
  clipCircle: true          # optional, clips to circle
  opacity: 0.9              # optional
  animation: { type: fade-in, delay: 0, duration: 500 }
```

### group

Groups position children relative to the group's rect origin. Use for composite components.

```yaml
- kind: group
  id: seal
  rect: { x: 1340, y: 600, w: 65, h: 65 }
  children:
    - kind: shape
      id: seal-border
      rect: { x: 0, y: 0, w: 65, h: 65 }    # relative to group origin
      shape: rect
      style: { fill: "rgba(0,0,0,0)", stroke: "#c41e3a", strokeWidth: 2, borderRadius: 2 }
    - kind: text
      id: seal-char
      rect: { x: 0, y: 10, w: 65, h: 45 }
      text: "验"
      style: { fontFamily: "Noto Serif SC, serif", fontSize: 28, fontWeight: 700, color: "#c41e3a", lineHeight: 1.0, textAlign: center }
  style:                    # optional, renders as background shape
    fill: "#ffffff"
    borderRadius: 8
    shadow: { offsetX: 0, offsetY: 4, blur: 24, color: "rgba(0,0,0,0.1)" }
  border: { width: 3, color: "#4f6df5", sides: ["left"] }  # optional
  clipContent: true         # optional, clips children to group bounds
  animation: { type: fade-in, delay: 400, duration: 500 }  # animates entire group
```

### code

```yaml
- kind: code
  id: unique-id
  rect: { x: 160, y: 300, w: 1600, h: 400 }
  code: "const x = 42;\nconsole.log(x);"
  language: typescript       # optional
  style:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: 18
    color: "#cdd6f4"
    background: "#1e1e2e"
    borderRadius: 12
    padding: 32
  animation: { type: fade-up, delay: 200, duration: 500 }
```

### table

```yaml
- kind: table
  id: unique-id
  rect: { x: 160, y: 300, w: 1600, h: 500 }
  headers: ["Name", "Score", "Grade"]
  rows:
    - ["Alice", "95", "A"]
    - ["Bob", "87", "B+"]
  headerStyle:
    fontFamily: "Inter, sans-serif"
    fontSize: 18
    fontWeight: 700
    color: "#ffffff"
    lineHeight: 1.4
    background: "#4f6df5"
  cellStyle:
    fontFamily: "Inter, sans-serif"
    fontSize: 16
    fontWeight: 400
    color: "#1a1a2e"
    lineHeight: 1.4
    background: "#ffffff"
    altBackground: "#f8f9fc"
  borderColor: "rgba(0,0,0,0.06)"
  animation: { type: fade-up, delay: 200, duration: 500 }
```

### list

```yaml
- kind: list
  id: unique-id
  rect: { x: 160, y: 300, w: 1600, h: 400 }
  items: ["First item", "Second item", "Third item"]
  ordered: false
  itemStyle:
    fontFamily: "Inter, sans-serif"
    fontSize: 22
    fontWeight: 400
    color: "#1a1a2e"
    lineHeight: 1.6
  bulletColor: "#4f6df5"    # optional
  itemSpacing: 16
  animation: { type: fade-up, delay: 200, duration: 500 }
```

## Animations

All elements support an optional `animation` property:

| Type | Effect | Best for |
|------|--------|----------|
| `fade-up` | Fade in + slide up 30px | Titles, body text, cards |
| `fade-in` | Fade in (no motion) | Background shapes, images |
| `slide-left` | Fade + slide from left 60px | Left-panel content |
| `slide-right` | Fade + slide from right 60px | Right-panel content |
| `scale-up` | Fade + scale from 85% to 100% | Stats, hero numbers |
| `count-up` | Number count-up (web only) | Stat values |
| `none` | No animation | Static elements |

**Stagger pattern**: Increment `delay` by 100-150ms between sequential elements for a cascading reveal effect. Start at delay: 0 for the first element.

## Common Themes (quick reference)

Use the `theme` field at presentation level. The theme determines default background, colors, and fonts.

| Theme | Background | Text | Accent | Heading Font |
|-------|-----------|------|--------|-------------|
| `modern` | #f8f9fc | #1a1a2e | #4f6df5 | Inter |
| `bold` | #0a0a0a | #f5f5f5 | #ff6b35 | Inter |
| `elegant` | #faf8f5 | #2d2a26 | #b8860b | Playfair Display |
| `dark-tech` | #0a0a12 | #e0e0e0 | #00ffc8 | JetBrains Mono |
| `paper-ink` | #faf9f7 | #1a1a1a | #c41e3a | Cormorant Garamond |
| `swiss-modern` | #ffffff | #1a1a1a | #e63946 | Helvetica Neue |
| `neon-cyber` | #0a0014 | #e0e0ff | #ff00ff | Orbitron |
| `terminal-green` | #0a0a0a | #00ff41 | #00ff41 | VT323 |

Each theme also provides: `bgSecondary`, `bgTertiary`, `textMuted`, `accent2`, `fontBody`, `fontMono`, `radius`, `radiusSm`, `cardBg`, `codeBg`, `codeText`.

## Component Recipes

### Split layout (dark/light panels)

```yaml
- template: freeform
  background: "#f5f0e8"
  elements:
    # Dark right panel
    - kind: shape
      id: dark-panel
      rect: { x: 960, y: 0, w: 960, h: 1080 }
      shape: rect
      style: { fill: "#1a1714" }
    # Content on left panel...
    # Content on right panel...
```

### Stat block

```yaml
- kind: text
  id: stat-value
  rect: { x: 200, y: 300, w: 400, h: 120 }
  text: "99%"
  style: { fontFamily: "Inter, sans-serif", fontSize: 96, fontWeight: 700, color: "#4f6df5", lineHeight: 1.0, textAlign: center }
  animation: { type: scale-up, delay: 200, duration: 500 }
- kind: text
  id: stat-label
  rect: { x: 200, y: 430, w: 400, h: 40 }
  text: "Uptime"
  style: { fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 400, color: "#64648c", lineHeight: 1.4, textAlign: center }
  animation: { type: fade-up, delay: 300, duration: 500 }
```

### Accent line (gradient divider)

```yaml
- kind: shape
  id: accent
  rect: { x: 160, y: 290, w: 120, h: 3 }
  shape: rect
  style:
    gradient:
      type: linear
      angle: 90
      stops:
        - { color: "#4f6df5", position: 0 }
        - { color: "#a855f7", position: 1 }
  animation: { type: fade-in, delay: 100, duration: 500 }
```

### Card with left border

```yaml
- kind: group
  id: card-1
  rect: { x: 160, y: 300, w: 760, h: 180 }
  children:
    - kind: text
      id: card-title
      rect: { x: 24, y: 20, w: 712, h: 40 }
      text: "Card Title"
      style: { fontFamily: "Inter, sans-serif", fontSize: 24, fontWeight: 700, color: "#0f0f23", lineHeight: 1.3 }
    - kind: text
      id: card-body
      rect: { x: 24, y: 68, w: 712, h: 80 }
      text: "Card body text goes here with more detail."
      style: { fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 400, color: "#64648c", lineHeight: 1.6 }
  style: { fill: "#ffffff", borderRadius: 8, shadow: { offsetX: 0, offsetY: 4, blur: 24, color: "rgba(0,0,0,0.06)" } }
  border: { width: 3, color: "#4f6df5", sides: ["left"] }
  animation: { type: fade-up, delay: 200, duration: 500 }
```

### Seal / stamp

```yaml
- kind: group
  id: seal
  rect: { x: 1340, y: 600, w: 65, h: 65 }
  children:
    - kind: shape
      id: seal-border
      rect: { x: 0, y: 0, w: 65, h: 65 }
      shape: rect
      style: { fill: "rgba(0,0,0,0)", stroke: "#c41e3a", strokeWidth: 2, borderRadius: 2 }
    - kind: text
      id: seal-char
      rect: { x: 0, y: 10, w: 65, h: 45 }
      text: "验"
      style: { fontFamily: "Noto Serif SC, serif", fontSize: 28, fontWeight: 700, color: "#c41e3a", lineHeight: 1.0, textAlign: center }
  animation: { type: fade-in, delay: 400, duration: 500 }
```

### Tag / pill

```yaml
- kind: group
  id: tag-1
  rect: { x: 160, y: 200, w: 120, h: 36 }
  children:
    - kind: shape
      id: tag-bg
      rect: { x: 0, y: 0, w: 120, h: 36 }
      shape: pill
      style: { fill: "rgba(79,109,245,0.1)" }
    - kind: text
      id: tag-text
      rect: { x: 0, y: 0, w: 120, h: 36 }
      text: "NEW"
      style: { fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, color: "#4f6df5", lineHeight: 1.0, textAlign: center, verticalAlign: middle, letterSpacing: 1, textTransform: uppercase }
  animation: { type: fade-in, delay: 100, duration: 500 }
```

## Tips

- **IDs must be unique** across all elements in a slide.
- **Group children** use coordinates relative to the group's `rect` origin, not the canvas.
- **Estimate text height**: `lines * fontSize * lineHeight`. One line of 42px text at lineHeight 1.2 = 50px. Add padding.
- **Estimate text width**: ~0.55 * fontSize * characterCount for proportional fonts. Measure generously.
- **Vertical centering**: To vertically center text in a box, use `verticalAlign: middle` or calculate `y = boxY + (boxH - textH) / 2`.
- **z-order**: Elements later in the array render on top. Put background shapes first, text last.
- **Animations on groups**: Animate the group, not individual children. All children animate together.
- **Dark panels**: Use a full-height shape as the first element, then place light-colored text on top.
- **PPTX export**: All elements export to PowerPoint. Avoid `count-up` (web-only). Keep animation durations 400-600ms.
