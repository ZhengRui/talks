# Replicate-Slides Skill Overhaul: Raw-First + Hidden Assumptions

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the replicate-slides skill to default to raw IR composition (instead of template matching) and document all implicit framework assumptions so Claude can predict rendering output.

**Architecture:** Two-file rewrite of `.claude/skills/replicate-slides/SKILL.md` and `reference.md`. No code changes. The skill shifts from template-first to raw-first for replication, while keeping templates for exact structural matches. The reference expands from a template catalog to a comprehensive IR + assumptions guide.

**Tech Stack:** Markdown/YAML documentation only. Verification via visual inspection with `bun run dev`.

---

### Task 1: Rewrite reference.md — IR Reference & Hidden Assumptions

**Files:**
- Modify: `.claude/skills/replicate-slides/reference.md`

This is the largest task — the reference becomes the comprehensive knowledge base that closes the gap between HTML/CSS and the YAML DSL.

**Step 1: Rewrite reference.md with all new sections**

Replace the entire file with the new reference containing these sections in order:

1. **Canvas & Coordinate System** — canvas dimensions, safe area, center point, split ratios
2. **IR Element Reference** — complete schema for all 9 element kinds with YAML examples
3. **CSS → IR Translation Table** — ~30 mappings from CSS concepts to IR equivalents
4. **Layout Modes (group + layout)** — flex-row, flex-column, grid behavior with exact rules
5. **Component Defaults Cheat Sheet** — every implicit default from every resolver
6. **Box Behavior Rules** — the 8 critical rules Claude must know
7. **Text Height Estimation** — the formula so Claude can predict layout
8. **Component vs Raw Decision Matrix** — when to use each
9. **Common Visual Patterns as IR** — 6-8 recipes (background panel, gradient strip, overlapping text, centered hero, etc.)
10. **Template Structural Signatures** — condensed from current reference (keep as-is but move to end)
11. **Template Creation Conventions** — condensed from current reference
12. **Theme Palettes** — keep as-is from current reference

Key content for each section:

**Canvas & Coordinate System:**
```
Canvas: 1920 × 1080 (fixed, all values in px)
Safe area: x:160, y:60 → x:1760, y:1020  (1600 × 960)
Center: (960, 540)
Split ratios: 50/50=960|960  55/45=1056|864  60/40=1152|768  65/35=1250|670  70/30=1344|576
z-order: later elements in YAML render on top
```

**IR Element Reference — all 9 kinds:**

Each kind documented with: all properties, types, defaults, and a YAML example.

- `text` — text (RichText), style (TextStyle: fontFamily, fontSize, fontWeight, fontStyle, color, lineHeight, textAlign, textShadow, letterSpacing, textTransform, verticalAlign, highlightColor)
- `shape` — shape (rect|circle|line|pill|arrow|triangle|chevron|diamond|star|callout), style (ShapeStyle: fill, stroke, strokeWidth, strokeDash, gradient, patternFill)
- `image` — src, objectFit (cover|contain), clipCircle
- `group` — children (LayoutElement[]), style (ShapeStyle for background), clipContent, layout (FlexLayout|GridLayout)
- `code` — code, language, style (fontFamily, fontSize, color, background, borderRadius, padding)
- `table` — headers (RichText[]), rows (RichText[][]), headerStyle, cellStyle, borderColor
- `list` — items (RichText[]), ordered, itemStyle (TextStyle), bulletColor, itemSpacing
- `video` — src, poster
- `iframe` — src

All elements share ElementBase: id, rect ({x,y,w,h}), opacity, borderRadius, shadow ({offsetX,offsetY,blur,spread?,color}), effects ({glow?,softEdge?,blur?}), border ({width,color,sides?,dash?}), entrance ({type,delay,duration}), animation (CSS shorthand string), clipPath, transform ({rotate?,scaleX?,scaleY?,flipH?,flipV?}), cssStyle (web-only Record<string,string>)

**CSS → IR Translation Table — key mappings:**

