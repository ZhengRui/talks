---
name: replicate-slides
description: Use when replicating an existing slide from a screenshot, HTML file, or verbal description. Analyzes the source visually, then composes pixel-accurate YAML using raw IR elements and selective components. Complementary to create-slides — this skill works from visual sources rather than intent.
---

# Slide Replication

Replicate slides from visual sources into the YAML presentation system. Outputs pixel-accurate slides using raw IR elements for layout/decoration and components for structured content. See [reference.md](reference.md) for the complete IR element reference, CSS-to-IR translation table, and component defaults.

## Input

Accept any combination — adapt analysis to whatever's provided:

| Input | What it gives you | Priority |
|-------|-------------------|----------|
| Screenshot (PNG/JPG path) | Visual composition, layout structure, approximate colors/sizes | Baseline |
| HTML file | Exact CSS values — colors, fonts, sizes, padding, flex/grid layout | Source of truth for exact values |
| Verbal description | User corrections, intent, emphasis ("left panel is 65%", "accent is coral") | Overrides everything |

When inputs conflict: **description > HTML > screenshot**.

**Required context:** Ask for the presentation slug if not obvious — needed for image paths and appending to the right `slides.yaml`.

## Core Principle: Raw-First Composition

Think of each slide as a 1920x1080 canvas. Place elements at exact pixel coordinates using raw IR elements — the same mental model as absolute-positioned HTML divs. Use components only when they genuinely simplify complex rendering (bullets with card styling, code blocks, tables, stats).

```
Raw IR elements  → position, decoration, precise text
Components       → structured content with complex internal layout
```

## Three-Phase Pipeline

```
Source (screenshot / HTML / description)
  ↓ Phase 1: Analyze
Structured element inventory (layout, typography, colors, spacing)
  ↓ Phase 2: Build
Raw IR + selective components composed on the canvas
  ↓ Phase 3: Instantiate
Concrete slide YAML ready to paste into slides.yaml
```

### Phase 1: Analyze

Examine the source and produce a structured breakdown of every visual element. Output this as text so the user can verify what was detected.

**Analysis format:**

```
ANALYSIS:
  Layout type: [single-column | two-panel | grid | hero-centered | freeform]
  Background: [color/gradient/image + overlay]
  Element inventory:
    - [element description] → [approximate rect or region] → [raw | component:type]
    - ...
  Typography:
    - Heading: [size, weight, color, font]
    - Body: [size, weight, color, font]
    - Accent: [size, weight, color, font]
  Colors: [palette list with hex values]
  Spacing: [key gaps and padding in px]
  Decorative elements: [gradients, watermarks, shapes, dividers]
```

**What to detect:**
- Layout structure (single column, split ratio, grid, absolute overlaps)
- Every text element with approximate font family, size, weight, color, alignment
- Every non-text element (shapes, images, dividers, decorative accents)
- Background treatment (solid, gradient, image, overlay)
- Spacing patterns (padding, gaps, margins)
- Animation cues if visible (stagger order, entrance direction)
- Rich text (inline color, bold, mixed styles within a single text block)
- Flag elements that need pixel-precise placement (raw IR) vs semantic rendering (components)

### Phase 2: Build

**Step 1 — Check for exact template match:**

Compare analysis against built-in templates (see reference.md, Template Structural Signatures). Match requires BOTH: same element types/count/arrangement AND visual fidelity achievable via style overrides. If match found, use template and skip to Phase 3.

**Step 2 — Compose with raw IR + selective components:**

If no template match, build the slide as a component tree:

1. Start with slide-level properties (`background`, `backgroundImage`, `overlay`, `theme`)
2. Create a top-level `box` (`variant: flat`, `padding: 0`, `height: 1080`) as the slide container
3. For each visual region:
   - **Background panels/shapes** — `raw` component with shape elements at exact coordinates
   - **Decorative elements** (gradients, watermarks, lines) — `raw` component with `position: absolute`
   - **Text at precise positions** — `raw` component with text elements
   - **Bullet lists** — `bullets` component (`card`/`plain`/`list` variants handle complex internal layout)
   - **Code blocks** — `code` component
   - **Stats (value + label)** — `stat` component
   - **Tables** — `table` component (or raw for full control)
   - **Two-panel splits** — `box` with flex-row layout + two child boxes
   - **Equal-width columns/grids** — `box` with flex-row or `grid` component
   - **Vertically centered content** — `box` with `verticalAlign: center`
4. Reference [reference.md](reference.md) for exact property schemas, defaults, and CSS-to-IR mappings

**Step 3 — Extract template (optional):**

If this layout pattern will be reused across multiple slides, extract into a `.template.yaml` file in `content/[slug]/templates/`. Otherwise, output as inline component tree.

### Phase 3: Instantiate

Produce the final YAML to append to `content/[slug]/slides.yaml`.

For template matches:

```yaml
- template: stats
  title: "Key Metrics"
  stats:
    - value: "907"
      label: "Year of Tang's Fall"
```

For raw-first compositions (inline):

