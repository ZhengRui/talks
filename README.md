# Presentation Hub

A Next.js app that hosts multiple slide decks powered by a custom scene compiler. Presentations are defined as YAML — either via shortcut templates (one block per slide) or as explicit scene graphs with absolute geometry. Export to PPTX with one click. Also ships an extract workbench that turns a slide screenshot into a scene template through an iterative vision/edit loop.

## Quick Start

```bash
bun install
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see all presentations, or [http://localhost:3000/workbench/extract](http://localhost:3000/workbench/extract) for the extract workbench.

## Creating a Presentation

1. Create `content/my-talk/slides.yaml`. Most slides are template invocations:

```yaml
title: "My Talk"
author: "Your Name"
theme: modern          # 16 themes — see Themes section below
slides:
  - template: cover
    params:
      title: "My Talk"
      subtitle: "A great subtitle"
      image: hero.jpg
      author: "Your Name"

  - template: bullets
    params:
      title: "Key Points"
      bullets:
        - First point
        - Second point
        - Third point

  - template: stats
    params:
      title: "By the numbers"
      stats:
        - { value: "42", label: "The Answer" }
        - { value: "10x", label: "Faster" }
```

2. For pixel-precise slides, drop into scene mode with explicit geometry:

```yaml
  - mode: scene
    background: "#0d1117"
    children:
      - kind: text
        id: title
        frame: { left: 120, top: 60, w: 700, h: 50 }
        text: "Custom layout"
        style: { fontSize: 32, fontWeight: 700, color: "#e6edf3" }
      - kind: shape
        id: divider
        frame: { left: 120, top: 130, w: 200, h: 2 }
        fill: "#4f6df5"
```

3. Put images in `content/my-talk/images/`. `predev`/`prebuild` run `sync-content` automatically; otherwise run `bun run sync-content`.
4. The home page auto-discovers the deck — no code changes needed.

## Two Approaches

| Approach | When to use | Verbosity |
|----------|-------------|-----------|
| **Templates** (35 of them) | Standard layouts: cover, bullets, stats, comparison, code, timeline, … | Low — fill in `params` |
| **Scene mode** | Pixel-precise replication, custom diagrams, screenshot-faithful slides | High — explicit `frame` + `kind` per node |

Both approaches compile to the same `LayoutSlide` IR. Templates expand into scene nodes via Nunjucks macros, then go through the same scene compiler as hand-authored scenes. Mix freely in the same deck.

## PPTX Export

Click the **Export PPTX** button on any presentation to download a `.pptx` file. The export uses the same `LayoutSlide` IR as the web renderer, so positioning is consistent.

## Extract Workbench

Visit `/workbench/extract` to turn a slide screenshot into a scene template. Upload a PNG, run **Analyze** (one-shot vision pass that produces a structured inventory and a first-cut proposal), then iterate the **Refine** loop. Each refine iteration runs:

1. A vision pass that compares the original screenshot against a freshly-rendered replica and emits a structured issue list with stable issue ids.
2. An edit pass that patches the proposal scene YAML to address the top issues, grounded in both images.
3. A render + pixel diff to score progress.

Issues are tracked across iterations as `resolved` / `still_wrong` / `unclear`, signature-visual issues are sticky until resolved, and the loop terminates when the diff falls below threshold or `maxIterations` is reached. See [`docs/2026-04-07-design-v11-refine-enhancement.md`](docs/2026-04-07-design-v11-refine-enhancement.md) for the full prompt and message-structure design.

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

All templates are DSL YAML files (`.template.yaml`) that expand into scene nodes at compile time via Nunjucks macros.

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

Preview all templates by visiting `/example-v9` (the `content/example-v9` deck cycles every template with sample content).

## Animations

CSS-only animations trigger when slides become active. Each template has sensible defaults (stagger, fade, counter-up, etc.). Override per-slide:

```yaml
- template: bullets
  params:
    title: "Points"
    bullets: ["First", "Second"]
  animation: none      # disable animation for this slide
```

## Architecture

```
slides.yaml
  → loadPresentation()      # YAML + DSL/template + Nunjucks expansion
  → layoutPresentation()    # Per-slide dispatch
  → compileSceneSlide()     # Scene compiler: normalize → solve geometry → emit IR
  → LayoutPresentation      # Absolute-positioned elements on a 1920×1080 canvas
       ├── Web : LayoutRenderer.tsx  (absolute divs + CSS animations)
       └── PPTX: exportPptx()        (PptxGenJS + JSZip post-processing)
```

Templates are `.template.yaml` files compiled by a Nunjucks engine that emits scene nodes (`text`, `shape`, `image`, `group`, `ir`) with explicit geometry. The scene compiler then resolves frames, anchors, guides, and group layouts (`stack` / `row` / `grid`) into absolute rectangles. Both the web renderer and the PPTX exporter consume the same `LayoutSlide` IR, which guarantees positional parity. The legacy v8 component layer with auto-layout pre-passes has been removed.

The extract workbench (`/workbench/extract`) builds on top of this by rendering scene proposals server-side via Playwright (`renderSlideToImage`), pixel-diffing them against the original screenshot (`compareImages`), and feeding both images plus a structured issue list back to the model in a vision/edit refine loop.

## Project Structure

```
content/[slug]/slides.yaml          # Presentation content (YAML, scene + templates)
content/[slug]/images/              # Source images (synced to public/[slug]/)
docs/                               # Design + discussion docs (v1 → v11)

