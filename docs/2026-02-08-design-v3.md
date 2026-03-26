# Design v3: Unified Layout Model + PPTX Export

## Motivation

The v2 system uses 35 individual React components as templates. While functional for web rendering, this architecture cannot produce other output formats — each template's layout logic is embedded in JSX and CSS, making it impossible to export to PowerPoint without a second rendering implementation.

v3 introduces an intermediate **layout model** between YAML content and rendering. Both the web renderer and the PPTX exporter consume the same layout model, guaranteeing consistent positioning across outputs.

## Architecture

```
content/[slug]/slides.yaml
    |
loadPresentation()                    [unchanged from v2]
    |
PresentationData                      [unchanged types]
    |
layoutPresentation()                  [NEW — TypeScript]
  |-- resolveTheme(themeName)         [NEW — CSS vars -> concrete values]
  |-- layoutSlide(slide, theme)       [NEW — per-template layout function]
    |
LayoutPresentation (JSON)             [NEW — absolute-positioned elements on 1920x1080]
    |-- Web: LayoutRenderer.tsx       [NEW — React, absolute-positioned divs + CSS animations]
    |     |
    |   SlideEngine.tsx               [unchanged — keyboard nav, scaling, slide activation]
    |
    |-- PPTX: exportPptx()           [NEW — Node.js, PptxGenJS]
          |
        .pptx file (returned as Buffer)
```

## Key Changes from v2

| Aspect | v2 | v3 |
|--------|----|----|
| Templates | 35 React components (`*Slide.tsx`) | 35 layout functions (pure TypeScript) |
| Theme resolution | CSS variables at runtime | Concrete values resolved at layout time |
| Rendering | JSX + CSS per template | Unified `LayoutRenderer` consuming layout JSON |
| Output formats | Web only | Web + PPTX from same layout |
| Template registry | `src/components/templates/index.ts` | `src/lib/layout/templates/index.ts` |

## Layout Model

The layout model is a JSON structure describing absolute-positioned elements on a 1920×1080 pixel canvas. It is the single source of truth for both renderers.

### Core Types

Defined in `src/lib/layout/types.ts`:

```typescript
interface Rect { x: number; y: number; w: number; h: number }

// 7 element types (discriminated union on `kind`)
type LayoutElement =
  | TextElement      // text with style (font, color, alignment)
  | ImageElement     // image with src, objectFit, optional clip
  | ShapeElement     // rectangle, circle, line, pill
  | GroupElement     // container with children (relative coords)
  | CodeElement      // code block with background
  | TableElement     // data table with headers and rows
  | ListElement      // bullet or numbered list

interface LayoutSlide {
  width: 1920;
  height: 1080;
  background: string;
  backgroundImage?: string;
  overlay?: string;
  elements: LayoutElement[];
}

interface LayoutPresentation {
  title: string;
  author?: string;
  slides: LayoutSlide[];
}
```

### Element Positioning

All elements use absolute coordinates on the 1920×1080 canvas. Group children use coordinates relative to the group's origin — the web renderer achieves this via CSS `position: absolute` on the group (creating a containing block), and the PPTX renderer offsets children by the group's absolute position.

## Theme System

Themes are resolved from CSS variable names to concrete values at layout time, not at render time. This means the layout JSON contains actual hex colors, font names, and pixel values — no CSS variables.

Defined in `src/lib/layout/theme.ts`:

```typescript
interface ResolvedTheme {
  bg: string;           // e.g. "#f8f9fc"
  bgSecondary: string;  // e.g. "#ffffff"
  text: string;         // e.g. "#1a1a2e"
  heading: string;      // e.g. "#1a1a2e"
  accent: string;       // e.g. "#4f6df5"
  accent2: string;      // e.g. "#a855f7"
  accentGradient: GradientDef;
  fontHeading: string;  // e.g. "Inter, system-ui, sans-serif"
  fontBody: string;
  fontMono: string;
  radius: number;       // px
  // ...
}
```

Four themes: `modern`, `bold`, `elegant`, `dark-tech`.

## Layout Functions

Each template has a pure TypeScript function that converts `SlideData` + `ResolvedTheme` into a `LayoutSlide`:

```typescript
// src/lib/layout/templates/bullets.ts
export function layoutBullets(
  slide: BulletSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];
  // ... compute positions, create text/shape/group elements
  return { width: 1920, height: 1080, background: theme.bg, elements };
}
```

Layout functions use shared helpers from `src/lib/layout/helpers.ts`:
- `titleBlock()` — standard title + accent line
- `stackVertical()` — vertically stack elements with gap
- `distributeHorizontal()` — distribute items across width
- `estimateTextHeight()` — heuristic text height from content/font size
- `bulletCard()` — card with left accent border

## Web Renderer

