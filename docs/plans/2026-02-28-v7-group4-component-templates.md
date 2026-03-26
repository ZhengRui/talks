# Group 4: Component Templates → New Components + DSL Templates

## Goal

Create DSL `.template.yaml` files (with `dsl-` prefix) for 8 Group 4 templates. Add 4 new components (grid, table, steps, timeline). User tests on dev server, then separately asks for rigid TS deletion + rename.

**Workflow**: Create `dsl-*` templates → user tests → (later) delete rigid TS + rename.

## Overview

| Step | What | Type |
|---|---|---|
| 1 | Template alias support + `dsl-chart-placeholder` & `dsl-diagram` | DSL alias |
| 2 | `dsl-image-gallery` → DSL using existing `columns` | DSL only |
| 3 | `grid` component | New component |
| 4 | `dsl-image-grid` & `dsl-icon-grid` → DSL using `grid` | DSL templates |
| 5 | `table` component + `dsl-table` template | New component + DSL |
| 6 | `steps` component + `dsl-steps` template | New component + DSL |
| 7 | `timeline` component + `dsl-timeline` template | New component + DSL |

---

## Step 1: Template Alias Support + `chart-placeholder` / `diagram`

Both are identical to `image-caption`. Instead of duplicating, define an `alias` field in the template file.

### New template format: `alias`

```yaml
name: dsl-chart-placeholder
alias: image-caption
```

When the loader encounters `alias`, it resolves to that template instead.

### `src/lib/dsl/loader.ts` — Handle alias

In `findTemplate`, after getting the parsed template def, check for alias:

```ts
export function findTemplate(
  templateName: string,
  slug?: string,
): DslTemplateDef | null {
  // ... existing lookup logic ...
  // After finding and parsing a template file:
  const def = parseTemplateFile(filePath, templateName);
  if (def && def.alias) {
    // Resolve alias — load the target template instead
    return findTemplate(def.alias, slug);
  }
  // ... rest unchanged ...
}
```

This requires `parseTemplateFile` to return the `alias` field. Update it to check `parsed.alias`.

### `src/lib/dsl/types.ts` — Add alias to DslTemplateDef

```ts
export interface DslTemplateDef {
  name: string;
  alias?: string;         // NEW — redirect to another template
  params: Record<string, DslParamDef>;
  style?: Record<string, DslStyleDef>;
  rawBody: string;
}
```

### Create template files

**`src/lib/layout/templates/dsl-chart-placeholder.template.yaml`**:
```yaml
name: dsl-chart-placeholder
alias: image-caption
```

**`src/lib/layout/templates/dsl-diagram.template.yaml`**:
```yaml
name: dsl-diagram
alias: image-caption
```

### `content/v7-comparison/slides.yaml`

Add DSL slides using `template: dsl-chart-placeholder` and `template: dsl-diagram` alongside existing rigid TS slides.

### Tests

- Test in `src/lib/dsl/loader.test.ts` (or integration test): `findTemplate("dsl-chart-placeholder")` returns a valid def with `rawBody` from `image-caption.template.yaml`
- Layout integration: slide with `template: dsl-chart-placeholder` renders image + caption

### Verification
- `bun run test` passes
- `bun run dev` → `/v7-comparison` → DSL chart-placeholder and diagram slides render same as rigid TS

---

## Step 2: `dsl-image-gallery` → DSL Using Existing `columns`

Image gallery = single-row horizontal images with captions. Maps to `columns` with `box[image + text]` children.

### Create `src/lib/layout/templates/dsl-image-gallery.template.yaml`

```yaml
name: dsl-image-gallery
params:
  title: { type: string }
  images: { type: array, required: true }
style:
  titleSize: { type: number, default: 56 }
  imageHeight: { type: number, default: 600 }
  captionSize: { type: number, default: 22 }

base: full-compose
children:
  {% if title %}
  - type: heading
    text: "{{ title }}"
    fontSize: {{ style.titleSize }}
    textAlign: center
  - type: divider
    variant: gradient
    width: 80
    align: center
    marginTop: 16
    marginBottom: 40
  {% endif %}
  - type: columns
    gap: 32
    children:
      {% for img in images %}
      - type: box
        variant: flat
        padding: 0
        children:
          - type: image
            src: "{{ img.src }}"
            height: {{ style.imageHeight }}
            objectFit: cover
            borderRadius: 16
            animationType: scale-up
          {% if img.caption %}
          - type: text
            text: "{{ img.caption }}"
            fontSize: {{ style.captionSize }}
            textAlign: center
            color: theme.textMuted
            marginTop: 12
          {% endif %}
      {% endfor %}
```

### `content/v7-comparison/slides.yaml`

Add `template: dsl-image-gallery` slide alongside existing rigid TS slide.

### Verification
- `bun run test` passes
- Visual: gallery renders with horizontal images + captions

---

## Step 3: `grid` Component

