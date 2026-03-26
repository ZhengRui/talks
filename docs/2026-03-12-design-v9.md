# Design v9: IR-First Scene Compiler

This document describes the v9 direction for screenshot-first slide replication. It keeps the current IR and renderer split, adds a parallel scene-first compiler path, and re-centers authoring on explicit scene geometry instead of runtime components.

## Problem

v8 improved the IR and export fidelity, but it still routes authoring through a component tree plus a pseudo-flex/grid layer. That works for semantic slide patterns, but it is a poor fit for screenshot replication:

- screenshots are spatial, not semantic
- slide composition is usually guide-based and absolute, not document-flow-first
- the current auto-layout semantics are intentionally smaller than CSS, but they still look close enough to CSS to create false expectations
- the component layer hides styling and layout defaults that must be learned from code

The result is an awkward middle ground:

- too much hidden behavior for pixel work
- not enough layout fidelity to behave like HTML/CSS
- too much runtime machinery for patterns that end up as `raw` anyway

## Goal

Make the primary authoring target a scene graph that compiles directly to absolute IR.

The system should optimize for:

1. screenshot-first replication
2. deterministic compilation
3. explicit geometry
4. web/PPTX parity at the IR layer
5. reusable templates without requiring semantic runtime components

## Non-Goals

- Full browser layout emulation
- A React-style component model at runtime
- Semantic slide primitives with hidden defaults
- Making every authoring pattern theme-switchable by default

## Core Shift

v8 pipeline:

```text
slides.yaml
  -> DSL expansion
  -> component tree
  -> component resolver
  -> auto-layout pre-pass
  -> absolute IR
  -> web / PPTX
```

v9 pipeline:

```text
slides.yaml
  -> template / macro expansion
  -> scene graph
  -> geometry compiler
  -> absolute IR
  -> web / PPTX
```

The intended end state is that new authoring flows bypass the component resolver. Templates emit scene nodes directly. The compiler solves geometry, measures content, and emits absolute IR.

## Current Status

This branch now implements a working v9 scene system as the only authoring/layout path:

- `SlideData` is now scene-only
- `layoutSlide()` always compiles through the scene compiler path
- scene slides support:
  - typed `background`
  - optional `guides`
  - `sourceSize`, `fit`, `align` for screenshot-space normalization
  - scene nodes: `text`, `shape`, `image`, `group`, `ir`
  - local `stack`, `row`, and `grid` group layouts
  - anchors / frame references
  - preset inheritance via `extends`
  - built-in and deck-local macro imports
  - basic diagnostics for duplicate ids and invalid guide refs
- the output is still the existing `LayoutSlide` / `LayoutElement[]` IR

Migration status:

- all built-in templates now emit scene slides directly
- `v9-templates` acts as the migrated built-in template gallery
- `v9-features` demonstrates the intended v9 feature story
- the legacy component/autolayout path has been removed
- the remaining migration work is focused on porting real v8 presentation decks, improving authoring ergonomics, and expanding parity tooling

The branch is beyond the initial proof-of-concept stage. The architectural question is already answered; the remaining work is migration completion and authoring comfort.

## What Stays

These v8 investments remain valid and should be preserved:

- `LayoutElement` and `LayoutSlide` as the export/render target
- the web renderer
- the PPTX exporter
- theme resolution
- rich text
- transforms, clipping, effects, and the CSS-OOXML intersection work

v9 is not a renderer rewrite. It is an authoring and compilation rewrite.

## Authoring Model

### Scene-First YAML

Slides are authored as scene nodes, not components.

Authoring should map naturally to the way designers describe slides:

- a background panel at these bounds
- a title aligned to this guide
- a divider anchored under the title
- a stats column pinned inside the right panel

This is closer to Figma / Keynote / PowerPoint semantics than to HTML flow.

### Scene Node Shape

The scene graph should be a compile-time authoring format, not necessarily the final runtime IR. Nodes can carry unresolved geometry and references that the compiler will solve.

Current implemented shape:

```typescript
interface ScenePresentation {
  title: string;
  author?: string;
  theme?: ThemeName;
  slides: SceneSlide[];
}

interface SceneSlide {
  background?: BackgroundSpec;
  guides?: GuideSet;
  sourceSize?: { w: number; h: number };
  fit?: "contain" | "cover" | "stretch" | "none";
  align?: "top-left" | "top" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom" | "bottom-right";
  children: SceneNode[];
}

type SceneNode =
  | SceneText
  | SceneShape
  | SceneImage
  | SceneGroup;

interface SceneNodeBase {
  id: string;
  frame?: FrameSpec;
  opacity?: number;
  borderRadius?: number;
  shadow?: BoxShadow;
  effects?: ElementEffects;
  border?: BorderDef;
  entrance?: EntranceDef;
  animation?: string;
  clipPath?: string;
  transform?: TransformDef;
  cssStyle?: Record<string, string>;
}

interface SceneReferenceValue {
  ref: string;
  offset?: number;
}

interface ScenePreset {
  extends?: string;
  ...
}
```

