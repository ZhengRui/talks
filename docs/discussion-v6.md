# Design v6: The Missing Component Layer

## Background

Design v5 identified the expressiveness gap between `frontend-slides` (freeform HTML generation) and `talks` (YAML + template + layout model IR). This document digs deeper into **why** that gap exists and where the architectural fix belongs.

## Key Insight: The HTML Is Not Freeform

Initial assumption: frontend-slides achieves expressiveness through "freeform HTML" — Claude can write anything CSS supports.

**Actual finding**: the generated HTML follows a strict, well-organized component tree. Every slide in the five-dynasties presentation uses the same pattern:

```html
<section class="slide slide-split">           <!-- layout type -->
    <div class="brush-divider"></div>          <!-- decorator -->
    <div class="panel-left">                   <!-- layout container -->
        <span class="dynasty-tag">总览</span>  <!-- component: tag -->
        <h2>何为五代十国？</h2>                  <!-- component: heading -->
        <div class="ink-divider"></div>         <!-- component: divider -->
        <ul class="bullet-list">               <!-- component: bullets -->
            <li>唐朝灭亡至北宋统一之间</li>
        </ul>
    </div>
    <div class="panel-right">                  <!-- layout container -->
        <div class="stat-row">                 <!-- component: stats -->
            <div class="stat">
                <div class="stat-number">72</div>
                <div class="stat-label">年</div>
            </div>
        </div>
        <div class="seal">史</div>             <!-- component: seal -->
    </div>
</section>
```

The component vocabulary for this presentation is about 12 items:

| Component | HTML class | What it does |
|---|---|---|
| Tag / badge | `.dynasty-tag` | Colored label (e.g., "五代 · 其一") |
| Ink divider | `.ink-divider` | Horizontal gradient-to-transparent line |
| Brush divider | `.brush-divider` | Vertical gradient line between panels |
| Bullet list | `.bullet-list` | Styled unordered list |
| Card | `.card` | Bordered box with title + body text |
| Seal stamp | `.seal` | Rotated bordered square with single character |
| Stat | `.stat` | Large number + small label |
| Timeline | `.timeline` | Vertical line with year + event entries |
| Quote | `.quote` | Italic text with left border |
| Kingdom grid | `.kingdoms-grid` | 5×2 grid of structured cards |
| Era badge | `.era-badge` | Outlined pill with dot indicator |
| Dark panel | `.panel-right` bg | Right half with dark background |

Two layout patterns: `slide-split` (two panels) and `slide-full` (centered content).

## The PPTX Script Mirrors This Exactly

The "bespoke" Python script has the **same component vocabulary** as helper functions:

```python
add_tag(slide, ..., '总览')           # ↔ <span class="dynasty-tag">
add_ink_divider(slide, ...)           # ↔ <div class="ink-divider">
add_brush_divider(slide)              # ↔ <div class="brush-divider">
add_bullet_list(slide, ..., [...])    # ↔ <ul class="bullet-list">
add_card(slide, ..., dark=True)       # ↔ <div class="card card-dark">
add_seal(slide, ..., '词')            # ↔ <div class="seal">
add_stat(slide, ..., '72', '年')      # ↔ <div class="stat">
add_timeline_entry(slide, ...)        # ↔ <div class="timeline-item">
add_dark_panel(slide)                 # ↔ <div class="panel-right"> background
```

The only difference: **who does the pixel math.**
- HTML: CSS does it (flexbox, grid, `clamp()`) — the browser is the layout engine
- PPTX: Claude hardcodes it (`Inches(0.8)`, `Pt(48)`) — no layout engine

This is why the PPTX replicates the HTML well (minus animations): both are built from the same ~12 components, assembled in the same order, with the same visual rules per component.

## Three Levels of Abstraction

This analysis reveals three distinct levels:

```
Level 3 — Semantic components    "put a seal stamp here", "add a stat showing 72/年"
Level 2 — Layout elements        shape at {x, y, w, h} + text at {x, y, w, h}
Level 1 — Pixels                 rendered on screen (web DOM or PPTX shapes)
```

