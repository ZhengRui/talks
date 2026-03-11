---
name: replicate-layout
description: Use when replicating the layout skeleton of a slide from a screenshot. Produces a raw IR wireframe with colored shapes at exact pixel coordinates — no content, just the spatial skeleton. Use this to verify proportions before full replication with replicate-slides.
---

# Layout Replication

Replicate the spatial skeleton of a slide as a colored wireframe using raw IR elements on a 1920×1080 canvas. Every visual region becomes a colored `shape` at exact pixel coordinates with a `text` label. Think of it as absolute-positioned HTML divs — you control every pixel. See [../replicate-slides/reference.md](../replicate-slides/reference.md) for the complete IR element reference.

## Pipeline Position

```
Screenshot → replicate-layout → wireframe YAML → replicate-slides → final slide
```

This skill produces the spatial scaffold. `replicate-slides` fills it in with real content later.

## Input

Accept any combination — adapt analysis to whatever's provided:

| Input | What it gives you | Priority |
|-------|-------------------|----------|
| Screenshot (PNG/JPG path) | Visual composition, layout structure, approximate sizes | Baseline |
| HTML file | Exact CSS values — sizes, padding, flex/grid layout, split ratios | Source of truth for exact values |
| Verbal description | User corrections ("left panel is 65%", "cards are 2×2 grid") | Overrides everything |

When inputs conflict: **description > HTML > screenshot**.

**Required context:** Ask for the presentation slug if not obvious — needed for appending to the right `slides.yaml`.

## Core Principle: Raw Freeform Wireframe

Every visual region becomes a raw IR `shape` (rect) at exact pixel coordinates with a `text` label centered inside it. The entire slide is one `raw` component covering the full 1920×1080 canvas.

**Mental model:** You are placing colored rectangles on a blank canvas, exactly like `position: absolute` in CSS. No layout engine, no hidden defaults, no component assumptions. You control every pixel.

**Why raw over components:**
- No hidden padding (box default: 28px)
- No variant surprises (card vs flat vs panel)
- No flex/grid distribution guessing
- Exact pixel positioning — what you write is what renders

## Color Coding Convention

| Region type | Fill | Use for |
|-------------|------|---------|
| Content area | `#2a2a3a` | Text blocks — heading, body, tag, subtitle regions |
| Panel / sidebar | `#1a1a2a` | Distinct background panels, secondary areas |
| Card / item | `#3a3a4a` | Repeated items — cards, list items, stat blocks |
| Decorative | `#4a3a2a` | Accent strips, dividers, decorative shapes |
| Image | `#2a3a2a` | Image placeholders |

All labels use `fontSize: 18`, `color: "#888"`, `textAlign: center`, `verticalAlign: middle`.

## Breathing Animation

Every placeholder shape gets a staggered pulse animation. Use the `animation` CSS shorthand on each element:

```yaml
animation: "pulse 2s ease-in-out <delay>s infinite"
```

Stagger by **0.1s** per element, incrementing top-to-bottom, left-to-right.

## Two-Phase Process

### Phase 1: Analyze Layout

Examine the source and produce a structured breakdown of spatial regions with **exact pixel coordinates**.

**Analysis format:**

```
LAYOUT ANALYSIS:
  Canvas: 1920×1080
  Background: [color]
  Regions:
    - [region name] → rect(x, y, w, h) → [region type]
    - [region name] → rect(x, y, w, h) → [region type]
    - ...
  Notes: [any centering, alignment, or spacing patterns observed]
```

**What to detect:**
- Every distinct visual region with its bounding rectangle (x, y, width, height)
- Background color of the slide
- How content is distributed (centered, top-aligned, grid pattern, etc.)
- Gap and padding patterns between regions
- Decorative elements (accent strips, dividers, borders)

