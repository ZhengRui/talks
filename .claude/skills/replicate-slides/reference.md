# Slide Replication Reference

Comprehensive IR element reference, layout behavior rules, hidden defaults, and CSS-to-IR translation for replicating slides with pixel-level accuracy.

---

## Canvas & Coordinate System

```
Canvas: 1920 × 1080 (fixed, all values in px)
Safe area: x:160, y:60 → x:1760, y:1020 (1600 × 960)
Center: (960, 540)
Split ratios: 50/50=960|960  55/45=1056|864  60/40=1152|768  65/35=1250|670  70/30=1344|576
z-order: later elements in YAML render on top
```

---

## IR Element Reference

All elements share the ElementBase properties below. There are 9 element kinds, each with additional kind-specific properties.

### ElementBase (shared by ALL elements)

| Property | Type | Description |
|----------|------|-------------|
| `id` | string, required | Unique element identifier |
| `rect` | `{x, y, w, h}`, required | Position and size in canvas px |
| `opacity` | number (0–1) | Transparency |
| `borderRadius` | number | Uniform corner radius in px |
| `shadow` | `{offsetX, offsetY, blur, spread?, color}` | Box shadow |
| `effects` | `{glow?: {color, radius, opacity?}, softEdge?: number, blur?: number}` | Visual effects |
| `border` | `{width, color, sides?: ("top"\|"right"\|"bottom"\|"left")[], dash?: "solid"\|"dash"\|"dot"\|"dashDot"}` | Border styling |
| `entrance` | `{type: "fade-up"\|"fade-in"\|"slide-left"\|"slide-right"\|"scale-up"\|"count-up"\|"none", delay, duration}` | Entrance animation |
| `animation` | string | Raw CSS animation shorthand |
| `clipPath` | string | CSS clip-path value |
| `transform` | `{rotate?, scaleX?, scaleY?, flipH?, flipV?}` | Transform operations |
| `cssStyle` | `Record<string,string>` | Web-only inline CSS overrides (ignored in PPTX) |
| `position` | `"absolute"` | Opt out of parent's flow layout |

### Kind 1: `text`

Rich text element with full typographic control.

| Property | Type | Description |
|----------|------|-------------|
| `text` | RichText (string or TextRun[]) | Text content |
| `style` | TextStyle | Typography and alignment |

**TextStyle properties:** `fontFamily`, `fontSize`, `fontWeight`, `fontStyle?`, `color`, `lineHeight`, `textAlign?`, `textShadow?`, `letterSpacing?`, `textTransform?`, `verticalAlign?`, `highlightColor?`

**TextRun properties:** `{text, bold?, italic?, underline?, strikethrough?, color?, fontSize?, fontFamily?, letterSpacing?, highlight?, superscript?, subscript?}`

```yaml
- kind: text
  id: title
  rect: { x: 160, y: 200, w: 1600, h: 70 }
  text: "Hello World"
  style: { fontFamily: "Inter, sans-serif", fontSize: 54, fontWeight: 700, color: "#fff", lineHeight: 1.15, textAlign: left }
```

### Kind 2: `shape`

Geometric shapes with fill, gradient, stroke, and pattern support.

| Property | Type | Description |
|----------|------|-------------|
| `shape` | `"rect"\|"circle"\|"line"\|"pill"\|"arrow"\|"triangle"\|"chevron"\|"diamond"\|"star"\|"callout"` | Shape type |
| `style` | ShapeStyle | Fill, stroke, gradient, pattern |

**ShapeStyle properties:** `fill?`, `stroke?`, `strokeWidth?`, `strokeDash?`, `gradient?: {type: "linear", angle, stops: [{color, position}]}`, `patternFill?: {preset, fgColor, fgOpacity?, bgColor?, bgOpacity?}`

**PatternPresets:** `narHorz`, `narVert`, `smGrid`, `lgGrid`, `dotGrid`, `pct5`, `pct10`, `dnDiag`, `upDiag`, `diagCross`

```yaml
- kind: shape
  id: bg-panel
  rect: { x: 0, y: 0, w: 1920, h: 1080 }
  shape: rect
  style: { fill: "#1a1a2e" }
```

### Kind 3: `image`

Positioned image with fit and clipping options.

