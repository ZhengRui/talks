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

### Implementation approach

Signature elements will be implemented as **decorative helpers** that layout templates can optionally call. This keeps them composable without requiring new element kinds or renderer changes.

```
src/lib/layout/decorators/
  split-background.ts    → two-tone vertical/horizontal split bg shapes
  accent-shapes.ts       → geometric decorators (circles, lines, dots)
  section-numbers.ts     → large numbered overlays for section slides
  texture-patterns.ts    → dot grids, scan lines, halftone via small shapes
```

Each decorator is a pure function: `(theme: ResolvedTheme, rect: Rect) → LayoutElement[]`

Templates opt-in by calling decorators when the active theme warrants them. The renderers remain unchanged — decorators produce standard `ShapeElement`/`GroupElement`/`TextElement` objects.

### Phasing

- **Phase 1** (done): 12 themes with palette + typography
- **Phase 2** (planned): Decorative helpers for split backgrounds, geometric accents, section numbers
- **Phase 3** (future): Theme-specific template variants (e.g., notebook-tabs cover with tab decorations)

## Non-goals

- **No `ResolvedTheme` interface changes** — existing slots are sufficient
- **No new element kinds** — decorators produce standard LayoutElements
- **No renderer changes** — both web and PPTX renderers are theme-agnostic
- **No responsive typography** — layout model uses absolute positioning; responsive is handled by the slide engine's viewport scaling
