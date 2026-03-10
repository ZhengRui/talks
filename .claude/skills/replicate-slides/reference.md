# Slide Replication Reference

Template matching signatures, parameterization conventions, and component syntax for replicating slides.

---

## Template Structural Signatures

Use these to determine if an existing template can replicate the source slide at pixel level. Match requires **same structure AND visual fidelity achievable via style overrides**.

### Title & Section

| Template | Structure | Style Controls |
|----------|-----------|----------------|
| `cover` | centered box > heading + divider + [subtitle] + [tag/author] | — |
| `statement` | centered box (gap: 28) > heading + [divider + subtitle] | — |
| `section-divider` | centered box > heading + divider + [subtitle] | optional background image/overlay |
| `end` | centered box (gap: 28) > heading + [divider + subtitle] | — |

### Content

| Template | Structure | Style Controls |
|----------|-----------|----------------|
| `bullets` | box > heading + divider + bullets | `titleSize`, `bulletVariant` (card/plain/list) |
| `numbered-list` | box > heading + divider + bullets (ordered: true) | — |
| `comparison` | box > [heading + divider] + columns (2x: heading + bullets, accent-top) | — |
| `definition` | box > heading + divider + looped (term + description + divider) | — |
| `agenda` | box > heading + divider + looped panel boxes | `activeIndex` highlights one item |
| `highlight-box` | box > [heading + divider] + styled panel box > body | `variant` (info/warning/success) |
| `qa` | box > heading (question) + divider + box > body (answer) | — |
| `quote` | centered box > quote component (decorative) + [attribution] | — |

### Data & Technical

| Template | Structure | Style Controls |
|----------|-----------|----------------|
| `stats` | box > [heading + divider] + spacer + columns (N stat cards) + spacer | — |
| `code` | box > [heading + divider] + code component | — |
| `code-comparison` | box > [heading + divider] + columns (2x: label + code) | — |
| `table` | box > [heading + divider] + raw (header + rows with borders) | — |
| `timeline` | box > [heading + divider] + raw (horizontal: connector + dots + labels) | — |
| `steps` | box > [heading + divider] + raw (vertical: badges + connectors + cards) | — |

### Media

| Template | Structure | Style Controls |
|----------|-----------|----------------|
| `image-text` | columns (50/50) > text-box (heading + divider + body/bullets) + image-box | `imagePosition` (left/right) |
| `image-caption` | box > [heading + divider] + image + caption | — |
| `image-grid` | box > [heading + divider] + grid (N columns of images + captions) | `columns` (2/3) |
| `image-comparison` | box > [heading + divider] + columns (2x: image + label) | — |
| `image-gallery` | box > [heading + divider] + columns (N images + captions) | — |
| `full-image` | centered box > [heading + body] with background image/overlay | `overlay` (dark/light) |
| `diagram` | alias → `image-caption` | — |
| `chart-placeholder` | alias → `image-caption` | — |

### Layout

| Template | Structure | Style Controls |
|----------|-----------|----------------|
| `two-column` | box > [heading + divider] + columns (2x: body text) | — |
| `three-column` | box > [heading + divider] + columns (3x: icon + heading + body, accent-top) | — |
| `sidebar` | box > columns (variable ratio) > main-box + sidebar-panel-box | `sidebarPosition` (left/right) |
| `top-bottom` | box > [heading + divider] + box (top body) + divider + box (bottom body) | — |

### Special

| Template | Structure | Style Controls |
|----------|-----------|----------------|
| `profile` | centered box > [circle image] + heading + [title + divider + bio] | — |
| `icon-grid` | box > [heading + divider] + grid (N columns of icon + label) | `columns` (2/3/4) |
| `video` | box > [heading + divider] + video component | — |
| `iframe` | box > [heading + divider] + iframe component | — |
| `blank` | empty (no children) | optional background image |

---

## Matching Decision Flow

```
Analyze source slide structure
  ↓
Count elements, identify types, note arrangement
  ↓
Find templates with same element types + count + arrangement
  ↓
For each candidate:
  Can style params achieve the visual differences?
    YES → Match found. Use template + style overrides.
    NO  → Not a match. Continue searching.
  ↓
No candidates left?
  → Create new template.
```