| Property | Type | Description |
|----------|------|-------------|
| `src` | string | Image path or URL |
| `objectFit` | `"cover"\|"contain"` | How image fits within rect |
| `clipCircle?` | boolean | Clip to circular shape |

```yaml
- kind: image
  id: hero
  rect: { x: 960, y: 0, w: 960, h: 1080 }
  src: "hero.jpg"
  objectFit: cover
  borderRadius: 0
```

### Kind 4: `group`

Container element that holds child elements. Supports flex and grid layout modes.

| Property | Type | Description |
|----------|------|-------------|
| `children` | LayoutElement[] | Child elements |
| `style?` | ShapeStyle | Background fill for the group |
| `clipContent?` | boolean | Clip children to group bounds |
| `layout?` | FlexLayout \| GridLayout | Layout mode for children |

**FlexLayout:** `{type: "flex", direction: "row"|"column", gap?, align?: "start"|"center"|"end"|"stretch", justify?: "start"|"center"|"end"|"space-between"|"space-around", wrap?, padding?}`

**GridLayout:** `{type: "grid", columns, gap?, rowGap?, columnGap?, padding?}`

```yaml
- kind: group
  id: container
  rect: { x: 160, y: 200, w: 1600, h: 600 }
  layout: { type: flex, direction: column, gap: 20, align: start }
  children:
    - kind: text
      id: child-1
      rect: { x: 0, y: 0, w: 0, h: 0 }
      text: "Auto-laid-out child"
      style: { fontFamily: "Inter", fontSize: 28, fontWeight: 400, color: "#333", lineHeight: 1.6 }
```

### Kind 5: `code`

Code block with language-specific rendering.

| Property | Type | Description |
|----------|------|-------------|
| `code` | string | Source code content |
| `language?` | string | Programming language for highlighting |
| `style` | `{fontFamily, fontSize, color, background, borderRadius, padding}` | Code block styling |

```yaml
- kind: code
  id: snippet
  rect: { x: 160, y: 300, w: 1600, h: 400 }
  code: "const x = 42;\nconsole.log(x);"
  language: javascript
  style: { fontFamily: "JetBrains Mono", fontSize: 24, color: "#e0e0e0", background: "#1e1e2e", borderRadius: 12, padding: 32 }
```

### Kind 6: `table`

Table with headers and rows, styled independently.

| Property | Type | Description |
|----------|------|-------------|
| `headers` | RichText[] | Column header text |
| `rows` | RichText[][] | Row data (array of arrays) |
| `headerStyle` | TextStyle & `{background}` | Header cell styling |
| `cellStyle` | TextStyle & `{background, altBackground}` | Body cell styling |
| `borderColor` | string | Border color between cells |

```yaml
- kind: table
  id: data-table
  rect: { x: 160, y: 300, w: 1600, h: 500 }
  headers: ["Name", "Role", "Status"]
  rows: [["Alice", "Engineer", "Active"], ["Bob", "Designer", "Away"]]
  headerStyle: { fontSize: 22, fontWeight: 700, color: "#fff", background: "#333" }
  cellStyle: { fontSize: 20, fontWeight: 400, color: "#333", background: "#fff", altBackground: "#f5f5f5" }
  borderColor: "#e0e0e0"
```

### Kind 7: `list`

Ordered or unordered list with bullet styling.

| Property | Type | Description |
|----------|------|-------------|
| `items` | RichText[] | List item text |
| `ordered` | boolean | Numbered (true) or bulleted (false) |
| `itemStyle` | TextStyle | Style for each list item |
| `bulletColor?` | string | Color of bullets or numbers |
| `itemSpacing` | number | Vertical spacing between items |

```yaml
- kind: list
  id: features
  rect: { x: 160, y: 300, w: 1600, h: 400 }
  items: ["Fast startup", "Low memory", "Type safe"]
  ordered: false
  itemStyle: { fontFamily: "Inter", fontSize: 28, fontWeight: 400, color: "#333", lineHeight: 1.6 }
  bulletColor: "#4f6df5"
  itemSpacing: 16
```

### Kind 8: `video`

Video player element.

| Property | Type | Description |
|----------|------|-------------|
| `src` | string | Video source URL |
| `poster?` | string | Poster image shown before playback |

```yaml
- kind: video
  id: demo
  rect: { x: 160, y: 200, w: 1600, h: 700 }
  src: "demo.mp4"
  poster: "demo-poster.jpg"
```

