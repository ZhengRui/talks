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

- **Vitest** — unit tests (`loadPresentation`, parser) + integration tests (template rendering via React Testing Library)
- **Playwright** (separate test runner) — E2E tests (full page: slide layout, navigation, images, keyboard). Committable, CI-ready.
- **`claude --chrome`** — ad-hoc visual debugging only, not a substitute for tests

Follow TDD: write failing test → implement → green. Enforced by Superpowers plugin.

## Architecture

YAML + template-driven presentation hub. See `docs/design.md` for full details.

**Data flow:** `content/[slug]/slides.yaml` → server component → template registry → `<section>` elements → Reveal.js.

### Key Files

- `src/lib/types.ts` — `SlideData` discriminated union, `PresentationData`, `PresentationSummary`
- `src/lib/loadPresentation.ts` — `loadPresentation()`, `discoverPresentations()`, `getAllSlugs()`
- `src/components/Presentation.tsx` — Reveal.js client wrapper
- `src/components/templates/` — one component per template, registry in `index.ts`
- `src/app/[slug]/page.tsx` — dynamic route with `generateStaticParams`
- `src/app/page.tsx` — home page, auto-discovers from `content/`

### Recipes

**New presentation:** Create `content/my-talk/slides.yaml`, put images in `public/my-talk/`. Auto-discovered.

**New template:** Add interface to `types.ts` → create `templates/Foo.tsx` → add to registry in `templates/index.ts`.

### Tech Stack

- Next.js 15 (App Router), React 19, TypeScript (strict)
- Reveal.js 5, Tailwind CSS 4, Bun
- Vitest for unit/integration tests, Playwright for E2E
- Superpowers plugin for TDD/SDD workflow
- `@/*` path alias → `src/*`

## Git Commit Format

Use conventional commits with scope. Body is a bullet list (no indentation). End with co-author line.

```
feat(scope): short summary

- Bullet point describing a change
- Another change

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```