```yaml
- background: "#0a0a0a"
  children:
    - type: box
      variant: flat
      padding: 0
      height: 1080
      children:
        - type: raw
          position: "absolute"
          x: 0
          y: 0
          width: 1920
          height: 4
          elements:
            - kind: shape
              id: accent-strip
              rect: { x: 0, y: 0, w: 1920, h: 4 }
              shape: rect
              style:
                gradient: { type: linear, angle: 90, stops: [{ color: "#ff6b35", position: 0 }, { color: "#00d4ff", position: 1 }] }
        - type: heading
          text: "Title Here"
          fontSize: 56
          textAlign: center
          color: "#ffffff"
```

## Workflow Summary

1. Receive source (screenshot, HTML, description — whatever's provided) + presentation slug
2. Phase 1: Produce the structured `ANALYSIS` block
3. Phase 2: Check templates, then compose raw-first if no match
4. Phase 3: Output complete YAML ready to paste into `slides.yaml`

All phases happen in one invocation. Show the analysis, then the build reasoning, then the final YAML.

## Examples

### Example 1: Existing Template Match

**Input:** Screenshot of a slide with a heading, a horizontal divider, and 4 bullet points in card style on a dark background.

**Phase 1 — Analyze:**

```
ANALYSIS:
  Layout type: single-column
  Background: #0f0f0f solid
  Element inventory:
    - Heading "Platform Overview" → top-center, ~y:180 → component:heading
    - Horizontal divider, gradient blue-to-purple → y:280, w:200 → component:divider
    - 4 bullet cards, vertical stack → y:340..920 → component:bullets
  Typography:
    - Heading: 48px, bold, #ffffff, Inter
    - Bullet title: 24px, semibold, #ffffff
    - Bullet body: 18px, regular, #a0a0a0
  Colors: #0f0f0f, #ffffff, #a0a0a0, #3b82f6, #8b5cf6
  Spacing: 40px gap between cards, 60px horizontal padding
  Decorative elements: gradient divider under heading
```

**Phase 2 — Build:**

Matches `bullets` template — same structure (heading + divider + bullet list with card styling). The template's style overrides cover the colors and gradient divider.

**Phase 3 — Instantiate:**

```yaml
- template: bullets
  title: "Platform Overview"
  divider: gradient
  bullets:
    - title: "Real-time Processing"
      body: "Sub-millisecond event processing with automatic scaling across regions"
    - title: "Built-in Observability"
      body: "Distributed tracing, metrics, and structured logging out of the box"
    - title: "Zero-Downtime Deploys"
      body: "Rolling deployments with automatic canary analysis and rollback"
    - title: "Multi-Region by Default"
      body: "Active-active replication with conflict-free data synchronization"
```

### Example 2: Raw-First Two-Panel Split

**Input:** Screenshot of a slide with:
- Full-width gradient strip at the very top (4px, orange-to-cyan)
- Left 65% of slide: tag label, large heading with one word in accent color, gradient divider, body paragraph
- Right 35%: dark panel (#1a1714) with two large stats vertically centered

**Phase 1 — Analyze:**

```
ANALYSIS:
  Layout type: two-panel (65/35 split)
  Background: #0f0a05 solid
  Element inventory:
    - Gradient accent strip → full width, y:0, h:4 → raw (position: absolute)
    - Tag "CHAPTER 03" → left panel, y:~160 → component:tag
    - Heading "The Fall of an Empire" → left, y:~220, "Empire" in #ff6b35 → component:heading (richText)
    - Gradient divider → left, y:~310, w:120 → component:divider
    - Body paragraph → left, y:~360, max-w:~560 → component:body
    - Stat "907 CE" / "Year of Collapse" → right panel, upper → component:stat
    - Stat "289" / "Years of Reign" → right panel, lower → component:stat
    - Dark background panel → right 35%, full height → box with background
  Typography:
    - Tag: 14px, bold, uppercase, #ff6b35
    - Heading: 52px, bold, #ffffff, "Empire" in #ff6b35
    - Body: 20px, regular, #b0a898, line-height 1.6
    - Stat value: 56px, bold, #ff6b35
    - Stat label: 16px, regular, #8a8078
  Colors: #0f0a05, #1a1714, #ffffff, #ff6b35, #00d4ff, #b0a898, #8a8078
  Spacing: left padding 80px vertical / 80px horizontal, right panel padding 60px, 24px gap between elements
  Decorative elements: 4px gradient strip (orange-to-cyan) at top edge
```

**Phase 2 — Build:**

No template match — two-panel layout with mixed raw decoration + components is not covered by any built-in template. Compose raw-first:

- Slide background: `#0f0a05`
- Top-level `box` (flat, padding: 0, height: 1080, flex-row)
  - Left child `box` (width: 1250, padding: [160, 80, 80, 80]) — tag, heading with richText, divider, body
  - Right child `box` (background: #1a1714, verticalAlign: center, padding: [80, 60]) — two stat components
- Decorative gradient strip: `raw` component at position absolute y:0, spanning full width

**Phase 3 — Instantiate:**

```yaml
- background: "#0f0a05"
  children:
    - type: box
      variant: flat
      padding: 0
      height: 1080
      layout: { type: flex, direction: row }
      children:
        # Decorative gradient strip at top edge
        - type: raw
          position: "absolute"
          x: 0
          y: 0
          width: 1920
          height: 4
          elements:
            - kind: shape
              id: top-accent
              rect: { x: 0, y: 0, w: 1920, h: 4 }
              shape: rect
              style:
                gradient:
                  type: linear
                  angle: 90
                  stops:
                    - { color: "#ff6b35", position: 0 }
                    - { color: "#00d4ff", position: 1 }

        # Left panel — text content
        - type: box
          variant: flat
          width: 1250
          padding: [160, 80, 80, 80]
          layout: { type: flex, direction: column, gap: 24 }
          children:
            - type: tag
              text: "CHAPTER 03"
              color: "#ff6b35"
            - type: heading
              text:
                - text: "The Fall of an "
                  color: "#ffffff"
                - text: "Empire"
                  color: "#ff6b35"
              fontSize: 52
            - type: divider
              variant: gradient
              width: 120
            - type: text
              text: "The Tang Dynasty's collapse in 907 CE marked the end of what many historians consider China's golden age. Internal rebellions, regional warlords, and economic strain combined to fracture an empire that had endured for nearly three centuries."
              fontSize: 20
              color: "#b0a898"
              lineHeight: 1.6
              maxWidth: 560

        # Right panel — stats on dark background
        - type: box
          variant: flat
          background: "#1a1714"
          verticalAlign: center
          padding: [80, 60]
          layout: { type: flex, direction: column, gap: 64 }
          children:
            - type: stat
              value: "907 CE"
              label: "Year of Collapse"
              color: "#ff6b35"
              fontSize: 56
              labelColor: "#8a8078"
              labelFontSize: 16
            - type: stat
              value: "289"
              label: "Years of Reign"
              color: "#ff6b35"
              fontSize: 56
              labelColor: "#8a8078"
              labelFontSize: 16
```

### Example 3: Raw-Heavy Hero with Decorative Elements

**Input:** Screenshot of a dark slide with:
- Giant "01" watermark at top-left, barely visible (~2-3% opacity)
- Centered heading "Introduction" in white, large
- Muted subtitle below heading
- 4px gradient strip at the very top (blue-to-purple)
- User note: "the watermark is barely visible, like 2-3% opacity"

**Phase 1 — Analyze:**

```
ANALYSIS:
  Layout type: hero-centered
  Background: #0a0a0a solid
  Element inventory:
    - Gradient strip → full width, y:0, h:4 → raw (position: absolute)
    - Watermark "01" → top-left, ~x:60, y:40, giant text ~320px → raw (position: absolute, opacity 0.03)
    - Heading "Introduction" → centered, ~y:460 → component:heading (inside centered box)
    - Subtitle "Setting the stage..." → centered, ~y:540 → component:body (inside centered box)
  Typography:
    - Watermark: 320px, weight 900, #ffffff at 3% opacity
    - Heading: 64px, bold, #ffffff
    - Subtitle: 24px, regular, #666666
  Colors: #0a0a0a, #ffffff, #666666, #3b82f6, #8b5cf6
  Spacing: heading and subtitle ~24px apart, both horizontally centered
  Decorative elements: gradient strip at top, giant number watermark
```

**Phase 2 — Build:**

No template match — the watermark decoration and centered hero layout with raw elements is custom. Compose raw-first:

- Slide background: `#0a0a0a`
- Top-level `box` (flat, padding: 0, height: 1080) as container
  - Gradient strip: `raw` at position absolute, y: 0
  - Watermark "01": `raw` at position absolute, giant text with opacity 0.03
  - Centered content: `box` with verticalAlign: center, textAlign: center, holding heading + body components

**Phase 3 — Instantiate:**

```yaml
- background: "#0a0a0a"
  children:
    - type: box
      variant: flat
      padding: 0
      height: 1080
      children:
        # Decorative gradient strip at top
        - type: raw
          position: "absolute"
          x: 0
          y: 0
          width: 1920
          height: 4
          elements:
            - kind: shape
              id: top-gradient
              rect: { x: 0, y: 0, w: 1920, h: 4 }
              shape: rect
              style:
                gradient:
                  type: linear
                  angle: 90
                  stops:
                    - { color: "#3b82f6", position: 0 }
                    - { color: "#8b5cf6", position: 1 }

        # Giant watermark number
        - type: raw
          position: "absolute"
          x: 60
          y: 40
          width: 500
          height: 350
          elements:
            - kind: text
              id: watermark-01
              rect: { x: 0, y: 0, w: 500, h: 350 }
              text: "01"
              opacity: 0.03
              style:
                fontFamily: "Inter, sans-serif"
                fontSize: 320
                fontWeight: 900
                color: "#ffffff"
                lineHeight: 1.0

        # Centered content
        - type: box
          variant: flat
          height: 1080
          verticalAlign: center
          padding: [0, 200]
          layout: { type: flex, direction: column, gap: 24 }
          children:
            - type: heading
              text: "Introduction"
              fontSize: 64
              color: "#ffffff"
              textAlign: center
            - type: body
              text: "Setting the stage for everything that follows"
              fontSize: 24
              color: "#666666"
              textAlign: center
```