`src/components/LayoutRenderer.tsx` — a single React component that renders any `LayoutSlide` as absolute-positioned `<div>` elements. It handles:
- Text elements with full CSS styling
- Images with object-fit and optional clip
- Shapes with fill, gradient, border, shadow
- Groups with relative-positioned children
- Code blocks with background
- Tables and lists
- CSS animations via animation definitions on each element

## PPTX Renderer

`src/lib/export/pptx.ts` — converts `LayoutPresentation` to a `.pptx` Buffer using PptxGenJS.

### Coordinate Conversion

Canvas (1920×1080 px) maps to PowerPoint's `LAYOUT_WIDE` (13.3" × 7.5"):

```typescript
pxToInchesX(px) = (px / 1920) * 13.3
pxToInchesY(px) = (px / 1080) * 7.5
pxToPoints(px)  = px * (13.3 / 1920) * 72  // font sizes: ~px × 0.5
```

### Element Mapping

| Layout Element | PptxGenJS API |
|---|---|
| `text` | `slide.addText(text, { x, y, w, h, fontSize, fontFace, color, align, valign, margin: 0 })` |
| `image` | `slide.addImage({ path/data, x, y, w, h, sizing })` |
| `shape` | `slide.addShape(shapeType, { x, y, w, h, fill, rectRadius, line })` |
| `group` | Background shape + offset children (no native groups in PPTX) |
| `code` | Background rect + monospace text |
| `table` | `slide.addTable(rows, { x, y, w, colW, border })` |
| `list` | `slide.addText([{ text, options: { bullet, breakLine } }, ...])` |

### Color Handling

PptxGenJS requires 6-char uppercase hex WITHOUT `#` prefix. Alpha is handled via the `transparency` property (0-100, where 0 = opaque, 100 = transparent).

### Known Limitations

- **Gradients**: PptxGenJS has no gradient support. Solid color fallback (last gradient stop) is used.
- **Text shaping**: Line breaks may differ between browser and PowerPoint — text shaping engines differ.
- **Fonts**: Inter, Playfair Display, JetBrains Mono must be installed on the viewer's machine.
- **Video/iframe**: Rendered as placeholder shapes with link text.

## API Routes

### GET /api/layout?slug=X

Returns the `LayoutPresentation` JSON for a given presentation slug. Used by the export button.

### POST /api/export_pptx

Accepts `LayoutPresentation` JSON body, returns `.pptx` file as binary response. Handles non-ASCII filenames via RFC 5987 encoding. Image paths are validated to prevent path traversal.

## Data Flow for Export

```
User clicks "Export PPTX" button in SlideEngine
    |
Client calls GET /api/layout?slug=my-talk
    |
API: loadPresentation() -> layoutPresentation() -> LayoutPresentation JSON
    |
Client POSTs JSON to /api/export_pptx
    |
API: exportPptx() via PptxGenJS -> .pptx Buffer response
    |
Browser downloads .pptx
```

## File Structure

```
src/lib/layout/
  types.ts                    -- LayoutSlide, LayoutElement, ResolvedTheme, AnimationDef
  theme.ts                    -- 4 theme definitions, resolveTheme()
  helpers.ts                  -- titleBlock(), stackVertical(), distributeHorizontal(), etc.
  index.ts                    -- layoutPresentation(), layoutSlide() dispatcher
  templates/
    index.ts                  -- layout function registry
    cover.ts ... (35 total)   -- one layout function per template

src/lib/export/
  pptx.ts                    -- exportPptx(layout: LayoutPresentation): Promise<Buffer>
  pptx-helpers.ts            -- pxToInches(), hexColor(), colorAlpha(), parseFontFamily()

src/components/
  LayoutRenderer.tsx          -- renders LayoutSlide[] as absolute-positioned divs
  SlideEngine.tsx             -- keyboard nav, scaling, Export PPTX button

src/app/api/layout/route.ts       -- GET /api/layout?slug=X
src/app/api/export_pptx/route.ts  -- POST layout JSON -> .pptx
```

## Testing

| Layer | Tool | What it tests |
|-------|------|---------------|
| **Unit** | Vitest | pptx-helpers (coordinate/color conversion), layout helpers, theme resolution |
| **Integration** | Vitest | Layout functions (all 35 templates), exportPptx (valid PPTX output) |
| **E2E** | Playwright | Slide navigation, rendering, counter, export button |

## Design Decisions

- **Layout model as intermediate representation** — Decouples content/theme resolution from rendering. Adding a new output format (e.g. PDF) means writing one new renderer, not 35 template conversions.
- **PptxGenJS over python-pptx** — Same Node.js stack, better API for precise positioning (`margin: 0`, `valign`, `transparency`), no dual-deployment complexity.
- **Concrete theme values** — Resolving CSS variables to hex/px at layout time makes the layout JSON self-contained. Both renderers work without CSS variable resolution.
- **Pure functions for layout** — Layout functions are stateless, side-effect-free, and testable without React or DOM.
- **Single LayoutRenderer** — Replaces 35 individual React components with one generic renderer. Less code, consistent behavior, easier to maintain.