**Common match failures:**
- Template has heading + divider + bullets but source has heading + divider + body + bullets → no match (extra element)
- Template hardcodes 50/50 split but source is 65/35 → no match (can't override ratio)
- Template uses `columns` but source has one panel with a different background → no match (visual fidelity)
- Template has the right structure but source uses rich text with inline colors → **still matches** (rich text is content, not structure)

---

## Template Creation Conventions

### File Location

```
content/[slug]/templates/<descriptive-name>.template.yaml
```

The DSL loader checks per-presentation templates first, then falls back to built-in. No registry update needed — auto-discovered from filesystem.

### Template File Structure

```yaml
name: descriptive-name
params:
  title: { type: string, required: true }
  items: { type: array, required: true }
  subtitle: { type: string, required: false }
style:
  titleSize: { type: number, default: 54 }
  accentColor: { type: string, default: "#c41e3a" }

children:
  - type: box
    variant: flat
    padding: [80, 160]
    children:
      {% if subtitle %}
      - type: tag
        text: "{{ subtitle }}"
      {% endif %}
      - type: heading
        text: "{{ title }}"
        fontSize: {{ style.titleSize }}
      - type: divider
        variant: gradient
      {% for item in items %}
      - type: card
        title: "{{ item.title }}"
        body: "{{ item.body }}"
      {% endfor %}
```

### Param Types

| Type | YAML declaration | Usage |
|------|-----------------|-------|
| `string` | `{ type: string }` | `"{{ title }}"` |
| `number` | `{ type: number }` | `{{ style.titleSize }}` |
| `string[]` | `{ type: "string[]" }` | `{{ bullets }}` (auto-serialized) |
| `array` | `{ type: array }` | `{% for s in stats %}...{% endfor %}` |
| `object` | `{ type: object }` | `{{ before.code }}`, `{{ before.label }}` |

### Nunjucks Patterns

**Variable interpolation:**
```yaml
text: "{{ title }}"
fontSize: {{ style.titleSize }}
color: {{ style.accentColor }}
```

**Conditional blocks (optional elements):**
```yaml
{% if subtitle %}
- type: body
  text: "{{ subtitle }}"
{% endif %}
```

**Loops (repeating elements):**
```yaml
{% for s in stats %}
- type: stat
  value: "{{ s.value }}"
  label: "{{ s.label }}"
{% endfor %}
```

**Loop variables:**
- `loop.index` — 1-based index
- `loop.index0` — 0-based index
- `loop.length` — total count
- `loop.first`, `loop.last` — boolean

**Filters:**
```yaml
code: {{ code | tojson }}           # JSON-escape for code blocks
text: "{{ text | yaml_string }}"    # YAML-safe string escaping
```

**Theme tokens (available in template context):**
```yaml
color: {{ theme.accent }}
background: {{ theme.bgSecondary }}
```

### Parameterization Guidelines

**Always parameterize:**
- All text content (titles, body, bullets, stats, labels)
- Arrays of repeating elements (stats, cards, bullets, timeline events)
- Optional elements (wrap in `{% if %}`)

**Parameterize as `style` (with defaults from original):**
- Split ratios, panel widths
- Font sizes, font weights
- Colors that are design choices (not theme-derived)
- Padding values, gap sizes
- Element counts (grid columns)

**Hardcode in template:**
- Layout direction (flex-row vs flex-column)
- Component types and nesting structure
- Divider variant, box variant
- Theme token references (use `theme.accent` not a hardcoded hex when the color matches the theme)
- Animation types (entrance, stagger pattern)

**Use theme tokens when:**
- The color matches the presentation's theme accent/bg/text
- You want the template to work across different themes
- The original slide clearly follows a theme palette

**Use hardcoded hex when:**
- The color is a specific design choice (a brand color, a unique accent)
- The color doesn't match any theme token
- Exactness matters more than theme-switchability

---

## Component Quick Reference

18 component types available in component trees and templates. All accept the shared mixin props (entranceType, opacity, transform, effects, width, height, margin, position, x, y).

### Text Components

| Component | Key Props | Use For |
|-----------|-----------|---------|
| `heading` | `text` (RichText), `level` (1/2/3), `fontSize`, `textAlign`, `color`, `fontFamily`, `textTransform` | Titles, section headers |
| `body` | `text` (RichText), `fontSize`, `color`, `lineHeight` | Paragraphs |
| `text` | `text` (RichText), `fontSize`, `fontWeight`, `color`, `textAlign`, `fontFamily`, `letterSpacing`, `textTransform`, `maxWidth` | Custom styled text |
| `tag` | `text` (RichText), `color`, `fontSize`, `padding`, `borderWidth`, `letterSpacing` | Labels, categories |
| `stat` | `value` (RichText), `label` (RichText), `fontSize`, `labelFontSize`, `color`, `labelColor`, `textAlign` | Numbers, metrics |
| `quote` | `text` (RichText), `attribution`, `fontSize`, `decorative` | Quotations |

### Content Components

| Component | Key Props | Use For |
|-----------|-----------|---------|
| `bullets` | `items` (RichText[]), `variant` (card/plain/list), `ordered`, `fontSize`, `gap`, `bulletColor` | Lists |
| `card` | `title` (RichText), `body` (RichText), `dark` | Card panels |
| `code` | `code`, `language`, `fontSize`, `padding` | Code blocks |
| `divider` | `variant` (solid/gradient/ink/border), `width`, `color`, `align` | Section separators |
| `spacer` | `height`, `flex` | Vertical spacing |

### Media Components

| Component | Key Props | Use For |
|-----------|-----------|---------|
| `image` | `src`, `height`, `objectFit`, `clipCircle` | Photos, diagrams |
| `video` | `src`, `poster`, `height` | Video embeds |
| `iframe` | `src`, `height` | Embedded web content |

### Layout Components

| Component | Key Props | Use For |
|-----------|-----------|---------|
| `box` | `variant`, `padding`, `background`, `layout` (flex/grid), `height`, `verticalAlign`, `autoEntrance`, `children` | Layout containers |
| `columns` | `gap`, `ratio`, `equalHeight`, `children` | Horizontal splits |
| `grid` | `columns`, `gap`, `equalHeight`, `children` | Multi-row grids |
| `raw` | `height`, `elements` (LayoutElement[]), `position`, `x`, `y` | Pixel-precise IR elements |

### Rich Text

All text-bearing components accept RichText — plain string, markdown shorthand, or styled runs:

```yaml
# Plain
text: "Simple text"

# Markdown shorthand
text: "The **Fall** of *Tang*"

# Styled runs
text:
  - "The "
  - text: "Fall"
    color: "#c41e3a"
    bold: true
  - " of Tang"
```

TextRun props: `bold`, `italic`, `underline`, `strikethrough`, `color`, `fontSize`, `fontFamily`, `letterSpacing`, `highlight`, `superscript`, `subscript`.

---

## IR Element Types (for `raw` components)

Used for pixel-precise elements. Each has `kind`, `id`, `rect: {x, y, w, h}`.

| Kind | Key Props | Use For |
|------|-----------|---------|
| `text` | `text`, `style` (fontFamily, fontSize, fontWeight, color, textAlign, lineHeight, letterSpacing, textTransform) | Precise text placement |
| `shape` | `shape` (rect/circle/line/pill/arrow/triangle/chevron/diamond/star/callout), `style` (fill, gradient, stroke, strokeWidth, patternFill) | Decorative shapes, backgrounds |
| `image` | `src`, `objectFit`, `clipCircle` | Precise image placement |
| `group` | `children`, `style` (fill), `clipContent`, `layout` | Grouped elements |
| `code` | `code`, `language`, `style` | Positioned code blocks |
| `table` | `headers`, `rows`, `headerStyle`, `cellStyle`, `borderColor` | Positioned tables |
| `list` | `items`, `ordered`, `itemStyle`, `bulletColor` | Positioned lists |

### Common Element Props (ElementBase)

```yaml
opacity: 0.8
borderRadius: 12
shadow: { offsetX: 0, offsetY: 4, blur: 24, color: "rgba(0,0,0,0.1)" }
effects: { glow: { color: "#ff6b35", radius: 15, opacity: 0.6 }, softEdge: 8, blur: 4 }
border: { width: 2, color: "#c41e3a", sides: ["left"], dash: "dash" }
entrance: { type: fade-up, delay: 0, duration: 500 }
transform: { rotate: 45, scaleX: 1.2, flipH: true }
clipPath: "polygon(0 0, 100% 0, 100% 85%, 0 100%)"
```

---

## Layout Patterns

### Single Column (most templates)

```yaml
- type: box
  variant: flat
  padding: [60, 160]
  children:
    - type: heading
      text: "{{ title }}"
    - type: divider
      variant: gradient
    - type: bullets
      items: {{ bullets }}
```

### Two-Panel Split

```yaml
- type: box
  variant: flat
  layout: { type: flex, direction: row }
  padding: 0
  height: 1080
  children:
    - type: box
      variant: flat
      width: {{ style.splitRatio }}     # e.g. 1250 for 65%
      padding: [80, 60]
      children: [...]
    - type: box
      background: {{ style.rightBg }}
      padding: [80, 60]
      verticalAlign: center
      children: [...]
```

### Grid of Cards

```yaml
- type: box
  variant: flat
  layout: { type: grid, columns: {{ style.columns }}, gap: 24 }
  children:
    {% for item in items %}
    - type: card
      title: "{{ item.title }}"
      body: "{{ item.body }}"
    {% endfor %}
```

### Centered Hero

```yaml
- type: box
  variant: flat
  padding: [0, 160]
  height: 1080
  layout: { type: flex, direction: column, justify: center, align: center }
  children:
    - type: heading
      text: "{{ title }}"
      textAlign: center
      fontSize: {{ style.titleSize }}
```

### Absolute Overlay (decorative elements)

```yaml
# Decorative shape behind flow content
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
        gradient: { type: linear, angle: 90, stops: [...] }
```

---

## Canvas & Sizing

- **Canvas**: 1920 x 1080 px (16:9, fixed)
- **Safe area**: x: 160..1760, y: 60..1020
- **Center**: (960, 540)
- **Estimate text height**: `lines * fontSize * lineHeight`
- **Estimate text width**: ~0.55 * fontSize * characterCount
- **z-order** (raw elements): Later elements render on top
- **Split ratios**: 50/50 = 960/960, 55/45 = 1056/864, 60/40 = 1152/768, 65/35 = 1250/670, 70/30 = 1344/576

---

## Theme Palettes

### Light Themes

| Theme | Accent | Bg | Fonts |
|-------|--------|----|-------|
| `modern` | `#4f6df5` | `#f8f9fc` | Inter |
| `elegant` | `#b8860b` | `#faf8f5` | Playfair Display / Inter |
| `paper-ink` | `#c41e3a` | `#faf9f7` | Cormorant Garamond / Source Serif 4 |
| `swiss-modern` | `#e63946` | `#ffffff` | Helvetica Neue |
| `split-pastel` | `#e8937a` | `#fef7f0` | Outfit |
| `notebook-tabs` | `#c7b8ea` | `#f8f6f1` | Bodoni Moda / DM Sans |
| `pastel-geometry` | `#5a7c6a` | `#c8d9e6` | Plus Jakarta Sans |
| `vintage-editorial` | `#e8d4c0` | `#f5f3ee` | Fraunces / Work Sans |

### Dark Themes

| Theme | Accent | Bg | Fonts |
|-------|--------|----|-------|
| `bold` | `#ff6b35` | `#0a0a0a` | Inter |
| `dark-tech` | `#00ffc8` | `#0a0a12` | JetBrains Mono / Inter |
| `bold-signal` | `#ff6b6b` | `#1a1a1a` | Inter |
| `electric-studio` | `#4361ee` | `#0a0a0a` | Manrope |
| `creative-voltage` | `#d4ff00` | `#1a1a2e` | Syne / Space Mono |
| `dark-botanical` | `#d4a574` | `#0f0f0f` | Cormorant / IBM Plex Sans |
| `neon-cyber` | `#ff00ff` | `#0a0014` | Orbitron / Inter |
| `terminal-green` | `#00ff41` | `#0a0a0a` | VT323 |

### Theme Tokens

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