### How frontend-slides uses these levels

**Web path:**
```
Claude writes Level 3    →  <div class="seal">词</div>
CSS resolves Level 2     →  width: 65px, border: 2px, rotate(5°), position from flexbox
Browser renders Level 1  →  pixels on screen
```

CSS acts as an invisible Level 2 — the developer never explicitly writes pixel coordinates. Flexbox and grid do the spatial math automatically.

**PPTX path:**
```
Claude writes Level 3    →  add_seal(slide, Inches(7), Inches(5.5), '词')
Skips Level 2            →  Claude hardcodes the pixel positions directly
python-pptx renders L1   →  shapes in the .pptx file
```

For PPTX, Claude does the layout math in its head and jumps from Level 3 straight to Level 1. There is no layout engine.

### How talks uses these levels

```
User writes Level 3-ish  →  template: comparison, left: [...], right: [...]
Template resolves Level 2 →  TextElement at {x:100, y:200, w:760, h:60}
Renderers handle Level 1  →  web DOM / PPTX shapes
```

We DO have Level 2 — that's our `LayoutElement` IR. Both renderers consume it. This is our architectural advantage.

## The Gap: YAML Templates Are Data Forms, Not Component Trees

Our problem is not that we lack levels — it's that our Level 3 items are **too big** and our Level 2 items are **too small**. And critically, our YAML format can't express component hierarchy at all.

### Current YAML is a form, not a tree

The `comparison` template type in TypeScript:

```typescript
export interface ComparisonSlideData {
  template: "comparison";
  title?: string;
  left: { heading: string; items: string[] };   // string[] — pure data
  right: { heading: string; items: string[] };   // no component types
}
```

The YAML that fills it:

```yaml
- template: comparison
  title: "何为五代十国？"
  left:
    heading: "开国"
    items:                      # just strings — the template decides
      - "唐朝灭亡至北宋统一之间"   # how to render ALL of them identically
      - "中原先后经历五个短命王朝"
  right:
    heading: "覆亡"
    items:
      - "72年"                  # this SHOULD be a big stat, but it's
      - "5个中原王朝"            # just a string — same as everything else
```

`items: string[]` is a **form field** — fill in text, the template decides the visual structure. There's no way to say "this item is a stat with a large number" or "put a seal after the bullets." Every item gets the same treatment.

Compare with what frontend-slides produces:

```html
<div class="panel-left">
    <span class="dynasty-tag">总览</span>     <!-- I am a tag -->
    <h2>何为五代十国？</h2>                     <!-- I am a heading -->
    <div class="ink-divider"></div>            <!-- I am a divider -->
    <ul class="bullet-list">                   <!-- I am a bullet list -->
        <li>唐朝灭亡至北宋统一之间</li>
    </ul>
</div>
<div class="panel-right">
    <div class="stat">                         <!-- I am a stat (big number) -->
        <div class="stat-number">72</div>
        <div class="stat-label">年</div>
    </div>
    <div class="seal">史</div>                 <!-- I am a seal stamp -->
</div>
```

Every element declares **what it is** — tag, heading, divider, bullets, stat, seal. The HTML is a **component tree** with typed nodes.

### The abstraction gap

```
frontend-slides Level 3:     tag  card  seal  stat  timeline  quote  bullets  divider
                               ↓    ↓     ↓     ↓      ↓        ↓       ↓       ↓
                             (CSS figures out positions — flexbox stacks them vertically)

talks Level 3:               comparison   bullets   timeline   stats   icon-grid   quote
                             (35 WHOLE-SLIDE templates — each is a fixed, monolithic layout)
                               ↓
talks Level 2:               TextElement   ShapeElement   GroupElement   ListElement
                             (7 raw geometry primitives with x/y/w/h pixel coordinates)
```

