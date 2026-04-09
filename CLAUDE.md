# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server at http://localhost:3000 (predev syncs content)
bun run build        # Production build (prebuild syncs content)
bun run start        # Start production server
bun run lint         # Run ESLint
bun run sync-content # Copy content/[slug]/images and per-slug CSS into public/
bun run slide:diff   # Pixel-diff a rendered slide against a reference image
```

### Testing

```bash
bun run test             # Vitest — unit + integration tests
bun run test:e2e         # Playwright — end-to-end tests
```

- **Vitest** — unit tests (loadPresentation, pptx-helpers, layout functions) + integration tests (exportPptx, SlideEngine)
- **Playwright** (separate test runner) — E2E tests (full page: slide layout, navigation, keyboard, export button). Committable, CI-ready.
- **`claude --chrome`** — ad-hoc visual debugging only, not a substitute for tests

Follow TDD: write failing test → implement → green. Enforced by Superpowers plugin.

## Architecture

YAML + scene-compiler-driven presentation hub, plus a screenshot-to-template extraction workbench. See `docs/2026-03-12-design-v9.md` for the v9 scene compiler, `docs/2026-04-07-design-v11-refine-enhancement.md` for the v11 refine loop (image-grounded vision/edit with structured issue tracking), and `docs/2026-03-12-discussion-v9.md` / `docs/2026-03-26-discussion-v11.md` for design history.

**Presentation data flow:** `content/[slug]/slides.yaml` → `loadPresentation()` (DSL/template expansion) → `layoutPresentation()` → `compileSceneSlide()` (scene compiler) → `LayoutPresentation` JSON → `LayoutRenderer` (web) or `exportPptx()` (PPTX)

**Extract data flow:** screenshot upload → `/api/extract/analyze` (vision → inventory + proposals) → `/api/extract/refine` (iterative vision + edit loop, image-grounded) → updated proposals → preview render via `compileProposalPreview` + `renderSlideToImage`.

All slides use `mode: "scene"`. The legacy component layer has been removed.

### Key Files

**Scene compiler** (v9 — the authoring/compilation layer):
- `src/lib/scene/types.ts` — `SceneSlideData`, `SceneNode` (5 kinds: text, shape, image, group, ir), `FrameSpec`, `SceneGuides`, `ScenePreset`, `SceneLayout` (stack/row/grid)
- `src/lib/scene/compiler.ts` — `compileSceneSlide()`: normalize → viewport scaling → geometry solve → IR emit
- `src/lib/scene/solve.ts` — frame resolution, guide/anchor references, stack/row/grid layout
- `src/lib/scene/normalize.ts` — theme token resolution, preset inheritance, image path prefixing
- `src/lib/scene/import-layout.ts` — `importLayoutPresentation()`: v8 IR → scene slide converter for migration

**Layout IR** (the render/export target — unchanged from v8):
- `src/lib/types.ts` — `SlideData` (`SceneSlideData & SlideBaseFields`), `PresentationData`, `ThemeName`
- `src/lib/loadPresentation.ts` — `loadPresentation()`, `discoverPresentations()`, `getAllSlugs()`
- `src/lib/layout/types.ts` — `LayoutSlide`, `LayoutElement` (9 kinds: text, image, shape, group, code, table, list, video, iframe), `ResolvedTheme`, `TransformDef`, `RichText`
- `src/lib/layout/theme.ts` — 16 resolved theme definitions, `resolveTheme()`
- `src/lib/layout/theme-tokens.ts` — `resolveThemeToken()`, alpha suffixes (`theme.accent@0.13`)
- `src/lib/layout/helpers.ts` — shared layout utilities, text height estimation
- `src/lib/layout/decorators/` — theme decorators (background/foreground elements per theme)

**DSL & templates:**
- `src/lib/layout/templates/` — 35 DSL YAML templates (`.template.yaml`), all emit `mode: scene`
- `src/lib/dsl/engine.ts` — DSL template loader, Nunjucks compiler with scene macro support
- `src/lib/dsl/macros/scene/blocks.njk` — shared scene macros (eyebrow_title, stat_card, section_title, etc.)

**Export:**
- `src/lib/export/pptx.ts` — `exportPptx()` via PptxGenJS, spid tracking + JSZip post-processing for animations
- `src/lib/export/pptx-animations.ts` — OOXML `<p:timing>` XML builder for entrance animations
- `src/lib/export/pptx-helpers.ts` — coordinate/color/font conversion utilities

**Rendering & UI:**
- `src/components/SlideEngine.tsx` — custom presentation engine (keyboard nav, scaling, themes, export button)
- `src/components/LayoutRenderer.tsx` — unified web renderer (layout model → absolute-positioned divs)
- `src/styles/engine.css` — slide engine base styles (scaling, layout, transitions)
- `src/styles/animations.css` — CSS keyframes and animation utility classes
- `src/styles/themes/` — 16 theme CSS files
- `src/app/[slug]/page.tsx` — dynamic route with `generateStaticParams`
- `src/app/page.tsx` — home page, auto-discovers from `content/`, links to `/workbench/extract`
- `src/app/api/layout/route.ts` — GET /api/layout?slug=X → layout JSON
- `src/app/api/export_pptx/route.ts` — POST layout JSON → .pptx download
- `src/app/api/render/route.ts` — POST layout slide → PNG (server-side render via Playwright)

**Server-side render:**
- `src/lib/render/html.ts` — layout slide → standalone HTML
- `src/lib/render/screenshot.ts` — `renderSlideToImage()` (Playwright-based PNG render)
- `src/lib/render/compare.ts` — `compareImages()` (pixel diff + region detection)
- `src/lib/render/annotate.ts` — overlay diff regions onto a result image
- `src/lib/render/crop.ts` — `CropBounds` helpers for content bounds masking
- `src/lib/render/fonts.ts` — font preloading for Playwright contexts

**Extract workbench** (screenshot → scene template):
- `src/app/workbench/extract/page.tsx` — `/workbench/extract` route, mounts `ExtractCanvas`
- `src/components/extract/ExtractCanvas.tsx` — top-level workbench shell
- `src/components/extract/store.ts` — Zustand store for analysis, proposals, refine state
- `src/components/extract/CanvasViewport.tsx`, `CanvasToolbar.tsx`, `InspectorPanel.tsx`, `TemplateInspector.tsx`, `SlideCard.tsx`, `ThumbnailStrip.tsx`, `BenchmarkLauncher.tsx` — UI panels
- `src/lib/extract/prompts.ts` — analyze-phase prompt builder (vision inventory + initial proposals)
- `src/lib/extract/refine-prompt.ts` — refine-phase vision + edit prompt builders
- `src/lib/extract/refine.ts` — `runRefinementLoop()` (vision → edit → render+diff per iteration)
- `src/lib/extract/compile-preview.ts` — `compileProposalPreview()` (proposal → layout slide)
- `src/lib/extract/normalize-analysis.ts` — raw analysis → render-space copy used by refine
- `src/lib/extract/geometry-hints.ts` — exact element rectangles fed into the edit prompt
- `src/lib/extract/benchmark.ts` — control vs coords benchmark runner
- `src/lib/extract/refine-artifacts.ts` — in-memory artifact store for diff overlay PNGs
- `src/app/api/extract/analyze/route.ts` — POST screenshot → analysis JSON + proposals
- `src/app/api/extract/refine/route.ts` — POST proposals → SSE stream of `refine:*` events
- `src/app/api/extract/benchmark/catalog/route.ts` — list benchmark slides
- `src/app/api/extract/benchmark/load/route.ts` — load a benchmark slide as a refine input

**Tooling:**
- `scripts/sync-content.sh` — copy `content/*/images` and per-slug CSS into `public/` (runs via `predev`/`prebuild`)
- `scripts/port-layout-to-scene.mjs` — batch migration of v8 layout.json → scene slides.yaml
- `scripts/slide-diff.mjs` — pixel-diff comparison between rendered slide and reference image (`bun run slide:diff`)

### Scene Authoring Model

Slides are authored as scene nodes with explicit geometry, not semantic components.

**Reuse hierarchy** (each tier has hard boundaries):
- **Presets** — node-level style defaults (no children, no content). Supports `extends` inheritance.
- **Macros** — Nunjucks-time scene node fragments (parameterized, compile-time only). In `src/lib/dsl/macros/scene/`.
- **Templates** — whole-slide composition via `.template.yaml`. May call macros.

**Key scene features:**
- `FrameSpec` — partial geometry constraints (`left`, `right`, `centerX`, etc.) compiled to absolute `Rect`
- Guides — named alignment points (`@x.content-left`, `@y.title-top`)
- Anchors — reference previously compiled siblings (`@panel.right`, `{ ref: "@title.bottom", offset: 24 }`)
- `sourceSize` + `fit` + `align` — author in screenshot pixel space, compiler scales to 1920×1080
- Layout primitives — `stack`, `row`, `grid` on groups (explicit gap/tracks, no hidden defaults)
- `kind: "ir"` — escape hatch wrapping raw `LayoutElement` for code/table/list/video/iframe

### Recipes

**New presentation:** Create `content/my-talk/slides.yaml`, put images in `content/my-talk/images/`. `predev` runs `sync-content` automatically; otherwise run `bun run sync-content`. Auto-discovered by the home page.

**Preview all templates:** Visit `/example-v9` (the `content/example-v9` deck cycles every template with sample content).

**New template:** Create `src/lib/layout/templates/foo.template.yaml` with `name`, `params`, `style`, and scene `children`. Must emit `mode: scene`. Auto-discovered by DSL loader — no registry update needed.

**New theme:** Add a new `ResolvedTheme` object in `src/lib/layout/theme.ts` → add to `ThemeName` union in `types.ts`. Both web and PPTX renderers use the same resolved values.

**PPTX export:** Click "Export PPTX" on any presentation, or use the API: `GET /api/layout?slug=X` then `POST /api/export_pptx` with the JSON body.

**Extract a template from a screenshot:** Visit `/workbench/extract`, upload a slide screenshot, run analyze, then iterate the refine loop. Use the benchmark launcher to compare control vs coords runs against existing decks.

### Tech Stack

- Next.js 15 (App Router), React 19, TypeScript (strict)
- Custom slide engine (no Reveal.js), Tailwind CSS 4, Bun
- Unified layout model (1920×1080 canvas) for web + PPTX
- PptxGenJS for PowerPoint export, JSZip for OOXML post-processing (animations)
- 16 themes via resolved concrete values, CSS-only animations
- Playwright for server-side slide rendering (`renderSlideToImage`) and E2E tests
- Sharp for image processing in extract diff/compare
- `@anthropic-ai/claude-agent-sdk` for vision/edit calls in the extract workbench
- Zustand for the extract workbench client store
- Vitest for unit/integration tests, Playwright Test for E2E
- Superpowers plugin for TDD/SDD workflow
- `@/*` path alias → `src/*`

## Git

`content/` is a git submodule. `git add content` updates the submodule commit pointer (not the files) — safe to use when syncing.

### Commit Format

Use conventional commits with scope. Body is a bullet list (no indentation). End with co-author line.

```
feat(scope): short summary

- Bullet point describing a change
- Another change

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```
