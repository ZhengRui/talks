# Design v4: PPTX Renderer Fidelity

## Motivation

The v3 unified layout model successfully drives both web and PPTX rendering from a single `LayoutPresentation` JSON. However, the PPTX renderer has accumulated fidelity gaps — properties that the web renderer handles correctly but the PPTX renderer ignores or approximates. Side-by-side comparison reveals visible differences in line spacing, text casing, gradients, padding, and clipping.

Meanwhile, an alternative approach (HTML → hand-written `generate_pptx.py`) produces higher-fidelity PPTX output because each element is manually tuned to match the visual result. The v4 goal is to close that gap by tightening the PPTX renderer to faithfully interpret the same layout JSON the web renderer already handles correctly.

## Current Architecture (unchanged)

```
slides.yaml → loadPresentation() → layoutPresentation() → LayoutPresentation (JSON)
    ├── Web:  LayoutRenderer.tsx    (React, absolute-positioned divs)
    └── PPTX: exportPptx()         (PptxGenJS)
```

The layout JSON is the ground truth. Both renderers consume it. v4 does not change the layout model — it fixes the PPTX renderer's interpretation of it.

## Fidelity Gaps

### 1. lineHeight not mapped to PPTX lineSpacing

**Web** (`LayoutRenderer.tsx:89`):
```tsx
lineHeight: el.style.lineHeight,   // e.g. 1.4
```

**PPTX** (`pptx.ts:144-167`): `textOpts()` does not set `lineSpacingMultiple`. PptxGenJS defaults to PowerPoint's ~1.15 line spacing. Layout model specifies 1.3–1.6 for most text. Every multi-line text block is vertically compressed in PPTX.

**Fix**: Map `style.lineHeight` → `lineSpacingMultiple` in `textOpts()`.

### 2. textTransform ignored in PPTX

**Web** (`LayoutRenderer.tsx:93`):
```tsx
textTransform: el.style.textTransform,   // "uppercase"
```

**PPTX**: Not mapped. Uppercase headings in web render as mixed-case in PPTX.

**Fix**: Apply `textTransform` to the string before passing to PptxGenJS:
- `"uppercase"` → `text.toUpperCase()`
- `"lowercase"` → `text.toLowerCase()`
- `"capitalize"` → capitalize first letter of each word

### 3. Gradients fall back to solid color

**Web** (`LayoutRenderer.tsx:165`):
```tsx
style.background = gradientToCSS(el.style.gradient);  // full CSS gradient
```

**PPTX** (`pptx.ts:257-264`):
```ts
// Gradient fallback — use last stop color
const lastStop = style.gradient.stops[style.gradient.stops.length - 1];
```

PptxGenJS does support gradients via `fill.type: 'solid'` replacement with gradient stops.

**Fix**: Use PptxGenJS gradient fill API with proper angle and color stop mapping.

### 4. SLIDE_W precision error

**Current** (`pptx-helpers.ts:7`):
```ts
const SLIDE_W = 13.3;
```

PptxGenJS `LAYOUT_WIDE` is 13.333... inches (10"/0.75). The 0.033" error causes ~6px drift at the right edge of the canvas.

**Fix**: Change to `13 + 1/3` or `13.333333` to match PptxGenJS's actual layout width.

### 5. Table padding mismatch

**Web** (`LayoutRenderer.tsx:301`):
```tsx
padding: "16px 24px"    // headers
padding: "14px 24px"    // cells
```

**PPTX** (`pptx.ts:494`):
```ts
margin: [2, 4, 2, 4]   // ~3px vertical, ~5.5px horizontal
```

The PPTX table cells are dramatically tighter than the web version.

**Fix**: Convert the web padding values through `pxToPoints()` for consistent cell margins.

### 6. Group clipping not preserved

**Web** (`LayoutRenderer.tsx:196`):
```tsx
overflow: el.clipContent ? "hidden" : undefined,
borderRadius: el.style?.borderRadius  // clips children to rounded corners
```

**PPTX** (`pptx.ts:381-428`): Flattens group to background shape + offset children. Children are **not clipped** to the group's bounds or border radius. Content that should be hidden overflows visibly.

**Fix**: Constrain child element rects to not exceed the parent group's bounds when `clipContent` is true. For border radius clipping, this is a known PptxGenJS limitation — document it as a known gap, but at minimum clamp child positions/sizes to the group rect.

### 7. Code block lineHeight mismatch

**Web** (`LayoutRenderer.tsx:236`): `lineHeight: 1.6`
**PPTX**: No `lineSpacingMultiple` set (defaults to ~1.15).

**Fix**: Same as gap #1 — set `lineSpacingMultiple: 1.6` in `renderCode()`.

## Additional Improvement: Persist Layout JSON

Currently the layout JSON is computed in-memory and never written to disk. Persisting it to `content/[slug]/layout.json` would enable:

- Visual inspection and diffing of layout output
- Debugging fidelity issues without running the app
- Snapshot testing (compare layout JSON against expected output)
- Decoupling layout computation from rendering (pre-compute once, render many)

## Implementation Order

1. **SLIDE_W precision** — one-line fix, eliminates cumulative drift
2. **lineHeight → lineSpacingMultiple** — highest visual impact, affects all multi-line text
3. **textTransform** — simple string transform before passing to PptxGenJS
4. **Table padding** — use pxToPoints conversion instead of hardcoded values
5. **Gradient support** — use PptxGenJS gradient API
6. **Group clipping** — rect clamping for clipContent groups
7. **Persist layout JSON** — tooling improvement for debugging all of the above

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/export/pptx-helpers.ts` | Fix SLIDE_W to 13.333... |
| `src/lib/export/pptx.ts` | lineHeight mapping, textTransform, gradient fills, table padding, group clipping, code lineHeight |
| `src/lib/layout/index.ts` | Optional: persist layout JSON to disk |
| `src/app/api/layout/route.ts` | Optional: write layout.json alongside response |