In frontend-slides, components are **small and composable** — you can put a tag, then bullets, then a quote, then a seal in the same panel. Any combination works.

In talks, templates are **large and rigid** — the `comparison` template always produces: title → left column items → right column items. You can't add a seal, or mix bullets with stats, or put a quote next to a timeline.

Our Level 2 elements (text, shape, group) are powerful enough to represent any of those components. A seal IS just a rotated shape + centered text in a group. A tag IS just a small rectangle + text. But no template composes them that way, and the YAML format can't express the intent.

**What's missing is a component layer between templates and raw elements:**

```
Proposed architecture:

  Level 3.5:  YAML templates (optional shorthand for common slide patterns)
                ↓
  Level 3:    tag  card  seal  stat  timeline  quote  bullets  divider ...
              (composable components — mix and match freely per slide)
                ↓
  Level 2:    TextElement  ShapeElement  GroupElement  ...
              (existing IR — raw positioned elements, unchanged)
                ↓
  Level 1:    LayoutRenderer (web) / exportPptx (PPTX)
              (existing renderers — unchanged)
```

## Where Do Components Come From?

### What the skill actually specifies

SKILL.md provides **scaffolding**, not components:
- The `.slide` / `.slide-content` container pattern
- CSS custom properties architecture (`:root { --title-size: clamp(...) }`)
- Animation class patterns (`.reveal`, `.reveal-scale`, `.reveal-left`)
- Content density limits per slide type (max 6 bullets, max 6 cards, etc.)
- Style-to-feeling mappings ("dramatic = slow fade-ins, dark backgrounds")

It never says "create a `.dynasty-tag` class" or "organize your HTML into semantic components."

### What the style presets actually specify

Each of the 12 presets in STYLE_PRESETS.md defines: a vibe (1-3 adjectives), a layout pattern, specific font pairings, CSS custom property values, and **signature elements**.

Here's what Paper & Ink actually says:

```
**Vibe:** Editorial, literary, thoughtful
**Typography:** Cormorant Garamond + Source Serif 4
**Colors:** Warm cream (#faf9f7), charcoal (#1a1a1a), crimson accent (#c41e3a)
**Signature:** Drop caps, pull quotes, elegant horizontal rules
```

The specified signature elements are: **drop caps, pull quotes, elegant horizontal rules.**

Not seals. Not brush dividers. Not dynasty tags. Not ink washes. **Claude invented all of those.**

### How Claude invents components: mood × content

Claude's creative process combines the style preset's **mood** with the presentation's **content**:

1. **The preset gives a mood**: "editorial, literary, thoughtful" + warm cream + crimson accent
2. **Claude interprets mood against content**: Chinese dynastic history + literary aesthetic = what visual elements fit?
3. **Claude invents appropriate components**: red seal stamps (traditional Chinese authentication marks), brush-stroke dividers (ink calligraphy aesthetic), dynasty tags (historical era labeling), ink wash gradients (Chinese painting technique)
4. **Claude naturally organizes them as reusable CSS classes**: because that's standard HTML/CSS practice — define `.seal { ... }` once, reuse across slides

Other presets would yield completely different inventions:

| Preset | Vibe | Content example | Likely invented components |
|---|---|---|---|
| Paper & Ink | literary, thoughtful | Chinese history | seal stamps, brush dividers, dynasty tags |
| Neon Cyber | futuristic, techy | AI startup pitch | glow cards, terminal blocks, data streams |
| Swiss Modern | precise, Bauhaus | Annual metrics report | data pills, metric rows, grid overlays |
| Dark Botanical | elegant, premium | Luxury brand | soft gradient circles, gold accent lines |
| Terminal Green | hacker aesthetic | Dev tools API | command prompts, syntax blocks, cursor blinks |

The component vocabulary is **content-dependent and style-dependent**, not universal. A "seal" only makes sense for East Asian content. A "terminal block" only makes sense for developer content. This content-aware creativity is the real source of expressiveness — not just "freeform HTML."

### The structured output is emergent, not instructed

