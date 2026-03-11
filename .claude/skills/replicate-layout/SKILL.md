---
name: replicate-layout
description: Use when replicating the layout skeleton of a slide from a screenshot. Produces a pure component-tree wireframe with colored placeholder boxes — no content, no raw IR. Use this to verify spatial proportions before full replication with replicate-slides.
---

# Layout Replication

Replicate the spatial skeleton of a slide as a colored wireframe using only `box`, `text`, and `spacer` components. No content, no raw IR — just positioned boxes with labels showing where each region goes. See [../replicate-slides/reference.md](../replicate-slides/reference.md) for box behavior rules, component defaults, and layout mode semantics.

## Pipeline Position

```
Screenshot → replicate-layout → wireframe YAML → replicate-slides → final slide
```

This skill produces the scaffold. `replicate-slides` fills it in with real content later.

## Input

Accept any combination — adapt analysis to whatever's provided:

| Input | What it gives you | Priority |
|-------|-------------------|----------|
| Screenshot (PNG/JPG path) | Visual composition, layout structure, approximate sizes | Baseline |
| HTML file | Exact CSS values — sizes, padding, flex/grid layout, split ratios | Source of truth for exact values |
| Verbal description | User corrections ("left panel is 65%", "cards are 2×2 grid") | Overrides everything |

When inputs conflict: **description > HTML > screenshot**.

**Required context:** Ask for the presentation slug if not obvious — needed for appending to the right `slides.yaml`.

## Core Principle: Pure Component Wireframe

Every visual region becomes a `box` with a colored fill and a `text` label child. The skeleton uses ONLY three component types:

- **`box`** — structural containers and placeholder regions
- **`text`** — labels inside placeholders ("HEADING", "CARD 1", etc.)
- **`spacer`** — explicit spacing where needed

No `raw`, no `heading`, no `stat`, no `bullets`, no other components. The component system handles centering, spacing, and distribution automatically via `verticalAlign`, `layout`, `padding`, `gap` — which is exactly why we use it instead of raw IR.

## Color Coding Convention

| Region type | Fill | Use for |
|-------------|------|---------|
| Content area | `#2a2a3a` | Text blocks — heading, body, tag, subtitle regions |
| Panel / sidebar | `#1a1a2a` | Distinct background panels, secondary areas |
| Card / item | `#3a3a4a` | Repeated items — cards, list items, stat blocks |
| Decorative | `#4a3a2a` | Accent strips, dividers, decorative shapes |
| Image | `#2a3a2a` | Image placeholders |

All labels use `fontSize: 12`, `color: "#666"`.

## Breathing Animation

Every placeholder box gets a staggered pulse animation for a loading-skeleton effect. Use `cssStyle` with the built-in `pulse` keyframe (fades opacity between 0.4 and 1):

```yaml
cssStyle: { animation: "pulse 2s ease-in-out <delay>s infinite" }
```

Stagger by **0.1s** per element, incrementing top-to-bottom, left-to-right. This creates a wave pattern across the wireframe. Apply to every leaf `box` with `variant: panel` — not to structural `flat` containers.

## Two-Phase Process

### Phase 1: Analyze Layout

Examine the source and produce a structured breakdown of spatial regions. Output this as text so the user can verify.

**Analysis format:**

```
LAYOUT ANALYSIS:
  Canvas: 1920×1080
  Structure: [single-column | two-panel (ratio) | grid | hero-centered | freeform]
  Regions:
    - [region name] → [position/size description] → [box purpose]
    - ...
  Vertical distribution: [centered | top-aligned | space-between | custom padding]
  Gaps: [key spacing values in px]
  Decorative elements: [noted for replicate-slides — rendered as simple colored boxes here]
```

**What to detect:**
- Overall structure type and split ratios
- Every distinct visual region with approximate position and size
- How content is vertically distributed (centered? top-padded? evenly spaced?)
- Gap and padding patterns
- Decorative elements (noted but rendered as simple colored boxes in the wireframe)

### Phase 2: Build Skeleton

Translate the analysis into a pure component tree:

