# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` contains Next.js App Router pages, including `src/app/[slug]/page.tsx` for presentations and `src/app/page.tsx` for the home index.
- `src/components/` holds the slide engine (`SlideEngine.tsx`) and unified web renderer (`LayoutRenderer.tsx`).
- `src/lib/layout/` contains the layout model: types, theme resolution, shared helpers, and 35 layout template functions.
- `src/lib/export/` contains the PPTX export pipeline (`pptx.ts`, `pptx-helpers.ts`).
- `src/lib/` also contains YAML loading and shared types (`loadPresentation.ts`, `types.ts`).
- `src/styles/` includes engine/layout CSS, animation utilities, shared component styles, and theme files.
- `content/[slug]/slides.yaml` defines a presentation; images go in `content/[slug]/images/` and are copied into `public/` via the sync script.
- Tests live in `src/**/*.test.ts(x)` (Vitest) and `e2e/*.spec.ts` (Playwright). Design notes are in `docs/` (see `docs/design-v3.md` for the current architecture).

## Build, Test, and Development Commands
- `bun install`: install dependencies.
- `bun run dev`: start the dev server at `http://localhost:3000`.
- `bun run build`: create a production build.
- `bun run start`: run the production server.
- `bun run lint`: run ESLint (Next.js config).
- `bun run test`: run Vitest unit/integration tests.
- `bun run test:watch`: run Vitest in watch mode.
- `bun run test:e2e`: run Playwright end-to-end tests.
- `bun run sync-content`: copy `content/` assets into `public/` (also runs before dev/build).

## Coding Style & Naming Conventions
- TypeScript + React; use 2-space indentation, double quotes, and semicolons (match existing files).
- Components are `PascalCase` (`SlideEngine.tsx`); utilities and functions are `camelCase`.
- Layout template functions follow the `layout*.ts` naming pattern in `src/lib/layout/templates/` and are registered in `src/lib/layout/templates/index.ts`.
- Prefer the `@/*` path alias for `src/*` imports.

## Testing Guidelines
- Unit/integration tests use Vitest in `src/**/*.test.ts(x)`. Add or update tests when changing loaders, layout functions, export logic, or engine behavior.
- E2E tests use Playwright in `e2e/*.spec.ts` for navigation, rendering, and export.
- Prefer TDD: write a failing test, implement, then make it pass.

## Commit & Pull Request Guidelines
- Use conventional commits with scope and a bullet list body, ending with a co-author line.
  Example:
  `feat(layout): add quote layout`
  `- Add layoutQuote template function`
  `- Update layout template registry`
  `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- PRs should include a clear summary, relevant test commands run, and screenshots/GIFs for visual slide changes. Link related issues when applicable.