**How to calculate coordinates:**
- Canvas is 1920×1080. Estimate regions as fractions of the canvas.
- A "centered heading" might be: `rect(460, 200, 1000, 60)` — centered horizontally (960 - 500 = 460), at y=200
- A "left 60% panel" is: `rect(0, 0, 1152, 1080)` — 60% of 1920 = 1152
- A "2×2 card grid with 20px gap starting at y=400": compute each card's rect individually

### Phase 2: Build Wireframe

Place all regions as raw IR elements on the canvas:

```yaml
- background: "<slide-bg-color>"
  children:
    - type: raw
      position: "absolute"
      x: 0
      y: 0
      width: 1920
      height: 1080
      elements:
        # Each region: shape + label
        - kind: shape
          id: <region-name>
          rect: { x: <x>, y: <y>, w: <w>, h: <h> }
          shape: rect
          borderRadius: <0-12>
          style: { fill: "<color-code>" }
          animation: "pulse 2s ease-in-out <delay>s infinite"
        - kind: text
          id: <region-name>-label
          rect: { x: <x>, y: <y>, w: <w>, h: <h> }
          text: "<LABEL>"
          style:
            fontSize: 18
            color: "#888"
            textAlign: center
            verticalAlign: middle
```

**Rules:**
1. One `raw` component covers the entire canvas — all elements go inside it
2. Each visual region = one `shape` (rect) + one `text` (label) at the same coordinates
3. Use `borderRadius` to match rounded corners in the original
4. Shapes render in YAML order — later shapes appear on top
5. Place background panels first, then content regions on top

## Output Format

**CRITICAL:** The output must be a complete, valid `slides.yaml` file with the required top-level structure:

```yaml
title: "<presentation title>"
theme: <theme-name>
slides:
  - background: "<slide-bg-color>"
    children:
      - type: raw
        ...
```

The `title`, `theme`, and `slides:` wrapper are required. Without them, the dev server will crash. If the file already exists, preserve the existing `title` and `theme` and append the new slide under `slides:`.

## Workflow Summary

1. Receive screenshot (+ optional HTML/description) + presentation slug
2. Phase 1: Output `LAYOUT ANALYSIS` with pixel coordinates for every region
3. Phase 2: Build raw IR wireframe with shapes + labels
4. Output complete `slides.yaml` with `title`/`theme`/`slides:` wrapper
5. User renders and compares wireframe against original

All phases happen in one invocation. Show the analysis, then the final YAML.

## Examples

### Example 1: Single-Column Centered Hero

**Input:** Dark slide with centered heading and subtitle.

**Phase 1 — Analyze:**

```
LAYOUT ANALYSIS:
  Canvas: 1920×1080
  Background: #0a0a0a
  Regions:
    - Heading → rect(460, 480, 1000, 60) → content area
    - Subtitle → rect(560, 560, 800, 30) → content area
  Notes: Both centered horizontally and vertically as a group
```

**Phase 2 — Build:**

```yaml
title: "Layout Wireframe"
theme: bold
slides:
  - background: "#0a0a0a"
    children:
      - type: raw
        position: "absolute"
        x: 0
        y: 0
        width: 1920
        height: 1080
        elements:
          - kind: shape
            id: heading
            rect: { x: 460, y: 480, w: 1000, h: 60 }
            shape: rect
            borderRadius: 4
            style: { fill: "#2a2a3a" }
            animation: "pulse 2s ease-in-out infinite"
          - kind: text
            id: heading-label
            rect: { x: 460, y: 480, w: 1000, h: 60 }
            text: "HEADING"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }

          - kind: shape
            id: subtitle
            rect: { x: 560, y: 560, w: 800, h: 30 }
            shape: rect
            borderRadius: 4
            style: { fill: "#2a2a3a" }
            animation: "pulse 2s ease-in-out 0.1s infinite"
          - kind: text
            id: subtitle-label
            rect: { x: 560, y: 560, w: 800, h: 30 }
            text: "SUBTITLE"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }
```

### Example 2: Two-Panel Split with Cards

**Input:** Left 60% has tag + heading + body + 2×2 card grid. Right 40% has a dark panel with stats. Light background.

