# Plan: PPTX Export via Unified Layout Model

## Goal

Add high-fidelity PPTX export by using the intermediate **layout model** (TypeScript) between YAML content and rendering. Both the web renderer and the **PptxGenJS** PPTX renderer consume the same layout model, guaranteeing identical positioning — all within the same Node.js stack.

## Architecture

```
slides.yaml
    ↓
loadPresentation()                    [existing, unchanged]
    ↓
PresentationData                      [existing types]
    ↓
layoutPresentation()                  [DONE — TypeScript]
  ├── resolveTheme(themeName)         [DONE — CSS vars → concrete values]
  └── layoutSlide(slide, theme)       [DONE — per-template layout function]
    ↓
LayoutPresentation (JSON)             [DONE — absolute-positioned elements on 1920×1080]
    ├── Web: LayoutRenderer.tsx       [DONE — React, absolute-positioned divs + CSS animations]
    │     ↓
    │   SlideEngine.tsx               [existing — keyboard nav, scaling, slide activation]
    │
    └── PPTX: exportPptx()           [NEW — Node.js, PptxGenJS, same stack as web]
          ↓
        .pptx file (returned as Buffer)
```

## Lessons Learned (from python-pptx attempt)

The initial implementation used Python's `python-pptx` library. After building and testing it end-to-end, we discovered fundamental issues that led to switching to PptxGenJS:

### 1. Dual-stack complexity
- Python serverless function alongside Next.js required `vercel.json` runtime config, `uv` for local dev, temp file juggling in the Next.js API route, and `requirements.txt` + `pyproject.toml` for dependency management.
- `vercel dev` does NOT auto-detect Python functions alongside Next.js — all routing is delegated to `next dev`. Required a shim Next.js API route (`src/app/api/export_pptx/route.ts`) that spawns `uv run python` as a subprocess for local dev.

### 2. Font size conversion pitfall
- Layout model uses CSS `px` on a 1920px canvas. Passing `fontSize` directly as PowerPoint `Pt()` produced text 2x too large (80px → 80pt instead of ~40pt).
- Correct conversion: `pt = px × (13.3 / 1920) × 72 ≈ px × 0.5`

### 3. Color parsing gaps
- `python-pptx` only accepts `RGBColor` objects (hex). Layout model emits both `#hex` and `rgba(r,g,b,a)` colors.
- `rgba` colors (e.g., `rgba(255,255,255,0.85)` for semi-transparent white subtitle text on dark slides) silently fell through as `None`, making text invisible.
- Required custom `parse_color()` handling both formats + separate `_set_fill_alpha()` for transparency.

### 4. Default shadows and margins
- PowerPoint adds default drop shadows to `ROUNDED_RECTANGLE` shapes. Required explicit `_no_shadow()` on every shape.
- Text frames have default margins/padding. Required `_zero_margins()` and `_zero_paragraph_spacing()` on every textbox.

### 5. Fundamental rendering engine gap
- Even after all fixes, PPTX output was noticeably different from web. Text shaping, line breaking, font metrics, and spacing all differ between browser and PowerPoint rendering engines.
- "Pixel-perfect" across two different rendering engines is not achievable — the goal should be "high fidelity" with matching layout and proportions.

### 6. Why PptxGenJS is better for this project
- **Same stack**: Node.js, no Python subprocess, no dual deployment config.
- **Better API primitives**: `margin: 0` built-in, `valign: "middle"`, `transparency` property, `rectRadius` for rounded corners — all the things that required workarounds in python-pptx.
- **No default shadows**: Explicit opt-in only.
- **Inch-based coordinates**: Natural match for PowerPoint's `LAYOUT_WIDE` (13.33" × 7.5").
- **Anthropic's official PPTX skill uses PptxGenJS** — proven patterns and QA workflow available.

## Key Decisions

- **Layout model in TypeScript** — reuses existing `SlideData` types, serves web directly with zero overhead
- **PptxGenJS for PPTX** — JavaScript library, same Node.js stack, better API for precise positioning
- **Single deployment target** — Next.js only, no Python serverless function needed
- **Unified renderer** — existing 35 React templates replaced by a single `LayoutRenderer` that renders `LayoutSlide` as absolute-positioned divs. Both web and PPTX derive from the same layout decisions.

## File Structure

