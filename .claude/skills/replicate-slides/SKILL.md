---
name: replicate-slides
description: Use when replicating an existing slide from a screenshot, HTML file, or verbal description. Analyzes the source slide visually, finds or creates a reusable DSL template, and outputs instantiated YAML that reproduces the slide at pixel level. Complementary to create-slides — this skill works from visual sources rather than intent.
---

# Slide Replication

Replicate slides from visual sources into the YAML presentation system. Three outputs per invocation: structured analysis, reusable template, instantiated slide YAML.

See [reference.md](reference.md) for template structural signatures, component/element syntax, and parameterization conventions.

## Input

Accept any combination — adapt analysis to whatever's provided:

| Input | What it gives you | Priority |
|-------|-------------------|----------|
| Screenshot (PNG/JPG path) | Visual composition, layout structure, approximate colors/sizes | Baseline |
| HTML file | Exact CSS values — colors, fonts, sizes, padding, flex/grid layout | Source of truth for exact values |
| Verbal description | User corrections, intent, emphasis ("left panel is 65%", "accent is coral") | Overrides everything |

When inputs conflict: **description > HTML > screenshot**.

**Required context:** Ask for the presentation slug if not obvious — needed for saving templates to `content/[slug]/templates/`.

## Three-Phase Pipeline

```
Source (screenshot / HTML / description)
  ↓ Phase 1: Analyze
Structured element inventory (layout, typography, colors, spacing)
  ↓ Phase 2: Template
Existing template match OR new .template.yaml file
  ↓ Phase 3: Instantiate
Concrete slide YAML using the template
```

### Phase 1: Analyze

Examine the source and produce a structured breakdown of every visual element. Output this as text so the user can verify what was detected.

**Analysis format:**

```
## Slide Analysis

**Layout:** [layout type — single column, two-panel split with ratio, grid, centered hero, etc.]
**Background:** [colors, images, overlays]

### Elements
1. [Component type] — [content], [position], [key visual properties]
2. [Component type] — [content], [position], [key visual properties]
...

### Typography
- Heading: [font family], [weight], [size]
- Body: [font family], [weight], [size]
- Special: [any other text styles — tags, stats, code]

### Colors
- Accent: [hex]
- Text primary: [hex]
- Text muted: [hex]
- Backgrounds: [hex values for each distinct area]

### Spacing
- Padding: [values per panel/section]
- Element gaps: [vertical/horizontal spacing between elements]
- Notable margins: [any non-standard spacing]
```

**What to detect:**
- Layout structure (single column, split ratio, grid, absolute overlaps)
- Every text element with approximate font family, size, weight, color, alignment
- Every non-text element (shapes, images, dividers, decorative accents)
- Background treatment (solid, gradient, image, overlay)
- Spacing patterns (padding, gaps, margins)
- Animation cues if visible (stagger order, entrance direction)
- Rich text (inline color, bold, mixed styles within a single text block)

### Phase 2: Template Decision

Compare the analysis against the 35 built-in templates. See [reference.md](reference.md) for structural signatures.

**Matching criteria — both must be true:**
1. **Structural match** — same element types, count, and arrangement (e.g. heading + divider + bullets = `bullets` template)
2. **Visual fidelity** — the template's `style` params can control any visual differences. If the template hardcodes something that needs to differ, it's not a match.

**If match found:** Use the existing template. Note which `style` overrides are needed.

**If no match:** Create a new `.template.yaml` in `content/[slug]/templates/`.

#### Creating New Templates

**File:** `content/[slug]/templates/<descriptive-name>.template.yaml`

**Naming:** Descriptive, kebab-case. Name after what the slide does structurally: `hero-stat-split`, `editorial-quote-cards`, `gradient-header-grid`.

**Parameterization — Claude decides per template:**

| What | Approach | Example |
|------|----------|---------|
| Text content | Always `params` | `title`, `body`, `bullets`, `stats` |
| Repeating elements | Array `params` + `{% for %}` loop | `stats: { type: array, required: true }` |
| Optional elements | `params` (required: false) + `{% if %}` conditional | `{% if tag %}...{% endif %}` |
| Structural dimensions | `style` with defaults from original | `splitRatio: { type: number, default: 1250 }` |
| Font sizes | `style` with defaults from original | `titleSize: { type: number, default: 54 }` |
| Colors that are design choices | `style` with defaults from original | `accentColor: { type: string, default: "#c41e3a" }` |
| Colors matching a theme | Use theme tokens directly | `color: theme.accent` |
| Fixed structural elements | Hardcode in template | divider variant, box layout direction |

**Template structure:**

