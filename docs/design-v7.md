# Design v7: Extended Component System

## Motivation

v6 introduced a composable component layer with 12 typed components and a vertical stacker. This works well for simple compositions but can only express ~9 of the 35 existing templates. The remaining templates need:

1. **Positioning controls** — centering, vertical splits, overlays, panel fill modes
2. **Complex components** — timeline, steps, table, image grids are spatial patterns that don't decompose into vertical stacks

If the compose system becomes expressive enough to replace all 35 templates, the generation target simplifies: Claude (or Claude Vision from a screenshot) only needs to output compose YAML instead of writing TypeScript layout functions. This unlocks the **screenshot → reusable template** workflow.

## Goal

Extend the component + compose system so that any slide layout can be expressed as a component composition in YAML — no TypeScript needed for new templates.

## Current State (v7)

**15 components:** text, heading, body, bullets, stat, tag, divider, quote, card, image, code, spacer, raw, columns, box

**2 containers:** split-compose (two horizontal panels), full-compose (single content area)

**Stacker:** Vertical, top-to-bottom, default gap (28px), flex spacers, marginTop/marginBottom overrides, verticalAlign. Flex distribution for `fill: true` boxes (equal space split among fill siblings).

**DSL engine:** Nunjucks-based `.template.yaml` expansion — `{{ }}`, `{% if %}`, `{% for %}` with style defaults and layered resolution (per-presentation shadows built-in)

**Group 1 COMPLETE:** 9 rigid templates (bullets, stats, statement, quote, code, numbered-list, definition, blank, end) replaced by DSL `.template.yaml` files. Rigid TS layout functions deleted.

**Group 2 COMPLETE:** 8 rigid templates (two-column, comparison, code-comparison, sidebar, image-caption, image-comparison, profile, image-text) replaced by DSL `.template.yaml` files. Rigid TS layout functions and type interfaces deleted.

**Group 3 COMPLETE:** 8 positioning templates (cover, section-divider, three-column, top-bottom, highlight-box, qa, agenda, full-image) replaced by DSL `.template.yaml` files. Rigid TS layout functions and type interfaces deleted. Features added: `backgroundImage`/`overlay` on full-compose, `fill: true` flex distribution, box `maxWidth`/`borderColor`/`borderWidth`/`borderSides`/`marginTop`/`marginBottom`/directional `padding`, tag `align`.

## Template Audit

### Group 1: COMPLETE (~9 templates)

Vertical stacks of existing components. All replaced by DSL `.template.yaml` files. Rigid TS deleted.

| Template | As composition |
|---|---|
| `bullets` | heading + divider + bullets |
| `stats` | heading + divider + spacer(flex) + columns[box[stat]] + spacer(flex) |
| `statement` | heading(large, center) + divider + body(muted, center) |
| `quote` | quote(decorative, centered) |
| `code` | heading(center) + divider(gradient, center) + code |
| `numbered-list` | heading + divider + bullets(ordered, plain) |
| `definition` | heading + divider + [text(bold, accent) + text + divider(border)]... |
| `blank` | empty |
| `end` | heading(large, center) + divider + body(muted, center) |

### Group 2: COMPLETE (~8 templates)

Two-panel layouts and multi-element compositions. All replaced by DSL `.template.yaml` files. Rigid TS layout functions and type interfaces deleted.

| Template | As composition |
|---|---|
| `two-column` | heading + divider + columns(equalHeight)[box[body] + box[body]] |
| `comparison` | heading + divider + columns[box(accentTop, green)[heading + bullets] + box(accentTop, red)[heading + bullets]] |
| `code-comparison` | heading + divider + columns[box[text(label) + code] + box[text(label) + code]] |
| `sidebar` | columns(ratio:0.3)[box[body(sidebar)] + box[heading + body(main)]] |
| `image-caption` | heading + divider + image(scale-up) + text(caption, centered) |
| `image-comparison` | heading + divider + columns(equalHeight)[box[image + text(label)] + box[image + text(label)]] |
| `profile` | image(circle, scale-up) + heading(name) + text(title, accent) + divider + text(bio, muted) |
| `image-text` | split-compose: left[image(cover, fill)] + right[heading + divider + body + bullets] |

### Group 3: COMPLETE (~8 templates)

Positioning templates — needed container/component extensions beyond basic vertical stacking. All replaced by DSL `.template.yaml` files. Rigid TS layout functions and type interfaces deleted.

