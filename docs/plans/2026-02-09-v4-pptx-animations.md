# Plan: PPTX Animation via OOXML Post-Processing

## Status: COMPLETE

## Goal
Add entrance animations to PPTX export that match the web slide engine's CSS animations. All animations play automatically on slide entry with staggered delays. Works in Keynote and WPS Office.

## Architecture

```
exportPptx()
  ├── Phase 1: Render shapes (PptxGenJS) + track spid-to-animation mapping
  ├── Phase 2: pres.write() → Buffer
  └── Phase 3: JSZip post-process → inject <p:timing> XML per slide
```

During Phase 1, each `renderElement()` call is bracketed by reading `slide._slideObjects.length` to compute the spid range (spid = idx + 2). Spids for animated elements (including all shapes in a group) are collected into `AnimationEntry` objects.

## Animation Type Mapping

All types use `presetID=10` (Fade) as the base preset — Keynote needs a recognized preset, and Fade won't add unwanted built-in motion. Custom `<p:anim>` elements add subtle motion on top.

| Layout `AnimationType` | OOXML Behavior |
|---|---|
| `fade-in` | `<p:animEffect filter="fade">` |
| `fade-up` | fade + `<p:anim ppt_y>` (offset 0.028 ≈ 30px/1080) |
| `slide-left` | fade + `<p:anim ppt_x>` (offset 0.031 ≈ 60px/1920) |
| `slide-right` | fade + `<p:anim ppt_x>` (offset -0.031) |
| `scale-up` | fade + `<p:animScale>` (85000→100000 EMU) |
| `none` / `count-up` | Skipped |

## Delay Compression

Layout model delays (0–950ms across 8+ groups on busy slides) are compressed for snappy PPTX playback:

- **MAX_PPTX_DELAY = 100ms** — total stagger budget
- **MAX_PPTX_DURATION = 200ms** — per-animation cap
- Uniform relative step between delay groups, delay=0 within the same group

### Cumulative delay insight

OOXML `nodeType="withEffect"` delays are **cumulative** — each entry's delay is relative to the PREVIOUS sibling's start, not the parent container. This means absolute delays [0, S, 2S, 3S...] produce actual start times [0, S, 3S, 6S, 10S...] — accelerating gaps that feel increasingly slow.

**Fix**: Use uniform RELATIVE delays — constant step S between groups — producing actual start times [0, S, 2S, 3S...] with perfectly equal spacing. Within the same delay group, use delay=0.

## WPS Office Compatibility

### Problem 1: Animations not playing at all
Animations worked in Keynote but were completely invisible in WPS Office (Mac).

### Debugging approach
1. Tried standard PowerPoint patterns (`clickEffect` + `delay="indefinite"`) — broke Keynote without fixing WPS
2. Searched English and Chinese web for WPS OOXML animation docs — no useful results
3. Created a minimal PPTX with one shape, had user add a Fade entrance animation via WPS UI, then extracted and compared the XML

### What we found — the critical diff

```
WPS structure (what WPS generates):
  tmRoot (id=1)
    └── mainSeq (id=2)
        └── click-group (id=3, delay="indefinite")    ← DIFF: we use "0"
            └── wrapper-par (id=4, delay="0")          ← DIFF: we're MISSING this layer
                └── entry-par (id=5, clickEffect)      ← DIFF: we use withEffect
                    └── visibility set (id=6)

Our original structure:
  tmRoot (id=1)
    └── mainSeq (id=2)
        └── click-group (id=3, delay="0")
            └── entry-par (id=4, withEffect)           ← directly inside click-group
                └── visibility set + behaviors
```

Three differences, but only ONE mattered: **the missing wrapper `<p:par>`**.

### What we tried
- `delay="indefinite"` on click-group → broke Keynote (required click to advance)
- `clickEffect` instead of `withEffect` → broke Keynote (required click to advance)
- Adding the wrapper `<p:par>` while keeping `delay="0"` + `withEffect` → **works in both Keynote AND WPS**

### Lesson learned
WPS Office requires an extra intermediate `<p:par>` wrapper between the click-group and entry-pars. The structure that works everywhere:

```
click-group → wrapper-par → entry-pars     (Keynote + WPS)
click-group → entry-pars                   (Keynote only)
```

The `delay` and `nodeType` values didn't matter for WPS — it was purely the structural nesting depth.

### Problem 2: WPS shows no stagger (all items animate simultaneously)
Even after the wrapper-par fix, WPS shows all animated items appearing at the same time instead of staggered left-to-right / top-to-bottom.

**Root cause**: WPS interprets `withEffect` delays as **absolute** (from the slide entry trigger), while the OOXML spec and PowerPoint/Keynote treat them as **cumulative** (each delay relative to the previous sibling's start). Our uniform relative delays (~14ms each) are all nearly the same absolute value from WPS's perspective, so everything starts at once.

**Trade-off**: Switching to absolute delays fixes WPS stagger but causes accelerating gaps on Keynote (cumulative interpretation of increasing values: [0, S, 3S, 6S, 10S...]). Tested both — Keynote looked noticeably worse with absolute delays.

**Decision**: Prioritize spec-correct cumulative behavior (Keynote). WPS delay interpretation is a known limitation with no single-file workaround that satisfies both apps.

## Final XML Structure

```xml
<p:timing>
  <p:tnLst>
    <p:par>
      <p:cTn nodeType="tmRoot">
        <p:seq nodeType="mainSeq">
          <p:par>                                    <!-- click-group -->
            <p:cTn fill="hold">
              <p:par>                                <!-- wrapper-par (WPS needs this) -->
                <p:cTn fill="hold">
                  <p:par>                            <!-- entry-par per element -->
                    <p:cTn grpId="0" presetID="10"
                           presetClass="entr"
                           nodeType="withEffect">
                      <p:set>...</p:set>             <!-- visibility -->
                      <p:animEffect>...</p:animEffect>
                      <p:anim>...</p:anim>           <!-- motion -->
                    </p:cTn>
                  </p:par>
                  <!-- more entry-pars... -->
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

## Files Modified/Created

| File | Action |
|------|--------|
| `src/lib/export/pptx-animations.ts` | **New** — timing XML builder with delay compression |
| `src/lib/export/pptx.ts` | Modified — spid tracking, JSZip post-processing |
| `src/lib/export/pptx-animations.test.ts` | **New** — 17 unit tests |
| `src/lib/export/pptx.test.ts` | Modified — integration tests for animation injection |

## Verification

- `bun run test` — all tests pass
- Exported PPTX tested in Apple Keynote — animations auto-play on slide entry
- Exported PPTX tested in WPS Office (Mac) — animations auto-play after wrapper-par fix
