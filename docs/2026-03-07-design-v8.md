# Design v8: Current Architecture

This document describes the current v8 architecture as implemented. For history, decisions, and remaining work, see `discussion-v8.md`.

## Data Flow

```
content/[slug]/slides.yaml
    → loadPresentation() — parse YAML, compile DSL templates
    → layoutPresentation() — resolve components → IR elements
        → resolveLayouts() — auto-layout pre-pass (flex/grid → absolute rects)
    → LayoutPresentation (all rects absolute)
        ├── LayoutRenderer (web)
        └── exportPptx() (PPTX)
```

All slides are component trees. No discriminated union, no base layout layer. `SlideData = ComponentSlideData & SlideBaseFields`.

## IR Types

### ElementBase

All 9 element types extend this:

```typescript
interface ElementBase {
  id: string;
  rect: Rect;                              // always required — {x:0,y:0,w:0,h:0} when layout-managed
  opacity?: number;
  borderRadius?: number;
  shadow?: BoxShadow;
  effects?: ElementEffects;                // glow, softEdge, blur
  border?: BorderDef;                      // width, color, sides?, dash?
  entrance?: EntranceDef;                  // type, delay, duration
  animation?: string;                      // CSS animation shorthand (web-only)
  clipPath?: string;                       // CSS clip-path value
  transform?: TransformDef;               // rotate, scaleX/Y, flipH/V
  cssStyle?: Record<string, string>;       // web-only escape hatch
  position?: "absolute";                   // opt out of parent flow layout
}
```

### Transform

```typescript
interface TransformDef {
  rotate?: number;      // degrees, positive = clockwise
  scaleX?: number;      // default 1.0
  scaleY?: number;      // default 1.0
  flipH?: boolean;
  flipV?: boolean;
}
```

### Rich Text

```typescript
type RichText = string | TextRun[];

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  letterSpacing?: number;
  highlight?: string;       // background color on this run
  superscript?: boolean;
  subscript?: boolean;
}
```

Markdown shorthand: `"The **Fall** of *Tang*"` is parsed to runs by renderers. `highlightColor` on `TextStyle` colors `**bold**` segments.

### Element Types

```typescript
TextElement     { kind: "text";   text: RichText; style: TextStyle }
ImageElement    { kind: "image";  src: string; objectFit: "cover"|"contain"; clipCircle?: boolean }
ShapeElement    { kind: "shape";  shape: ShapePreset; style: ShapeStyle }
GroupElement    { kind: "group";  children: LayoutElement[]; style?: ShapeStyle;
                  clipContent?: boolean; layout?: LayoutMode }
CodeElement     { kind: "code";   code: string; language?: string; style: CodeStyle }
TableElement    { kind: "table";  headers: RichText[]; rows: RichText[][] }
ListElement     { kind: "list";   items: RichText[]; ordered: boolean }
VideoElement    { kind: "video";  src: string; poster?: string }
IframeElement   { kind: "iframe"; src: string }
```

Shape presets: `rect`, `circle`, `line`, `pill`, `arrow`, `triangle`, `chevron`, `diamond`, `star`, `callout`.

### Auto-Layout

```typescript
type LayoutMode = FlexLayout | GridLayout;

interface FlexLayout {
  type: "flex";
  direction: "row" | "column";
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "space-between" | "space-around";
  wrap?: boolean;
  padding?: number | [number, number, number, number];
}

interface GridLayout {
  type: "grid";
  columns: number;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  padding?: number | [number, number, number, number];
}
```

Layout resolution happens **before** rendering. `resolveLayouts()` walks the element tree top-down, computes absolute rects for children of layout groups, then recurses into children. Children with `position: "absolute"` are excluded from flow and keep their rects unchanged.

Absence of `layout` on a group = absolute positioning (children use their own rects).

### Slide

```typescript
interface LayoutSlide {
  width: 1920;
  height: 1080;
  background: string;              // CSS background value
  backgroundImage?: string;
  overlay?: string;
  elements: LayoutElement[];
}
```

## Component Layer

18 component types resolved by `resolvers.ts` into IR elements. All share a mixin:

```typescript
type SlideComponent = (
  TextComponent | HeadingComponent | BodyComponent | BulletsComponent
  | StatComponent | TagComponent | DividerComponent | QuoteComponent
  | CardComponent | ImageComponent | VideoComponent | IframeComponent
  | CodeComponent | SpacerComponent | RawComponent | ColumnsComponent
  | BoxComponent | GridComponent
) & {
  // Style passthrough — applied to root element after component-specific resolution
  entranceType?: EntranceType;
  entranceDelay?: number;
  opacity?: number;
  transform?: TransformDef;
  effects?: ElementEffects;
  borderRadius?: number;
  clipPath?: string;
  cssStyle?: Record<string, string>;

  // Layout control
  width?: number;                  // enables justify in flex-row boxes
  height?: number;
  margin?: number | number[];      // CSS-style: 1-4 values
  position?: "absolute";           // opt out of parent flow
  x?: number;                      // absolute position within parent
  y?: number;
};
```

### Key Components

**Text-bearing** (accept `RichText`): `text`, `heading`, `body`, `bullets`, `stat`, `tag`, `quote`, `card`.

**Box** — the primary layout container:

```typescript
interface BoxComponent {
  type: "box";
  children: SlideComponent[];
  padding?: number | number[];         // default 28
  variant?: "card" | "flat" | "panel"; // default "card"
  background?: string;
  accentTop?: boolean;
  accentColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderSides?: ("top" | "right" | "bottom" | "left")[];
  height?: number;
  maxWidth?: number;
  fill?: boolean;                      // expand to fill panel height
  verticalAlign?: "top" | "center" | "bottom";
  autoEntrance?: {
    type: EntranceType;
    stagger?: number;                  // ms per child, default 100
    baseDelay?: number;                // ms, default 0
  };
  layout?: {
    type: "flex" | "grid";
    direction?: "row" | "column";      // flex only, default "column"
    columns?: number;                  // grid only
    gap?: number;
    rowGap?: number;                   // grid only
    columnGap?: number;                // grid only
    align?: "start" | "center" | "end" | "stretch";
    justify?: "start" | "center" | "end" | "space-between" | "space-around";
    wrap?: boolean;                    // flex-row only
  };
}
```

Boxes without explicit `layout` default to `flex-column` with 16px gap.

**Spacer** — `{ type: "spacer", height?: number, flex?: boolean }`. Defaults to `flex: true` when no height — fills remaining space in flex layouts.

**Raw** — `{ type: "raw", height: number, elements: LayoutElement[] }`. Escape hatch for IR elements directly in component trees.

**Columns** — `{ type: "columns", children: SlideComponent[], gap?: number, ratio?: number, equalHeight?: boolean }`. Horizontal split with optional ratio.

**Grid** — `{ type: "grid", children: SlideComponent[], columns?: number, gap?: number, equalHeight?: boolean }`.

### Component Resolution

```
resolveComponent(component, ctx)
    → resolveByType(component, ctx)    // component-specific logic → ResolveResult
    → apply mixin passthrough          // borderRadius, transform, effects, etc. → root element
    → apply entrance                   // entranceType/entranceDelay → EntranceDef
    → return { elements, height, flex }
```

For Box with `layout`, the resolver:
1. Resolves each child component to get its natural height
2. Builds placeholder elements with computed heights
3. Creates a virtual group with the layout config
4. Calls `resolveLayouts()` to compute positions
5. Maps positions back to resolved child elements

## DSL Template System

Templates are `.template.yaml` files in `src/lib/layout/templates/`. Each declares:

```yaml
name: template-name
params:
  - name: title
    required: true
  - name: items
    required: true
style:
  background: "{{ theme.bg }}"

children:
  - type: heading
    text: "{{ title }}"
  - type: bullets
    items: {{ items | dump }}
```

Templates output component trees. Nunjucks compiles `{{ }}` expressions. Auto-discovered — no registry update needed.

## Theme System

16 themes defined as `ResolvedTheme` objects with concrete values (no CSS vars). Both web and PPTX renderers use the same resolved values.

Key tokens: `bg`, `bgSecondary`, `bgTertiary`, `text`, `textMuted`, `heading`, `accent`, `accent2`, `accentGradient`, `fontHeading`, `fontBody`, `fontMono`, `radius`, `shadow`, `border`, `cardBg`, `cardBorder`.

Component resolvers map theme tokens: `"heading"` → `theme.fontHeading`, `"body"` → `theme.fontBody`, `"mono"` → `theme.fontMono`.