The prototype does **not** try to mirror every IR element kind yet. The recommended direction is:

- keep the scene-native core small
- add first-class scene nodes only when compile-time geometry adds real value
- add a low-level escape hatch so scene is never less expressive than raw/freeform IR

In other words: scene should become a better authoring language than raw, not just a second spelling of the entire IR.

### FrameSpec

Instead of forcing `rect` early, authoring should allow partial geometry constraints:

```typescript
interface FrameSpec {
  x?: number | string | SceneReferenceValue;
  y?: number | string | SceneReferenceValue;
  w?: number | string | SceneReferenceValue;
  h?: number | string | SceneReferenceValue;
  left?: number | string | SceneReferenceValue;
  top?: number | string | SceneReferenceValue;
  right?: number | string | SceneReferenceValue;
  bottom?: number | string | SceneReferenceValue;
  centerX?: number | string | SceneReferenceValue;
  centerY?: number | string | SceneReferenceValue;
}
```

The compiler resolves `FrameSpec` into a concrete `Rect`. This is the main difference from old raw/freeform IR authoring, which required final `rect` values up front.

### Guides

Guides should be a first-class concept because screenshot replication often starts from visible alignment lines rather than container semantics.

Illustrative shape:

```yaml
guides:
  x:
    content-left: 160
    split: 1240
    content-right: 1760
  y:
    title-top: 180
    divider-top: 320
```

Nodes can then reference these values through the template/macro layer.

Guide references are already implemented in the prototype using string values such as `@x.content-left` and `@y.title-top`.

### Presets

Presets are now the main node-level reuse mechanism for scene authoring.

Current behavior:

- presets provide reusable defaults for a single node
- presets can inherit from other presets using `extends`
- inheritance resolves before theme normalization
- node-level fields still win over preset defaults

This keeps presets as authoring-time defaults rather than hidden runtime semantics.

### Macros

Macros are now the main fragment-level reuse mechanism for scene authoring.

Current behavior:

- inline Nunjucks macros work inside scene templates
- templates can import built-in macro files from `src/lib/dsl/macros/`
- templates can import deck-local macro files from their own `templates/` directory
- macro output is still just scene YAML, compiled through the normal scene pipeline

This is the intended reuse model:

- preset = one node's defaults
- macro = one or more scene nodes
- template = whole-slide composition

Current macro strategy:

- keep the shared macro library intentionally small
- extract only stable scene fragments that repeat across templates and real decks
- keep complex or domain-specific abstractions deck-local
- do not rebuild the old runtime component layer under new macro names

The most promising shared fragments are:

- centered top headers
- centered title stacks
- card / panel shells
- media framing blocks
- repeated stat / comparison / quote fragments where they prove stable across more than one deck

### Groups

Groups remain useful, but as geometry containers rather than semantic components.

Two group modes:

- `overlay`: no layout, children keep explicit frames
- `layout`: compiler-managed arrangement for local geometry sugar

Absence of `layout` should mean overlay/absolute, not "default flex-column".

That behavior is implemented today: a group without `layout` is purely overlay/absolute.

### Scene vs Raw / Freeform

v9 scene slides are intentionally close to old raw/freeform slides, but they are not the same thing.

- raw/freeform authored the final IR directly
- scene authors a source format above the IR and compiles it down

That distinction matters because scene adds authoring-time features that raw did not have:

- `FrameSpec` instead of mandatory final `rect`
- named guides
- `sourceSize` / `fit` / `align` root normalization
- recursive scaling of frames, font sizes, borders, shadows, and layout gaps
- local geometry primitives (`stack`, `row`)

So scene is not "invent a new ontology." It is "make freeform first-class, but with compiler help."

## Layout Engine Role in v9

The layout engine is still meaningful, but its role becomes smaller and clearer.

It should do four things well:

1. measure intrinsic sizes
2. solve explicit geometry constraints
3. flatten relative groups into absolute IR
4. emit diagnostics

It should not:

- invent card styles
- invent default spacing systems
- reinterpret missing properties as semantic intent
- try to be a partial browser