| Template | As composition |
|---|---|
| `cover` | heading(large, center) + divider + body(center) + tag(center) + backgroundImage/overlay |
| `section-divider` | heading(large, center) + body(center) + backgroundImage/overlay |
| `three-column` | heading + divider + columns[box(accentTop)[text + heading + body] x 3] |
| `top-bottom` | heading + divider + box(fill) + divider(gradient) + box(fill) |
| `highlight-box` | heading + divider + box(maxWidth, borderColor, panel)[body] |
| `qa` | heading + divider + box(maxWidth)[body] |
| `agenda` | heading + divider + [box(borderSides:left, conditional opacity/bold)]... |
| `full-image` | heading(center) + body(center) + backgroundImage/overlay |

### Group 4: Need new components (~8 templates)

Complex spatial patterns that are their own layout primitive — they should become components.

| Template | Component needed |
|---|---|
| `timeline` | **timeline** — labeled points on a horizontal/vertical line |
| `steps` | **steps** — numbered process flow with connectors |
| `diagram` | **diagram** — boxes with arrows/connections |
| `chart-placeholder` | **chart** — or just use image component |
| `icon-grid` | **icon-grid** — grid of icon + label pairs |
| `image-grid` | **image-grid** — 2x2 or 3x2 image layout |
| `image-gallery` | **gallery** — row of images with captions |
| `table` | **table** — already exists in IR as `kind: table` |

### Group 5: Special (~2 templates)

| Template | Notes |
|---|---|
| `video` | Embed, not a visual layout pattern |
| `iframe` | Embed, not a visual layout pattern |

## Proposed Extensions

### Extension 1: Positioning controls

Add layout properties to containers and the stacker so content isn't limited to top-down vertical flow.

#### Vertical alignment

```yaml
- template: full-compose
  align: center
  verticalAlign: center        # NEW — top | center | bottom (default: top)
  children:
    - type: heading
      text: "Section Title"
    - type: body
      text: "Subtitle"
```

This unlocks `cover`, `section-divider`, `highlight-box` — any centered content.

#### Vertical split container

```yaml
- template: stack-compose       # NEW — vertical panels
  ratio: 0.6
  top:
    background: theme.bg
    children: [...]
  bottom:
    background: theme.bgSecondary
    children: [...]
```

This unlocks `top-bottom`, `qa` — any top/bottom split.

#### Three-panel container

```yaml
- template: columns-compose     # NEW — N horizontal panels
  columns:
    - width: 0.33
      children: [...]
    - width: 0.34
      children: [...]
    - width: 0.33
      children: [...]
```

This unlocks `three-column`, `agenda` with column layouts.

#### Panel fill mode

```yaml
- template: split-compose
  left:
    fill: true                  # NEW — child fills panel, no padding
    children:
      - type: image
        src: "hero.jpg"
  right:
    children:
      - type: heading
        text: "Title"
```

This unlocks `image-text`, `profile`, `full-image` — panels where an image bleeds to the edge.

#### Overlay mode

```yaml
- template: full-compose
  backgroundImage: "hero.jpg"   # NEW — image behind all content
  overlay: "rgba(0,0,0,0.5)"   # NEW — darkening overlay
  verticalAlign: bottom
  children:
    - type: heading
      text: "Title over image"
```

This unlocks `full-image` — text overlaid on a background image.

### Extension 2: New components

Promote complex templates to components so they can appear inside any container.

#### table

```yaml
- type: table
  headers: ["Year", "Event", "Impact"]
  rows:
    - ["907", "Tang falls", "Fragmentation begins"]
    - ["960", "Song founded", "Reunification"]
```

Maps directly to existing `kind: table` in IR.

#### timeline

```yaml
- type: timeline
  items:
    - year: "907"
      label: "Fall of Tang"
    - year: "960"
      label: "Song Dynasty"
```

Renders as horizontal line with labeled points.

#### steps

```yaml
- type: steps
  items:
    - title: "Research"
      description: "Gather requirements"
    - title: "Design"
      description: "Create wireframes"
```

Renders as numbered boxes with connectors.

#### icon-grid

```yaml
- type: icon-grid
  columns: 3
  items:
    - icon: "🚀"
      label: "Fast"
    - icon: "🔒"
      label: "Secure"
```

Renders as grid of icon + label pairs.

#### image-grid