Claude generates well-organized component trees (semantic class names, reusable styles, consistent patterns) not because the skill tells it to, but because:
- It's trained on millions of well-structured HTML codebases
- Component-based CSS is modern web development best practice
- Writing `.card { ... }` once and reusing it is just good engineering
- The SKILL.md HTML architecture section provides enough scaffolding (`.slide`, `.slide-content`) that Claude naturally extends the pattern with its own components

### Implication for talks

This means a **fixed menu of 20 components cannot replicate the expressiveness**. The power comes from Claude inventing the right components for each unique combination of style + content. No predetermined list would include "dynasty tag" for a Chinese history deck or "glow card" for a cyberpunk pitch.

However, our existing 7 `LayoutElement` types (text, shape, group, image, code, table, list) ARE expressive enough to represent any component Claude might invent. A seal IS a rotated ShapeElement + centered TextElement in a GroupElement. A dynasty tag IS a small ShapeElement + TextElement. The primitives can compose anything — the question is who does the composing and how.

## Comparing the Two IRs

| | HTML (frontend-slides IR) | LayoutPresentation (our IR) |
|---|---|---|
| **Abstraction** | High — semantic components (card, seal, tag) | Low — geometry primitives (text, shape, group) |
| **Layout engine** | CSS (flexbox, grid, `clamp()`) | Template functions (hardcoded px on 1920×1080) |
| **Composability** | Any component in any panel, freely mixed | One template per slide, fixed slots |
| **Vocabulary** | ~12 per presentation, **invented per style** | 7 element types, **universal and fixed** |
| **Dual-target** | No — PPTX needs a separate bespoke script | Yes — same IR drives both renderers |
| **Fidelity loss** | Web: zero. PPTX: style-faithful but no animations | Web: minimal. PPTX: minimal (same IR) |
| **Portability** | Any browser, zero dependencies | Needs our renderers |
| **Determinism** | No — Claude generates differently each time | Yes — same input, same output |

The last vocabulary row is crucial. frontend-slides' power comes from Claude inventing components per presentation. Our constraint is that components must be predefined because both renderers need to handle them. But since components resolve to existing IR primitives, we only need to build the **resolver**, not modify renderers.

## Design Goals

Any v6 architecture must satisfy three simultaneous requirements:

1. **Claude as designer** — can invent visual vocabulary (seals, dynasty tags, glow cards) based on mood × content, not limited to a fixed menu
2. **Spectrum of control** — from fully constrained (pick a template, fill in fields) to guided (follow conventions but compose freely) — with the ability to graduate good freeform patterns into named templates over time
3. **Dual-target rendering preserved** — everything resolves to `LayoutPresentation` (Level 2 IR), web and PPTX renderers unchanged

## Proposed Architecture: Level 3 IR

### The idea

Create a **component-tree IR** (Level 3) as a new authoring format. Claude generates Level 3; a **resolver** maps it to Level 2 (existing `LayoutPresentation`). Renderers remain untouched.

The data flow for each tier of the control spectrum:

```
Fully constrained        Guided                    Fully creative
─────────────────────────────────────────────────────────────────
template: comparison     Level 3 IR with           Level 3 IR with
left: [...]              predefined components     raw escape hatch
right: [...]             (tag, card, stat, etc.)   (embed Level 2 directly)
     ↓                        ↓                         ↓
YAML → template fn       Level 3 resolver          Level 3 resolver + passthrough
     ↓                        ↓                         ↓
     Level 2 IR               Level 2 IR                Level 2 IR
     ↓                        ↓                         ↓
     renderers                renderers                 renderers
```

- **Constrained**: existing YAML templates, unchanged. User writes YAML, picks template, fills in fields.
- **Guided**: Claude generates Level 3 IR using predefined components (tag, card, stat, bullets, etc.). The resolver handles pixel positioning. Claude has composition freedom but uses known building blocks.
- **Fully creative**: Claude uses predefined components PLUS a `raw` escape hatch that embeds `LayoutElement[]` directly for anything the menu can't express.

