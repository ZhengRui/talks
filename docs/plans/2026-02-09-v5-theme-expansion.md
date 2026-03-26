# Design v5: Theme Expansion

## Motivation

The talks repo has 4 themes (`modern`, `bold`, `elegant`, `dark-tech`) while the frontend-slides repo defines 12 curated presets with distinctive visual identities. The layout model is a generic DSL — adding themes is purely a data exercise (new `ResolvedTheme` entries), requiring zero changes to templates, renderers, or the layout model.

This is the cheapest high-impact improvement: 12 new entries in one file → every existing template instantly gains 12 new looks, both web and PPTX.

## Architecture (unchanged)

```
slides.yaml → loadPresentation() → layoutPresentation() → LayoutPresentation (JSON)
    ├── Web:  LayoutRenderer.tsx    (React, absolute-positioned divs)
    └── PPTX: exportPptx()         (PptxGenJS)
```

The `ResolvedTheme` interface is **not changing**. Each frontend-slides preset maps into the existing ~30 semantic slots. The renderers remain untouched.

## Design Decision: Theme vs Template Separation

The frontend-slides presets bundle two concerns:

| Concern | Example | Maps to |
|---|---|---|
| Palette + typography | colors, fonts, radii, shadows | `ResolvedTheme` slots |
| Signature elements | notebook tabs, geometric shapes, halftone textures, split panels | Layout templates |

This plan addresses **palette + typography only**. Signature elements (decorative shapes, custom layouts) would be separate new templates — a future effort orthogonal to this one.

## Mapping Strategy

Each frontend-slides preset maps to `ResolvedTheme` slots as follows:

```
Frontend-slides variable     →  ResolvedTheme slot
─────────────────────────────────────────────────────
--bg-primary / --bg-dark     →  bg
--bg-secondary / --card-bg   →  bgSecondary, cardBg
--bg-tertiary                →  bgTertiary
--text-primary               →  text
--text-secondary / --muted   →  textMuted
--text-heading               →  heading
--accent                     →  accent
--accent-2                   →  accent2
--font-display               →  fontHeading
--font-body                  →  fontBody
```

Slots not directly present in a preset (e.g., `highlightInfoBg`, `codeBg`, `overlayBg`) are derived:
- `codeBg` — dark variant of `bg` (darken for light themes, lighten for dark themes)
- `overlayBg` — semi-transparent black/dark bg
- `highlightInfoBg` — 8% opacity of `accent`
- `highlightWarningBg` — 8% opacity of a warm color
- `highlightSuccessBg` — 8% opacity of a green
- `cardBorder` — low-opacity version of `text`
- `progressBg` — low-opacity version of `text` or `accent`

## The 12 New Themes

### Dark themes (4)

| Theme | Vibe | Accent | Heading font |
|---|---|---|---|
| `bold-signal` | Confident, high-impact | #FF5722 (orange) | Archivo Black |
| `electric-studio` | Clean, professional | #4361ee (blue) | Manrope |
| `creative-voltage` | Energetic, retro-modern | #0066ff / #d4ff00 | Syne |
| `dark-botanical` | Elegant, sophisticated | #d4a574 (warm) | Cormorant |

### Light themes (4)

| Theme | Vibe | Accent | Heading font |
|---|---|---|---|
| `notebook-tabs` | Editorial, organized | #c7b8ea (lavender) | Bodoni Moda |
| `pastel-geometry` | Friendly, approachable | #f0b4d4 / #5a7c6a | Plus Jakarta Sans |
| `split-pastel` | Playful, modern | #e4dff0 / #f5e6dc | Outfit |
| `vintage-editorial` | Witty, editorial | #e8d4c0 (warm) | Fraunces |

### Specialty themes (4)

| Theme | Vibe | Accent | Heading font |
|---|---|---|---|
| `neon-cyber` | Futuristic, techy | #00ffcc / #ff00aa | Clash Display |
| `terminal-green` | Developer, hacker | #39d353 (green) | JetBrains Mono |
| `swiss-modern` | Clean, Bauhaus | #ff3300 (red) | Archivo |
| `paper-ink` | Literary, editorial | #c41e3a (crimson) | Cormorant Garamond |