```yaml
name: descriptive-name
params:
  title: { type: string, required: true }
  items: { type: array, required: true }
  subtitle: { type: string, required: false }
style:
  titleSize: { type: number, default: 54 }
  accentColor: { type: string, default: "#c41e3a" }
  splitRatio: { type: number, default: 1250 }

children:
  - type: box
    variant: flat
    # ... component tree with {{ param }} and {{ style.prop }} interpolation
```

**Nunjucks patterns available:**
- `{{ title }}` — string interpolation
- `{{ items }}` — array (auto-serialized to YAML flow sequence)
- `{{ style.titleSize }}` — style with default
- `{% if subtitle %}...{% endif %}` — conditional block
- `{% for s in stats %}...{% endfor %}` — loop with `loop.index`, `loop.index0`, `loop.length`
- `{{ code | tojson }}` — JSON-escape for code blocks
- `{{ text | yaml_string }}` — YAML-safe string escaping
- `{{ theme.accent }}` — theme token access

### Phase 3: Instantiate

Output a concrete slide YAML that uses the template (existing or newly created) with all params filled to replicate the source.

```yaml
# Using existing template
- template: stats
  title: "Key Metrics"
  stats:
    - value: "907"
      label: "Year of Tang's Fall"
  style:
    statColor: "#ff2d2d"

# Using newly created template
- template: editorial-split-stats
  tag: "Chapter 3"
  title:
    - "The "
    - text: "Fall"
      color: "#c41e3a"
      bold: true
    - " of Tang"
  stats:
    - value: "907"
      label: "Year of Tang's Fall"
```

**Key rules:**
- Use the template's param interface — never output raw component trees when a template exists
- Preserve rich text (inline colors, bold) when the source has mixed styling
- The YAML is ready to paste into `content/[slug]/slides.yaml`
- Template + instantiation together must reproduce the source at pixel level

## Workflow Summary

