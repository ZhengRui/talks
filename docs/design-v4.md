# Design v4: PPTX Renderer Fidelity

## Motivation

The v3 unified layout model successfully drives both web and PPTX rendering from a single `LayoutPresentation` JSON. However, the PPTX renderer had accumulated fidelity gaps — properties that the web renderer handled correctly but the PPTX renderer ignored or approximated.

Meanwhile, an alternative approach (HTML → hand-written `generate_pptx.py`) produced higher-fidelity PPTX output because each element is manually tuned. The v4 goal was to close that gap. **Result**: aside from font family substitution, PPTX output is now near pixel-perfect alignment with web slides.

## Architecture (unchanged)

```
slides.yaml → loadPresentation() → layoutPresentation() → LayoutPresentation (JSON)
    ├── Web:  LayoutRenderer.tsx    (React, absolute-positioned divs)
    └── PPTX: exportPptx()         (PptxGenJS)
```

The layout JSON is the ground truth. Both renderers consume it. v4 fixed the PPTX renderer's interpretation without changing the layout model.

## Methodology

1. Initial code review identified 11 theoretical gaps
2. Side-by-side visual comparison (web vs PPTX) revealed the **actual priority order** — card styling gaps were far more visible than text spacing issues
3. Fixes applied one at a time with visual testing after each change
4. Several fixes were reverted or revised based on visual feedback (e.g., shadow opacity was already correct, rounded corner issue was actually border overflow)

## Completed Fixes

### 1. SLIDE_W precision
- `pptx-helpers.ts`: Changed `13.3` → `40 / 3` to match PptxGenJS `LAYOUT_WIDE` (13.333...)
- Eliminated ~6px drift at right edge

### 2. Transparent fill/border handling
- `makeFill()`: Returns `undefined` for fully transparent fills instead of `{ color: "000000", transparency: 100 }`
- `makeLine()`: Skips borders with >= 80% transparency (PowerPoint renders them more visibly than CSS)
- `renderGroup()`: Checks `fillVisible`/`borderVisible` before rendering shapes — prevents black backgrounds on transparent groups (e.g., inactive agenda items)