**Phase 1 — Analyze:**

```
LAYOUT ANALYSIS:
  Canvas: 1920×1080
  Background: #1c1d35
  Regions:
    - Tag → rect(220, 180, 200, 24) → content area
    - Heading → rect(220, 220, 700, 52) → content area
    - Divider → rect(220, 292, 80, 4) → decorative
    - Body → rect(220, 316, 500, 55) → content area
    - Card 1 → rect(220, 400, 280, 115) → card
    - Card 2 → rect(520, 400, 280, 115) → card
    - Card 3 → rect(220, 535, 280, 115) → card
    - Card 4 → rect(520, 535, 280, 115) → card
    - Right panel bg → rect(860, 0, 1060, 1080) → panel
    - Right inner panel → rect(900, 300, 400, 400) → panel
    - Icon → rect(1050, 320, 100, 65) → card
    - Panel title → rect(940, 400, 320, 26) → content area
    - Bar 1 → rect(940, 450, 320, 26) → card
    - Bar 2 → rect(940, 490, 320, 26) → card
    - Bar 3 → rect(940, 530, 320, 26) → card
    - Bar 4 → rect(940, 570, 320, 26) → card
  Notes: Left content top-padded ~180px. Right panel has darker bg, inner content vertically centered within panel.
```

**Phase 2 — Build:**