```yaml
- type: image-grid
  columns: 2
  items:
    - src: "photo1.jpg"
      caption: "First"
    - src: "photo2.jpg"
      caption: "Second"
```

Renders as grid of images with optional captions.

### Extension 3: Component-level positioning (optional)

Allow individual components to override default stacker behavior.

```yaml
- type: heading
  text: "Title"
  align: center                 # text alignment within the component
  margin:
    top: 40                     # override default gap
```

This gives fine-grained control without going full freeform.

## Extension 4: Jinja-style Template DSL — IMPLEMENTED

### Motivation

Currently there are two extremes:

1. **Rigid templates** — clean data interface (`title`, `bullets[]`), but rendering is locked in TypeScript
2. **Compose** — fully flexible, but verbose — users specify every component, font size, margin

A template DSL bridges these: **a template is a parameterized component tree**. It has a clean user-facing schema but expands into the same components that compose uses. This also enables the **screenshot → reusable template** workflow — AI generates a `.template.yaml` from a screenshot, and users reuse it with different content.

### Processing Pipeline

```
slides.yaml
  → loadPresentation()
  → for each slide:
      if rigid (registry) → existing TS layout function (18 remaining)
      if DSL template     → expand params → component tree → stackComponents
      if compose          → stackComponents directly
```

The `.template.yaml` file is valid YAML, but certain sections contain Jinja expressions. Processing:

1. Parse front matter (`params`, `style`, `base`) — extract defaults
2. Build context: merge user data + style defaults
3. Render the template through a Jinja engine with that context
4. Parse the rendered result as YAML
5. Extract `children` → `SlideComponent[]` → hand to stacker

Non-string values auto-serialize to YAML format — arrays become YAML lists, objects become YAML maps, numbers/booleans output as-is.

### DSL Constructs

Three Jinja constructs cover all template patterns:

- **`{{ expr }}`** — variable interpolation with dot access (`{{ s.value }}`)
- **`{% if expr %}...{% endif %}`** — conditional blocks (truthiness check, supports `loop.last`, `not`, etc.)
- **`{% for item in list %}...{% endfor %}`** — iteration with loop context variables

The `{% %}` tags are control flow markers that get **stripped from the output**. They have no indentation requirement of their own — only the content inside the blocks needs correct YAML indentation. With `trim_blocks` + `lstrip_blocks` enabled, leading whitespace on `{% %}` lines is also stripped, so tags can be indented for readability without affecting output.

Available loop variables (standard Jinja):

| Variable | Description |
|---|---|
| `loop.index` | 1-based counter |
| `loop.index0` | 0-based counter |
| `loop.first` | `true` on first iteration |
| `loop.last` | `true` on last iteration |
| `loop.length` | total items |

Nesting is fully supported — `{% if %}` inside `{% for %}`, `{% for %}` inside `{% for %}`, etc.

### Template Definition Format

A `.template.yaml` file has two parts: **front matter** (params, style, base) and **component tree** (with Jinja expressions).

```yaml
name: <template-name>

params:
  <field>: { type: <type>, required: true }
  <field>: { type: <type> }                   # optional

style:
  <field>: { type: <type>, default: <value> }  # visual tweaks with defaults

base: full-compose | split-compose
# base-level props (verticalAlign, ratio, etc.)

children:  # or left/right for split-compose
  - type: <component>
    text: "{{ param }}"
    fontSize: {{ style.styleProp }}
```

The `params` section defines content data (what the user provides). The `style` section defines optional visual tweaks — all have defaults, users override selectively.

In the template body, params are accessed directly (`{{ title }}`), style values under `style.*` (`{{ style.titleSize }}`). This avoids name collisions.

### Coverage

All 17 templates (Group 1 + Group 2) with constructs needed:

| Template | `{{ }}` | `{% if %}` | `{% for %}` | `style` |
|---|---|---|---|---|
| `bullets` | title, bullets | – | – | titleSize, bulletVariant |
| `stats` | title | – | stats | statFontSize, cardHeight |
| `statement` | statement | subtitle | – | – |
| `quote` | quote | attribution | – | fontSize |
| `code` | title, code | title | – | codeFontSize |
| `numbered-list` | title, items | – | – | – |
| `definition` | title | – | definitions | termSize, descSize |
| `blank` | – | – | – | – |
| `end` | title | subtitle | – | – |
| `two-column` | title, left, right | title, cardHeight | – | titleSize, bodySize, cardHeight |
| `comparison` | title, left, right | title | – | titleSize, headingSize, bodySize, leftAccent, rightAccent |
| `code-comparison` | title, before, after | title, labels | – | titleSize |
| `sidebar` | title, sidebar, main | title, sidebarPosition | – | – |
| `image-caption` | title, image, caption | title | – | – |
| `image-comparison` | title, before, after | title, labels | – | – |
| `profile` | name, title, image, bio | image, title, bio | – | – |
| `image-text` | title, image, body, bullets | title, body, bullets, imagePosition | – | – |

