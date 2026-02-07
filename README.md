# Presentation Hub

A Next.js app that hosts multiple slide decks powered by a custom slide engine. Presentations are defined as YAML files with template references — no custom code needed per presentation. Export to PPTX with one click.

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
theme: modern          # modern (default) | bold | elegant | dark-tech
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

2. Put images in `content/my-talk/images/`, then run `bun run sync-content`
3. The home page auto-discovers it — no code changes needed

## PPTX Export

Click the **Export PPTX** button on any presentation to download a `.pptx` file. The export uses the same layout model as the web renderer, so positioning is consistent.

The export pipeline:
1. Layout model converts YAML slides to absolute-positioned elements on a 1920×1080 canvas
2. PptxGenJS maps those elements to PowerPoint shapes, text boxes, and images
3. The result is a standard `.pptx` file compatible with PowerPoint, Keynote, and WPS Office

## Themes

Four built-in themes, selected per-presentation via the `theme` YAML field:

| Theme | Style |
|-------|-------|
| `modern` (default) | Clean lines, light backgrounds, soft shadows |
| `bold` | High contrast, saturated colors, large type |
| `elegant` | Serif headings, muted tones, refined spacing |
| `dark-tech` | Dark backgrounds, neon accents, monospace touches |

Themes are defined as concrete value sets in `src/lib/layout/theme.ts`. Both the web renderer and PPTX exporter consume the same resolved theme values.

## Available Templates (35)

| Template | Description |
|----------|-------------|
| `cover` | Title slide with optional image and author |
| `bullets` | Bullet point list with optional image |
| `image-text` | Image alongside text (left/right positioning) |
| `full-image` | Full-bleed background image with optional overlay |
| `section-divider` | Section break / interstitial |
| `quote` | Blockquote with attribution |
| `statement` | Large centered statement text |
| `numbered-list` | Ordered list of items |
| `definition` | Term + definition layout |
| `agenda` | Agenda / table of contents |
| `code` | Syntax-highlighted code block |
| `code-comparison` | Side-by-side code blocks |
| `table` | Data table |
| `timeline` | Chronological events on a connected line |
| `stats` | Key metrics with counter-up animation |
| `chart-placeholder` | Placeholder for chart/graph |
| `diagram` | Diagram layout |
| `comparison` | Side-by-side comparison (e.g. pros/cons) |
| `steps` | Sequential process steps |
| `profile` | Person profile card with image |
| `icon-grid` | Grid of icon + label items |
| `highlight-box` | Emphasized content box |
| `qa` | Question and answer format |
| `video` | Embedded video |
| `iframe` | Embedded iframe |
| `image-grid` | Grid of images |
| `image-comparison` | Side-by-side image comparison |
| `image-caption` | Image with caption |
| `image-gallery` | Image gallery layout |
| `two-column` | Two-column content layout |
| `three-column` | Three-column content layout |
| `top-bottom` | Top/bottom split layout |
| `sidebar` | Content with sidebar |
| `blank` | Empty slide |
| `end` | Closing slide |

Preview all templates at `/example`.

## Animations

CSS-only animations trigger when slides become active. Each template has a sensible default (stagger, fade, counter-up, etc.). Override per-slide:

```yaml
- template: bullets
  title: "Points"
  bullets: [...]
  animation: none      # disable animation for this slide
```

## Architecture

```
slides.yaml → loadPresentation() → layoutPresentation() → LayoutPresentation (JSON)
  ├── Web: LayoutRenderer.tsx (absolute-positioned divs + CSS animations)
  └── PPTX: exportPptx() via PptxGenJS (same layout, PowerPoint shapes)
```

Both renderers consume the same intermediate layout model — a JSON structure with absolute-positioned elements on a 1920×1080 canvas. This guarantees consistent positioning between web and PPTX output.

## Project Structure

```
content/[slug]/slides.yaml          # Presentation content (YAML)
content/[slug]/images/              # Source images
src/lib/types.ts                    # TypeScript types (discriminated union)
src/lib/loadPresentation.ts         # YAML parser + auto-discovery
src/lib/layout/                     # Layout model (v3)
  types.ts                          #   Layout element types, ResolvedTheme
  theme.ts                          #   4 theme definitions, resolveTheme()
  helpers.ts                        #   Shared layout utilities
  index.ts                          #   layoutPresentation() dispatcher
  templates/                        #   35 layout functions (one per template)
src/lib/export/                     # PPTX export
  pptx.ts                           #   exportPptx() via PptxGenJS
  pptx-helpers.ts                   #   Coordinate/color/font conversion
src/components/SlideEngine.tsx      # Custom presentation engine
src/components/LayoutRenderer.tsx   # Web renderer (layout model → divs)
src/styles/engine.css               # Engine base styles (scaling, layout, transitions)
src/styles/animations.css           # CSS keyframes and animation utilities
src/styles/components.css           # Shared CSS component classes
src/styles/themes/                  # 4 theme CSS files
src/app/[slug]/page.tsx             # Dynamic presentation route
src/app/page.tsx                    # Home page (auto-discovers presentations)
src/app/api/layout/route.ts        # GET /api/layout?slug=X → layout JSON
src/app/api/export_pptx/route.ts   # POST layout JSON → .pptx download
```

## Tech Stack

- Next.js 15 (App Router), React 19, TypeScript
- Custom slide engine (keyboard nav, viewport scaling, CSS transitions)
- Unified layout model (1920×1080 canvas) for web + PPTX rendering
- PptxGenJS for PowerPoint export
- 4 CSS themes via custom properties, CSS-only animations
- Tailwind CSS 4 for styling
- Vitest + Playwright for testing
- Bun as package manager

## License

MIT