Like `columns` but wraps items into rows. Model after `resolveColumns` (`resolvers.ts:736-802`).

### `src/lib/layout/components/types.ts`

Add to `SlideComponent` union:

```ts
export interface GridComponent {
  type: "grid";
  children: SlideComponent[];
  columns?: number;      // items per row, default 3
  gap?: number;          // default 32
  equalHeight?: boolean; // stretch cells to same height per row
}
```

### `src/lib/layout/components/resolvers.ts`

Add `resolveGrid` — distributes children into rows of N columns. For each row: position children horizontally like `resolveColumns`, then stack rows vertically with gap.

Key logic:
- `cols = c.columns ?? 3`
- `colW = (panel.w - gap * (cols - 1)) / cols`
- For each row: resolve children, position at `(col * (colW + gap), totalH)`, track maxH per row
- `equalHeight`: stretch groups to maxH within each row
- Staggered animation: `staggerDelay(idx, baseDelay)` across all items (not per-row)

Add `case "grid": result = resolveGrid(component, ctx); break;` to `resolveComponent` switch.

### Tests

Test in component test file:
- 6 children, 3 columns → 2 rows, correct x/y positions
- `equalHeight: true` stretches group elements
- Default gap 32, custom gap

### Verification
- `bun run test` passes

---

## Step 4: `dsl-image-grid` & `dsl-icon-grid` → DSL Using `grid`

### Create `src/lib/layout/templates/dsl-image-grid.template.yaml`

```yaml
name: dsl-image-grid
params:
  title: { type: string }
  images: { type: array, required: true }
  columns: { type: number }
style:
  titleSize: { type: number, default: 56 }
  imageHeight: { type: number, default: 300 }
  captionSize: { type: number, default: 24 }

base: full-compose
children:
  {% if title %}
  - type: heading
    text: "{{ title }}"
    fontSize: {{ style.titleSize }}
    textAlign: center
  - type: divider
    variant: gradient
    width: 80
    align: center
    marginTop: 16
    marginBottom: 40
  {% endif %}
  - type: grid
    columns: {{ columns or 2 }}
    gap: 32
    equalHeight: true
    children:
      {% for img in images %}
      - type: box
        variant: flat
        padding: 0
        children:
          - type: image
            src: "{{ img.src }}"
            height: {{ style.imageHeight }}
            objectFit: cover
            borderRadius: 16
            animationType: scale-up
          {% if img.caption %}
          - type: text
            text: "{{ img.caption }}"
            fontSize: {{ style.captionSize }}
            textAlign: center
            color: theme.textMuted
            marginTop: 8
          {% endif %}
      {% endfor %}
```

### Create `src/lib/layout/templates/dsl-icon-grid.template.yaml`

```yaml
name: dsl-icon-grid
params:
  title: { type: string }
  items: { type: array, required: true }
  columns: { type: number }
style:
  titleSize: { type: number, default: 56 }
  iconSize: { type: number, default: 48 }
  labelSize: { type: number, default: 26 }

base: full-compose
children:
  {% if title %}
  - type: heading
    text: "{{ title }}"
    fontSize: {{ style.titleSize }}
    textAlign: center
  - type: divider
    variant: gradient
    width: 80
    align: center
    marginTop: 16
    marginBottom: 40
  {% endif %}
  - type: grid
    columns: {{ columns or 3 }}
    gap: 32
    equalHeight: true
    children:
      {% for item in items %}
      - type: box
        accentTop: true
        padding: 32
        children:
          - type: text
            text: "{{ item.icon }}"
            fontSize: {{ style.iconSize }}
            textAlign: center
          - type: text
            text: "{{ item.label }}"
            fontSize: {{ style.labelSize }}
            textAlign: center
            fontWeight: bold
      {% endfor %}
```

### `content/v7-comparison/slides.yaml`

Add `template: dsl-image-grid` and `template: dsl-icon-grid` slides.

### Verification
- `bun run test` passes
- Visual: grids wrap correctly into rows

---

## Step 5: `table` Component + `dsl-table`

Thin pass-through to `kind: "table"` layout IR element.

### `src/lib/layout/components/types.ts`

```ts
export interface TableComponent {
  type: "table";
  headers: string[];
  rows: string[][];
  fontSize?: number;       // cell font size, default 26
  headerFontSize?: number; // header font size, default 26
}
```

Add `| TableComponent` to `SlideComponent` union.

### `src/lib/layout/components/resolvers.ts`

Add `resolveTable` — creates a single `kind: "table"` LayoutElement using theme styles for header/cell formatting. Port styling from `table.ts` (lines 46-66): accent header bg, cardBg cells, altBackground rows, border color.

Add `case "table": result = resolveTable(component, ctx); break;` to switch.

### Create `src/lib/layout/templates/dsl-table.template.yaml`