```
src/lib/layout/
  types.ts                    — LayoutSlide, LayoutElement, ResolvedTheme, AnimationDef     [DONE]
  theme.ts                    — 4 theme definitions as concrete values, resolveTheme()       [DONE]
  helpers.ts                  — titleBlock(), stackVertical(), distributeHorizontal(), etc.   [DONE]
  index.ts                    — layoutPresentation(), layoutSlide() dispatcher                [DONE]
  templates/
    index.ts                  — layout function registry                                      [DONE]
    cover.ts … (35 total)     — one layout function per template                              [DONE]

src/lib/export/
  pptx.ts                    — exportPptx(layout: LayoutPresentation): Promise<Buffer>       [NEW]
  pptx-helpers.ts            — pxToInches(), hexColor(), addText(), addShape(), etc.         [NEW]

src/components/
  LayoutRenderer.tsx          — renders LayoutSlide[] as absolute-positioned divs             [DONE]

src/app/api/layout/route.ts   — GET /api/layout?slug=X → returns LayoutPresentation JSON     [DONE]
src/app/api/export_pptx/route.ts — POST layout JSON → .pptx Buffer response                 [REWRITE]
```

**Files to remove:**
- `api/export_pptx.py` — replaced by `src/lib/export/pptx.ts`
- `api/requirements.txt` — no longer needed
- `pyproject.toml` — no longer needed
- `.python-version` — no longer needed
- `vercel.json` — no longer needed (was only for Python runtime config)

## Layout Model Types

Already implemented in `src/lib/layout/types.ts`. Core types:

```typescript
// Canvas: always 1920×1080

interface Rect { x: number; y: number; w: number; h: number }

interface TextStyle {
  fontFamily: string;        // resolved, e.g. "Inter, system-ui, sans-serif"
  fontSize: number;          // px on 1920×1080 canvas
  fontWeight: number;
  fontStyle?: "normal" | "italic";
  color: string;             // resolved hex/rgba
  lineHeight: number;
  textAlign?: "left" | "center" | "right";
  textShadow?: string;       // CSS string, web-only (ignored by PPTX)
}

// Element types (discriminated union on `kind`)
type LayoutElement =
  | { kind: "text"; ... }
  | { kind: "image"; ... }
  | { kind: "shape"; ... }
  | { kind: "group"; ... }
  | { kind: "code"; ... }
  | { kind: "table"; ... }
  | { kind: "list"; ... }
```

## PptxGenJS Renderer

`src/lib/export/pptx.ts`:

### Coordinate conversion

```typescript
const CANVAS_W = 1920;
const CANVAS_H = 1080;
const SLIDE_W_INCHES = 13.3;  // LAYOUT_WIDE exact value
const SLIDE_H_INCHES = 7.5;

function pxToInches(px: number, axis: "x" | "y"): number {
  return axis === "x"
    ? (px / CANVAS_W) * SLIDE_W_INCHES
    : (px / CANVAS_H) * SLIDE_H_INCHES;
}

function pxToPoints(px: number): number {
  // Font sizes: px on 1920px canvas → points at 13.3" width
  return px * (SLIDE_W_INCHES / CANVAS_W) * 72;  // ≈ px × 0.5
}
```

### Color conversion

PptxGenJS uses 6-char hex strings WITHOUT `#` prefix:
```typescript
function hexColor(color: string): string {
  // "#4f6df5" → "4F6DF5"
  // "rgba(255,255,255,0.85)" → "FFFFFF" (alpha handled separately via transparency)
  // Returns uppercase 6-char hex
}

function colorAlpha(color: string): number | undefined {
  // "rgba(255,255,255,0.85)" → 15 (transparency = (1-alpha)*100)
  // "#4f6df5" → undefined (fully opaque)
}
```

### Element mapping

| Layout Element | PptxGenJS API |
|---|---|
| `text` | `slide.addText(text, { x, y, w, h, fontSize, fontFace, color, align, valign: "top", margin: 0 })` |
| `image` | `slide.addImage({ path or data, x, y, w, h, sizing: { type: "cover"/"contain" } })` |
| `shape` | `slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill, rectRadius, line })` |
| `group` | Background shape + offset children (PptxGenJS has no native groups) |
| `code` | Background rect + `slide.addText(code, { fontFace: monospace, ... })` |
| `table` | `slide.addTable(rows, { x, y, w, colW, border, fill, ... })` |
| `list` | `slide.addText([{ text, options: { bullet: true, breakLine: true } }, ...], { x, y, w, h })` |

### Key PptxGenJS patterns (from Anthropic PPTX skill)