## Implementation Plan

### Step 1: Add theme names to `ThemeName` union

**File:** `src/lib/types.ts`

Add 12 new names to the `ThemeName` union type. Use kebab-case matching the table above.

### Step 2: Define 12 `ResolvedTheme` entries

**File:** `src/lib/layout/theme.ts`

Add 12 new entries to the `THEMES` record. Each entry fills all ~30 slots using the mapping strategy above. Group them by category (dark / light / specialty) with comments.

### Step 3: Register Google Fonts

**File:** `src/app/layout.tsx` (or equivalent font loading)

Add `<link>` tags or `next/font` imports for the 10 new Google Fonts families:
- Archivo Black, Manrope, Syne, Space Mono, Cormorant, IBM Plex Sans
- Bodoni Moda, Plus Jakarta Sans, Outfit, Fraunces, Work Sans
- DM Sans, Source Serif 4, Nunito, Satoshi, Space Grotesk

Two fonts (Clash Display, Satoshi) are from Fontshare, not Google — need separate loading or fallback substitution.

### Step 4: Add theme CSS files for web engine

**File:** `src/styles/themes/*.css`

The slide engine uses theme CSS for non-layout styling (scrollbar colors, selection colors, etc.). Add 12 new CSS files with minimal overrides. Most visual styling comes from `ResolvedTheme` values in the layout model, not CSS.

### Step 5: Update example presentation

**File:** `content/example/slides.yaml`

Add slides showcasing the new themes (per-slide `theme:` override) so `/example` demonstrates all 16 themes.

### Step 6: Font fallback mapping for PPTX

**File:** `src/lib/export/pptx-helpers.ts`

Update `parseFontFamily()` to map web fonts to closest PowerPoint-safe equivalents:

| Web font | PPTX fallback |
|---|---|
| Archivo Black | Arial Black |
| Cormorant / Cormorant Garamond | Garamond |
| Bodoni Moda | Bodoni MT |
| Fraunces | Georgia |
| Playfair Display | Georgia |
| Plus Jakarta Sans / Outfit / Manrope | Calibri |
| Syne | Arial |
| JetBrains Mono / Space Mono | Consolas |

### Step 7: Tests

- Unit test: `resolveTheme()` returns valid theme for all 16 names
- Unit test: every theme has all required `ResolvedTheme` fields (TypeScript enforces this, but runtime check is good)
- Visual: run dev server, browse `/example` to verify all themes render correctly
- Visual: export PPTX, verify themes look reasonable with fallback fonts

## Files Modified

| File | Changes |
|---|---|
| `src/lib/types.ts` | Add 12 names to `ThemeName` union |
| `src/lib/layout/theme.ts` | Add 12 `ResolvedTheme` entries |
| `src/app/layout.tsx` | Load new Google Fonts + Fontshare fonts |
| `src/styles/themes/*.css` | 12 new minimal theme CSS files |
| `src/lib/export/pptx-helpers.ts` | Font fallback mapping table |
| `content/example/slides.yaml` | Showcase slides for new themes |
| `src/lib/layout/theme.test.ts` | Theme validation tests |

## Phase 2: Signature Elements

The frontend-slides presets include distinctive visual elements beyond palette + typography. These are **template-layer concerns** — decorative `ShapeElement`/`GroupElement` objects produced by layout functions.

### Signature elements by theme

| Theme | Signature Elements |
|---|---|
| Bold Signal | Large section numbers (01, 02), navigation breadcrumbs |
| Electric Studio | Two-panel vertical split, accent bar on panel edge |
| Creative Voltage | Halftone texture patterns, neon badges/callouts |
| Dark Botanical | Abstract soft gradient circles (blurred, overlapping), thin vertical accent lines |
| Notebook Tabs | Paper container with shadow, colorful section tabs on right edge, binder holes |
| Pastel Geometry | Rounded card with soft shadow, vertical pills on right edge |
| Split Pastel | Two-color vertical split background, playful badge pills, grid pattern overlay |
| Vintage Editorial | Abstract geometric shapes (circle outline + line + dot), bold bordered CTA boxes |
| Neon Cyber | Particle-like dot backgrounds, neon glow effects, grid patterns |
| Terminal Green | Scan lines, blinking cursor effect, code syntax styling |
| Swiss Modern | Visible grid lines, asymmetric layouts, geometric shapes |
| Paper & Ink | Drop caps, pull quotes, elegant horizontal rules |