| CSS | IR Equivalent |
|-----|---------------|
| `background-color: #1a1a2e` | shape element: `style: { fill: "#1a1a2e" }` |
| `background: linear-gradient(90deg, #ff6b35, #00d4ff)` | shape element: `style: { gradient: { type: linear, angle: 90, stops: [{color: "#ff6b35", position: 0}, {color: "#00d4ff", position: 1}] } }` |
| `color: #fff; font-size: 42px; font-weight: 700` | text element: `style: { color: "#fff", fontSize: 42, fontWeight: 700 }` |
| `position: absolute; top: 100px; left: 200px; width: 300px; height: 50px` | any element: `rect: { x: 200, y: 100, w: 300, h: 50 }` |
| `display: flex; flex-direction: column; gap: 20px; align-items: center` | group element: `layout: { type: flex, direction: column, gap: 20, align: center }` |
| `display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px` | group element: `layout: { type: grid, columns: 3, gap: 24 }` |
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

**Layout Modes — exact behavioral rules:**

Flex-row:
- Children w/o explicit width → equal share of remaining space
- Children WITH explicit width → locked at that width
- gap applies between children on main axis only
- align (cross-axis): start|center|end|stretch — stretch fills container height
- justify (main-axis): start|center|end|space-between|space-around
- wrap: splits children into rows when total widths exceed container; row height = tallest child
- NO flex-grow/basis per child — only equal distribution

Flex-column:
- Same rules as row but transposed (height instead of width)
- Children w/o explicit height → equal share of remaining space
- align controls width: stretch fills container width, otherwise uses explicit width or container width

Grid:
- columns: fixed count, all columns equal width = (innerW - (cols-1)*gap) / cols
- NO column spanning, NO unequal column widths
- Row height: tallest child in row, or equal share if no explicit heights
- rowGap/columnGap override gap

**Component Defaults Cheat Sheet:**

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
| `quote` | 30 | 1.6 | 400 | left | theme.fontBody | fontStyle: italic, accent bar (4px left) |
| `card` title | 26 | 1.3 | 700 | left | theme.fontHeading | padding: 28, gap: 12 to body |
| `card` body | 24 | 1.6 | 400 | left | theme.fontBody | color: theme.textMuted |
| `code` | 24 | 1.6 | — | — | theme.fontMono | padding: 32 |
| `divider` solid | — | — | — | left | — | w: min(panel,200), h: 4, opacity: 0.4 |
| `divider` gradient | — | — | — | left | — | w: min(panel,200), h: 4, theme.accentGradient |
| `divider` ink | — | — | — | left | — | w: min(panel,200), h: 4, accent→transparent |
| `divider` border | — | — | — | left | — | w: full panel, h: 1, theme.border.color |
| `bullets` card | 30 | 1.6 | 400 | left | theme.fontBody | gap: 16, padding: 16, bgSecondary fill, 3px accent left bar |
| `bullets` plain | 30 | — | 400 | left | theme.fontBody | gap: 20, itemH: 52, ordered: badge(44px circle) |
| `bullets` list | 30 | 1.6 | 400 | left | theme.fontBody | gap: 10, bulletIndent: 30 |
| `image` | — | — | — | — | — | objectFit: contain, borderRadius: theme.radiusSm |
| `spacer` | — | — | — | — | — | flex: true (fills remaining space) |

**Box Behavior — 8 critical rules:**

1. Default layout is flex-column (even with no `layout` prop)
2. Default padding: 28px all sides
3. Default gap: 16px between children
4. Default variant: card (= cardBg fill + border + shadow + radius + clipContent)
5. `variant: flat` = no fill, no border, no shadow, no radius — invisible container
6. `variant: panel` = fill but no shadow, selective border
7. `fill: true` = height expands to parent height (like flex-grow: 1)
8. `verticalAlign` shifts content within box, not the box position itself

When to use each variant:
- `flat` for transparent structural containers (slide-level wrapper, split panels)
- `card` for themed content boxes with visual chrome
- `panel` for filled areas without shadow (sidebar panels, content areas)

**Text Height Estimation:**
```
charWidth = isBold ? fontSize × 0.57 : fontSize × 0.52
           (CJK chars: fontSize × 1.0)
paragraphWidth = sum(charWidth for each char in paragraph)
linesPerParagraph = ceil(paragraphWidth / containerWidth)
totalLines = sum(linesPerParagraph for each \n-separated paragraph)
height = totalLines × fontSize × lineHeight
       + (lineHeight < 1.3 ? fontSize × 0.15 : 0)   // descender padding
```

**Component vs Raw Decision Matrix:**