```typescript
import PptxGenJS from "pptxgenjs";

const pptx = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";  // 13.3" × 7.5"

// Text with precise alignment
slide.addText("Title", {
  x: 1.0, y: 2.0, w: 11.0, h: 1.5,
  fontSize: 36,
  fontFace: "Inter",
  color: "4F6DF5",
  align: "center",
  valign: "middle",
  margin: 0,           // critical: prevents default padding
  bold: true,
});

// Shape — no shadow by default in PptxGenJS (just don't set shadow property)
slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
  x: 0.5, y: 1.0, w: 5.0, h: 3.0,
  fill: { color: "FFFFFF" },
  rectRadius: 0.1,     // inches
  line: { color: "E0E0E0", width: 1 },
});

// Semi-transparent fill
slide.addShape(pres.shapes.RECTANGLE, {
  fill: { color: "000000", transparency: 50 },  // 50% transparent
});

// Image
slide.addImage({
  path: "https://example.com/image.jpg",
  x: 0, y: 0, w: 13.3, h: 7.5,
  sizing: { type: "cover", w: 13.3, h: 7.5 },
});

// List — bullet + breakLine on EACH item in the array
slide.addText([
  { text: "First item", options: { bullet: true, breakLine: true } },
  { text: "Second item", options: { bullet: true, breakLine: true } },
  { text: "Third item", options: { bullet: true } },  // last item: no breakLine
], { x: 0.5, y: 0.5, w: 8, h: 3, fontSize: 14, margin: 0 });
```

### Critical PptxGenJS Pitfalls

1. **NEVER use `#` prefix in hex colors** — causes file corruption. Use `"4F6DF5"` not `"#4F6DF5"`.
2. **NEVER encode opacity in hex color strings** — 8-char colors (e.g., `"00000020"`) corrupt the file. Use `transparency` or `opacity` property instead.
3. **NEVER reuse option objects across calls** — PptxGenJS mutates objects in-place (e.g., converting shadow values to EMU). Use factory functions to create fresh objects each time:
   ```typescript
   // ❌ WRONG: second call gets already-converted values
   const opts = { fill: { color: "FFFFFF" }, shadow: { ... } };
   slide.addShape(pres.shapes.RECTANGLE, opts);
   slide.addShape(pres.shapes.RECTANGLE, opts);  // corrupted!

   // ✅ CORRECT: factory function creates fresh object each time
   const makeOpts = () => ({ fill: { color: "FFFFFF" }, shadow: { ... } });
   slide.addShape(pres.shapes.RECTANGLE, makeOpts());
   slide.addShape(pres.shapes.RECTANGLE, makeOpts());
   ```
4. **Shadows are opt-in** — PptxGenJS does NOT add default shadows. Simply don't set the `shadow` property. If you need a shadow: `shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 135, opacity: 0.15 }`. Never use negative `offset` values (corrupts file).
5. **Bullets go on each array item**, not the container — `{ text: "Item", options: { bullet: true, breakLine: true } }`.
6. **`breakLine: true` required** between array items in `addText()`, or text runs together.
7. **Gradient fills are NOT supported** — use gradient background images instead.
8. **`charSpacing` not `letterSpacing`** — `letterSpacing` is silently ignored.
9. **`lineSpacing` breaks bullets** — use `paraSpaceAfter` instead for spacing between bullet items.

## Data Flow for PPTX Export

```
User clicks "Export PPTX" button in SlideEngine
    ↓
Client calls GET /api/layout?slug=my-talk
    ↓
API route: loadPresentation() → layoutPresentation() → returns LayoutPresentation JSON
    ↓
Client POSTs JSON to /api/export_pptx
    ↓
Next.js API route: JSON → exportPptx() via PptxGenJS → .pptx Buffer response
    ↓
Browser downloads .pptx
```

Single stack, no Python subprocess, no cross-language serialization.

## Files Modified

| File | Status | Change |
|------|--------|--------|
| `src/lib/layout/types.ts` | DONE | Layout model types |
| `src/lib/layout/theme.ts` | DONE | Theme resolution |
| `src/lib/layout/helpers.ts` | DONE | Shared layout helpers |
| `src/lib/layout/index.ts` | DONE | layoutPresentation() dispatcher |
| `src/lib/layout/templates/*.ts` | DONE | 35 layout functions |
| `src/components/LayoutRenderer.tsx` | DONE | Unified web renderer |
| `src/app/[slug]/page.tsx` | DONE | Uses layout model + LayoutRenderer |
| `src/app/api/layout/route.ts` | DONE | API endpoint returning layout JSON |
| `src/lib/export/pptx.ts` | DONE | PptxGenJS PPTX renderer |
| `src/lib/export/pptx-helpers.ts` | DONE | Coordinate/color conversion utilities |
| `src/lib/export/pptx-helpers.test.ts` | DONE | 25 unit tests for helpers |
| `src/lib/export/pptx.test.ts` | DONE | 6 integration tests for exportPptx |
| `src/app/api/export_pptx/route.ts` | DONE | Call exportPptx() directly (no subprocess) |
| `package.json` | DONE | Added `pptxgenjs` dependency |
| `src/components/templates/*.tsx` | DELETED | 35 old React templates removed |
| `api/export_pptx.py` | DELETED | Replaced by PptxGenJS |
| `api/requirements.txt` | DELETED | No longer needed |
| `pyproject.toml` | DELETED | No longer needed |
| `.python-version` | DELETED | No longer needed |
| `vercel.json` | DELETED | No longer needed |

