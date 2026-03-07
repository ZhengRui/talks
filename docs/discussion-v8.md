# Discussion v8: Framework Expressiveness and PPTX Fidelity

## Context

After replicating 10 slides from an external HTML presentation (`localhost:8765/index.html`) into the YAML framework (`content/replicate-iran-war-2026/slides.yaml`), we found significant gaps in the framework's expressive power and PPTX export fidelity. This document captures the analysis.

## What We Built During Replication

28 commits on the branch, 145 files changed (+15,089/-1,387 lines) in `src/`. The uncommitted replication-session work alone: 40 files, +788/-307 lines.

## Categorizing Changes: Generic vs Hack

### Generic Improvements (Benefit Any Presentation)

| Change | Files | Why It's Generic |
|--------|-------|-----------------|
| `entrance`/`animation` rename | 37 files | Clears up confusing naming — `entrance` = one-shot reveal, `animation` = continuous CSS animation. Every future presentation benefits. |
| `highlightColor` on TextStyle | types.ts, LayoutRenderer, resolvers | Enables `**bold**` markdown segments to render in a distinct color. Common pattern in real presentations. |
| `clipPath` field on all elements | types.ts, LayoutRenderer | Genuine CSS/SVG capability. Useful for reveal effects, masking, non-rectangular crops. |
| `animation` (CSS shorthand) on elements | types.ts, LayoutRenderer | Enables continuous CSS animations (`float 4s infinite`). Standard capability. |
| `whiteSpace: "pre-line"` in renderer | LayoutRenderer.tsx | Fixes newline rendering in text blocks. Was a bug. |
| `renderInlineHighlight()` | LayoutRenderer.tsx | `**bold**` markdown parsing with optional highlight color. Common need. |
| `parseFontFamily` undefined guard | pptx-helpers.ts | Bug fix — undefined font crashed PPTX export. |
| `extractSolidColor()` / `parseCssGradients()` | pptx-helpers.ts | Proper CSS gradient stack parsing. Any slide with gradient backgrounds needs this. |
| PPTX radial gradient support | pptx-effects.ts | `buildCssGradFillXml()` with OOXML `<a:path path="circle">`. Generic capability. |
| CSS gradient → PPTX background overlays | pptx.ts | Detects gradient layers in `background` string, creates full-slide shapes with proper OOXML gradient fills. Any gradient background now exports. |
| Per-presentation CSS loading | SlideEngine.tsx | Loads `/<slug>/animations.css` if present. Lets presentations define custom keyframes without polluting global CSS. |

### Hacks (Workarounds for Missing Capabilities)

| Hack | Root Cause | What's Really Needed |
|------|-----------|---------------------|
| `clipPath: "polygon(0% 98%, 0% 100%, 100% 2%, 100% 0%)"` for diagonal lines | **No rotation support.** Can't rotate a 1px-tall rect 45deg. Faked it with a polygon clip that reveals only a thin diagonal strip. | `transform: { rotate: 45 }` on any element |
| Glitch keyframes in global `animations.css` | **No per-presentation keyframe system.** Had to define `glitch-anim`, `glitch-anim2`, `glitch-skew` globally. | Per-presentation CSS (partially solved by SlideEngine change, but keyframes are still in global CSS) |
| Massive freeform YAML for every slide | **No mid-level abstraction for custom layouts.** A hub-spoke diagram with 8 nodes required ~100 lines of YAML with every rect hand-calculated. | Relative positioning, auto-layout components, reusable snippets |
| Manual scale/offset calculations | **No viewport mapping.** Source was 1200x948, canvas is 1920x1080. Had to manually compute `x * 1.6`, `y * 1.6 - 219` for every coordinate. | Source viewport declaration + auto-scaling |
| Emoji text elements without fontFamily | **TextStyle requires fontFamily but some elements are just emoji.** | Optional fontFamily with sensible default (fixed by the guard, but shows the type was too rigid) |
| CSS gradient strings as background | **No structured background model.** Background is a raw CSS string parsed at export time. | Typed `BackgroundLayer[]` in the IR |

### Verdict

