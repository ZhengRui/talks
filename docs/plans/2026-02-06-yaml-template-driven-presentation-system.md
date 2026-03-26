# Plan: YAML + Template-Driven Presentation System

Redesign from scratch. Replace the current per-slide custom code approach with a system where each presentation is a single YAML file + images, and templates (React components) handle all layout.

## Architecture Overview

```
content/[slug]/slides.yaml    ← text content + template choices (you edit this)
public/[slug]/*.jpg            ← images served statically by Next.js
src/lib/types.ts               ← TypeScript types (discriminated union for slides)
src/lib/loadPresentation.ts    ← YAML parser + content/ auto-discovery
src/components/Presentation.tsx         ← Reveal.js wrapper (client component)
src/components/templates/index.ts       ← template registry
src/components/templates/CoverSlide.tsx ← one React component per template
src/app/[slug]/page.tsx        ← dynamic route: loads YAML → maps to templates
src/app/page.tsx               ← home page: auto-discovers presentations
```

**Data flow:** `slides.yaml` → server component reads & parses → maps each slide to a template component via registry → templates render `<section>` elements → Reveal.js handles navigation/transitions.

**Image resolution:** YAML says `image: cover.jpg` → page computes `imageBase = "/[slug]"` → template builds `src="/[slug]/cover.jpg"` → Next.js serves from `public/[slug]/cover.jpg`.

---

## YAML Format

```yaml
title: "70 Years of AI"
author: "Rui Zheng"
theme: dark
slides:
  - template: cover
    title: "70 Years of AI"
    subtitle: "crack the AI jargon"
    image: cover-bg.jpg

  - template: image-text
    title: "AI Applications"
    image: s1-ai-applications.jpg
    imagePosition: left
    bullets:
      - Computer Vision (CV)
      - Natural Language Processing (NLP)

  - template: full-image
    title: "Deep Learning Era"
    image: deep-learning.jpg
    overlay: dark
    body: "2012 - 2020: Big data meets GPUs"

  - template: bullets
    title: "Key Takeaways"
    bullets:
      - Intelligence is a learnable function
      - 4 waves of AI development
```

---

## Type System (`src/lib/types.ts`)

Discriminated union on `template` field. Each template variant has its own interface with required/optional fields.

```typescript
export type SlideData = CoverSlideData | ImageTextSlideData | FullImageSlideData | BulletSlideData;

export type TemplateProps<T extends SlideData> = {
  slide: T;
  imageBase: string;  // e.g. "/70-years-of-ai"
};
```

Key types: `PresentationData` (top-level YAML shape), `PresentationSummary` (lightweight for home page listing), per-template data interfaces, `SlideComponent<T>` (what the registry stores).

## Template System (`src/components/templates/`)

- Each template = a React component returning one `<section>` element
- Templates are pure/presentational — no hooks, no state
- Background images use Reveal.js `data-background-*` attributes on `<section>`
- Speaker notes use `<aside className="notes">` inside `<section>`
- Bullet fragments use Reveal.js `fragment fade-in` CSS classes
- Registry is a plain `Record<string, SlideComponent>` with a `getTemplate()` lookup function

**4 starter templates:**
| Template | Required Fields | Key Feature |
|----------|----------------|-------------|
| `cover` | title | Optional background image, subtitle |
| `image-text` | title, image | Left/right image position, optional bullets |
| `full-image` | image | Dark/light overlay for text readability |
| `bullets` | title, bullets | Fragment animation for progressive reveal |

**Adding a new template (3-file change):**
1. Add data interface to `types.ts` + add to `SlideData` union
2. Create component in `templates/NewSlide.tsx`
3. Add one line to registry in `templates/index.ts`

## Presentation Wrapper (`src/components/Presentation.tsx`)

Simplified Reveal.js client component. Changes from current `RevealPresentation.tsx`:
- Remove Markdown plugin (no longer needed — all content is React)
- Remove `activeInstances` Set / `useId` tracking — use simple `destroyed` flag pattern
- Remove double-rAF and 50ms timeout hacks — use async/await
- Keep Notes plugin for speaker notes
- Use fixed 1920x1080 dimensions for consistent aspect ratio

## Pages

- **`src/app/[slug]/page.tsx`** — server component. Calls `loadPresentation(slug)`, maps slides to template components via `getTemplate()`, wraps in `<Presentation>`. Uses `generateStaticParams` for static generation.
- **`src/app/page.tsx`** — server component. Calls `discoverPresentations()` which scans `content/` for directories containing `slides.yaml`. No more hardcoded list.

---

## Implementation Steps

### Phase 1: Foundation
1. **Update `package.json`** — add `yaml`, remove `next-mdx-remote`, `gray-matter`, `three`, `@types/three`. Run `bun install`.
2. **Create `src/lib/types.ts`** — full type system
3. **Create `src/lib/loadPresentation.ts`** — `loadPresentation()`, `discoverPresentations()`, `getAllSlugs()`

### Phase 2: Templates
4. **Create `src/components/templates/CoverSlide.tsx`**
5. **Create `src/components/templates/BulletSlide.tsx`**
6. **Create `src/components/templates/ImageTextSlide.tsx`**
7. **Create `src/components/templates/FullImageSlide.tsx`**
8. **Create `src/components/templates/index.ts`** — registry

### Phase 3: Presentation & Pages
9. **Create `src/components/Presentation.tsx`** — simplified Reveal.js wrapper
10. **Rewrite `src/app/[slug]/page.tsx`** — dynamic route with YAML loading
11. **Rewrite `src/app/page.tsx`** — auto-discovery home page
12. **Update `src/app/layout.tsx`** — keep Reveal.js CSS imports, clean up metadata

### Phase 4: Content
13. **Create `content/70-years-of-ai/slides.yaml`** — migrate existing content
14. **Flatten images** — move `public/70-years-of-ai/images/*` up to `public/70-years-of-ai/`

### Phase 5: Cleanup
15. **Delete old files:** `src/components/MdxSlide.tsx`, `src/components/MarkdownSlide.tsx`, `src/components/RevealPresentation.tsx`, `src/utils/mdxUtils.ts`, `src/app/example/` (entire dir), `src/app/70-years-of-ai/` (entire dir), `public/example/` (entire dir), `public/70-years-of-ai/images/` (now empty)
16. **Update `CLAUDE.md`** to reflect new architecture

---

## Verification

1. `bun run build` — should compile with no errors, static generation should find the YAML
2. `bun run dev` → visit `http://localhost:3000` — should list "70 Years of AI" auto-discovered
3. Click into the presentation — slides should render with correct templates, images should load
4. Arrow keys should navigate between slides
5. Press `S` to verify speaker notes window opens
6. `bun run lint` — should pass
