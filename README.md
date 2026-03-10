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
theme: modern          # 16 themes — see Themes section below
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

  - children:
      - type: box
        variant: flat
        layout: { type: flex, direction: row, gap: 32 }
        children:
          - type: box
            variant: flat
            children:
              - type: heading
                text: "Custom Layout"
              - type: bullets
                items: ["Mix components freely", "Theme-aware colors"]
          - type: box
            variant: flat
            children:
              - type: stat
                value: "42"
                label: "The Answer"
```

2. Put images in `content/my-talk/images/`, then run `bun run sync-content`
3. The home page auto-discovers it — no code changes needed

## Two Approaches

| Approach | When to use | YAML verbosity |
|----------|-------------|----------------|
| **Shortcut templates** | Standard layouts (bullets, stats, cover, comparison) | Low — fill in props |
| **Component trees** | Custom layouts using Box with auto-layout (flex/grid) | Medium — compose components |

All slides are component trees. Templates are shortcuts that expand into components. For pixel-precise control, use `raw` components with IR elements or `position: absolute` on children.

## PPTX Export

Click the **Export PPTX** button on any presentation to download a `.pptx` file. The export uses the same layout model as the web renderer, so positioning is consistent.

## Themes

16 built-in themes, selected per-presentation via the `theme` YAML field:

### Light
| Theme | Style |
|-------|-------|
| `modern` (default) | Clean lines, blue accent, soft shadows |
| `elegant` | Gold on parchment, serif headings |
| `paper-ink` | Crimson on warm paper, literary |
| `swiss-modern` | Red on white, Bauhaus precision |
| `split-pastel` | Soft peach + lavender, playful |
| `notebook-tabs` | Lavender + rose on warm paper |
| `pastel-geometry` | Sage green + pink on soft blue |
| `vintage-editorial` | Warm tones, strong borders, print-inspired |

### Dark
| Theme | Style |
|-------|-------|
| `bold` | Orange on black, high-impact |
| `dark-tech` | Cyan-green on navy, futuristic |
| `bold-signal` | Coral + electric blue, vibrant |
| `electric-studio` | Blue accent, black/white contrast |
| `creative-voltage` | Lime-green on dark indigo, experimental |
| `dark-botanical` | Copper + blush, warm organic |
| `neon-cyber` | Magenta on deep purple, sci-fi |
| `terminal-green` | Green phosphor on black, hacker |

Themes are defined as concrete value sets in `src/lib/layout/theme.ts`. Both the web renderer and PPTX exporter consume the same resolved theme values.

## Available Templates (35)

All templates are DSL YAML files (`.template.yaml`) that expand into composable components at runtime.

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
| `video` | Playable video (.mp4/.webm or YouTube/Vimeo embed) |
| `iframe` | Embedded webpage |
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

CSS-only animations trigger when slides become active. Each template has sensible defaults (stagger, fade, counter-up, etc.). Override per-slide:

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

Templates are DSL YAML files processed by a Nunjucks compiler into composable components, which are resolved into layout elements by the component resolvers. Auto-layout (flex/grid) computes absolute rects in a pre-pass before rendering.

## Project Structure

```
content/[slug]/slides.yaml          # Presentation content (YAML)
content/[slug]/images/              # Source images
src/lib/types.ts                    # TypeScript types (SlideData, ThemeName)
src/lib/loadPresentation.ts         # YAML parser + auto-discovery
src/lib/layout/                     # Layout model
  types.ts                          #   9 element kinds, ResolvedTheme, RichText, LayoutMode
  auto-layout.ts                    #   resolveLayouts() — flex/grid pre-pass
  theme.ts                          #   16 theme definitions, resolveTheme()
  helpers.ts                        #   Shared layout utilities
  index.ts                          #   layoutPresentation() dispatcher
  components/                       #   18 composable component types + resolvers
  templates/                        #   35 DSL YAML templates (.template.yaml)
src/lib/dsl/                        # DSL template loader + Nunjucks compiler
src/lib/export/                     # PPTX export
  pptx.ts                           #   exportPptx() via PptxGenJS
  pptx-helpers.ts                   #   Coordinate/color/font conversion
src/components/SlideEngine.tsx      # Custom presentation engine
src/components/LayoutRenderer.tsx   # Web renderer (layout model → divs)
src/styles/engine.css               # Engine base styles (scaling, layout, transitions)
src/styles/animations.css           # CSS keyframes and animation utilities
src/styles/themes/                  # 16 theme CSS files
src/app/[slug]/page.tsx             # Dynamic presentation route
src/app/page.tsx                    # Home page (auto-discovers presentations)
src/app/api/layout/route.ts        # GET /api/layout?slug=X → layout JSON
src/app/api/export_pptx/route.ts   # POST layout JSON → .pptx download
```

## Tech Stack

- Next.js 15 (App Router), React 19, TypeScript (strict)
- Custom slide engine (keyboard nav, viewport scaling, CSS transitions)
- Unified layout model (1920×1080 canvas) for web + PPTX rendering
- DSL template system (Nunjucks) — 35 YAML templates, 18 composable components
- PptxGenJS for PowerPoint export, JSZip for OOXML post-processing
- 16 themes via resolved concrete values, CSS-only animations
- Tailwind CSS 4 for styling
- Vitest + Playwright for testing
- Bun as package manager

## License

MIT