1. Start with slide `background` color (match the original or use `"#111"`)
2. Top-level `box`: `variant: flat`, `padding: 0`, `height: 1080`
3. **Panel splits** → `layout: { type: flex, direction: row }` with child boxes having explicit `width`
4. **Vertical stacking** → `layout: { type: flex, direction: column, gap: N }`
5. **Card grids** → `layout: { type: grid, columns: N, gap: N }`
6. **Vertical centering** → `verticalAlign: center` on the containing box
7. **Edge spacing** → `padding: [top, right, bottom, left]`
8. **Every leaf region** → `box` with `variant: panel`, `background: <color-code>`, `height: <estimated>`, `cssStyle: { animation: "pulse 2s ease-in-out <delay>s infinite" }`, containing a `text` label child

### Critical Box Rules

These defaults will bite you if you forget them (see reference.md for full list):

| Rule | What happens if you forget |
|------|---------------------------|
| Default padding is **28px** | Structural containers get unwanted insets → set `padding: 0` on flat containers |
| Default variant is **card** | Invisible containers get fill/shadow/border → use `variant: flat` for structural boxes |
| Gap is inside `layout`, not a direct prop | `gap: 24` on box does nothing → use `layout: { type: flex, direction: column, gap: 24 }` |
| Flex children without explicit `width` get **equal shares** | Uneven splits need explicit `width` on the wider child |
| `verticalAlign` shifts content **within** the box | It doesn't move the box itself — the box must have `height` set |
| `variant: panel` = fill + radius, **no shadow/border** | Good for placeholder regions — visible but not heavy |

## Workflow Summary

1. Receive screenshot (+ optional HTML/description) + presentation slug
2. Phase 1: Output `LAYOUT ANALYSIS` block
3. Phase 2: Build skeleton component tree
4. Output complete YAML, append to `content/[slug]/slides.yaml`
5. User renders and compares wireframe against original

All phases happen in one invocation. Show the analysis, then the build reasoning, then the final YAML.

## Examples

### Example 1: Single-Column Centered Hero

**Input:** Dark slide with centered heading and subtitle.

**Phase 1 — Analyze:**

```
LAYOUT ANALYSIS:
  Canvas: 1920×1080
  Structure: hero-centered
  Regions:
    - Heading → centered, large text → content area
    - Subtitle → centered, below heading, smaller → content area
  Vertical distribution: centered (both elements as a group in the middle)
  Gaps: ~24px between heading and subtitle
  Decorative elements: none
```

**Phase 2 — Build:**

Single centered box with two placeholder children.

```yaml
- background: "#0a0a0a"
  children:
    - type: box
      variant: flat
      padding: [0, 200]
      height: 1080
      verticalAlign: center
      layout: { type: flex, direction: column, gap: 24 }
      children:
        - type: box
          variant: panel
          background: "#2a2a3a"
          height: 70
          cssStyle: { animation: "pulse 2s ease-in-out infinite" }
          children:
            - type: text
              text: "HEADING"
              fontSize: 12
              color: "#666"
              textAlign: center
        - type: box
          variant: panel
          background: "#2a2a3a"
          height: 30
          cssStyle: { animation: "pulse 2s ease-in-out 0.1s infinite" }
          children:
            - type: text
              text: "SUBTITLE"
              fontSize: 12
              color: "#666"
              textAlign: center
```

### Example 2: Two-Panel Split (65/35)

**Input:** Left 65% has tag + heading + body + 2×2 card grid. Right 35% has a dark panel with icon, title, and 4 horizontal bars. Content on the left is top-padded, right panel content is vertically centered.

**Phase 1 — Analyze:**

```
LAYOUT ANALYSIS:
  Canvas: 1920×1080
  Structure: two-panel (65/35 split → 1250 | 670)
  Regions:
    - Left panel: w:1250
      - Tag → small, top-left → content area
      - Heading → below tag, large → content area
      - Divider → thin accent line below heading → decorative
      - Body text → below divider, paragraph → content area
      - Card grid → 2×2 below body → cards
    - Right panel: w:670, darker background
      - Icon → centered, top of panel → card
      - Panel title → centered, below icon → content area
      - Bar 1–4 → horizontal bars, stacked → cards
  Vertical distribution: left is top-padded (~180px), right is vertically centered
  Gaps: 24px between left elements, 20px card grid gap, 16px between right elements
  Decorative elements: thin divider between heading and body
```