| Scenario | Use | Why |
|----------|-----|-----|
| Background color panel | raw shape | Exact rect, no component overhead |
| Gradient strip / decorative line | raw shape | Pixel-precise position + gradient |
| Watermark text at 2% opacity | raw text | Needs exact x,y + opacity |
| Overlapping elements | raw elements | Components can't overlap in flow |
| Content with bullet cards | `bullets` component | Card rendering has 15+ lines of layout logic |
| Code block | `code` component | Syntax highlighting + theme colors |
| Stat (value + label) | `stat` component | Handles two-line layout with proper gaps |
| Table with headers | `table` component (or raw) | Header/row/alternating-row styling |
| Two-panel split layout | `box` with flex-row children | Handles width distribution + padding |
| Vertically centered content | `box` with `verticalAlign: center` | Handles offset math internally |
| Equal-width columns | `box` with flex-row or `columns` | Auto-distributes width |

**Common Visual Patterns as IR:**

Include 6-8 complete YAML snippets for common replication patterns:
1. Full-bleed background panel (shape covering entire slide)
2. Two-panel split (flex-row group with two children)
3. Gradient accent strip (full-width 4px shape at top)
4. Centered text block (text element with textAlign center, manually computed x/y)
5. Overlapping watermark (large text at low opacity behind content)
6. Card with accent top border (group with fill + border sides:["top"])
7. Circular image (image with clipCircle at computed square dimensions)
8. Staggered entrance animation (multiple elements with incremental delays)

**Step 2: Verify the reference renders correctly**

Read through the file to check Markdown formatting, YAML code block syntax, table alignment.

**Step 3: Commit**

```bash
git add .claude/skills/replicate-slides/reference.md
git commit -m "docs(replicate-slides): comprehensive IR reference with hidden assumptions"
```

---

### Task 2: Rewrite SKILL.md — Raw-First Pipeline

**Files:**
- Modify: `.claude/skills/replicate-slides/SKILL.md`

**Step 1: Rewrite SKILL.md with raw-first approach**

Key structural changes from current skill:

**Frontmatter:** Keep name + description, update description to mention raw-first approach.

**Input section:** Keep as-is (screenshot/HTML/description priority).

**Three-Phase Pipeline — changes:**

Phase 1 (Analyze): Keep the same structured analysis format. Add one line: "Note which elements need pixel-precise placement (→ raw IR) vs semantic rendering (→ components)."

Phase 2 (Build): Complete rewrite. New name: "Build" instead of "Template Decision."

New decision flow:
```
1. Check for exact template match (same structure + style params cover differences)
   → YES: use existing template
   → NO: continue to step 2

2. Compose the slide using raw IR + selective components:
   a. Start with slide-level background (shape or backgroundImage)
   b. Place each visual element as raw IR at exact coordinates
   c. Substitute components ONLY for: bullets, code, tables, stats, cards
      (where the component genuinely simplifies complex rendering)
   d. Use box with flex/grid layout ONLY for equal-distribution layouts
   e. Wrap everything in a top-level box (variant: flat, padding: 0)

3. If this layout will be reused, extract into a .template.yaml
   → Otherwise, output as inline component tree
```

Phase 3 (Instantiate): Mostly same, but add raw-first YAML examples.

**Examples section:** Replace all 3 examples:

Example 1: Keep — existing template match (simple case, no change needed).

Example 2: Replace with a raw-first replication. Show a slide with:
- Dark background panel on the right third
- Heading + body on the left
- A decorative gradient strip at the top
- Stats on the right panel

Show the output using raw shapes for the background panel and gradient strip, components for heading/body/stats, positioned with explicit coordinates.

Example 3: Replace with a hybrid composition. Show a slide with:
- A complex grid of cards with icons
- Use box + grid layout for the card grid
- Use raw shapes for decorative elements
- Show the mixing of raw + components in one slide

**Step 2: Verify skill description and examples**

Read through for clarity, YAML validity, consistency with reference.md.

**Step 3: Commit**

```bash
git add .claude/skills/replicate-slides/SKILL.md
git commit -m "feat(replicate-slides): raw-first replication pipeline with hybrid composition"
```

---

### Task 3: Verification — Test with Visual Comparison

**Step 1: Pick a test slide and replicate it using the new skill**

Use the new skill's approach to replicate a moderately complex slide (two-panel split with decorative elements). Compare output against the original to verify the documentation is sufficient.

**Step 2: Iterate on documentation if gaps found**

Fix any missing defaults, incorrect translation mappings, or unclear patterns discovered during testing.

**Step 3: Final commit**

```bash
git add .claude/skills/replicate-slides/
git commit -m "docs(replicate-slides): refinements from visual verification"
```