## Phased Implementation

### Phase 1: Layout Model Foundation — COMPLETE
1. ~~Create `src/lib/layout/types.ts` with all type definitions~~
2. ~~Create `src/lib/layout/theme.ts` with 4 resolved themes~~
3. ~~Create `src/lib/layout/helpers.ts` with shared utilities~~

### Phase 2: All 35 Template Layouts + Web Renderer — COMPLETE
1. ~~Convert all 35 templates to layout functions~~
2. ~~Build `LayoutRenderer.tsx`~~
3. ~~Wire into `[slug]/page.tsx`~~
4. ~~Visual verification across all templates~~

### Phase 3: PptxGenJS PPTX Renderer — COMPLETE
1. ~~Install `pptxgenjs`: `bun add pptxgenjs` (v4.0.1)~~
2. ~~Create `src/lib/export/pptx-helpers.ts` with coordinate, color, font conversion utilities~~
3. ~~Create `src/lib/export/pptx.ts` with element renderers for all 7 element types~~
4. ~~Rewrite `src/app/api/export_pptx/route.ts` — direct import, no subprocess~~
5. ~~Clean up Python artifacts~~
6. ~~Test: export PPTX for `/example` and `/five-dynasties`, verified end-to-end~~

**Bugs found and fixed during Phase 3:**
- Group children positioning: children use relative coords, must offset by group origin
- Gradient fills invisible: `makeFill()` now falls back to last gradient stop color
- Side borders rendered as full borders: added `renderSideBorders()` overlay rectangles
- Non-ASCII filenames in Content-Disposition header: use RFC 5987 `filename*=UTF-8''` encoding
- Path traversal via crafted image src: validate resolved path stays within `public/`
- Nested group offset bug (latent): recursion now uses accumulated absolute rect

### Phase 4: Polish & QA — COMPLETE
1. ~~Codex code review: 2 rounds of findings, all addressed~~
2. ~~Security: path traversal protection on `resolveImagePath()`~~
3. ~~Handle edge cases: gradients use solid color fallback, side borders as overlay rects~~
4. ~~Remove old React template components (35 files + registry + types)~~
5. ~~Simplify `page.tsx` — removed dual-path fallback, layout model only~~
6. ~~Add PPTX export tests: 25 helper unit tests + 6 integration tests~~
7. ~~Update E2E tests for layout model DOM structure (no more `h1`/`h2` selectors)~~
8. ~~All tests pass: 79 unit tests, 9 E2E tests~~

## Verification — All Passing

1. **Unit tests**: `bun run test` — 79 tests pass (layout helpers, theme, layout functions, PPTX helpers, export integration)
2. **Visual comparison**: `bun run dev` → `/example` → all 144 slides (4 themes × 35 templates + theme headers) render correctly
3. **PPTX export**: Click "Export PPTX" on `/example` (1.7MB, 144 slides) and `/five-dynasties` (343KB, 23 slides with Chinese text) — both export and open successfully
4. **E2E**: `bun run test:e2e` — 9 tests pass (home page + presentation page)
5. **TypeScript**: `npx tsc --noEmit` — zero errors
6. **Security**: path traversal blocked, non-ASCII filenames handled via RFC 5987

## Known Challenges

- **Text height estimation**: Layout functions use heuristic: `Math.ceil(textLength * fontSize * 0.5 / containerWidth) * fontSize * lineHeight`. Both renderers handle overflow within the rect.
- **Gradient fills NOT supported**: PptxGenJS has zero native gradient support. Must use pre-rendered gradient background images or solid color approximation.
- **Font availability in PPTX**: Inter, Playfair Display, JetBrains Mono must be installed on the viewer's machine. PptxGenJS uses `fontFace` (first font family name only, no fallback chain in PPTX).
- **Video/iframe templates**: No PPTX equivalent. Render a placeholder shape with link text.
- **Image handling**: For local images, need to read file and pass as base64 data. For remote URLs, PptxGenJS can fetch directly via `path`.
- **Text will never be pixel-identical**: Different text shaping engines mean line breaks may differ. Acceptable — focus on matching layout proportions and visual weight.