~85% of the code changes are genuinely generic. The gradient parsing, inline highlight, entrance/animation rename, clipPath field — these all make the framework more capable for any presentation. The main hacks are (1) no rotation forcing clipPath abuse, and (2) no relative/auto-layout forcing verbose freeform YAML.

## Core Limitations Exposed by Replication

### A. No Transforms (Rotation, Scale, Skew)

The single biggest gap. Diagonal lines, rotated text, skewed backgrounds — all impossible. The `clipPath` hack works for thin lines but breaks down for rotated text or images. Both CSS `transform` and OOXML `<a:xfrm rot="...">` support rotation natively.

### B. No Relative/Auto-Layout

Every freeform element needs `rect: { x, y, w, h }` in absolute pixels. A hub-spoke diagram with 8 nodes is 100+ lines because you manually position each rect. There's no "center this below that" or "distribute these evenly in a row."

### C. Primitive Text Model

Text is a plain string with one style. Real presentations have:
- Mixed inline formatting (bold word in red, rest in white)
- Superscripts, subscripts
- Inline icons/emoji with different sizing
- Multi-paragraph with different styles

We added `highlightColor` for `**bold**` segments, but this is a narrow solution. A proper rich-text model with styled runs would handle all cases.

### D. No Multi-Layer Backgrounds in the IR

The `background` field is a string. When it contains CSS gradients like `"radial-gradient(...), radial-gradient(...), #080808"`, we parse it into OOXML on the export side — but the IR doesn't model this. It's a string-in, string-out hack.

### E. No Reusable Element Groups / Snippets

The hub-spoke diagram on slide 10 is a pattern (central node + N satellite nodes + connector lines). But there's no way to define this as a reusable component. If another presentation needs a hub-spoke, you write 100 lines of freeform YAML again.

### F. Template-to-Freeform Cliff

There are three levels: shortcut template -> compose template -> freeform. The jump from compose to freeform is steep. Compose gives you typed components in panels, but the moment you need one element positioned freely (an overlapping accent shape, a diagonal line), you drop to full freeform and lose all the convenience.

### G. Prop-by-Prop Patching

Each time we replicate a new presentation, we discover missing CSS properties and bolt them on: `clipPath`, `animation`, `highlightColor`, `opacity`. This ad-hoc approach means non-standard naming, inconsistent placement across element types, and no guarantee of PPTX export support.

### H. PPTX Fidelity Gaps

Several IR features silently fail in PPTX export:
- `clipPath` — ignored
- `animation` (CSS) — inherently unexportable
- Box shadow on groups — partial
- Border on groups — partial
- Multi-layer gradient backgrounds — hacked via overlay shapes

## The Template Accumulation Vision

The end-state workflow:

```
New presentation encountered
    |
    v
Replicate using existing templates where possible
(cover -> use cover template, bullet list -> use bullets template)
    |
    v
For novel layouts, use compose or freeform
    |
    v
Once a freeform slide looks good, run "save as template"
    |
    v
Tool extracts parameters -> generates .template.yaml
    |
    v
Human reviews, adjusts parameter names, adds defaults
    |
    v
Template registered and available for future presentations
    |
    v
PPTX export works automatically (template uses IR elements)
```

### What's Needed to Make This Real

1. **IR expressiveness** (transforms, rich text, auto-layout, comprehensive styles) — without these, too many slides require verbose hacks that can't be cleanly templated
2. **"Save as template" tool** — the extraction step that turns freeform YAML into parameterized templates
3. **Template testing** — each new template should have a sample rendering + PPTX export verification

### What's Already Working Well

- The DSL engine (Nunjucks templates) is solid and expressive
- The component layer (18 types) covers most content patterns
- The 3-tier approach (shortcut -> compose -> freeform) is the right architecture
- PPTX export with post-processing handles effects, gradients, animations
- Theme system with resolved concrete values works for both renderers

## Conclusion

The framework's layered architecture is sound. The gap is in the IR's expressive power (transforms, rich text, relative positioning, comprehensive styling) and the PPTX export's fidelity coverage. Filling these gaps — detailed in `design-v8.md` — would make the "replicate -> templatize -> accumulate" cycle fast enough to be practical.