### Kind 9: `iframe`

Embedded web content.

| Property | Type | Description |
|----------|------|-------------|
| `src` | string | URL to embed |

```yaml
- kind: iframe
  id: embed
  rect: { x: 160, y: 200, w: 1600, h: 700 }
  src: "https://example.com"
```

---

## CSS to IR Translation Table

| CSS | IR Equivalent |
|-----|---------------|
| `background-color: #1a1a2e` | shape element: `style: { fill: "#1a1a2e" }` |
| `background: linear-gradient(90deg, #ff6b35, #00d4ff)` | shape: `style: { gradient: { type: linear, angle: 90, stops: [{color: "#ff6b35", position: 0}, {color: "#00d4ff", position: 1}] } }` |
| `color: #fff; font-size: 42px; font-weight: 700` | text: `style: { color: "#fff", fontSize: 42, fontWeight: 700 }` |
| `position: absolute; top: 100px; left: 200px; width: 300px; height: 50px` | any element: `rect: { x: 200, y: 100, w: 300, h: 50 }` |
| `display: flex; flex-direction: column; gap: 20px; align-items: center` | group: `layout: { type: flex, direction: column, gap: 20, align: center }` |
| `display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px` | group: `layout: { type: grid, columns: 3, gap: 24 }` |
| `border-left: 3px solid #c41e3a` | `border: { width: 3, color: "#c41e3a", sides: ["left"] }` |
| `border-radius: 12px` | `borderRadius: 12` |
| `box-shadow: 0 4px 24px rgba(0,0,0,0.1)` | `shadow: { offsetX: 0, offsetY: 4, blur: 24, color: "rgba(0,0,0,0.1)" }` |
| `opacity: 0.8` | `opacity: 0.8` |
| `transform: rotate(45deg) scaleX(1.2)` | `transform: { rotate: 45, scaleX: 1.2 }` |
| `clip-path: polygon(...)` | `clipPath: "polygon(...)"` |
| `text-align: center` | text style: `textAlign: "center"` |
| `text-transform: uppercase` | text style: `textTransform: "uppercase"` |
| `letter-spacing: 2px` | text style: `letterSpacing: 2` |
| `line-height: 1.4` | text style: `lineHeight: 1.4` |
| `font-style: italic` | text style: `fontStyle: "italic"` |
| `overflow: hidden` | group: `clipContent: true` |
| `filter: blur(4px)` | `effects: { blur: 4 }` |
| `border: 1px dashed #ccc` | `border: { width: 1, color: "#ccc", dash: "dash" }` |
| `<span style="color:red">text</span>` inside text | TextRun: `[{text: "text", color: "red"}]` |
| `vertical-align: middle` on single-line text | text style: `verticalAlign: "middle"` |

### NOT Supported in IR

These CSS features have no IR equivalent and must be worked around:

- Radial gradients
- Per-corner border-radius (only uniform `borderRadius`)
- `backdrop-filter`
- `mix-blend-mode`
- `text-stroke` / `-webkit-text-stroke`
- Inset box-shadow
- `mask-image`
- SVG paths (use `clipPath` polygon approximations instead)

---

## Layout Modes (group + layout)

Layout modes control how a `group` element positions its children. Understanding these rules is critical for predicting rendered output.

### Flex-Row Rules

- Children **without** explicit width → split remaining space equally (there is NO flex-grow/flex-basis; it is always equal division)
- Children **with** explicit width → locked at that width; remaining space distributed among width-less children
- `gap`: px between children on the **main axis only** (horizontal gaps between columns)
- `align` (cross-axis): `start` | `center` | `end` | `stretch`
  - `stretch` fills the container height
  - Other values use the child's explicit height, or fall back to the container height
- `justify` (main-axis): `start` | `center` | `end` | `space-between` | `space-around`
  - Only meaningful when children have explicit widths (otherwise children fill all available space and there is nothing to distribute)
- `wrap: true` splits children into multiple rows when total widths exceed container width
  - Row height in wrap mode = tallest child's explicit height in that row
- `padding`: insets the layout area (reduces available space for children)

### Flex-Column Rules

Same as flex-row but transposed (height and width swap roles):

