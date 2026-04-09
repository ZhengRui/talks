# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` contains the Next.js App Router entrypoints:
  - `src/app/page.tsx` is the home index.
  - `src/app/[slug]/page.tsx` renders presentations.
  - `src/app/workbench/extract/page.tsx` hosts the extract/refine workbench.
  - `src/app/api/` contains render/export/layout APIs such as `render`, `layout`, and `export_pptx`.
- `src/components/` contains the presentation runtime (`SlideEngine.tsx`, `LayoutRenderer.tsx`) and the extract workbench UI under `src/components/extract/`.
- `src/lib/layout/` contains theme logic, rich text transforms, decorators, and the YAML template catalog in `src/lib/layout/templates/*.template.yaml`.
- `src/lib/scene/` contains scene normalization, imported-layout conversion, solving, and compilation.
- `src/lib/dsl/` contains the Nunjucks-backed scene DSL runtime and macros.
- `src/lib/render/` contains HTML rendering, screenshots, diffing, crop/annotate helpers, and font loading.
- `src/lib/extract/` contains the screenshot-analysis, benchmark, geometry-hint, compile-preview, and refine-loop pipeline.
- `src/lib/export/` contains the PPTX export pipeline and animation/effect helpers.
- `src/lib/` also contains shared loaders/types such as `loadPresentation.ts`, `types.ts`, and `overlay.ts`.
- `content/[slug]/slides.yaml` defines presentation content; assets in `content/**/images` are synced into `public/` by the content sync script.
- `scripts/` contains repo utilities such as `sync-content.sh`, `slide-diff.mjs`, and `port-layout-to-scene.mjs`.
- Tests live alongside source in `src/**/*.test.ts(x)` and in `e2e/*.spec.ts`. Current refine-loop design notes live in `docs/2026-04-07-design-v11-refine-enhancement.md`.

## Build, Test, and Development Commands
- `bun install`: install dependencies.
- `bun run dev`: start the Next.js dev server on `http://localhost:3000`.
- `bun run build`: create a production build.
- `bun run start`: run the production server.
- `bun run lint`: run ESLint.
- `bun run test`: run the full Vitest suite.
- `bun run test:watch`: run Vitest in watch mode.
- `bun run test:e2e`: run the Playwright suite.
- `bun run sync-content`: sync `content/` assets into `public/`.
- `bun run slide:diff`: run the slide diff helper script.
- For focused verification, prefer targeted test runs such as `bun x vitest run src/lib/extract/refine.test.ts`.

## Coding Style & Naming Conventions
- Use TypeScript + React with 2-space indentation, double quotes, and semicolons to match the repo.
- Components use `PascalCase`; helpers, hooks, and utilities use `camelCase`.
- Prefer the `@/*` path alias for imports from `src/*`.
- Keep scene/layout template files in the existing `*.template.yaml` naming style.
- Follow existing terminology in the extract stack: `analysis`, `inventory`, `proposals`, `geometryHints`, `priorIssues`, and `contentBounds`.
- Keep edits surgical. Extend current modules and conventions rather than introducing parallel abstractions unless the task explicitly calls for a broader refactor.

## Testing Guidelines
- Add or update Vitest coverage when changing rendering, extract/refine logic, scene compilation, export, loaders, or store/UI event handling.
- Use Playwright in `e2e/` for browser-level rendering and navigation checks.
- When changing the extract workbench, prefer targeted tests in:
  - `src/components/extract/*.test.tsx`
  - `src/lib/extract/*.test.ts`
  - `src/lib/render/*.test.ts`
- If a change is doc-only, tests are optional; otherwise, run the narrowest relevant test set and note what you ran.

## Commit & Pull Request Guidelines
- Use conventional commits with a scope.
- Commit messages should include a short bullet-list body and end with:
  - `Co-Authored-By: Codex <codex@openai.com>`
- Example:
  ```text
  feat(extract): add prompt copy actions

  - Add copy buttons to expanded prompt sections in the inspector
  - Cover prompt copying in the TemplateInspector tests

  Co-Authored-By: Codex <codex@openai.com>
  ```
- PRs should include:
  - a concise summary,
  - relevant test commands run,
  - screenshots/GIFs for visual changes,
  - linked issues or design docs when applicable.