### Full catalog by implementation tier

#### Tier 1: Trivial — 1-5 standard LayoutElements per use

All items produce simple `ShapeElement`/`TextElement` objects at specific coordinates. Works identically in web and PPTX with zero renderer changes.

| Element | Themes | CSS technique | Layout model |
|---|---|---|---|
| Split background (2-tone) | Electric Studio, Creative Voltage, Split Pastel | `grid-template-columns: 1fr 1fr` with different bg colors | Two `ShapeElement` rects, full-height, side-by-side |
| Thin vertical accent lines | Dark Botanical, Paper & Ink | Pseudo-element or div, `width: 2-4px` | `ShapeElement` line, 2-4px wide |
| Horizontal rules | Paper & Ink, Vintage Editorial | `border-top: 1px solid`, optionally gradient | `ShapeElement` line, 40-80px wide, 1-2px tall |
| Large section numbers | Bold Signal | Oversized `font-size`, absolute positioning | `TextElement`, e.g. "01" at 200px font size, low opacity |
| Binder holes | Notebook Tabs | Small circles with `border-radius: 50%` | 3-4 small `ShapeElement` circles along left edge |
| Colored tabs on right edge | Notebook Tabs | Absolute-positioned colored rects, `writing-mode: vertical-rl` | 5 `ShapeElement` rects (~20-30px wide, varying heights) on right edge |
| Vertical pills on right edge | Pastel Geometry | Absolute-positioned rounded rects, varying heights | 5 rounded `ShapeElement` rects, different colors, right edge |
| Geometric accent (circle + line + dot) | Vintage Editorial | Circle outline (`border: 2px solid, border-radius: 50%`), thin rect, small filled circle | 3 `ShapeElement`s composed together |
| Bold bordered box | Vintage Editorial, Swiss Modern | `border: 2px solid`, no/light fill | `ShapeElement` rect with stroke, no fill |

#### Tier 2: Moderate — many small shapes, heavier layout JSON

Technically possible with existing element types but generates dozens of shape objects per slide. May bloat PPTX file size and layout JSON.

| Element | Themes | CSS technique | Concern |
|---|---|---|---|
| Grid pattern overlay | Split Pastel, Neon Cyber, Swiss Modern | Repeating `linear-gradient` (1px lines at 40-50px intervals) | ~100 shapes for full-slide grid |
| Scan lines (CRT effect) | Terminal Green | `repeating-linear-gradient` (2px line, 2px gap) | ~270 shapes for full-slide coverage |
| Badge pills with icons | Split Pastel, Creative Voltage | `border-radius: 20px`, flex layout | Moderate, 3-5 groups |

#### Tier 3: Hard — needs unsupported properties or is inherently web-only

These require element properties we don't have or depend on animation/JS. Skip entirely.

| Element | Themes | Why it's hard |
|---|---|---|
| Soft gradient circles (blurred) | Dark Botanical | Needs `filter: blur()` — no `LayoutElement` support, PPTX can't do it |
| Neon glow effects | Neon Cyber, Creative Voltage | `text-shadow`/`box-shadow` glow — web-only, PPTX shadows are basic drop shadows |
| Halftone dot texture | Creative Voltage | Hundreds of tiny circles — performance concern |
| Blinking cursor | Terminal Green | CSS `@keyframes` animation — web-only, static in PPTX |
| Drop caps | Paper & Ink | `::first-letter` — inline formatting, our `TextElement` is single-style |
| Particle backgrounds | Neon Cyber | Canvas/JS animation — completely out of scope |

### Design decision: asymmetric rendering

The layout model is a shared contract between web and PPTX renderers. Its value is that both renderers produce the same output from the same JSON. Adding web-only properties to the layout model (blur, repeating gradients, CSS filters) would pollute the contract — the model would describe what web shows, and PPTX would silently skip half of it.

Instead, we **accept asymmetry** with a clean separation:

- **Tier 1 (both renderers):** Implemented as layout model decorators — standard `ShapeElement`/`TextElement` objects that both web and PPTX render faithfully.
- **Tier 2/3 (web-only):** Implemented as **theme CSS** — `::before`/`::after` pseudo-elements, `background-image` patterns, `filter: blur()`, etc. These live in the theme CSS files (`src/styles/themes/*.css`), never touch the layout model, and PPTX simply doesn't have them.

This keeps the layout model honest: if it's in the JSON, both renderers show it. Web gets extra visual richness from CSS on top.

### Tier 1 implementation: layout model decorators

Decorators are **pure functions** in `src/lib/layout/decorators/`:

```
src/lib/layout/decorators/
  split-background.ts    → splitBackground(theme, rect)      → LayoutElement[]
  edge-tabs.ts           → edgeTabs(theme, rect, colors[])   → LayoutElement[]
  section-number.ts      → sectionNumber(theme, rect, n)     → LayoutElement[]
  geometric-accent.ts    → geometricAccent(theme, rect)       → LayoutElement[]
  accent-line.ts         → accentLine(theme, rect, dir)       → LayoutElement[]
  binder-holes.ts        → binderHoles(theme, rect)           → LayoutElement[]
  bordered-box.ts        → borderedBox(theme, rect)           → LayoutElement[]
```

Signature: `(theme: ResolvedTheme, rect: Rect, ...args) → LayoutElement[]`

Each returns standard `ShapeElement`/`TextElement`/`GroupElement` objects. Renderers remain untouched.

#### Decorator ↔ theme mapping

| Decorator | Themes it serves |
|---|---|
| `splitBackground()` | Electric Studio, Creative Voltage, Split Pastel |
| `edgeTabs()` | Notebook Tabs (colored tabs), Pastel Geometry (pills) |
| `sectionNumber()` | Bold Signal |
| `geometricAccent()` | Vintage Editorial |
| `accentLine()` | Dark Botanical, Paper & Ink |
| `binderHoles()` | Notebook Tabs |
| `borderedBox()` | Vintage Editorial, Swiss Modern |

#### Integration: how templates call decorators

Two approaches considered:

**Option A — Theme name check in templates:**
```ts
function layoutCover(data, theme) {
  const els = [...normalElements];
  if (themeName === "split-pastel") els.unshift(...splitBackground(theme, canvasRect));
  return els;
}
```
Con: Templates know theme names, coupling the layers.

**Option B — Decorator list on ResolvedTheme (recommended):**
```ts
interface ResolvedTheme {
  ...existing fields...
  decorators?: string[];  // e.g. ["split-bg", "edge-tabs"]
}
```
Templates check `theme.decorators` generically:
```ts
function layoutCover(data, theme) {
  const els = [...normalElements];
  if (theme.decorators?.includes("split-bg")) els.unshift(...splitBackground(theme, canvasRect));
  return els;
}
```
Pro: Templates don't know theme names, just decorator IDs. Adding a new theme with `decorators: ["split-bg"]` automatically gets the decoration in all templates that support it.

### Tier 2/3 implementation: web-only theme CSS

CSS-only decorations live in the existing theme CSS files. No layout model changes, no PPTX renderer changes. Examples:

```css
/* terminal-green.css — scan lines overlay */
.theme-terminal-green .slide::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    0deg, transparent 0px, transparent 2px,
    rgba(0, 0, 0, 0.15) 2px, rgba(0, 0, 0, 0.15) 4px
  );
  pointer-events: none;
  z-index: 2;
}

/* dark-botanical.css — soft blurred accent circles */
.theme-dark-botanical .slide::before {
  content: "";
  position: absolute;
  width: 600px; height: 600px;
  top: -100px; right: -200px;
  background: radial-gradient(circle, rgba(212, 165, 116, 0.08) 0%, transparent 70%);
  filter: blur(40px);
  pointer-events: none;
}

/* neon-cyber.css — glow on headings */
.theme-neon-cyber [style*="font-weight: 700"] {
  text-shadow: 0 0 10px rgba(0, 255, 204, 0.6);
}
```

PPTX export is unaffected — these decorations exist only in the browser.