### Examples

#### Simple substitution: bullets

```yaml
name: bullets
params:
  title: { type: string, required: true }
  bullets: { type: string[], required: true }
style:
  titleSize: { type: number, default: 56 }
  accentStyle: { type: string, default: gradient }
  bulletVariant: { type: string, default: card }

base: full-compose
children:
  - type: heading
    text: "{{ title }}"
    fontSize: {{ style.titleSize }}
  - type: divider
    variant: {{ style.accentStyle }}
    width: 80
    marginTop: 16
    marginBottom: 40
  - type: bullets
    items: {{ bullets }}
    variant: {{ style.bulletVariant }}
```

Usage — identical to the current rigid template, style overrides optional:

```yaml
- template: bullets
  title: "My Points"
  bullets:
    - First point
    - Second point
  style:
    titleSize: 48
    bulletVariant: plain
```

#### Conditional: statement

```yaml
name: statement
params:
  statement: { type: string, required: true }
  subtitle: { type: string }

base: full-compose
verticalAlign: center
children:
  - type: heading
    text: "{{ statement }}"
    fontSize: 72
    textAlign: center
  {% if subtitle %}
  - type: divider
    variant: gradient
    width: 120
    align: center
  - type: body
    text: "{{ subtitle }}"
    fontSize: 32
    color: theme.textMuted
    textAlign: center
  {% endif %}
```

#### Iteration on container: stats

```yaml
name: stats
params:
  title: { type: string, required: true }
  stats: { type: array, items: { value: string, label: string }, required: true }
style:
  statFontSize: { type: number, default: 72 }
  labelFontSize: { type: number, default: 26 }
  cardHeight: { type: number, default: 200 }

base: full-compose
children:
  - type: heading
    text: "{{ title }}"
    fontSize: 56
    textAlign: center
  - type: divider
    variant: gradient
    width: 80
    align: center
    marginTop: 16
    marginBottom: 40
  - type: spacer
    flex: true
  - type: columns
    gap: 32
    children:
      {% for s in stats %}
      - type: box
        accentTop: true
        height: {{ style.cardHeight }}
        children:
          - type: stat
            value: "{{ s.value }}"
            label: "{{ s.label }}"
            textAlign: center
            fontSize: {{ style.statFontSize }}
            labelFontSize: {{ style.labelFontSize }}
      {% endfor %}
  - type: spacer
    flex: true
```

#### Sibling-level iteration with `loop.last`: definition

```yaml
name: definition
params:
  title: { type: string, required: true }
  definitions: { type: array, items: { term: string, description: string }, required: true }
style:
  termSize: { type: number, default: 30 }
  descSize: { type: number, default: 28 }

base: full-compose
children:
  - type: heading
    text: "{{ title }}"
    fontSize: 56
  - type: divider
    variant: gradient
    width: 80
    marginTop: 16
  {% for def in definitions %}
  - type: text
    text: "{{ def.term }}"
    fontSize: {{ style.termSize }}
    fontWeight: bold
    color: theme.accent
    marginTop: 24
  - type: text
    text: "{{ def.description }}"
    fontSize: {{ style.descSize }}
    marginTop: 8
    {% if not loop.last %}
  - type: divider
    variant: border
    marginTop: 24
    {% endif %}
  {% endfor %}
```

#### Nested iteration: grouped list

```yaml
name: grouped-list
params:
  title: { type: string, required: true }
  groups: { type: array, items: { name: string, items: string[] }, required: true }

base: full-compose
children:
  - type: heading
    text: "{{ title }}"
    fontSize: 56
  - type: divider
    variant: gradient
    width: 80
    marginTop: 16
  {% for group in groups %}
  - type: text
    text: "{{ group.name }}"
    fontSize: 30
    fontWeight: bold
    color: theme.accent
    marginTop: 32
    {% for item in group.items %}
  - type: text
    text: "{{ item }}"
    fontSize: 24
    marginTop: 8
    {% endfor %}
    {% if not loop.last %}
  - type: divider
    variant: border
    marginTop: 24
    {% endif %}
  {% endfor %}
```