```yaml
name: dsl-table
params:
  title: { type: string }
  headers: { type: array, required: true }
  rows: { type: array, required: true }
style:
  titleSize: { type: number, default: 56 }
  fontSize: { type: number, default: 26 }

base: full-compose
children:
  {% if title %}
  - type: heading
    text: "{{ title }}"
    fontSize: {{ style.titleSize }}
    textAlign: center
  - type: divider
    variant: gradient
    width: 80
    align: center
    marginTop: 16
    marginBottom: 40
  {% endif %}
  - type: table
    headers: {{ headers }}
    rows: {{ rows }}
    fontSize: {{ style.fontSize }}
```

### `content/v7-comparison/slides.yaml`

Add `template: dsl-table` slide.

### Verification
- `bun run test` passes
- Visual: table renders with themed header/rows

---

## Step 6: `steps` Component + `dsl-steps`

Numbered badge circles + connector lines + content cards.

### `src/lib/layout/components/types.ts`

```ts
export interface StepsComponent {
  type: "steps";
  items: { label: string; description?: string }[];
  badgeSize?: number;  // default 48
  gap?: number;        // vertical gap between steps, default 24
}
```

Add `| StepsComponent` to `SlideComponent` union.

### `src/lib/layout/components/resolvers.ts`

Add `resolveSteps` — port logic from `steps.ts`:
- Calculate step height to fill available panel height
- For each step: badge group (accent circle + number text) + connector line (except last) + card group (label + optional description)
- Staggered animation delays

Add `case "steps": result = resolveSteps(component, ctx); break;` to switch.

### Create `src/lib/layout/templates/dsl-steps.template.yaml`

```yaml
name: dsl-steps
params:
  title: { type: string }
  steps: { type: array, required: true }
style:
  titleSize: { type: number, default: 56 }
  badgeSize: { type: number, default: 48 }

base: full-compose
children:
  {% if title %}
  - type: heading
    text: "{{ title }}"
    fontSize: {{ style.titleSize }}
    textAlign: center
  - type: divider
    variant: gradient
    width: 80
    align: center
    marginTop: 16
    marginBottom: 40
  {% endif %}
  - type: steps
    items: {{ steps }}
    badgeSize: {{ style.badgeSize }}
```

### `content/v7-comparison/slides.yaml`

Add `template: dsl-steps` slide.

### Verification
- `bun run test` passes
- Visual: steps render with badges + connectors + cards

---

## Step 7: `timeline` Component + `dsl-timeline`

Horizontal line with labeled points.

### `src/lib/layout/components/types.ts`

```ts
export interface TimelineComponent {
  type: "timeline";
  events: { date: string; label: string; description?: string }[];
  dotSize?: number;  // default 16
}
```

Add `| TimelineComponent` to `SlideComponent` union.

### `src/lib/layout/components/resolvers.ts`

Add `resolveTimeline` — port from `timeline.ts`:
- Horizontal connector line spanning panel width
- 3-layer dots (ring, inner, core) at each event position
- Date text (accent, below dot) + label (bold) + optional description (muted)
- Staggered animation

Add `case "timeline": result = resolveTimeline(component, ctx); break;` to switch.

### Create `src/lib/layout/templates/dsl-timeline.template.yaml`

```yaml
name: dsl-timeline
params:
  title: { type: string }
  events: { type: array, required: true }
style:
  titleSize: { type: number, default: 56 }

base: full-compose
children:
  {% if title %}
  - type: heading
    text: "{{ title }}"
    fontSize: {{ style.titleSize }}
    textAlign: center
  - type: divider
    variant: gradient
    width: 80
    align: center
    marginTop: 16
    marginBottom: 40
  {% endif %}
  - type: timeline
    events: {{ events }}
```

### `content/v7-comparison/slides.yaml`

Add `template: dsl-timeline` slide.

### Verification
- `bun run test` passes
- Visual: timeline renders with horizontal line + dots + labels

---

## Key Files

| File | Role |
|---|---|
| `src/lib/layout/components/types.ts` | Add GridComponent, TableComponent, StepsComponent, TimelineComponent |
| `src/lib/layout/components/resolvers.ts` | Add resolveGrid, resolveTable, resolveSteps, resolveTimeline |
| `src/lib/dsl/loader.ts` | Handle `alias` field in template files |
| `src/lib/dsl/types.ts` | Add `alias?` to DslTemplateDef |
| `src/lib/layout/templates/dsl-*.template.yaml` | Create 8 new DSL templates |
| `content/v7-comparison/slides.yaml` | Add DSL slides alongside rigid TS |

## Execution Batches

**Batch 1** (Steps 1-2): Alias support + `dsl-chart-placeholder`, `dsl-diagram`, `dsl-image-gallery` — no new components
**Batch 2** (Steps 3-4): Grid component + `dsl-image-grid`, `dsl-icon-grid`
**Batch 3** (Steps 5-6): Table + steps components + `dsl-table`, `dsl-steps`
**Batch 4** (Step 7): Timeline component + `dsl-timeline`

After each batch: `bun run test` + user visual check on dev server.