**Phase 2 — Build:**

Two-panel flex-row split. Left panel has flex-column children with a grid for cards. Right panel uses verticalAlign: center.

```yaml
- background: "#1c1d35"
  children:
    - type: box
      variant: flat
      padding: 0
      height: 1080
      layout: { type: flex, direction: row }
      children:
        # Left panel
        - type: box
          variant: flat
          width: 1250
          padding: [180, 80, 80, 220]
          layout: { type: flex, direction: column, gap: 24 }
          children:
            - type: box
              variant: panel
              background: "#2a2a3a"
              height: 24
              width: 200
              cssStyle: { animation: "pulse 2s ease-in-out infinite" }
              children:
                - type: text
                  text: "TAG"
                  fontSize: 12
                  color: "#666"
            - type: box
              variant: panel
              background: "#2a2a3a"
              height: 52
              cssStyle: { animation: "pulse 2s ease-in-out 0.1s infinite" }
              children:
                - type: text
                  text: "HEADING"
                  fontSize: 12
                  color: "#666"
            - type: box
              variant: panel
              background: "#4a3a2a"
              height: 4
              width: 80
              cssStyle: { animation: "pulse 2s ease-in-out 0.2s infinite" }
            - type: box
              variant: panel
              background: "#2a2a3a"
              height: 55
              width: 530
              cssStyle: { animation: "pulse 2s ease-in-out 0.3s infinite" }
              children:
                - type: text
                  text: "BODY TEXT"
                  fontSize: 12
                  color: "#666"
            # Card grid
            - type: box
              variant: flat
              padding: 0
              layout: { type: grid, columns: 2, gap: 20 }
              children:
                - type: box
                  variant: panel
                  background: "#3a3a4a"
                  height: 115
                  borderRadius: 10
                  cssStyle: { animation: "pulse 2s ease-in-out 0.4s infinite" }
                  children:
                    - type: text
                      text: "CARD 1"
                      fontSize: 12
                      color: "#666"
                - type: box
                  variant: panel
                  background: "#3a3a4a"
                  height: 115
                  borderRadius: 10
                  cssStyle: { animation: "pulse 2s ease-in-out 0.5s infinite" }
                  children:
                    - type: text
                      text: "CARD 2"
                      fontSize: 12
                      color: "#666"
                - type: box
                  variant: panel
                  background: "#3a3a4a"
                  height: 115
                  borderRadius: 10
                  cssStyle: { animation: "pulse 2s ease-in-out 0.6s infinite" }
                  children:
                    - type: text
                      text: "CARD 3"
                      fontSize: 12
                      color: "#666"
                - type: box
                  variant: panel
                  background: "#3a3a4a"
                  height: 115
                  borderRadius: 10
                  cssStyle: { animation: "pulse 2s ease-in-out 0.7s infinite" }
                  children:
                    - type: text
                      text: "CARD 4"
                      fontSize: 12
                      color: "#666"

        # Right panel
        - type: box
          variant: panel
          background: "#1a1a2a"
          verticalAlign: center
          padding: [40, 40]
          borderRadius: 14
          layout: { type: flex, direction: column, gap: 16 }
          children:
            - type: box
              variant: panel
              background: "#3a3a4a"
              height: 65
              cssStyle: { animation: "pulse 2s ease-in-out 0.2s infinite" }
              children:
                - type: text
                  text: "ICON"
                  fontSize: 12
                  color: "#666"
                  textAlign: center
            - type: box
              variant: panel
              background: "#2a2a3a"
              height: 26
              cssStyle: { animation: "pulse 2s ease-in-out 0.3s infinite" }
              children:
                - type: text
                  text: "PANEL TITLE"
                  fontSize: 12
                  color: "#666"
                  textAlign: center
            - type: box
              variant: panel
              background: "#3a3a4a"
              height: 26
              cssStyle: { animation: "pulse 2s ease-in-out 0.4s infinite" }
              children:
                - type: text
                  text: "BAR 1"
                  fontSize: 12
                  color: "#666"
            - type: box
              variant: panel
              background: "#3a3a4a"
              height: 26
              cssStyle: { animation: "pulse 2s ease-in-out 0.5s infinite" }
              children:
                - type: text
                  text: "BAR 2"
                  fontSize: 12
                  color: "#666"
            - type: box
              variant: panel
              background: "#3a3a4a"
              height: 26
              cssStyle: { animation: "pulse 2s ease-in-out 0.6s infinite" }
              children:
                - type: text
                  text: "BAR 3"
                  fontSize: 12
                  color: "#666"
            - type: box
              variant: panel
              background: "#3a3a4a"
              height: 26
              cssStyle: { animation: "pulse 2s ease-in-out 0.7s infinite" }
              children:
                - type: text
                  text: "BAR 4"
                  fontSize: 12
                  color: "#666"
```

