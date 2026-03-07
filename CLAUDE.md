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

YAML + layout-model-driven presentation hub. See `docs/design-v3.md` for layout model, `docs/design-v6.md` for composable components, `docs/design-v7.md` for DSL template system.

**Data flow:** `content/[slug]/slides.yaml` → `loadPresentation()` → `layoutPresentation()` → `LayoutPresentation` JSON → `LayoutRenderer` (web) or `exportPptx()` (PPTX)

### Key Files

- `src/lib/types.ts` — `SlideData` discriminated union, `PresentationData`, `ThemeName`, `AnimationOverride`
- `src/lib/loadPresentation.ts` — `loadPresentation()`, `discoverPresentations()`, `getAllSlugs()`
- `src/lib/layout/types.ts` — `LayoutSlide`, `LayoutElement` (9 kinds: text, image, shape, group, code, table, list, video, iframe), `ResolvedTheme`, `AnimationDef`
- `src/lib/layout/theme.ts` — 16 resolved theme definitions, `resolveTheme()`
- `src/lib/layout/helpers.ts` — shared layout utilities (`titleBlock`, `stackVertical`, etc.)
- `src/lib/layout/components/` — composable component layer: types (18 components), resolvers, stacker, theme tokens
- `src/lib/layout/templates/` — 35 DSL YAML templates (`.template.yaml`), registry in `index.ts`
- `src/lib/layout/templates/bases/` — 3 base layout engines: freeform, split-compose, full-compose
- `src/lib/dsl/` — DSL template loader, Nunjucks compiler, integration tests
- `src/lib/export/pptx.ts` — `exportPptx()` via PptxGenJS, spid tracking + JSZip post-processing for animations
- `src/lib/export/pptx-animations.ts` — OOXML `<p:timing>` XML builder for entrance animations
- `src/lib/export/pptx-helpers.ts` — coordinate/color/font conversion utilities
- `src/components/SlideEngine.tsx` — custom presentation engine (keyboard nav, scaling, themes, export button)
- `src/components/LayoutRenderer.tsx` — unified web renderer (layout model → absolute-positioned divs)
- `src/styles/engine.css` — slide engine base styles (scaling, layout, transitions)
- `src/styles/animations.css` — CSS keyframes and animation utility classes
- `src/styles/themes/` — 16 theme CSS files
- `src/app/[slug]/page.tsx` — dynamic route with `generateStaticParams`
- `src/app/page.tsx` — home page, auto-discovers from `content/`
- `src/app/api/layout/route.ts` — GET /api/layout?slug=X → layout JSON
- `src/app/api/export_pptx/route.ts` — POST layout JSON → .pptx download

### Recipes

**New presentation:** Create `content/my-talk/slides.yaml`, put images in `content/my-talk/images/`. Run `bun run sync-content` to copy to `public/`. Auto-discovered.

**Preview all templates:** Visit `/example` — one slide per template with sample content.

**New template:** Create `src/lib/layout/templates/foo.template.yaml` with `name`, `params`, `style`, `base` (full-compose/split-compose/freeform), and `children`. Auto-discovered by DSL loader — no registry update needed.

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
