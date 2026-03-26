# Plan: v4 PPTX Renderer Fidelity

## Status: Complete

PPTX output is now near pixel-perfect alignment with web slides, aside from font family substitution (Inter not available in PowerPoint).

## Context

Comparison of two presentation-to-PPTX approaches revealed that the talks repo's PPTX output had lower fidelity than expected, despite having the architecturally superior layout model approach.

### Talks repo (layout model approach)
```
YAML → LayoutPresentation (JSON) → Web Renderer / PPTX Renderer
```

### Frontend-slides repo (HTML-first approach)
```
HTML (single file) → generate_pptx.py → PPTX
```

The HTML-first approach got better fidelity because it's a direct translation from one concrete output to another. Our layout model approach had two interpreters that disagreed on details. v4 closed that gap.

## Key Lessons Learned

1. **Code review priorities were wrong** — theoretical gaps (lineHeight, textTransform) were barely visible. The actual visible differences were card styling (shadows, borders, corners, transparency).

2. **Visual testing is essential** — several fixes were reverted or revised based on screenshots:
   - Shadow opacity: the "bug" was actually already producing correct output (two wrongs making a right)
   - Rounded corners: the real issue was border overflow, not radius values
   - Semi-transparent borders: PowerPoint renders them more visibly than CSS, so they need to be skipped above 80% transparency

3. **"transparent" is a dangerous value** — `hexColor("transparent")` returns `"000000"`. Any code path that converts transparent colors to hex without checking for full transparency will produce black fills/borders. Fixed by early-return checks in `makeFill()`, `makeLine()`, and `renderGroup()`.

4. **PptxGenJS table limitations** — `addTable()` doesn't support borderRadius or border transparency. Replaced with shape-based rendering (rounded rects + text boxes) for full control.

5. **JS spread gotcha** — `{ ...defaults, color: undefined }` overwrites `defaults.color` with `undefined`. Fixed in `titleBlock()` by conditionally including optional properties.

6. **Dev server infinite refresh** — writing files to watched directories during render triggers fast refresh loops. Fixed by comparing content before writing.

## Completed Steps

### Step 1: SLIDE_W precision
- `pptx-helpers.ts`: `13.3` → `40 / 3`

### Step 2: Layout JSON persistence
- `layoutPresentation()` writes `layout.json` to `content/[slug]/` in dev mode
- Change detection prevents Next.js fast refresh loops
- Gitignored in `content/.gitignore`

### Step 3: Border transparency passthrough
- `makeLine()` passes `transparency` to `ShapeLineProps`
- Borders >= 80% transparency skipped entirely (PowerPoint renders them too visibly)

### Step 4: Backing shape technique for rounded borders
- `renderGroup()` rewritten: accent-colored backing rect + inset fill rect
- Inner rect extends 2px on non-bordered sides to prevent corner bleed
- Handles top, left, right, bottom borders correctly

### Step 5: Transparent fill/border handling
- `makeFill()` returns `undefined` for fully transparent fills
- `renderGroup()` checks `fillVisible`/`borderVisible` before rendering shapes
- Fixed black backgrounds on inactive agenda items

### Step 6: Table as shapes
- Replaced `addTable()` with shapes + text boxes
- Rounded corners, border transparency, correct padding, alternating row colors
- Proportional row heights matching template constants (72px header, 68px data)

### Step 7: Title descender clipping
- `estimateTextHeight()` adds `fontSize * 0.15` descender padding when `lineHeight < 1.3`

### Step 8: Title color override bug
- `titleBlock()` no longer spreads `undefined` color/textShadow into heading style
- Fixed invisible titles on all dark themes

### Step 9: Icon grid sizing
- Icon font: 64→48px, box height: 64→72px
- Label height: 32→42px, inner gap: 16→4px
- Vertical centering within card

### Web slide engine improvements (bonus)
- Vertical nav dots: 32-dot sliding window, number hints, click to navigate
- Scroll navigation: accumulator threshold + cooldown for trackpad support

## Remaining Gaps (low priority)

| Gap | Impact | Effort |
|-----|--------|--------|
| Font family substitution | Medium — titles slightly thinner | Not fixable without font embedding |
| Gradients → solid fallback | Low — only accent lines use gradients | Medium — use PptxGenJS gradient API |
| lineHeight → lineSpacing | Low — barely visible on short text | Low |
| textTransform | Low — few templates use uppercase | Low |
| Group clipping | Low — rare edge case | Medium |

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/export/pptx.ts` | Transparency handling, backing shapes, table rendering, border skip |
| `src/lib/export/pptx-helpers.ts` | SLIDE_W precision |
| `src/lib/layout/helpers.ts` | Descender padding, title color fix |
| `src/lib/layout/index.ts` | Layout JSON persistence |
| `src/lib/layout/templates/icon-grid.ts` | Icon/label sizing |
| `src/components/SlideEngine.tsx` | NavDots component, scroll navigation |
| `src/styles/engine.css` | Nav dots styling |
| `src/app/[slug]/page.tsx` | Use layoutPresentation() |
| `content/.gitignore` | Ignore layout.json |
