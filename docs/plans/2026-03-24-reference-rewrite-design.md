# Reference.md Rewrite + Compiler fit/align Change

## Problem

The replicate-slides `reference.md` is 930 lines mixing authoring guidance with repo integration, verification tooling, and built-in template/theme matching. It should be a concise scene authoring manual for template extraction. Additionally, `fit`/`align` are currently baked into template definitions but should be consumer decisions at the slide instance level.

## Changes

### 1. Compiler: Remove fit/align from template expansion

`engine.ts` lines 154-155 propagate `fit`/`align` from the parsed template body to the expanded slide. Remove these two lines. Instance-level `fit`/`align` (lines 158-159) remain.

- `sourceSize` stays in template body (intrinsic coordinate space)
- `fit`/`align` come only from the slide instance level
- Raw scene slides (no template) unchanged
- Types unchanged (`SceneSlideData` keeps optional `fit?`/`align?`)
- Existing content unaffected (no templates or deck-local templates use slide-level fit/align)
- Add test: template body fit/align ignored, instance fit/align honored

Note: `PresentationData` does NOT have `fit`/`align` fields. Presentation-level defaults are not supported and should not be documented. `fit`/`align` come from the slide instance only.

### 2. Extract pipeline: Update prompts, preview compiler, and instance YAML generator

The extract pipeline has its own code path that must match the new contract:

- `src/lib/extract/prompts.ts:56` instructs the LLM to put `fit: contain` and `align: center` in template bodies. Update to: `sourceSize` goes in the template body; `fit`/`align` do not.
- `src/lib/extract/compile-preview.ts:86-92` spreads raw parsed YAML directly into `SceneSlideData` (bypassing `expandDslTemplate`), so the engine.ts change has no effect on preview. Update to: strip `fit`/`align` from parsed template body, apply `fit: "contain"` and `align: "center"` as preview defaults.
- `src/components/extract/yaml-gen.ts:44-56` generates instance YAML with only `template` and `params`. Must branch on `proposal.scope`:
  - `scope: "slide"`: emit slide instance with `fit: contain` and `align: center`
  - `scope: "block"`: emit a `kind: block` snippet (with `id`, `template`, `frame`, `params`) — block templates are not top-level slide instances
- Add test for `compileProposalPreview` with concrete rect assertions that verify contain/center behavior (not just width/height existence checks).
- Add test for `generateInstanceYaml` confirming scope-aware output (fit/align for slides, kind: block for blocks).

### 3. reference.md: Fresh rewrite (~400 lines)

Write from scratch as a concise scene authoring manual. Structure:

1. Intro (~10 lines) — scene-only repo, extraction produces fresh templates with explicit styles
2. Template System (~40 lines) — two scopes, kind: block, name collision avoidance
3. Coordinate Space (~20 lines) — sourceSize is template-intrinsic, fit/align are consumer-specified at slide instance level only (not presentation level)
4. Scene Nodes (~100 lines) — text, shape, image, group, ir with property tables
5. IR Elements (~60 lines) — code, table, list, video, iframe (currently undocumented gap). Document two-layer geometry: node-level `frame` for positioning + nested `element.rect` that gets fitted into the resolved frame.
6. FrameSpec (~20 lines) — constraints and examples
7. Guides & Anchors (~30 lines) — definition, syntax, rules
8. Presets (~15 lines) — syntax, extends, override behavior
9. Layouts (~30 lines) — stack, row, grid; grid rowHeight pitfall
10. Backgrounds (~10 lines) — v9 background spec
11. Template Skeletons (~50 lines) — slide-scope, block-scope, instance examples (no fit/align in template)
12. Common Patterns (~20 lines) — asymmetric split, watermark, mixed emphasis, repeating sub-regions
13. Pitfalls (~20 lines) — trimmed to actionable items only

Excluded from reference.md:
- Layer 2 (repo adapter, read/write boundaries)
- Verification tooling (slide:diff, workbench, overlay)
- Built-in template list / matching guidance
- Built-in theme reading / matching guidance

### 4. integration.md: Extract Layer 2 as-is

Move from current reference.md without rewriting:
- Layer model (Layer 1 / Layer 2)
- Read/write boundaries
- File path conventions
- Verification tooling
- Repo adapter workflow
- Output contract

Future optimization deferred.

### 5. SKILL.md: Update all pointers and remove contradictions

- reference.md for authoring, integration.md for repo integration
- Remove ALL built-in template matching guidance, including:
  - Line 10: "Built-in templates still exist, but for screenshot replication they are only for exact structural matches"
  - Lines 80-84: "Use an exact built-in template only if the source already matches it closely"
  - Lines 116-117: "Prefer scene over built-in templates unless there is a close structural match"
- Replace with: "Always extract fresh templates. Built-in templates are for slide generation, not extraction."
- Update sourceSize/fit/align guidance to match new contract
- Minimal structural changes — future optimization deferred