src/lib/types.ts                    # SlideData, PresentationData, ThemeName
src/lib/loadPresentation.ts         # YAML parser + presentation auto-discovery
src/lib/scene/                      # Scene compiler (v9 — primary authoring path)
  types.ts                          #   SceneSlideData, SceneNode, FrameSpec, layouts
  compiler.ts                       #   compileSceneSlide()
  solve.ts                          #   Geometry solver (frames, anchors, guides)
  normalize.ts                      #   Theme tokens, preset inheritance
  import-layout.ts                  #   v8 IR → scene migration helper
src/lib/layout/                     # Layout IR (the render/export target)
  types.ts                          #   LayoutSlide, LayoutElement (9 kinds)
  theme.ts                          #   16 theme definitions, resolveTheme()
  theme-tokens.ts                   #   Theme token resolution + alpha suffixes
  helpers.ts                        #   Shared layout utilities
  decorators/                       #   Per-theme background/foreground decorators
  templates/                        #   35 DSL YAML templates (.template.yaml)
src/lib/dsl/                        # DSL template loader + Nunjucks engine
  engine.ts                         #   Template compilation pipeline
  macros/scene/                     #   Shared scene macros (eyebrow_title, stat_card, …)
src/lib/export/                     # PPTX export
  pptx.ts                           #   exportPptx() via PptxGenJS
  pptx-animations.ts                #   OOXML <p:timing> builder
  pptx-helpers.ts                   #   Coordinate/color/font conversion
src/lib/render/                     # Server-side slide rendering (Playwright)
  html.ts                           #   LayoutSlide → standalone HTML
  screenshot.ts                     #   renderSlideToImage()
  compare.ts                        #   compareImages() (pixel diff + regions)
  annotate.ts                       #   Diff overlay rendering
src/lib/extract/                    # Extract workbench (screenshot → template)
  prompts.ts                        #   Analyze prompt builder
  refine-prompt.ts                  #   Refine vision + edit prompt builders
  refine.ts                         #   runRefinementLoop() (vision → edit → diff)
  compile-preview.ts                #   Proposal → LayoutSlide for preview rendering
  geometry-hints.ts                 #   Exact element rects fed to the edit prompt
  benchmark.ts                      #   Control vs coords benchmark runner

src/components/SlideEngine.tsx      # Custom presentation engine
src/components/LayoutRenderer.tsx   # Unified web renderer
src/components/extract/             # Extract workbench UI
  ExtractCanvas.tsx                 #   Top-level shell
  store.ts                          #   Zustand store
  CanvasViewport.tsx                #   Slide preview surface
  CanvasToolbar.tsx                 #   Tool palette + actions
  InspectorPanel.tsx                #   Issue / proposal inspector
  TemplateInspector.tsx             #   Generated scene YAML view
  BenchmarkLauncher.tsx             #   Built-in benchmark runner UI

src/styles/engine.css               # Engine base styles
src/styles/animations.css           # CSS keyframes + animation utilities
src/styles/themes/                  # 16 theme CSS files

src/app/page.tsx                    # Home (auto-discovers presentations)
src/app/[slug]/page.tsx             # Dynamic presentation route
src/app/workbench/extract/page.tsx  # Extract workbench route
src/app/api/layout/route.ts         # GET /api/layout?slug=X → layout JSON
src/app/api/render/route.ts         # POST layout slide → PNG
src/app/api/export_pptx/route.ts    # POST layout JSON → .pptx download
src/app/api/extract/analyze/        # POST screenshot → analysis + first proposals
src/app/api/extract/refine/         # POST proposals → SSE stream of refine:* events
src/app/api/extract/benchmark/      # Benchmark catalog + load endpoints

scripts/sync-content.sh             # Copy content/*/images and CSS into public/
scripts/slide-diff.mjs              # Pixel-diff a rendered slide vs reference
scripts/port-layout-to-scene.mjs    # Batch v8 layout.json → scene slides.yaml migration
```

## Tech Stack

- Next.js 15 (App Router), React 19, TypeScript (strict)
- Custom slide engine (keyboard nav, viewport scaling, CSS transitions)
- Scene compiler with explicit geometry (`frame`, `guides`, `anchors`, `stack`/`row`/`grid`)
- Unified `LayoutSlide` IR (1920×1080 canvas) for web + PPTX rendering
- DSL template system (Nunjucks) — 35 YAML templates that compile to scene nodes
- PptxGenJS for PowerPoint export, JSZip for OOXML post-processing (animations)
- 16 themes via resolved concrete values, CSS-only animations
- Tailwind CSS 4 for styling
- Playwright for server-side slide rendering and E2E tests
- Sharp for image processing in extract diff/compare
- `@anthropic-ai/claude-agent-sdk` for vision/edit calls in the extract workbench
- Zustand for the extract workbench client store
- Vitest for unit/integration tests
- Bun as package manager

## License

MIT