- Children **without** explicit height → split remaining vertical space equally
- Children **with** explicit height → locked at that height
- `gap`: px between children on the **main axis** (vertical gaps between rows)
- `align` controls **width**: `stretch` = container width, otherwise uses explicit width or container width
- `justify` controls **vertical distribution**: only meaningful when children have explicit heights
- `padding`: insets the layout area

### Grid Rules

- `columns`: fixed column count; ALL columns have equal width = `(innerW - (cols-1) * gap) / cols`
- NO column spanning; NO unequal column widths
- Row height: tallest explicit child height in that row, or equal share of remaining height if no child has an explicit height
- `rowGap` / `columnGap` override the uniform `gap` value when specified
- `padding`: insets the grid area

### Absolute Positioning

- Any element with `position: "absolute"` is **removed from flow layout**
- Positioned at its own `rect` coordinates within the parent group's coordinate space
- Z-order preserved by YAML order (mixed with flow elements — absolute elements render in document order alongside flow elements)

---

## Component Defaults Cheat Sheet

These are the implicit defaults applied by each component resolver. Claude must know these to predict rendered output without trial and error.

| Component | fontSize | lineHeight | fontWeight | textAlign | fontFamily | Other Defaults |
|-----------|----------|------------|------------|-----------|------------|----------------|
| `heading` (level 1) | 54 | 1.15 | 700 | left | theme.fontHeading | — |
| `heading` (level 2) | 42 | 1.15 | 700 | left | theme.fontHeading | — |
| `heading` (level 3) | 34 | 1.15 | 700 | left | theme.fontHeading | — |
| `body` | 28 | 1.6 | 400 | left | theme.fontBody | — |
| `text` | 28 | 1.6 | 400 | left | theme.fontBody | — |
| `stat` value | 64 | 1.15 | 700 | left | theme.fontHeading | color: theme.accent |
| `stat` label | 24 | 1.5 | 400 | left | theme.fontBody | color: theme.textMuted, gap: 8px above |
| `tag` | 20 | 1.0 | 600 | center | theme.fontBody | padding: [12,20], pill bg: accent+"22", border: 1px accent |
| `quote` | 30 | 1.6 | 400 | left | theme.fontBody | fontStyle: italic, accent bar 4px left when left-aligned |
| `card` title | 26 | 1.3 | 700 | left | theme.fontHeading | padding: 28, gap: 12 to body |
| `card` body | 24 | 1.6 | 400 | left | theme.fontBody | color: theme.textMuted |
| `code` | 24 | 1.6 | — | — | theme.fontMono | padding: 32, bg: theme.codeBg |
| `divider` solid | — | — | — | left | — | w: min(panel,200), h: 4, opacity: 0.4 |
| `divider` gradient | — | — | — | left | — | w: min(panel,200), h: 4, theme.accentGradient |
| `divider` ink | — | — | — | left | — | w: min(panel,200), h: 4, accent→transparent |
| `divider` border | — | — | — | left | — | w: full panel, h: 1, theme.border.color |
| `bullets` card | 30 | 1.6 | 400 | left | theme.fontBody | gap: 16, padding: 16, bgSecondary fill, 3px accent left bar |
| `bullets` plain | 30 | — | 400 | left | theme.fontBody | gap: 20, itemH: 52, ordered: badge 44px circle |
| `bullets` list | 30 | 1.6 | 400 | left | theme.fontBody | gap: 10, bulletIndent: 30 |
| `image` | — | — | — | — | — | objectFit: contain, borderRadius: theme.radiusSm |
| `spacer` | — | — | — | — | — | flex: true (fills remaining space) when no explicit height |

---

## Box Behavior Rules

The `box` component is the primary layout container. These 8 rules govern its behavior:

1. **Default layout is flex-column** — even with no `layout` prop specified, children stack vertically
2. **Default padding: 28px all sides** — CSS-style values: `number` | `[vert, horiz]` | `[top, right, bottom, left]`
3. **Default gap: 16px** between children
4. **Default variant: "card"** = cardBg fill + theme border + shadow + radius + clipContent
5. **`variant: "flat"`** = no fill, no border, no shadow, no radius, no clipContent — invisible structural container
6. **`variant: "panel"`** = fill, no shadow, selective border only if explicitly set
7. **`fill: true`** = height expands to fill parent (like flex-grow: 1)
8. **`verticalAlign`** (`"top"` | `"center"` | `"bottom"`) shifts content within the box, not the box position itself