## Geometry Primitives

The engine should keep a small set of layout primitives, but they should be explicitly slide-oriented rather than browser-like.

Recommended primitives:

- `stack`
- `row`
- `grid`
- `anchor`
- `distribute`
- `fit`
- `cover`
- `overlay`

Prototype status:

- implemented: absolute / overlay, `stack`, `row`, `grid`, anchor refs, dedicated diagnostics for guides / ids
- not yet implemented: `distribute`
- partially covered already:
  - slide-level `fit` via `sourceSize` + `fit` + `align`
  - image `cover` / `contain` via `objectFit`

### `stack`

Vertical arrangement with explicit gap and optional alignment.

```yaml
layout:
  type: stack
  gap: 24
  align: start
```

### `row`

Horizontal arrangement with explicit tracks or explicit child widths. Prefer deterministic track sizing over pseudo-flex behavior.

```yaml
layout:
  type: row
  gap: 32
  tracks: [1250, 638]
```

If fluid tracks are needed, keep them explicit:

```yaml
layout:
  type: row
  gap: 32
  tracks: ["65%", "35%"]
```

### `grid`

Useful for icon grids and image matrices, but keep it simple and deterministic:

```yaml
layout:
  type: grid
  columns: 3
  columnGap: 24
  rowGap: 24
```

Current implementation:

- fixed `columns`
- optional explicit `tracks`
- optional `columnGap`, `rowGap`, `rowHeight`, and `padding`
- row-major placement
- no spanning
- no responsive behavior

### `anchor`

Anchors are now implemented as frame references, not as a separate node-level object.

Examples:

- `centerX: "@panel.centerX"`
- `top: { ref: "@title.bottom", offset: 24 }`
- `w: "@card.width"`

Current rules:

- anchors can target previously compiled nodes in the same container
- direct string refs work for zero-offset cases
- object refs with `offset` are used when spacing needs to scale with `sourceSize`
- guides remain `@x.*` / `@y.*`; node anchors are `@nodeId.edge`

Supported node anchor keys:

- `left`, `right`, `centerX`, `x`
- `top`, `bottom`, `centerY`, `y`
- `width`, `w`, `height`, `h`

The missing primitives are still useful backlog, but they are no longer blockers for the core architectural question. The prototype already demonstrates that screenshot-first replication works better without routing through components first.

## Compiler Pipeline

### Phase 1: Parse

- parse YAML
- expand Nunjucks templates / partials / macros when present
- preserve `mode: scene` slides as first-class input

Output: `ScenePresentation`

### Phase 2: Normalize

- resolve theme tokens
- prefix image paths
- normalize background specs
- normalize font aliases (`heading`, `body`, `mono`)

Output: normalized scene graph with unresolved geometry still intact

### Phase 3: Root Viewport

- compute the slide-space viewport from:
  - `sourceSize`
  - `fit`
  - `align`
- scale source-space node geometry and style metrics into the target viewport

Output: normalized scene graph in slide-space, still using unresolved frames

### Phase 4: Solve Geometry

- resolve guide references
- resolve `frame` constraints into concrete rects
- estimate text heights from font settings and width constraints
- run local layout primitives (`stack`, `row`)

Output: fully positioned scene graph

### Phase 5: Emit IR

- convert scene nodes into `LayoutElement[]`
- preserve group structure for the existing renderer/exporter
- feed the unchanged web renderer and PPTX exporter backend

Output: `LayoutPresentation`

### Phase 6: Diagnostics

- unresolved references
- overlapping text
- clipped content
- export caveats for `cssStyle`
- missing assets

Diagnostics should be emitted in dev and test runs, not hidden.

## Background Model

v9 should move away from raw CSS strings as the primary authoring model for backgrounds.

Current prototype:

- implemented: `solid`, `image`
- not yet implemented: typed linear/radial/layered scene backgrounds

Preferred direction:

```typescript
type BackgroundSpec =
  | { type: "solid"; color: string }
  | { type: "linear-gradient"; angle: number; stops: Stop[] }
  | { type: "radial-gradient"; centerX: number; centerY: number; stops: Stop[] }
  | { type: "image"; src: string; fit: "cover" | "contain"; overlay?: string }
  | { type: "layers"; layers: BackgroundSpec[] };
```

This keeps background handling typed and compiler-friendly while preserving exportability.

## Template Story Without Components

Removing runtime components does not remove reuse.

Reuse should come from:

- Nunjucks partials
- parameterized scene templates
- guide presets
- scene macros for recurring shapes and text blocks
- style presets for repeated text and shape styling