### Example 3: Grid of Cards with Decorative Top Strip

**Input:** Dark slide with a thin accent strip at top, centered heading, and a 3×2 grid of cards below.

**Phase 1 — Analyze:**

```
LAYOUT ANALYSIS:
  Canvas: 1920×1080
  Structure: single-column with grid
  Regions:
    - Accent strip → full width, 4px at top → decorative
    - Heading → centered, below strip → content area
    - Card grid → 3 columns, 2 rows → cards
  Vertical distribution: top strip flush, heading ~160px from top, cards below with gap
  Gaps: 40px between heading and grid, 24px grid gap
  Decorative elements: 4px accent strip at very top
```

**Phase 2 — Build:**

Vertical flex-column with spacers for positioning, grid for cards.

```yaml
- background: "#0f0f0f"
  children:
    - type: box
      variant: flat
      padding: 0
      height: 1080
      layout: { type: flex, direction: column }
      children:
        # Decorative accent strip
        - type: box
          variant: panel
          background: "#4a3a2a"
          height: 4
          cssStyle: { animation: "pulse 2s ease-in-out infinite" }
        # Spacing above heading
        - type: spacer
          height: 160
        # Heading region
        - type: box
          variant: panel
          background: "#2a2a3a"
          height: 60
          width: 500
          margin: [0, auto]
          cssStyle: { animation: "pulse 2s ease-in-out 0.1s infinite" }
          children:
            - type: text
              text: "HEADING"
              fontSize: 12
              color: "#666"
              textAlign: center
        # Spacing before grid
        - type: spacer
          height: 40
        # Card grid
        - type: box
          variant: flat
          padding: [0, 80]
          layout: { type: grid, columns: 3, gap: 24 }
          children:
            - type: box
              variant: panel
              background: "#3a3a4a"
              height: 200
              borderRadius: 12
              cssStyle: { animation: "pulse 2s ease-in-out 0.2s infinite" }
              children:
                - type: text
                  text: "CARD 1"
                  fontSize: 12
                  color: "#666"
            - type: box
              variant: panel
              background: "#3a3a4a"
              height: 200
              borderRadius: 12
              cssStyle: { animation: "pulse 2s ease-in-out 0.3s infinite" }
              children:
                - type: text
                  text: "CARD 2"
                  fontSize: 12
                  color: "#666"
            - type: box
              variant: panel
              background: "#3a3a4a"
              height: 200
              borderRadius: 12
              cssStyle: { animation: "pulse 2s ease-in-out 0.4s infinite" }
              children:
                - type: text
                  text: "CARD 3"
                  fontSize: 12
                  color: "#666"
            - type: box
              variant: panel
              background: "#3a3a4a"
              height: 200
              borderRadius: 12
              cssStyle: { animation: "pulse 2s ease-in-out 0.5s infinite" }
              children:
                - type: text
                  text: "CARD 4"
                  fontSize: 12
                  color: "#666"
            - type: box
              variant: panel
              background: "#3a3a4a"
              height: 200
              borderRadius: 12
              cssStyle: { animation: "pulse 2s ease-in-out 0.6s infinite" }
              children:
                - type: text
                  text: "CARD 5"
                  fontSize: 12
                  color: "#666"
            - type: box
              variant: panel
              background: "#3a3a4a"
              height: 200
              borderRadius: 12
              cssStyle: { animation: "pulse 2s ease-in-out 0.7s infinite" }
              children:
                - type: text
                  text: "CARD 6"
                  fontSize: 12
                  color: "#666"
        # Bottom spacing
        - type: spacer
          flex: true
```
