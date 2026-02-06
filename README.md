# Presentation Hub

A Next.js app that hosts multiple Reveal.js slide decks. Presentations are defined as YAML files with template references — no custom code needed per presentation.

## Quick Start

```bash
bun install
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see all presentations.

## Creating a Presentation

1. Create `content/my-talk/slides.yaml`:

```yaml
title: "My Talk"
author: "Your Name"
slides:
  - template: cover
    title: "My Talk"
    subtitle: "A great subtitle"
    image: hero.jpg

  - template: bullets
    title: "Key Points"
    bullets:
      - First point
      - Second point
      - Third point
```

2. Put images in `public/my-talk/`
3. The home page auto-discovers it — no code changes needed

## Available Templates

| Template | Required Fields | Optional Fields |
|----------|----------------|-----------------|
| `cover` | title | subtitle, image, author |
| `bullets` | title, bullets | image |
| `image-text` | title, image | imagePosition (left/right), bullets, body |
| `full-image` | image | title, body, overlay (dark/light) |

## Project Structure

```
content/[slug]/slides.yaml       # Presentation content (YAML)
public/[slug]/*.jpg              # Static images
src/lib/types.ts                 # TypeScript types
src/lib/loadPresentation.ts      # YAML parser + auto-discovery
src/components/Presentation.tsx  # Reveal.js wrapper
src/components/templates/        # Slide template components
src/app/[slug]/page.tsx          # Dynamic presentation route
src/app/page.tsx                 # Home page (auto-discovers presentations)
```

## Tech Stack

- Next.js 15 (App Router), React 19, TypeScript
- Reveal.js 5 for presentations
- Tailwind CSS 4 for styling
- Bun as package manager

## License

MIT