### What the Level 3 IR looks like

```yaml
slide:
  layout: split
  theme: paper-ink
  left:
    background: "#faf9f7"
    children:
      - type: tag
        text: "总览"
        variant: default
      - type: heading
        text: "何为五代十国？"
      - type: divider
      - type: bullets
        items:
          - "唐朝灭亡（907年）至北宋统一（979年）之间"
          - "中原先后经历五个短命王朝"
  right:
    background: "#1a1714"
    textColor: "#e8e0d0"
    children:
      - type: stat
        value: "72"
        label: "年（907-979）"
      - type: stat
        value: "5"
        label: "中原王朝"
      - type: seal
        char: "史"
```

### What the resolver does

Takes the component tree and produces a `LayoutSlide` (Level 2) with pixel-positioned elements:

1. **Split the canvas** — `split` layout: left panel x:0..960, right x:960..1920. `full` layout: centered, max width.
2. **Stack children vertically** — like CSS flexbox column. Start at top of panel, place each component, advance by its height + gap.
3. **Resolve each component** — `tag` → ShapeElement (rounded rect) + TextElement (label). `seal` → GroupElement with rotated ShapeElement + centered TextElement. `stat` → TextElement (large number) + TextElement (small label).
4. **Apply theme** — use `ResolvedTheme` values for colors, fonts, spacing.

We already have utilities like `stackVertical`, `titleBlock` in our layout helpers. The resolver would use similar logic, but operating on a component tree instead of fixed template fields.

### The raw escape hatch

When Claude invents a component not in the predefined menu (e.g., a "dynasty tag" unique to a Chinese history deck), it drops to raw `LayoutElement[]`:

```yaml
- type: raw
  height: 28
  elements:
    - kind: shape
      rect: { x: 0, y: 0, w: 120, h: 28 }
      shape: rect
      style: { fill: "#2a2520", borderRadius: 2 }
    - kind: text
      rect: { x: 8, y: 2, w: 104, h: 24 }
      text: "五代 · 其一"
      style: { fontFamily: "Noto Serif SC", fontSize: 11, color: "#f5f0e8", ... }
```

The resolver places this `raw` block in the vertical stack like any other component, allocating it a bounding box. The embedded elements use coordinates **relative to that box**.

### Graduating patterns into components

This is how the system evolves over time (goal #2):

1. Claude invents a "seal stamp" using `raw` in a Chinese history deck
2. The same pattern appears in 3 more presentations
3. We promote it to a named component: `type: seal` with `char`, `color`, `size` parameters
4. The resolver handles it natively — Claude no longer needs raw for this pattern
5. The component gets tested, validated, and documented

The component vocabulary grows organically from real usage, not from upfront guessing.

## Pros and Cons

### Pros

1. **Meets all three goals** — Claude creativity via raw escape hatch, constrained mode via existing templates, dual-target via unchanged Level 2 IR
2. **Organic vocabulary growth** — good `raw` patterns get graduated into named components over time
3. **Claude doesn't need pixel math for common cases** — predefined components handle positioning automatically. Only uses `raw` for novel inventions.
4. **Renderers completely unchanged** — everything resolves to `LayoutPresentation`, which renderers already consume
5. **Testable** — can unit test each component resolver, integration test the stacking engine
6. **Existing templates still work** — the constrained YAML path is untouched, nothing breaks

### Cons

1. **Must build a layout engine** — the resolver that stacks components vertically, handles split panels, manages spacing. Not trivial. It's a simplified CSS flexbox. The hardest sub-problem: **height estimation**. How tall is a "bullets" component with 4 items? With 8 items? Font metrics, line wrapping, CJK text all complicate this. (We have `estimateTextHeight` with CJK awareness already, but it's imprecise.)
2. **Two IRs to maintain** — Level 3 (component tree) + Level 2 (LayoutPresentation). Schema changes, validation, documentation for both.
3. **Cliff between guided and creative** — predefined components work smoothly; the `raw` escape hatch requires Claude to do full pixel math within the bounding box. The gap between the two tiers is steep, not gradual.
4. **Raw escape hatch may dominate** — if Claude frequently drops to `raw`, the component layer adds indirection without value. The benefit is proportional to how often predefined components suffice.
5. **Height estimation is the hard problem** — the stacking resolver needs to know each component's height before positioning the next one. Text-heavy components (bullets, paragraphs, quotes) depend on font metrics and content length. Errors here cascade — one component estimated too short pushes everything below it up, causing overlaps.

