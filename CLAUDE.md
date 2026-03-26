# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # Install dependencies
bun run dev          # Start dev server at http://localhost:3000
bun run build        # Production build
bun run start        # Start production server
bun run lint         # Run ESLint
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

YAML + scene-compiler-driven presentation hub. See `docs/2026-03-12-design-v9.md` for current architecture, `docs/2026-03-12-discussion-v9.md` for design history.

**Data flow:** `content/[slug]/slides.yaml` → `loadPresentation()` (DSL/template expansion) → `layoutPresentation()` → `compileSceneSlide()` (scene compiler) → `LayoutPresentation` JSON → `LayoutRenderer` (web) or `exportPptx()` (PPTX)

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
- `src/app/page.tsx` — home page, auto-discovers from `content/`
- `src/app/api/layout/route.ts` — GET /api/layout?slug=X → layout JSON
- `src/app/api/export_pptx/route.ts` — POST layout JSON → .pptx download

**Tooling:**
- `scripts/port-layout-to-scene.mjs` — batch migration of v8 layout.json → scene slides.yaml
- `scripts/slide-diff.mjs` — pixel-diff comparison between rendered slide and reference image

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

**New presentation:** Create `content/my-talk/slides.yaml`, put images in `content/my-talk/images/`. Run `bun run sync-content` to copy to `public/`. Auto-discovered.

**Preview all templates:** Visit `/example` — one slide per template with sample content.

**New template:** Create `src/lib/layout/templates/foo.template.yaml` with `name`, `params`, `style`, and scene `children`. Must emit `mode: scene`. Auto-discovered by DSL loader — no registry update needed.

**New theme:** Add a new `ResolvedTheme` object in `src/lib/layout/theme.ts` → add to `ThemeName` union in `types.ts`. Both web and PPTX renderers use the same resolved values.

**PPTX export:** Click "Export PPTX" on any presentation, or use the API: `GET /api/layout?slug=X` then `POST /api/export_pptx` with the JSON body.

### Tech Stack

- Next.js 15 (App Router), React 19, TypeScript (strict)
- Custom slide engine (no Reveal.js), Tailwind CSS 4, Bun
- Unified layout model (1920×1080 canvas) for web + PPTX
- PptxGenJS for PowerPoint export, JSZip for OOXML post-processing (animations)
- 16 themes via resolved concrete values, CSS-only animations
- Vitest for unit/integration tests, Playwright for E2E
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
