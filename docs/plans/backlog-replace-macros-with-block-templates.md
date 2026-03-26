# Backlog: Replace Structural Macros with Block Templates

**Status:** Backlog — revisit when freeform scene slides show repeated patterns

## Context

`blocks.njk` contains ~5 structural macros that emit scene nodes (not just presets). 9 of 35 slide templates use them. Meanwhile, block template infrastructure (`block.ts`, `block-expand.ts`) is fully built but has zero consumers — no content slides use `kind: block` yet.

There are 86 freeform `mode: scene` slides across 4 content presentations that could potentially benefit from block templates.

## Structural Macros in Scope

| Macro | Used by | Migration difficulty |
|---|---|---|
| `section_title` | icon-grid, image-grid, image-gallery, qa, comparison, code, code-comparison | Medium — callers pre-compute Y; block would use anchors instead |
| `centered_title_stack` | statement, end | Easy — self-contained, worst ergonomics (17 positional args) |
| `code_element` | code, code-comparison | Hard — emits `kind: ir`, not a group (see constraint below) |
| `stat_card` / `stat_panel` | (available but unused in templates, used in freeform slides) | Easy — self-contained |
| `eyebrow_title` | (available but unused currently) | Easy |

## Constraint to Relax First

`block.ts:135-145` requires block template output to be `kind: group` with `children`. This is a simplifying assumption, not an architectural necessity. Single-node output (text, shape, image, ir) should be allowed — the `NODE_BASE_KEYS` overlay logic works on all node kinds via `SceneNodeBase`.

This must be relaxed before `code_element` can migrate.

## Pros of Migrating

1. **Namespaced isolation** — IDs/presets auto-prefixed, no manual collision avoidance
2. **Declarative composition** — block nodes are inspectable YAML data, not opaque Nunjucks text interpolation
3. **Style overrides via merge** — `blockNode.style` merges with template defaults, replacing positional args
4. **Recursive nesting** — blocks can contain blocks (depth limit: 5)
5. **Reusable in freeform slides** — block templates work in both template slides and hand-authored `mode: scene` slides; macros only work inside Nunjucks-rendered templates

## Cons of Migrating

1. **Two-phase compilation** — blocks expand in a separate pass before normalization; macros are inline single-pass
2. **No parent-scope access** — macros see `{% set %}` variables and `text_height` results from the parent template; block templates only see their own `params`, so callers must pre-compute or blocks must use anchors
3. **More files** — 5 macros in one file → 5+ separate `.template.yaml` files
4. **Positional geometry harder** — macros receive absolute x/y/w and bake them in; blocks get geometry via `frame` on the block node, but can't compute layout-relative offsets from parent scope

## Recommended Migration Order

1. Relax the single-node constraint in `block.ts`
2. `centered_title_stack` — worst macro ergonomics, self-contained (pilot)
3. `stat_card` / `stat_panel` — simple, self-contained
4. `section_title` — needs anchor-based internal layout
5. `code_element` — needs single-node relaxation

## Trigger to Start

- Freeform scene slides duplicating title+divider or stat-card patterns
- Macro signatures getting worse (more params, more callers)
- Someone wants to compose blocks inside blocks
