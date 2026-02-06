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

No test framework is configured yet.

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
- `@/*` path alias → `src/*`