### When to Use Each Variant

- **`flat`** — transparent structural containers (slide-level wrapper, split panels with no visible chrome)
- **`card`** (default) — themed content boxes with visible background, border, shadow
- **`panel`** — filled areas without shadow (sidebar panels, content areas with background but no card chrome)

### Additional Box Properties

- `maxWidth` constrains and centers the box horizontally within its parent
- `accentTop: true` adds a 3px accent-colored top border
- `background` overrides the default cardBg fill (works with all variants including flat)
- Children's `margin`: CSS-style values, baked into layout calculations (vertical margin into placeholder height for flex-column, horizontal for flex-row)

---

## Text Height Estimation

The formula the framework uses to calculate text element heights. Use this to predict how much vertical space text will consume.

```
charWidth = isBold ? fontSize × 0.57 : fontSize × 0.52
            (CJK characters: fontSize × 1.0)

For each \n-separated paragraph:
  paragraphWidth = sum(charWidth for each character)
  lines = max(1, ceil(paragraphWidth / containerWidth))

totalLines = sum of lines across all paragraphs
height = totalLines × fontSize × lineHeight
       + (lineHeight < 1.3 ? fontSize × 0.15 : 0)   ← descender padding
```

### Quick Estimates for Common Cases

| Element | Parameters | Height per Line |
|---------|-----------|----------------|
| Heading (level 1) | 54px, bold, lineHeight 1.15 | ~62px per line, +8px descender |
| Body text | 28px, lineHeight 1.6 | ~45px per line |
| Single-line stat value | 64px, lineHeight 1.15 | ~74px |
| Tag | 20px, lineHeight 1.0 | ~20px + padding |

---

## Component vs Raw Decision Matrix

| Scenario | Use | Why |
|----------|-----|-----|
| Background color panel | raw `kind: shape` | Exact rect at exact position, no component overhead |
| Gradient strip or decorative line | raw `kind: shape` | Pixel-precise position + gradient fill |
| Watermark text at low opacity | raw `kind: text` | Needs exact x,y + opacity control |
| Overlapping/layered elements | raw elements | Components in flow layout can't overlap |
| Precise text at specific coordinates | raw `kind: text` | Full control over position and style |
| Circular decorative shape | raw `kind: shape` (circle) | Exact size and position |
| Content with bullet cards | `bullets` component | Card rendering has complex internal layout (bg, accent bar, padding) |
| Code block with syntax highlighting | `code` component | Handles theme colors, padding, font |
| Stat value + label pair | `stat` component | Handles two-line layout with proper gap and sizing |
| Table with headers and rows | `table` component | Header/row/alternating styling built-in |
| Two-panel split layout | `box` with flex-row children | Handles width distribution + padding |
| Vertically centered content | `box` with `verticalAlign: center` | Handles offset math internally |
| Equal-width card columns | `box` with flex-row or `columns` | Auto-distributes width |
| Grid of repeated items | `grid` component | Equal columns + row layout |

**Rule of thumb:** Use raw when POSITION matters. Use components when STRUCTURE matters.

---

## Common Visual Patterns as IR

Complete YAML snippets for frequently needed replication patterns. Each is a `children` array entry ready to use in a template.

### 1. Full-Bleed Background Panel

Shape covering entire slide or a portion:

```yaml
- kind: shape
  id: bg-panel
  rect: { x: 1250, y: 0, w: 670, h: 1080 }
  shape: rect
  style: { fill: "#1a1a2e" }
```

### 2. Gradient Accent Strip

Full-width thin line at top:

```yaml
- kind: shape
  id: accent-strip
  rect: { x: 0, y: 0, w: 1920, h: 4 }
  shape: rect
  style:
    gradient: { type: linear, angle: 90, stops: [{ color: "#ff6b35", position: 0 }, { color: "#00d4ff", position: 1 }] }
```

### 3. Centered Text Block

Heading centered on slide:

```yaml
- kind: text
  id: title
  rect: { x: 160, y: 440, w: 1600, h: 70 }
  text: "Centered Title"
  style: { fontFamily: "Inter, sans-serif", fontSize: 56, fontWeight: 700, color: "#ffffff", lineHeight: 1.15, textAlign: center }
```

### 4. Overlapping Watermark