```yaml
title: "Layout Wireframe"
theme: bold
slides:
  - background: "#1c1d35"
    children:
      - type: raw
        position: "absolute"
        x: 0
        y: 0
        width: 1920
        height: 1080
        elements:
          # Right panel background (rendered first, behind everything)
          - kind: shape
            id: right-panel-bg
            rect: { x: 860, y: 0, w: 1060, h: 1080 }
            shape: rect
            style: { fill: "#1a1a2a" }

          # Left content
          - kind: shape
            id: tag
            rect: { x: 220, y: 180, w: 200, h: 24 }
            shape: rect
            borderRadius: 4
            style: { fill: "#2a2a3a" }
            animation: "pulse 2s ease-in-out infinite"
          - kind: text
            id: tag-label
            rect: { x: 220, y: 180, w: 200, h: 24 }
            text: "TAG"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }

          - kind: shape
            id: heading
            rect: { x: 220, y: 220, w: 700, h: 52 }
            shape: rect
            borderRadius: 4
            style: { fill: "#2a2a3a" }
            animation: "pulse 2s ease-in-out 0.1s infinite"
          - kind: text
            id: heading-label
            rect: { x: 220, y: 220, w: 700, h: 52 }
            text: "HEADING"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }

          - kind: shape
            id: divider
            rect: { x: 220, y: 292, w: 80, h: 4 }
            shape: rect
            style: { fill: "#4a3a2a" }
            animation: "pulse 2s ease-in-out 0.2s infinite"

          - kind: shape
            id: body
            rect: { x: 220, y: 316, w: 500, h: 55 }
            shape: rect
            borderRadius: 4
            style: { fill: "#2a2a3a" }
            animation: "pulse 2s ease-in-out 0.3s infinite"
          - kind: text
            id: body-label
            rect: { x: 220, y: 316, w: 500, h: 55 }
            text: "BODY TEXT"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }

          # Card grid (2×2)
          - kind: shape
            id: card-1
            rect: { x: 220, y: 400, w: 280, h: 115 }
            shape: rect
            borderRadius: 10
            style: { fill: "#3a3a4a" }
            animation: "pulse 2s ease-in-out 0.4s infinite"
          - kind: text
            id: card-1-label
            rect: { x: 220, y: 400, w: 280, h: 115 }
            text: "CARD 1"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }

          - kind: shape
            id: card-2
            rect: { x: 520, y: 400, w: 280, h: 115 }
            shape: rect
            borderRadius: 10
            style: { fill: "#3a3a4a" }
            animation: "pulse 2s ease-in-out 0.5s infinite"
          - kind: text
            id: card-2-label
            rect: { x: 520, y: 400, w: 280, h: 115 }
            text: "CARD 2"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }

          - kind: shape
            id: card-3
            rect: { x: 220, y: 535, w: 280, h: 115 }
            shape: rect
            borderRadius: 10
            style: { fill: "#3a3a4a" }
            animation: "pulse 2s ease-in-out 0.6s infinite"
          - kind: text
            id: card-3-label
            rect: { x: 220, y: 535, w: 280, h: 115 }
            text: "CARD 3"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }

          - kind: shape
            id: card-4
            rect: { x: 520, y: 535, w: 280, h: 115 }
            shape: rect
            borderRadius: 10
            style: { fill: "#3a3a4a" }
            animation: "pulse 2s ease-in-out 0.7s infinite"
          - kind: text
            id: card-4-label
            rect: { x: 520, y: 535, w: 280, h: 115 }
            text: "CARD 4"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }

          # Right panel inner
          - kind: shape
            id: right-inner
            rect: { x: 900, y: 300, w: 400, h: 400 }
            shape: rect
            borderRadius: 14
            style: { fill: "rgba(255,255,255,0.05)" }

          - kind: shape
            id: icon
            rect: { x: 1050, y: 320, w: 100, h: 65 }
            shape: rect
            borderRadius: 6
            style: { fill: "#3a3a4a" }
            animation: "pulse 2s ease-in-out 0.2s infinite"
          - kind: text
            id: icon-label
            rect: { x: 1050, y: 320, w: 100, h: 65 }
            text: "ICON"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }

          - kind: shape
            id: panel-title
            rect: { x: 940, y: 400, w: 320, h: 26 }
            shape: rect
            borderRadius: 4
            style: { fill: "#2a2a3a" }
            animation: "pulse 2s ease-in-out 0.3s infinite"
          - kind: text
            id: panel-title-label
            rect: { x: 940, y: 400, w: 320, h: 26 }
            text: "PANEL TITLE"
            style: { fontSize: 14, color: "#888", textAlign: center, verticalAlign: middle }

          - kind: shape
            id: bar-1
            rect: { x: 940, y: 450, w: 320, h: 26 }
            shape: rect
            borderRadius: 4
            style: { fill: "#3a3a4a" }
            animation: "pulse 2s ease-in-out 0.4s infinite"
          - kind: text
            id: bar-1-label
            rect: { x: 940, y: 450, w: 320, h: 26 }
            text: "BAR 1"
            style: { fontSize: 14, color: "#888", textAlign: center, verticalAlign: middle }

          - kind: shape
            id: bar-2
            rect: { x: 940, y: 490, w: 320, h: 26 }
            shape: rect
            borderRadius: 4
            style: { fill: "#3a3a4a" }
            animation: "pulse 2s ease-in-out 0.5s infinite"
          - kind: text
            id: bar-2-label
            rect: { x: 940, y: 490, w: 320, h: 26 }
            text: "BAR 2"
            style: { fontSize: 14, color: "#888", textAlign: center, verticalAlign: middle }

          - kind: shape
            id: bar-3
            rect: { x: 940, y: 530, w: 320, h: 26 }
            shape: rect
            borderRadius: 4
            style: { fill: "#3a3a4a" }
            animation: "pulse 2s ease-in-out 0.6s infinite"
          - kind: text
            id: bar-3-label
            rect: { x: 940, y: 530, w: 320, h: 26 }
            text: "BAR 3"
            style: { fontSize: 14, color: "#888", textAlign: center, verticalAlign: middle }

          - kind: shape
            id: bar-4
            rect: { x: 940, y: 570, w: 320, h: 26 }
            shape: rect
            borderRadius: 4
            style: { fill: "#3a3a4a" }
            animation: "pulse 2s ease-in-out 0.7s infinite"
          - kind: text
            id: bar-4-label
            rect: { x: 940, y: 570, w: 320, h: 26 }
            text: "BAR 4"
            style: { fontSize: 14, color: "#888", textAlign: center, verticalAlign: middle }
```