#### Tier 2/3 CSS decorator ↔ theme mapping

| CSS decoration | Theme | Technique |
|---|---|---|
| Scan lines overlay | Terminal Green | `repeating-linear-gradient` on `::after` |
| Blurred accent circles | Dark Botanical | `radial-gradient` + `filter: blur()` on `::before` |
| Neon glow on headings | Neon Cyber | `text-shadow` glow |
| Neon glow on accents | Creative Voltage | `box-shadow` glow on accent-colored elements |
| Grid pattern overlay | Swiss Modern, Split Pastel | `repeating-linear-gradient` grid on `::after` |
| Halftone dot texture | Creative Voltage | `radial-gradient` repeating dots on `::before` |

### Phasing

- **Phase 1** (done): 12 themes with palette + typography — steps 1-7 complete
- **Phase 2** (planned): 7 Tier 1 decorator functions + `decorators` field on `ResolvedTheme`
- **Phase 2b** (planned): Tier 2/3 CSS-only decorations in theme CSS files
- **Phase 3** (future): Theme-specific template variants (e.g., notebook-tabs cover with tab decorations)

## Non-goals

- **No web-only properties in the layout model** — layout JSON = shared contract, only contains what both renderers handle
- **No new element kinds** — Tier 1 decorators produce standard `ShapeElement`/`TextElement`/`GroupElement`
- **No renderer changes** — both web and PPTX renderers are theme-agnostic
- **No responsive typography** — layout model uses absolute positioning; responsive is handled by the slide engine's viewport scaling

## Phase 2 Revision: OOXML Post-Processing Changes Everything

### Discovery

PptxGenJS doesn't expose glow, blur, soft edges, or pattern fills — but these are **PptxGenJS limitations, not PPTX limitations**. OOXML (Office Open XML / ECMA-376) natively supports all of them since Office 2007. We already have a JSZip post-processing pipeline (`pptx-animations.ts`) that injects raw OOXML XML after PptxGenJS generates the file. The same technique works for visual effects.

### OOXML native effects available via post-processing

| Effect | OOXML Element | Applies to | What it does |
|---|---|---|---|
| Glow | `<a:glow rad="...">` | Shapes, text, images | Color-blurred outline outside shape boundary |
| Soft edge | `<a:softEdge rad="...">` | Shapes, text, images | Feathered/blurred edges, interior stays crisp |
| Blur | `<a:blur rad="..." grow="1">` | Shapes, text, images | Full Gaussian blur (= CSS `filter: blur()`) |
| Pattern fill | `<a:pattFill prst="...">` | Shapes, table cells | 54 preset patterns: scan lines, grids, dots, crosshatch, etc. |
| Radial gradient | `<a:gradFill><a:path path="circle">` | Shapes | Circle gradient with per-stop alpha transparency |
| Inner shadow | `<a:innerShdw>` | Shapes, text | Inset shadow with blur, offset, color |
| Outer shadow (extended) | `<a:outerShdw>` | Shapes, text | Full control: blur, offset, skew, scale, alignment |
| Shape rotation | `rot` attr on `<a:xfrm>` | All shapes | Arbitrary rotation angle |
| Reflection | `<a:reflection>` | Shapes, text, images | Mirrored reflection below shape |
| Custom dash | `<a:prstDash>` / `<a:custDash>` | Lines, borders | Dotted, dashed, custom dash patterns |

All effects are combinable via `<a:effectLst>` (glow + shadow + soft edge on the same shape).

Key patterns for decorative elements:
- `<a:pattFill prst="narHorz">` — scan lines (replaces ~270 shapes with **one**)
- `<a:pattFill prst="smGrid">` — grid overlay (replaces ~100 shapes with **one**)
- `<a:pattFill prst="pct5">` — subtle dot/halftone texture
- `<a:softEdge>` + radial `<a:gradFill>` — blurred gradient circles

### Revised tier categorization

The original tiers assumed "if PptxGenJS can't do it, PPTX can't do it." That assumption was wrong. Here is the revised categorization:

#### Tier 1A: Standard shapes — both renderers, no post-processing needed

Unchanged from original Tier 1. These produce standard `ShapeElement`/`TextElement` objects.