## Alternatives

### Alternative A: Claude generates Level 2 IR directly

Skip the component layer. Claude writes `LayoutPresentation` JSON — raw elements with pixel coordinates on 1920×1080.

```json
{
  "slides": [{
    "background": "#faf9f7",
    "elements": [
      {"kind": "shape", "rect": {"x":960,"y":0,"w":960,"h":1080}, "shape": "rect",
       "style": {"fill":"#1a1714"}},
      {"kind": "text", "rect": {"x":100,"y":200,"w":760,"h":60}, "text": "何为五代十国？",
       "style": {"fontFamily":"Noto Serif SC", "fontSize":32, "fontWeight":700,
                 "color":"#2a2520", "lineHeight":1.2}}
    ]
  }]
}
```

**Can Claude actually do this?** Yes. The `generate_pptx.py` scripts prove it. That script writes shapes at hardcoded coordinates (`Inches(0.8)`, `Pt(48)`) — functionally identical to our Level 2 IR (`"x": 77, "y": 115`). The same spatial reasoning applies. If Claude can produce `add_textbox(slide, Inches(0.8), Inches(1.2), ...)` for PPTX, it can produce `{"rect": {"x":77, "y":115, ...}}` for our IR.

**Does this approach have a spectrum?** Yes — controlled by prompting rather than architecture:

```
Constrained:      template: comparison (existing YAML, nothing changes)
                    ↓ template function ↓
                  Level 2 IR

Guided:           Claude generates Level 2 IR
                  with skill prompt: "use theme colors, standard spacing,
                  common patterns for headings/bullets/stats"
                    ↓ directly ↓
                  Level 2 IR

Fully creative:   Claude generates Level 2 IR
                  with skill prompt: "design freely,
                  invent visual elements for the content"
                    ↓ directly ↓
                  Level 2 IR
```

The "guided" and "creative" tiers produce the same format — the difference is how tightly the skill prompt constrains Claude.

**Pros:**
- No new abstraction, no component vocabulary, no resolver to build
- Maximum flexibility from day one — Claude can compose anything
- Simplest implementation — write a skill prompt, add a `template: freeform` passthrough, done
- Proven: Claude already does equivalent work with `generate_pptx.py`

**Cons:**
- Claude must do all spatial math for every element, even common patterns (heading + bullets + stat)
- No automatic vertical stacking — Claude calculates every y-coordinate
- Harder to graduate patterns — there's no named component to promote, just raw elements
- More error-prone — overlaps, inconsistent spacing, miscalculated heights
- Very verbose — a single slide might be 50+ lines of JSON

**Verdict:** Viable, especially as a starting point. Fast to implement, full expressiveness. The trade-off is no guardrails — Claude does everything, including things a resolver could automate.

### Alternative B: Extend YAML templates to be composable

Instead of a new IR, evolve the existing YAML format so templates accept component lists:

```yaml
# Old rigid template (still works):
- template: comparison
  title: "何为五代十国？"
  left:
    heading: "开国"
    items: ["唐朝灭亡...", "中原先后..."]
  right:
    heading: "覆亡"
    items: ["72年", "5个中原王朝"]

# New composable template (same YAML file):
- template: split
  left:
    - tag: "总览"
    - heading: "何为五代十国？"
    - divider: ink
    - bullets: ["唐朝灭亡...", "中原先后..."]
  right:
    - stat: { value: "72", label: "年" }
    - seal: { char: "史" }

# Old rigid template again (same presentation can mix both):
- template: bullets
  title: "时代背景"
  items: ["安史之乱后...", "地方藩镇..."]
```