### 3. Border transparency passthrough
- `makeLine()`: Passes `transparency` from `colorAlpha()` to `ShapeLineProps`
- PptxGenJS shape borders support `line.transparency` (PR #889)
- Table borders do NOT support transparency (PptxGenJS TODO) — handled by skipping

### 4. Rounded corner border overflow (backing shape technique)
- Problem: Side accent borders (e.g., blue top bar on stats cards) overflowed outside rounded corners
- Solution: Two-shape approach in `renderGroup()`:
  1. Full-size rounded rect filled with border color
  2. Inner rounded rect filled with card color, inset by border width on bordered sides
  3. Inner rect extends 2px beyond outer on non-bordered sides to prevent corner bleed

### 5. Table rendering — shapes instead of `addTable()`
- Replaced `addTable()` with individual shapes + text boxes
- Benefits: rounded corners, border transparency, proper padding, consistent rendering
- Structure: outer rounded rect (header bg) → data area rounded rect → alt-row fills → border lines → text boxes
- Header padding: 12pt/18pt, cell padding: 11pt/18pt (matching web's 16px/24px and 14px/24px)

### 6. Title text descender clipping
- `estimateTextHeight()`: Added descender padding (`fontSize * 0.15`) when `lineHeight < 1.3`
- Prevents bottom clipping on letters like 'g', 'y' in titles

### 7. Title color override bug
- `titleBlock()` in `helpers.ts`: Destructuring `color` from opts as `undefined` was overriding `theme.heading` via spread
- Fix: Only include `color` and `textShadow` in spread when explicitly defined
- This fixed invisible titles on all dark themes (bold, dark-tech)

### 8. Layout JSON persistence
- `layoutPresentation()` writes `layout.json` to `content/[slug]/` in dev mode
- Only writes when content changes (prevents Next.js fast refresh loop)
- Gitignored via `content/.gitignore`

## Web Slide Engine Improvements

### Vertical navigation dots
- Fixed 32-dot maximum with sliding window behavior
- First/last 16 slides: dot moves top↔middle↔bottom
- Middle slides: track scrolls, active dot stays centered
- Smooth CSS transition on track transform
- Number hint on active dot and on hover

### Scroll navigation
- Wheel/trackpad support with accumulator threshold (80px) + cooldown (500ms)
- Prevents over-scrolling on sensitive trackpads

## PPTX Entrance Animations

### Goal
Match the web slide engine's CSS entrance animations in PPTX export. All animations auto-play on slide entry with staggered delays — no clicks required.

### Architecture

```
exportPptx()
  ├── Phase 1: Render shapes (PptxGenJS) + track spid-to-animation mapping
  ├── Phase 2: pres.write() → Buffer
  └── Phase 3: JSZip post-process → inject <p:timing> XML per slide
```

During Phase 1, each `renderElement()` call is bracketed by reading `slide._slideObjects.length` to compute the spid range. Spids for animated elements (including all shapes in a group) are collected into `AnimationEntry` objects.

### Animation Type Mapping

All types use `presetID=10` (Fade) as the base preset — Keynote needs a recognized preset, and Fade won't add unwanted built-in motion. Custom `<p:anim>` elements add subtle motion on top.

| Layout `AnimationType` | OOXML Behavior |
|---|---|
| `fade-in` | `<p:animEffect filter="fade">` |
| `fade-up` | fade + `<p:anim ppt_y>` (offset 0.028 ≈ 30px/1080) |
| `slide-left` | fade + `<p:anim ppt_x>` (offset 0.031 ≈ 60px/1920) |
| `slide-right` | fade + `<p:anim ppt_x>` (offset -0.031) |
| `scale-up` | fade + `<p:animScale>` (85000→100000 EMU) |
| `none` / `count-up` | Skipped |

### Delay Compression

Layout model delays (0–950ms across 8+ groups on busy slides) are compressed for snappy PPTX playback:

- **MAX_PPTX_DELAY = 100ms** — total stagger budget
- **MAX_PPTX_DURATION = 200ms** — per-animation cap
- Uniform relative step between delay groups, delay=0 within the same group

**Critical insight**: OOXML `nodeType="withEffect"` delays are **cumulative** — each entry's delay is relative to the previous sibling's start, not the parent container. Setting absolute delays [0, S, 2S, 3S...] produces actual start times [0, S, 3S, 6S...] (accelerating gaps). The fix: use uniform RELATIVE delays — constant step S between groups — producing actual start times [0, S, 2S, 3S...] with perfectly equal spacing.

### WPS Office Compatibility

**Wrapper par**: WPS Office (Mac) requires an extra wrapper `<p:par>` layer between the click-group and entry-pars:

```
click-group → wrapper-par → entry-par (WPS-compatible, also works in Keynote)
click-group → entry-par              (only works in Keynote)
```

This was discovered by creating a minimal PPTX, adding an animation via WPS UI, and comparing the generated XML against ours.

**Delay interpretation difference**: WPS appears to interpret `withEffect` delays as **absolute** (from the slide trigger), while the OOXML spec and PowerPoint/Keynote treat them as **cumulative** (relative to the previous sibling's start). With our small uniform relative delays (~14ms), WPS shows all items appearing nearly simultaneously instead of staggered. We prioritize spec-correct cumulative behavior since Keynote renders it correctly. This is a known WPS limitation with no workaround that satisfies both apps — absolute delays fix WPS but cause accelerating gaps on Keynote.

### XML Structure

```xml
<p:timing>
  <p:tnLst>
    <p:par>                                          <!-- tmRoot -->
      <p:cTn nodeType="tmRoot">
        <p:seq nodeType="mainSeq">
          <p:par>                                    <!-- click-group -->
            <p:cTn fill="hold">
              <p:par>                                <!-- wrapper-par (WPS requires this) -->
                <p:cTn fill="hold">
                  <p:par>                            <!-- entry-par per animated element -->
                    <p:cTn grpId="0" presetID="10" presetClass="entr"
                           nodeType="withEffect">
                      <p:set>...</p:set>             <!-- visibility toggle -->
                      <p:animEffect>...</p:animEffect> <!-- fade -->
                      <p:anim>...</p:anim>           <!-- motion (optional) -->
                    </p:cTn>
                  </p:par>
                </p:cTn>
              </p:par>
            </p:cTn>
          </p:par>
        </p:seq>
      </p:cTn>
    </p:par>
  </p:tnLst>
</p:timing>
```

All `<p:cTn>` nodes get sequentially incrementing `id` attributes. Elements use `nodeType="withEffect"` for auto-play. Each animated shape gets a `<p:set>` visibility toggle (hidden → visible) plus type-specific behavior elements.

### Tested On
- Apple Keynote (Mac) — auto-play works, correct motion
- WPS Office (Mac) — auto-play works after wrapper-par fix
- Microsoft PowerPoint — expected to work (standard OOXML)

## Known Remaining Gaps

### Font family substitution
- Layout model specifies "Inter, system-ui, sans-serif" — PowerPoint doesn't have Inter
- `parseFontFamily()` extracts first font; PowerPoint falls back to its own default
- Titles appear slightly thinner due to different font metrics
- **Not fixable** without font embedding (which PptxGenJS doesn't support)

### Gradients fall back to solid color
- `makeFill()` uses last gradient stop color as fallback
- PptxGenJS does support gradients — could use the actual API

### lineHeight not mapped
- Low visual impact on short text (single-line bullets, titles)
- Would need `lineSpacingMultiple` in `textOpts()`

### textTransform ignored
- `uppercase` headings not applied in PPTX
- Simple string transform before passing to PptxGenJS

### Group clipping not preserved
- PPTX flattens groups — children not clipped to group bounds

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/export/pptx.ts` | Transparent fill/border handling, backing shape technique, table as shapes, border transparency skip, spid tracking + JSZip animation post-processing |
| `src/lib/export/pptx-animations.ts` | **New** — OOXML timing XML builder with delay compression and WPS-compatible structure |
| `src/lib/export/pptx-animations.test.ts` | **New** — 17 unit tests for timing XML builder |
| `src/lib/export/pptx-helpers.ts` | SLIDE_W precision fix |
| `src/lib/layout/helpers.ts` | Descender padding in estimateTextHeight, title color override fix in titleBlock |
| `src/lib/layout/index.ts` | Layout JSON persistence with change detection |
| `src/lib/layout/templates/icon-grid.ts` | Icon/label sizing adjustments |
| `src/components/SlideEngine.tsx` | Nav dots component, scroll navigation |
| `src/styles/engine.css` | Nav dots styling |
| `src/app/[slug]/page.tsx` | Use layoutPresentation() for JSON persistence |
| `content/.gitignore` | Ignore layout.json artifacts |
