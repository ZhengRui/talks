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
        entrance: { type: fade-up, delay: 0, duration: 500 }
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
  entrance: { type: fade-up, delay: 0, duration: 500 }
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
  entrance: { type: fade-in, delay: 100, duration: 500 }
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
  entrance: { type: fade-in, delay: 0, duration: 500 }
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
  entrance: { type: fade-in, delay: 400, duration: 500 }  # animates entire group
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
  entrance: { type: fade-up, delay: 200, duration: 500 }
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
  entrance: { type: fade-up, delay: 200, duration: 500 }
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
  entrance: { type: fade-up, delay: 200, duration: 500 }
```

### video

Renders a playable `<video>` tag for direct files (.mp4/.webm), or an `<iframe>` embed for YouTube/Vimeo URLs.

```yaml
- kind: video
  id: unique-id
  rect: { x: 160, y: 200, w: 1600, h: 700 }
  src: "demo.mp4"            # .mp4/.webm → <video>, YouTube/Vimeo → <iframe> embed
  poster: "thumbnail.jpg"   # optional preview image
  borderRadius: 12           # optional
  entrance: { type: fade-in, delay: 0, duration: 500 }
```

### iframe

Renders an embedded `<iframe>`. Subject to same-origin restrictions — some sites block framing.

```yaml
- kind: iframe
  id: unique-id
  rect: { x: 160, y: 200, w: 1600, h: 700 }
  src: "https://en.wikipedia.org/wiki/Slide_deck"
  borderRadius: 12           # optional
  entrance: { type: fade-in, delay: 0, duration: 500 }
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

## Theme Palettes

Use the `theme` field at presentation level. You can also override individual colors per-slide via custom `background` and element styles. **Don't just use defaults — adapt and combine.**

### Light Themes

**`modern`** — Clean, professional. Blue accent on near-white.
- bg: `#f8f9fc`, text: `#1a1a2e`, accent: `#4f6df5`, accent2: `#a855f7`
- Fonts: Inter (heading + body), JetBrains Mono (code)
- Radius: 12. Feel: Corporate but friendly.

**`elegant`** — Warm, refined. Gold on parchment.
- bg: `#faf8f5`, text: `#2d2a26`, accent: `#b8860b`, accent2: `#6b4c8a`
- Fonts: Playfair Display (heading), Inter (body)
- Radius: 6. Feel: Bookish, luxurious.

**`paper-ink`** — Literary, thoughtful. Crimson on warm paper.
- bg: `#faf9f7`, text: `#1a1a1a`, accent: `#c41e3a`, accent2: `#8b0000`
- Fonts: Cormorant Garamond (heading), Source Serif 4 (body)
- Radius: 2. Feel: Manuscript, editorial.

**`swiss-modern`** — Precise, minimal. Red on pure white.
- bg: `#ffffff`, text: `#1a1a1a`, accent: `#e63946`, accent2: `#1d3557`
- Fonts: Helvetica Neue (heading + body)
- Radius: 0. Feel: Bauhaus, grid-driven.

**`split-pastel`** — Playful, friendly. Soft peach + lavender.
- bg: `#fef7f0`, text: `#2d2a3e`, accent: `#e8937a`, accent2: `#9b8ec4`
- Fonts: Outfit (heading + body)
- Radius: 16. Feel: Startup, approachable.

**`notebook-tabs`** — Soft, whimsical. Lavender + rose on warm paper.
- bg: `#f8f6f1`, text: `#1a1a1a`, accent: `#c7b8ea`, accent2: `#f4b8c5`
- Fonts: Bodoni Moda (heading), DM Sans (body)
- Radius: 6. Feel: Journaling, stationery.

**`pastel-geometry`** — Cool, structured. Sage green + pink on soft blue.
- bg: `#c8d9e6`, text: `#2a2a2a`, accent: `#5a7c6a`, accent2: `#f0b4d4`
- Fonts: Plus Jakarta Sans (heading + body)
- Radius: 16. Feel: Architecture, modern art.

**`vintage-editorial`** — Classic, print-inspired. Warm tones + strong borders.
- bg: `#f5f3ee`, text: `#1a1a1a`, accent: `#e8d4c0`, accent2: `#c45c5c`
- Fonts: Fraunces (heading), Work Sans (body)
- Radius: 4. Feel: Magazine, editorial.

### Dark Themes

**`bold`** — High-impact, confident. Orange on black.
- bg: `#0a0a0a`, text: `#f5f5f5`, accent: `#ff6b35`, accent2: `#00d4ff`
- Fonts: Inter (heading + body)
- Radius: 4. Feel: Keynote energy, punchy.

**`dark-tech`** — Futuristic. Cyan-green on deep navy.
- bg: `#0a0a12`, text: `#e0e0e0`, accent: `#00ffc8`, accent2: `#7b61ff`
- Fonts: JetBrains Mono (heading), Inter (body)
- Radius: 8. Feel: Terminal meets design.