**How this differs from the Level 3 IR proposal:**

| | Level 3 IR | Alternative B |
|---|---|---|
| Format | New separate format | Same `slides.yaml`, extended |
| Entry point | New loader + resolver | Same `loadPresentation()` → `layoutPresentation()` |
| Code paths | Two parallel paths to Level 2 | One path, templates become smarter |
| Where resolver lives | Separate `resolveLevel3()` module | Inside new template functions (e.g., `split.ts`, `full-compose.ts`) |
| Mixing rigid + composable | Separate — a presentation is either templates or Level 3 | Seamless — rigid and composable slides coexist in same file |
| Raw escape hatch | Natural — `type: raw` with `elements: [...]` | Possible but awkward in YAML — component list with embedded element arrays |
| Claude generates | A format different from what users write | Same YAML format users already know |

**The connection:** Both need the exact same component resolver logic (tag → ShapeElement + TextElement, vertical stacking within panels). The engineering work is nearly identical. The difference is packaging — one format vs two, one code path vs two.

**Pros:**
- Single authoring format — no new IR to learn
- Old rigid templates and new composable ones coexist in the same presentation
- Templates evolve naturally (rigid → composable → fully creative)
- Familiar to existing users

**Cons:**
- Same resolver engineering as Level 3 IR (stacking, height estimation, component resolution)
- Less clean separation — component logic mixed into template functions
- Raw escape hatch is clunky in YAML (deeply nested element arrays)

**Verdict:** Architecturally identical to Level 3 IR, but simpler mental model. If we don't need the clean separation of a dedicated Level 3 format, this is the pragmatic choice.

### Alternative C: Claude generates HTML, Claude translates to Level 2

**Important correction**: the original framing of this alternative (automatic HTML→IR parsing) was wrong. Building *code* that programmatically parses HTML/CSS into our IR would require reimplementing a browser layout engine — impractical.

But Claude already does this translation for PPTX scripts. The `generate_pptx.py` script is Claude reading the HTML design and writing equivalent positioned shapes. Claude is the "parser" — using visual/semantic understanding, not CSS evaluation.

This suggests a **two-step Claude generation**:

```
Step 1: Claude generates index.html (leveraging its HTML/CSS strengths)
Step 2: Claude translates its own HTML into our Level 2 IR (same skill as writing PPTX scripts)
```

**Pros:**
- Claude is very strong at writing HTML/CSS — plays to its strengths in step 1
- The translation step is proven — Claude already does HTML→PPTX shapes successfully
- Full expressiveness — Claude can use any CSS technique in step 1

**Cons:**
- Two-step generation is slower and more expensive (two Claude calls)
- Translation may lose fidelity — some CSS effects (gradients, clamp, pseudo-elements) can't map to our 7 element types
- No single source of truth — the HTML and the IR may drift if Claude doesn't translate perfectly
- Harder to debug — which step introduced the visual bug?
- Why bother with step 1? If Claude can translate HTML→IR, it can generate IR directly (Alternative A)

**Verdict:** Viable but roundabout. The insight it provides: Claude's spatial reasoning is good enough to go directly from visual intent to positioned elements, whether the output format is PPTX shapes, HTML, or our Level 2 IR. This strengthens the case for Alternative A.

## Remaining Design Questions

### 1. Who does the pixel positioning?

**Option A — Our resolver**: Components declare content; the resolver calculates positions based on panel size and vertical stacking. Like a simple CSS flexbox.
**Option B — Claude does it**: Claude specifies approximate positions, our system snaps to grid.
**Option C — Hybrid**: Resolver handles vertical stacking within panels (common case), Claude can override with explicit positions when needed.

### 2. How does Claude get design knowledge?