#### Split-compose base

```yaml
name: image-text
params:
  title: { type: string, required: true }
  body: { type: string }
  image: { type: string, required: true }
style:
  ratio: { type: number, default: 0.5 }

base: split-compose
ratio: {{ style.ratio }}
left:
  children:
    - type: image
      src: "{{ image }}"
right:
  children:
    - type: heading
      text: "{{ title }}"
    {% if body %}
    - type: body
      text: "{{ body }}"
    {% endif %}
```

### Where Templates Live

Layered resolution with shadowing:

```
src/lib/layout/templates/
  bullets.template.yaml      # built-in (ships with system)
  stats.template.yaml
  ...

content/my-talk/
  templates/
    custom-card.template.yaml  # per-presentation (user-defined)
    bullets.template.yaml      # shadows built-in for this deck
  slides.yaml
```

Per-presentation templates shadow built-in ones — override `bullets` for a specific deck.

### What's Explicitly Excluded

- **Computed expressions** — no `{{ items | length > 5 }}` or ternaries. If complex logic is needed, write a TypeScript resolver. Keeps the DSL declarative and AI-friendly.
- **Template inheritance/mixins** — a template is one flat definition. Copy to create variants.
- **Expressions in style values** — no `fontSize: "{{ itemCount > 5 ? 20 : 28 }}"`. Use reasonable fixed defaults.

### Implementation Notes

The Jinja subset is small — only `{{ }}`, `{% if %}`, `{% for %}` with dot access and loop variables. Options:

- Use [Nunjucks](https://mozilla.github.io/nunjucks/) (Mozilla's JS Jinja2 port) — full-featured, well-maintained
- Or implement a lightweight engine (~100 lines) for just this subset

## Screenshot → Template Workflow

With the extensions above and the template DSL, the screenshot-to-template flow becomes:

1. User provides a screenshot of a slide they like
2. Claude Vision analyzes the design: layout structure, colors, typography, content slots
3. Claude generates a `.template.yaml` with:
   - Appropriate base (`full-compose`, `split-compose`)
   - Typed components matching the visual elements
   - `{{ param }}` holes for content data
   - `style` section for tweakable visual props
   - Theme tokens for colors where possible
4. User saves the template and reuses it with different content:
   ```yaml
   - template: custom-card
     title: "My Title"
     bullets: [...]
     style:
       titleSize: 48
   ```

No TypeScript needed. The `.template.yaml` is the template.

## Migration Path

Rigid templates are progressively replaced by DSL `.template.yaml` files:

1. ~~Group 1: 9 rigid templates → DSL (DONE)~~
2. ~~Group 2: 8 two-panel/multi-element templates → DSL (DONE)~~
3. ~~Group 3: 8 positioning templates → DSL with component extensions (DONE)~~
4. Group 4: 8 component templates → add new components, create DSL templates
5. Group 5: 2 embed templates (video, iframe) — keep as rigid or convert last

## Design Decisions

### `verticalAlign` lives on the container, not the stacker

Currently `align` (horizontal) is on the container (`full-compose`). It computes the panel rect, then passes it to the stacker. The stacker always stacks top-down within whatever rect it receives.

`verticalAlign` follows the same pattern: the container runs the stacker to get total content height, then offsets all elements by `(panel.h - contentHeight) / 2` for center. The stacker stays simple.

### Panel `fill` removes all padding

When `fill: true`, the panel content area has 0px padding on all sides. The content (typically an image) bleeds to all panel edges. If users want partial padding, they use spacers or component-level margin overrides. Simpler mental model than directional padding rules.

### `raw` stays at the stack level, not inside components

Components have clean boundaries — their props define what's customizable. If a user needs to customize something inside a component (e.g., a custom icon at a timeline point), they should use `raw` or freeform for that whole section instead of injecting raw elements inside the component. This keeps component resolvers simple and predictable.

### Priority ordering

1. Positioning controls (unlock Group 3 — most templates, least code)
2. New container types — stack-compose, columns-compose (unlock multi-panel layouts)
3. New components (unlock Group 4 — driven by demand, one at a time)
