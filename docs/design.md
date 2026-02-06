# Design: YAML + Template-Driven Presentation System

## Architecture

```
content/[slug]/slides.yaml           ← text content + template choices
public/[slug]/*.jpg                  ← images served statically by Next.js
src/lib/types.ts                     ← TypeScript types (discriminated union)
src/lib/loadPresentation.ts          ← YAML parser + content/ auto-discovery
src/components/Presentation.tsx      ← Reveal.js wrapper (client component)
src/components/templates/index.ts    ← template registry
src/components/templates/*.tsx       ← one React component per template
src/app/[slug]/page.tsx              ← dynamic route: loads YAML → templates
src/app/page.tsx                     ← home page: auto-discovers presentations
```

## Data Flow

1. `slides.yaml` is read by the server component at build time
2. Each slide entry is mapped to a template component via the registry
3. Templates render `<section>` elements (Reveal.js slides)
4. The `<Presentation>` client component initializes Reveal.js around them

## Image Resolution

YAML references images by filename (e.g. `image: cover.jpg`). The page component computes `imageBase = "/[slug]"` and passes it to each template. Templates build the full path: `src="/[slug]/cover.jpg"`. Next.js serves the file from `public/[slug]/cover.jpg`.

## Type System

Discriminated union on the `template` field:

```typescript
type SlideData = CoverSlideData | BulletSlideData | ImageTextSlideData | FullImageSlideData;
```

Each variant has its own interface with required/optional fields. `TemplateProps<T>` bundles `slide: T` and `imageBase: string`.

## Template Registry

A plain `Record<string, SlideComponent>` in `src/components/templates/index.ts`. The `getTemplate(name)` function returns the component or `null`.

### Available Templates

| Template | Required Fields | Optional Fields | Key Feature |
|----------|----------------|-----------------|-------------|
| `cover` | title | subtitle, image, author | Background image with opacity |
| `bullets` | title, bullets | image | Fragment animation for progressive reveal |
| `image-text` | title, image | imagePosition, bullets, body | Side-by-side layout |
| `full-image` | image | title, body, overlay | Dark/light overlay for readability |

### Adding a New Template

1. Add data interface to `types.ts` + add to `SlideData` union
2. Create component in `templates/NewSlide.tsx`
3. Add one line to registry in `templates/index.ts`

## Presentation Wrapper

`Presentation.tsx` is a simplified Reveal.js client component:
- Async/await initialization (no timeouts or double-rAF)
- Simple `destroyed` flag for cleanup
- Fixed 1920x1080 dimensions for consistent aspect ratio
- Notes plugin only (no Markdown plugin needed)

## Auto-Discovery

`discoverPresentations()` scans `content/` for directories containing `slides.yaml`, parses each to extract title/author/slide count, and returns `PresentationSummary[]` for the home page.

## Testing Strategy

Two test runners, each with a distinct role:

| Layer | Tool | What it tests |
|-------|------|---------------|
| **Unit** | Vitest | `loadPresentation()`, `discoverPresentations()`, parser edge cases |
| **Integration** | Vitest + React Testing Library | Template rendering → correct HTML structure, props validation |
| **E2E** | Playwright (own test runner) | Full pages: slide layout, navigation, image loading, keyboard controls |

**`claude --chrome`** is for ad-hoc visual debugging during development — quick "does this look right?" checks. It is ephemeral and not a substitute for repeatable tests.

Key config files:
- `vitest.config.ts` — Vitest config with Next.js plugin and path aliases
- `playwright.config.ts` — Playwright config with dev server auto-start

Development follows TDD (red-green-refactor) enforced by the Superpowers plugin. All tests are committable and runnable in CI.

## Design Decisions

- **YAML over MDX/Markdown** — Separates content from layout. Authors only choose a template name; all styling lives in code. Prevents drift between presentations.
- **Discriminated union** — Type-safe slide data. Each template gets exactly the fields it needs. Invalid combinations are compile-time errors.
- **Static generation** — Presentations are fully rendered at build time. No runtime YAML parsing. Fast page loads.
- **No Markdown plugin** — All content is React. Removes a Reveal.js plugin dependency and the complexity of client-side Markdown rendering.