1. Read the input (screenshot, HTML, description — whatever's provided)
2. Output the structured analysis (Phase 1)
3. Search for an existing template match; if none, create a new `.template.yaml` (Phase 2)
4. Output the instantiated slide YAML (Phase 3)

All three phases happen in one invocation. If the user wants to iterate ("make the left panel wider"), re-run with corrections.

## Examples

### Example 1: Existing template match

**Input:** Screenshot of a slide with a title, horizontal divider, and 4 bullet points in card style.

**Phase 1 output:**
```
## Slide Analysis
**Layout:** Single column, full-width, padded
**Background:** #f8f9fc

### Elements
1. Heading — "Key Challenges", 54px, sans-serif, left-aligned
2. Divider — gradient, ~30% width, left-aligned
3. Bullets — 4 items, card variant with accent-colored left bar, 26px

### Typography
- Heading: Inter, 700, 54px
- Bullets: Inter, 400, 26px

### Colors
- Accent: #4f6df5
- Text: #1a1a2e

### Spacing
- Padding: 60px top/bottom, 160px left/right
- Bullet gap: 16px
```

**Phase 2:** Matches `bullets` template — same structure (heading + divider + bullets), card variant controllable via style.

**Phase 3:**
```yaml
- template: bullets
  title: "Key Challenges"
  bullets:
    - "Rising infrastructure costs across all regions"
    - "Talent retention in competitive markets"
    - "Regulatory compliance across jurisdictions"
    - "Legacy system migration timelines"
```

### Example 2: New template — asymmetric split with stats

**Input:** Screenshot of a two-panel slide (65/35), left has tag + heading + divider + body text, right panel is dark with two large stats vertically stacked.

**Phase 1 output:**
```
## Slide Analysis
**Layout:** Two-panel split (65/35), full-bleed, no outer padding
**Background:** Left: #faf8f5, Right: #1a1714

### Elements
1. Tag — "Overview", left panel top, #b8860b border, uppercase, 14px
2. Heading — "Revenue Growth", 54px, Playfair Display, left-aligned
3. Divider — gradient, 30% width, left-aligned
4. Body — "Our Q4 results exceeded...", 26px, Inter, 1.6 line-height
5. Stat — "$2.4B" at 72px in #b8860b, label "Total Revenue", right panel
6. Stat — "34%" at 72px in #b8860b, label "YoY Growth", right panel

### Typography
- Heading: Playfair Display, 700, 54px
- Body: Inter, 400, 26px
- Stat value: Inter, 700, 72px
- Stat label: Inter, 400, 18px, uppercase

### Colors
- Accent: #b8860b (gold)
- Text: #2d2a26
- Stat label: rgba(255,255,255,0.6)
- Right panel bg: #1a1714

### Spacing
- Left padding: 80px vert, 60px horiz
- Right padding: 80px vert, 60px horiz, vertically centered
- Element gap: 16px
```

**Phase 2:** No existing template matches — `comparison` has two panels but with heading+bullets structure, not tag+heading+body vs stats. Creates new template:

**File:** `content/my-talk/templates/split-content-stats.template.yaml`

```yaml
name: split-content-stats
params:
  tag: { type: string, required: false }
  title: { type: string, required: true }
  body: { type: string, required: false }
  bullets: { type: "string[]", required: false }
  stats: { type: array, required: true }
style:
  splitRatio: { type: number, default: 1250 }
  rightBg: { type: string, default: "#1a1714" }
  accentColor: { type: string, default: "#b8860b" }
  titleSize: { type: number, default: 54 }
  statSize: { type: number, default: 72 }

children:
  - type: box
    variant: flat
    layout: { type: flex, direction: row }
    padding: 0
    height: 1080
    children:
      - type: box
        variant: flat
        width: {{ style.splitRatio }}
        padding: [80, 60]
        children:
          {% if tag %}
          - type: tag
            text: "{{ tag }}"
            color: {{ style.accentColor }}
          {% endif %}
          - type: heading
            text: "{{ title }}"
            fontSize: {{ style.titleSize }}
          - type: divider
            variant: gradient
          {% if body %}
          - type: body
            text: "{{ body }}"
          {% endif %}
          {% if bullets %}
          - type: bullets
            items: {{ bullets }}
          {% endif %}
      - type: box
        background: {{ style.rightBg }}
        padding: [80, 60]
        verticalAlign: center
        children:
          {% for s in stats %}
          - type: stat
            value: "{{ s.value }}"
            label: "{{ s.label }}"
            color: {{ style.accentColor }}
            fontSize: {{ style.statSize }}
          {% endfor %}
```

**Phase 3:**
```yaml
- template: split-content-stats
  tag: "Overview"
  title: "Revenue Growth"
  body: "Our Q4 results exceeded all projections, driven by enterprise expansion and improved retention across key markets."
  stats:
    - value: "$2.4B"
      label: "Total Revenue"
    - value: "34%"
      label: "YoY Growth"
```

### Example 3: New template — hero with decorative elements

**Input:** Screenshot showing a dark slide with a giant "01" watermark, a gradient strip at the top, and a centered heading with subtitle. Plus verbal: "the watermark is barely visible, like 2-3% opacity."

**Phase 1 output:**
```
## Slide Analysis
**Layout:** Single column, centered, dark background
**Background:** #0a0a0a

### Elements
1. Raw shape — gradient strip, full width, 4px tall, top edge, orange→cyan
2. Raw text — "01" watermark, ~400px, 900 weight, ~2-3% opacity, top-left offset
3. Heading — "Introduction", 64px, Inter, centered, white
4. Body — "Setting the stage", 28px, Inter, centered, rgba(255,255,255,0.6)

### Typography
- Heading: Inter, 700, 64px, white
- Body: Inter, 400, 28px, muted white

### Colors
- Accent gradient: #ff6b35 → #00d4ff
- Text: #ffffff
- Text muted: rgba(255,255,255,0.6)
- Watermark: rgba(255,255,255,0.03)

### Spacing
- Content vertically centered, ~160px horizontal padding
```

**Phase 2:** No match — creates `hero-watermark.template.yaml`:

```yaml
name: hero-watermark
params:
  title: { type: string, required: true }
  subtitle: { type: string, required: false }
  watermark: { type: string, required: true }
style:
  titleSize: { type: number, default: 64 }
  watermarkSize: { type: number, default: 400 }
  watermarkOpacity: { type: number, default: 0.03 }
  gradientLeft: { type: string, default: "#ff6b35" }
  gradientRight: { type: string, default: "#00d4ff" }

children:
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
          gradient: { type: linear, angle: 90, stops: [{ color: "{{ style.gradientLeft }}", position: 0 }, { color: "{{ style.gradientRight }}", position: 1 }] }
  - type: raw
    position: "absolute"
    x: -50
    y: 80
    width: 1000
    height: 600
    elements:
      - kind: text
        id: watermark
        rect: { x: 0, y: 0, w: 1000, h: 600 }
        text: "{{ watermark }}"
        style: { fontFamily: "Inter, sans-serif", fontSize: {{ style.watermarkSize }}, fontWeight: 900, color: "rgba(255,255,255,{{ style.watermarkOpacity }})", lineHeight: 1.0 }
  - type: box
    variant: flat
    padding: [0, 160]
    height: 1080
    layout: { type: flex, direction: column, justify: center, align: center }
    children:
      - type: heading
        text: "{{ title }}"
        fontSize: {{ style.titleSize }}
        textAlign: center
        color: "#ffffff"
      {% if subtitle %}
      - type: body
        text: "{{ subtitle }}"
        textAlign: center
        color: "rgba(255,255,255,0.6)"
      {% endif %}
```

**Phase 3:**
```yaml
- template: hero-watermark
  background: "#0a0a0a"
  watermark: "01"
  title: "Introduction"
  subtitle: "Setting the stage for what comes next."
```