Templates encode design knowledge (title at y=120, font size 54, weight 700). Without templates, Claude needs equivalent guidance:
- A skill prompt (like SKILL.md) teaching our Level 3 IR, canvas size, spacing conventions, theme system
- Example presentations as few-shot demonstrations
- The resolved theme object as context (so Claude uses theme-consistent colors/fonts)

### 3. Theme integration

**Theme-locked**: Claude receives the `ResolvedTheme`, uses its values directly. Changing themes requires regeneration. Matches how frontend-slides works.
**Theme-referenced**: Claude uses tokens like `theme.accent` instead of `#c8a96e`. A resolver substitutes concrete values. Allows theme switching without regeneration, but adds complexity.

### 4. Dual-target constraint

Our IR's expressiveness is bounded by the **least capable renderer** — PPTX. PowerPoint can't do CSS grid, `clamp()`, blend modes, or pseudo-elements.

Options:
- **Maintain the contract**: freeform mode uses our IR, bounded by what PPTX supports. Gain composition freedom but not new visual capabilities beyond our 7 element types.
- **Web-only freeform**: use HTML directly for maximum expressiveness, accept no PPTX for those slides.
- **Pragmatic middle**: expand element types for the most painful gaps (badge, decorative divider) while staying within PPTX's capabilities.

## Key Realizations

### 1. The expressiveness gap is about who invents the visual vocabulary

In frontend-slides, Claude acts as a designer: it reads a mood board (style preset), understands the content (Chinese history), and invents appropriate visual components (seals, brush dividers, dynasty tags). The components are creative acts, not selections from a menu.

In talks, templates are the visual vocabulary — fixed, predetermined, content-agnostic. A `comparison` template doesn't know it's showing Chinese dynasties vs JavaScript frameworks. It always produces the same structure.

### 2. Our YAML is data, not structure

The current YAML format can express *what content* goes on a slide, but not *what each piece of content is*. `items: string[]` treats a stat, a quote, and a bullet point identically. This is why extending the format (Level 3 IR or Alternative B) is necessary — we need typed components, not just strings.

### 3. Claude's spatial reasoning is already proven

The `generate_pptx.py` scripts demonstrate that Claude can translate visual designs into positioned elements with hardcoded coordinates. This same capability applies to our Level 2 IR format. Whether we build a component resolver (Level 3 IR / Alternative B) or let Claude handle all positioning (Alternative A), the spatial reasoning bottleneck is not Claude — it's about how much we want to automate.

### 4. The approaches form a spectrum of engineering investment

```
                    Less engineering                    More engineering
                    ←─────────────────────────────────────────────────→

Alternative A       Alternative B              Level 3 IR proposal
(Claude → Level 2)  (composable YAML)           (new format + resolver)

Skill prompt only.   Same YAML format.           Clean separation.
Claude does all      Resolver handles stacking.  Dedicated Level 3 format.
spatial math.        Components + raw coexist    Components + raw + resolver.
Immediate power,     in same file.               Most structured, most work.
no guardrails.       Pragmatic middle ground.    Best long-term architecture.
```

All three produce the same Level 2 IR. All three keep existing templates. All three leave renderers unchanged. The choice is about how much positioning logic we build vs how much we delegate to Claude.

## Status

Analysis phase — no implementation path chosen yet. The three viable approaches are:

1. **Alternative A** (simplest): Claude generates Level 2 IR directly, guided by a skill prompt. Fast to implement, full expressiveness, no guardrails.
2. **Alternative B** (pragmatic): Extend YAML with composable templates that accept typed component lists. Same resolver work as Level 3 IR but packaged as template evolution.
3. **Level 3 IR** (cleanest): New component-tree format with dedicated resolver. Best separation of concerns, most engineering work.

A reasonable path: start with Alternative A (skill prompt + freeform passthrough) to validate that Claude can produce good Level 2 IR, then evolve toward B or Level 3 as patterns emerge that are worth automating.
