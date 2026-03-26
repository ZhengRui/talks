# Design v1: YAML + Template-Driven Presentation System

> **Superseded by [design-v2.md](./design-v2.md)** — v2 replaces Reveal.js with a custom slide engine, adds 4 themes, CSS animations, and polished templates.

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

Discriminated union on the `template` field. 35 template variants, each with its own interface. `TemplateProps<T>` bundles `slide: T` and `imageBase: string`.

## Template Registry

A plain `Record<string, SlideComponent>` in `src/components/templates/index.ts`. The `getTemplate(name)` function returns the component or `null`. Preview all templates at `/example`.

### Available Templates (35)

**Text-focused:**
| Template | Required | Optional |
|----------|----------|----------|
| `cover` | title | subtitle, image, author |
| `bullets` | title, bullets | image |
| `section-divider` | title | subtitle, image |
| `quote` | quote | attribution, image |
| `statement` | statement | subtitle, image |
| `numbered-list` | title, items | — |
| `definition` | title, definitions | — |
| `agenda` | title, items | activeIndex |

**Image-focused:**
| Template | Required | Optional |
|----------|----------|----------|
| `full-image` | image | title, body, overlay |
| `image-text` | title, image | imagePosition, bullets, body |
| `image-grid` | images | title, columns |
| `image-comparison` | before, after | title |
| `image-caption` | image, caption | title |
| `image-gallery` | images | title |

**Layout:**
| Template | Required | Optional |
|----------|----------|----------|
| `two-column` | left, right | title |
| `three-column` | columns | title |
| `top-bottom` | top, bottom | title |
| `sidebar` | sidebar, main | title, sidebarPosition |

**Data & Technical:**
| Template | Required | Optional |
|----------|----------|----------|
| `code` | code | title, language |
| `code-comparison` | before, after | title |
| `table` | headers, rows | title |
| `timeline` | events | title |
| `stats` | stats | title |
| `chart-placeholder` | title, image | caption |
| `diagram` | image | title, caption |

**Storytelling:**
| Template | Required | Optional |
|----------|----------|----------|
| `comparison` | left, right | title |
| `steps` | steps | title |
| `profile` | name | title, image, bio |
| `icon-grid` | items | title, columns |
| `highlight-box` | body | title, variant |
| `qa` | question, answer | — |

**Special:**
| Template | Required | Optional |
|----------|----------|----------|
| `video` | src | title |
| `iframe` | src | title |
| `blank` | — | image |
| `end` | — | title, subtitle, image |

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