**`bold-signal`** — Vibrant, modern dark. Coral + electric blue.
- bg: `#1a1a1a`, text: `#f5f5f5`, accent: `#ff6b6b`, accent2: `#4ecdc4`
- Fonts: Inter (heading + body)
- Radius: 8. Feel: Confident tech pitch.

**`electric-studio`** — Bold contrast. Blue accent, black/white panels.
- bg: `#0a0a0a`, text: `#ffffff`, accent: `#4361ee`, accent2: `#6b83f2`
- Fonts: Manrope (heading + body)
- Radius: 8. Feel: Studio, high-contrast.

**`creative-voltage`** — Electric, experimental. Lime-green on dark indigo.
- bg: `#1a1a2e`, text: `#ffffff`, accent: `#d4ff00`, accent2: `#0066ff`
- Fonts: Syne (heading), Space Mono (body)
- Radius: 8. Feel: Experimental, avant-garde.

**`dark-botanical`** — Warm organic. Copper + blush on dark.
- bg: `#0f0f0f`, text: `#e8e4df`, accent: `#d4a574`, accent2: `#e8b4b8`
- Fonts: Cormorant (heading), IBM Plex Sans (body)
- Radius: 8. Feel: Natural luxury, organic.

**`neon-cyber`** — Futuristic, glowing. Magenta on deep purple.
- bg: `#0a0014`, text: `#e0e0ff`, accent: `#ff00ff`, accent2: `#00ffff`
- Fonts: Orbitron (heading), Inter (body)
- Radius: 4. Feel: Sci-fi, cyberpunk.

**`terminal-green`** — Hacker aesthetic. Green phosphor on black.
- bg: `#0a0a0a`, text: `#00ff41`, accent: `#00ff41`, accent2: `#00cc33`
- Fonts: VT323 (heading + body + code)
- Radius: 0. Feel: Retro terminal, developer.

Each theme also provides: `bgSecondary`, `bgTertiary`, `textMuted`, `fontMono`, `cardBg`, `codeBg`, `codeText`, `shadow`, `shadowLg`.

### Using Custom Colors

You can ignore themes entirely and use custom colors per element. Good for matching a brand or creating a unique palette:
```yaml
title: "Custom Palette Deck"
theme: modern  # base theme for fallback
slides:
  - template: freeform
    background: "#1b1f3b"  # custom deep navy
    elements:
      - kind: text
        id: title
        rect: { x: 160, y: 400, w: 1200, h: 120 }
        text: "Think Different"
        style: { fontFamily: "SF Pro Display, Inter, sans-serif", fontSize: 72, fontWeight: 700, color: "#e8c547", lineHeight: 1.1 }
```

## Content Density Limits

| Slide Type | Maximum Content |
|------------|----------------|
| Hero / Title | 1 heading + 1 subtitle + optional accent element |
| Statement | 1 sentence (max 15 words), huge text |
| Split | 1 heading + 4-5 bullets per panel, or 1 heading + 2-3 stats |
| Grid | 1 heading + 4-6 cards (2x2 or 2x3) |
| Data | 1 heading + 3-4 stat blocks, or 1 table |
| Code | 1 heading + 8-10 lines of code |
| Quote | 1 quote (max 3 lines) + attribution |

**Rule:** If content exceeds limits, split into multiple slides. Never cram.

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
  entrance: { type: scale-up, delay: 200, duration: 500 }
- kind: text
  id: stat-label
  rect: { x: 200, y: 430, w: 400, h: 40 }
  text: "Uptime"
  style: { fontFamily: "Inter, sans-serif", fontSize: 20, fontWeight: 400, color: "#64648c", lineHeight: 1.4, textAlign: center }
  entrance: { type: fade-up, delay: 300, duration: 500 }
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
  entrance: { type: fade-in, delay: 100, duration: 500 }
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
  entrance: { type: fade-up, delay: 200, duration: 500 }
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
  entrance: { type: fade-in, delay: 400, duration: 500 }
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
  entrance: { type: fade-in, delay: 100, duration: 500 }
```

## Sizing & Positioning Tips

- **Estimate text height**: `lines * fontSize * lineHeight`. One line of 42px at 1.2 = 50px. Add padding.
- **Estimate text width**: ~0.55 * fontSize * characterCount for proportional fonts. Measure generously.
- **Vertical centering**: Use `verticalAlign: middle` or calculate `y = boxY + (boxH - textH) / 2`.
- **Group children**: Coordinates relative to the group's `rect` origin, not the canvas.
- **z-order**: Later elements render on top. Decorative shapes first, then content, text last.

## Design Anti-Patterns (avoid these)

- **The AI Grid**: 3 equal-width cards centered on every slide. Vary your layouts.
- **Blue everything**: Using the accent color on every element. Restraint creates impact.
- **Uniform animation**: Every element with fade-up at 100ms stagger. Use different types. Leave some static.
- **Centered symmetry**: Everything centered, everything balanced. Off-center creates energy.
- **Wall of text**: More than 6-8 text elements per slide. Split into multiple slides.
- **Tiny elements**: Don't make decorative elements too small to notice. If it's worth adding, make it visible.
- **Same layout twice**: Two consecutive slides with identical composition. Alternate between types.