Examples of reusable patterns:

- cover title block
- chapter label + divider
- metric block
- image with caption
- browser-frame shell

These are better expressed as template snippets that emit scene nodes than as runtime component resolvers.

Current status:

- the DSL engine now requires `.template.yaml` files to emit `mode: scene` slides directly
- macros and presets are now the main way to solve scene verbosity
- the remaining work is extracting better shared fragments from real deck migrations

## Screenshot-First Workflow

Primary workflow:

```text
screenshot
  -> human / vision analysis
  -> scene template or direct scene YAML
  -> geometry compiler
  -> layout.json
  -> render / export
```

Optional workflow when HTML exists:

```text
HTML / CSS
  -> importer
  -> scene graph
  -> geometry compiler
  -> layout.json
```

HTML import is a side path, not the core model.

## Debug Tooling

v9 should add inspection tooling early. This matters as much as the compiler itself.

Recommended dev tools:

- source screenshot overlay against compiled slide
- visible guides / frames / bounds
- source-to-output id mapping
- text box overflow markers
- export-only warning badges for web-only CSS

Implemented in this branch:

- a replication workbench UI at `/workbench/replicate`
  - deck selector
  - slide selector
  - reference path or uploaded screenshot
  - render / reference / overlay / diff / split modes
- viewer-side overlay via query params:
  - `?slide=12`
  - `?overlay=refs/slide-12.png`
  - `?overlayDir=refs&overlayPattern=slide-{n}.png`
  - `?overlayOpacity=0.5`
  - `?chrome=0`
- `bun run slide:diff -- --slug <slug> --slide <n> --reference <png>`

Without this, the system will keep relying on trial and error.

## Proposed File Structure

```text
src/lib/scene/
  types.ts              -- SceneSlide, SceneNode, FrameSpec
  normalize.ts          -- token resolution, path normalization
  solve.ts              -- guide resolution, frame solving, local layout
  compiler.ts           -- root viewport + scaling + SceneNode -> LayoutElement[]
  diagnostics.ts        -- planned compiler warnings/errors

src/lib/templates/
  *.template.yaml       -- emits scene nodes, not components

src/lib/layout/
  types.ts              -- kept as render/export IR
  theme.ts              -- kept

src/lib/export/
  pptx.ts               -- kept, adapted only if IR evolves
```

## Migration Plan

### Phase 0: Parallel Prototype

Keep v8 running. Add a v9 compiler path in parallel.

Status: done in this branch.

### Phase 1: Scene Authoring for New Slides

Add support for a new slide shape that bypasses components entirely.

Example:

```yaml
- mode: scene
  children:
    - kind: text
      id: title
      frame: { left: 160, top: 180, w: 760 }
      text: "Title"
      style:
        fontFamily: "heading"
        fontSize: 56
        fontWeight: 700
        color: "#ffffff"
        lineHeight: 1.15
```

Compile this path alongside the existing v8 path.

Status: done in this branch, including `sourceSize` / `fit` / `align` root normalization.

### Phase 2: Make Scene Fully Viable For Real Authoring

Immediate priorities:

1. add a low-level scene escape hatch for raw IR elements
2. let templates emit scene slides directly
3. add scene macros / presets to reduce verbosity
4. add diagnostics and anchors
5. add `grid` only if real slides need it

Status in this branch:

- done: 1, 2, 3, 5, and a focused version of 4
- next likely step: either `distribute`, or more template-time ergonomics if repeated slide work still feels too verbose

This phase matters more than adding a long tail of geometry primitives. The main gap after the prototype is authoring ergonomics, not proof of concept.

### Phase 3: Port Replication-Heavy Decks and Templates

Port one or two screenshot-replicated presentations first, then move built-in templates from component-emitting DSL to scene-emitting DSL where it improves clarity.

### Phase 4: Legacy Removal

This branch has already removed:

- `src/lib/layout/components/`
- the old component resolver path
- the old auto-layout pass from the main layout pipeline

What remains is migration validation:

- confirm the remaining real v8 decks are comfortably portable
- keep web/PPTX parity stable
- keep scene plus its escape hatch expressive enough for future decks

## Why This Fits This Repo

This repo's strongest asset is already the absolute IR and dual renderer model. v9 builds around that strength.

The component layer was useful as a bridge away from rigid TypeScript templates. It does not need to be the end state.

For screenshot-first work, the durable architecture is:

- explicit scene authoring
- small deterministic geometry compiler
- absolute IR as the shared rendering contract

That is simpler than the current v8 authoring stack and closer to the actual problem the repo is solving.