### Example 3: Horizontal Card Row with Heading

**Input:** Light slide with centered heading at top, 5 vertical cards in a horizontal row, each card has icon area + number circle + caption + divider + description.

**Phase 1 — Analyze:**

```
LAYOUT ANALYSIS:
  Canvas: 1920×1080
  Background: #f0f0f0
  Regions:
    - Heading → rect(660, 50, 600, 50) → content area
    - Card 1 → rect(100, 180, 320, 720) → card
      - Icon → rect(120, 200, 280, 200) → image
      - Number → rect(230, 420, 60, 60) → decorative
      - Caption → rect(140, 500, 240, 30) → content area
      - Divider → rect(240, 545, 40, 4) → decorative
      - Description → rect(130, 565, 260, 60) → content area
    - Card 2 → rect(440, 180, 320, 720) → card
      - (same internal layout, offset by 340px)
    - Card 3 → rect(780, 180, 320, 720) → card
    - Card 4 → rect(1120, 180, 320, 720) → card
    - Card 5 → rect(1460, 180, 320, 720) → card
  Notes: 5 equal cards, 20px gaps, horizontally centered. Each card has identical internal layout.
```

**Phase 2 — Build:**

```yaml
title: "Layout Wireframe"
theme: bold
slides:
  - background: "#f0f0f0"
    children:
      - type: raw
        position: "absolute"
        x: 0
        y: 0
        width: 1920
        height: 1080
        elements:
          # Heading
          - kind: shape
            id: heading
            rect: { x: 660, y: 50, w: 600, h: 50 }
            shape: rect
            borderRadius: 4
            style: { fill: "#2a2a3a" }
            animation: "pulse 2s ease-in-out infinite"
          - kind: text
            id: heading-label
            rect: { x: 660, y: 50, w: 600, h: 50 }
            text: "HEADING"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }

          # Card 1
          - kind: shape
            id: card-1-bg
            rect: { x: 100, y: 180, w: 320, h: 720 }
            shape: rect
            borderRadius: 12
            style: { fill: "#3a3a4a" }
          - kind: shape
            id: card-1-icon
            rect: { x: 120, y: 200, w: 280, h: 200 }
            shape: rect
            borderRadius: 8
            style: { fill: "#2a3a2a" }
            animation: "pulse 2s ease-in-out 0.1s infinite"
          - kind: text
            id: card-1-icon-label
            rect: { x: 120, y: 200, w: 280, h: 200 }
            text: "ICON"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }
          - kind: shape
            id: card-1-num
            rect: { x: 230, y: 420, w: 60, h: 60 }
            shape: circle
            style: { fill: "#4a3a2a" }
            animation: "pulse 2s ease-in-out 0.2s infinite"
          - kind: text
            id: card-1-num-label
            rect: { x: 230, y: 420, w: 60, h: 60 }
            text: "01"
            style: { fontSize: 18, color: "#888", textAlign: center, verticalAlign: middle }
          - kind: shape
            id: card-1-caption
            rect: { x: 140, y: 500, w: 240, h: 30 }
            shape: rect
            borderRadius: 4
            style: { fill: "#2a2a3a" }
            animation: "pulse 2s ease-in-out 0.3s infinite"
          - kind: shape
            id: card-1-divider
            rect: { x: 240, y: 545, w: 40, h: 4 }
            shape: rect
            style: { fill: "#4a3a2a" }
          - kind: shape
            id: card-1-desc
            rect: { x: 130, y: 565, w: 260, h: 60 }
            shape: rect
            borderRadius: 4
            style: { fill: "#2a2a3a" }
            animation: "pulse 2s ease-in-out 0.4s infinite"

          # Cards 2-5 follow same pattern, offset +340px each
          # (abbreviated — full output would list all elements for each card)
```