| Element | Themes |
|---|---|
| Split background (2-tone) | Electric Studio, Creative Voltage, Split Pastel |
| Thin vertical accent lines | Dark Botanical, Paper & Ink |
| Horizontal rules | Paper & Ink, Vintage Editorial |
| Large section numbers | Bold Signal |
| Binder holes | Notebook Tabs |
| Colored tabs on right edge | Notebook Tabs |
| Vertical pills on right edge | Pastel Geometry |
| Geometric accent (circle + line + dot) | Vintage Editorial |
| Bold bordered box | Vintage Editorial, Swiss Modern |

#### Tier 1B: Effects shapes — both renderers, PPTX via post-processing

These produce layout model shapes that BOTH renderers enhance with effects. Web uses CSS (`box-shadow`, `filter: blur()`, `background-image`). PPTX post-processor injects OOXML XML.

| Element | Themes | Web technique | OOXML technique |
|---|---|---|---|
| Neon glow on shapes | Neon Cyber, Creative Voltage | `box-shadow: 0 0 Xpx color` | `<a:glow rad="...">` in `<a:effectLst>` |
| Neon glow on text | Neon Cyber, Creative Voltage | `text-shadow: 0 0 Xpx color` | `<a:glow>` in `<a:rPr><a:effectLst>` |
| Soft gradient circles | Dark Botanical | `radial-gradient()` + `filter: blur()` | `<a:softEdge>` + radial `<a:gradFill path="circle">` |
| Scan lines overlay | Terminal Green | `repeating-linear-gradient()` | `<a:pattFill prst="narHorz">` — **one shape** |
| Grid pattern overlay | Swiss Modern, Neon Cyber, Split Pastel | `repeating-linear-gradient()` grid | `<a:pattFill prst="smGrid">` — **one shape** |
| Halftone dot texture | Creative Voltage | `radial-gradient()` repeating dots | `<a:pattFill prst="pct5">` — **one shape** |

#### Tier 2: Web-only — genuinely no PPTX equivalent

| Element | Themes | Why still web-only |
|---|---|---|
| Blinking cursor | Terminal Green | CSS `@keyframes` animation — PPTX is static |
| Paper texture (SVG noise) | Paper & Ink | SVG `feTurbulence` filter — no OOXML equivalent |
| Particle backgrounds | Neon Cyber | Canvas/JS — completely out of scope |
| Drop caps | Paper & Ink | `::first-letter` inline formatting |

### How Tier 1B effects flow through the system

The decorator functions produce standard `ShapeElement` objects with an `effects` metadata hint:

```ts
// Decorator produces a shape with effect hints
function glowCircle(theme: ResolvedTheme, rect: Rect): LayoutElement {
  return {
    kind: "shape",
    shapeType: "ellipse",
    rect,
    fill: theme.accent,
    fillOpacity: 0.3,
    effects: {  // new optional field on LayoutElement
      glow: { color: theme.accent, radius: 12, opacity: 0.6 },
      softEdge: 20,
    },
  };
}
```

Both renderers handle the `effects` field:
- **Web (LayoutRenderer.tsx):** Maps `glow` → `box-shadow`, `softEdge` → `filter: blur()`, pattern fills → `background-image`
- **PPTX (post-processing):** Maps `glow` → `<a:glow>`, `softEdge` → `<a:softEdge>`, pattern → `<a:pattFill>`

This extends the layout model minimally (one optional `effects` field) while keeping the contract honest: if it's in the JSON, both renderers show it.

### Revised phasing

- **Phase 1** (done): 12 themes with palette + typography — steps 1-7 complete
- **Phase 2a**: Tier 1A decorator functions + `decorators` field on `ResolvedTheme`
- **Phase 2b**: `effects` field on `LayoutElement` + Tier 1B decorators (glow, softEdge, pattern fills)
- **Phase 2c**: PPTX post-processing for effects (extend `pptx-animations.ts` or new `pptx-effects.ts`)
- **Phase 2d**: Web renderer support for `effects` field (CSS mappings)
- **Phase 2e**: Tier 2 web-only CSS decorations (blinking cursor, paper texture, particles)
- **Phase 3** (future): Theme-specific template variants