Large text behind content at low opacity:

```yaml
- kind: text
  id: watermark
  rect: { x: -50, y: 100, w: 1000, h: 600 }
  text: "01"
  style: { fontFamily: "Inter, sans-serif", fontSize: 400, fontWeight: 900, color: "rgba(255,255,255,0.03)", lineHeight: 1.0 }
```

### 5. Card with Accent Top Border

Grouped content with visual chrome:

```yaml
- kind: group
  id: card-0
  rect: { x: 160, y: 200, w: 740, h: 300 }
  style: { fill: "#1e1e2e" }
  borderRadius: 12
  border: { width: 3, color: "#4f6df5", sides: ["top"] }
  shadow: { offsetX: 0, offsetY: 4, blur: 24, color: "rgba(0,0,0,0.15)" }
  clipContent: true
  children:
    - kind: text
      id: card-0-title
      rect: { x: 28, y: 28, w: 684, h: 34 }
      text: "Card Title"
      style: { fontFamily: "Inter, sans-serif", fontSize: 26, fontWeight: 700, color: "#ffffff", lineHeight: 1.3, textAlign: left }
    - kind: text
      id: card-0-body
      rect: { x: 28, y: 74, w: 684, h: 90 }
      text: "Card body text goes here with supporting details."
      style: { fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 400, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, textAlign: left }
```

### 6. Flex Container for Equal Columns

Group with flex-row layout for auto-distributed columns:

```yaml
- kind: group
  id: cols
  rect: { x: 160, y: 200, w: 1600, h: 600 }
  layout: { type: flex, direction: row, gap: 32, align: stretch }
  children:
    - kind: group
      id: col-0
      rect: { x: 0, y: 0, w: 0, h: 0 }
      style: { fill: "#f0f0f0" }
      borderRadius: 8
      children: []
    - kind: group
      id: col-1
      rect: { x: 0, y: 0, w: 0, h: 0 }
      style: { fill: "#f0f0f0" }
      borderRadius: 8
      children: []
```

Note: children with `w:0, h:0` get auto-sized by the flex layout engine (equal share of available space).

### 7. Staggered Entrance Animation

Elements appearing sequentially with increasing delay:

```yaml
- kind: text
  id: line-1
  rect: { x: 160, y: 300, w: 1600, h: 50 }
  text: "First line"
  style: { fontFamily: "Inter", fontSize: 32, fontWeight: 400, color: "#333", lineHeight: 1.4 }
  entrance: { type: fade-up, delay: 0, duration: 600 }
- kind: text
  id: line-2
  rect: { x: 160, y: 370, w: 1600, h: 50 }
  text: "Second line"
  style: { fontFamily: "Inter", fontSize: 32, fontWeight: 400, color: "#333", lineHeight: 1.4 }
  entrance: { type: fade-up, delay: 100, duration: 600 }
- kind: text
  id: line-3
  rect: { x: 160, y: 440, w: 1600, h: 50 }
  text: "Third line"
  style: { fontFamily: "Inter", fontSize: 32, fontWeight: 400, color: "#333", lineHeight: 1.4 }
  entrance: { type: fade-up, delay: 200, duration: 600 }
```

### 8. Image with Rounded Corners

Positioned image with shadow:

```yaml
- kind: image
  id: photo
  rect: { x: 1000, y: 100, w: 800, h: 880 }
  src: "hero-photo.jpg"
  objectFit: cover
  borderRadius: 16
  shadow: { offsetX: 0, offsetY: 8, blur: 32, color: "rgba(0,0,0,0.2)" }
```

---

## Template Structural Signatures

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

## Template Creation Conventions

### File Location

```
content/[slug]/templates/<descriptive-name>.template.yaml
```

The DSL loader checks per-presentation templates first, then falls back to built-in. No registry update needed — auto-discovered from filesystem.

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

### Theme Token Usage

**Use theme tokens when:**
- The color matches the presentation's theme accent/bg/text
- You want the template to work across different themes
- The original slide clearly follows a theme palette

**Use hardcoded hex when:**
- The color is a specific design choice (a brand color, a unique accent)
- The color doesn't match any theme token
- Exactness matters more than theme-switchability

**Theme tokens available in template context:**
```yaml
color: {{ theme.accent }}
background: {{ theme.bgSecondary }}
```

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
