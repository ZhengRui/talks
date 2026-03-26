# Extract UI Design

## Goal

A web UI at `/workbench/extract` where users upload a screenshot, Claude analyzes it and proposes reusable templates (slide or block scope), and users configure which params/styles to expose via an interactive editor with live preview — then save the results as deck-local templates and slides.

## Architecture

- **Frontend:** Next.js page at `/workbench/extract`, React components, Tailwind CSS
- **Analysis backend:** Next.js API route (`/api/extract/analyze`) that calls the Claude Code SDK (`@anthropic-ai/claude-code`) — uses the user's Claude Code subscription, no separate API key
- **File output:** API route (`/api/extract/save`) writes templates and slides to `content/<slug>/`
- **Live preview:** Server-side compilation via `/api/extract/preview` + client-side `LayoutSlideRenderer` (same pattern as existing workbench)

## User Flow

### Phase 1: Input

- Image upload area (cmd+v / ctrl+v paste, or file picker — PNG, JPEG, WebP)
- Optional text input for verbal description or corrections
- Slug input (optional — auto-generated from image/text if blank)
- "Analyze" button → calls `/api/extract/analyze`
- Loading state while Claude Code SDK runs

### Phase 2: Edit + Preview

Two-column layout:

**Left: Overlay Container**
- Single container stacking three layers:
  - Bottom: uploaded screenshot
  - Middle: proposal region outlines (colored bounding boxes, clickable to select)
  - Top: live rendered slide preview (from generated template + instance)
- Opacity slider to blend between screenshot and rendered preview for comparison
- Clicking a region selects that proposal in the right panel

**Right: Proposal Editor**
- List of proposal cards (slide-scope and block-scope)
- Each card:
  - Template name (editable)
  - Scope badge (slide / block)
  - Description
  - Params table: name | type | value (editable) | expose toggle
  - Styles table: name | type | value (editable) | expose toggle
- YAML preview panel (auto-generated from structured data, read-only)
- "Save to Deck" button → calls `/api/extract/save`

## Analysis JSON Contract

Written by Claude Code SDK, consumed by the UI.

```json
{
  "source": {
    "image": "screenshot.png",
    "dimensions": { "w": 1366, "h": 768 }
  },
  "proposals": [
    {
      "scope": "slide",
      "name": "split-stat-rail",
      "description": "Two-panel slide with text left, stats right",
      "region": { "x": 0, "y": 0, "w": 1366, "h": 768 },
      "params": {
        "eyebrow": { "type": "string", "expose": true, "value": "CHAPTER 03" },
        "title": { "type": "string", "expose": true, "value": "The Fall of an Empire" },
        "stats": { "type": "array", "expose": true, "value": [{"value": "907 CE", "label": "Year"}] }
      },
      "style": {
        "accent": { "type": "string", "expose": true, "value": "#ff6b35" },
        "split": { "type": "number", "expose": false, "value": 910 }
      },
      "body": "background: ...\nguides: ...\nchildren:\n  - kind: shape\n    ..."
    }
  ]
}
```

### Field semantics

- **`params`** — content that varies across slides (text, arrays, images)
- **`style`** — design knobs that could vary but have sensible defaults (colors, sizes, gaps)
- **`expose: true`** → becomes a template param/style in the header. For params: `required: true`. For styles: `default: <value>`.
- **`expose: false`** → value is hardcoded into the body as a literal. Not in the template header.
- **`value`** — the concrete value Claude extracted from the screenshot. Used as: instance content (params) or default (styles) when exposed, literal when not exposed.
- **`body`** — Nunjucks template body (children + scope-appropriate config). References `{{ param_name }}` and `{{ style.name }}`.

### Generation rules

```
expose: true  param  → header: { type, required: true }     instance: value    body: {{ param_name }}
expose: false param  → header: (removed)                    instance: (removed) body: "literal value"
expose: true  style  → header: { type, default: value }     body: {{ style.name }}
expose: false style  → header: (removed)                    body: "literal value"
```

## API Routes

### POST `/api/extract/analyze`

**Request:** `multipart/form-data`
- `image` — uploaded screenshot file
- `text` — optional description string
- `slug` — optional slug string

**Processing:**
1. Save image to temp location
2. Call Claude Code SDK with the replicate-slides skill prompt + image
3. Parse structured JSON response
4. If no slug provided, generate one from the analysis
5. Return analysis JSON

**Response:** The analysis JSON (see contract above)

### POST `/api/extract/save`

**Request:** JSON body
- `slug` — deck slug
- `templates` — array of `{ name, scope, yaml }` (generated template file contents)
- `instance` — the slides.yaml content
- `image` — original image filename (to copy into deck images/)

**Processing:**
1. Create `content/<slug>/` directory structure
2. Write `content/<slug>/templates/<name>.template.yaml` for each template
3. Write `content/<slug>/slides.yaml`
4. Copy image to `content/<slug>/images/`
5. Run `bun run sync-content` to copy to public/

**Response:** `{ slug, files: [...paths written] }`

## YAML Generation (Client-Side)

The UI generates YAML from the structured proposal data. No server round-trip needed.

### Template file generation

```yaml
name: <proposal.name>
scope: <proposal.scope>
params:
  <for each param where expose: true>
  <name>: { type: <type>, required: true }
style:
  <for each style where expose: true>
  <name>: { type: <type>, default: <value> }

<proposal.body — with expose:false values hardcoded as literals>
```

### Instance generation

```yaml
- template: <proposal.name>
  params:
    <for each param where expose: true>
    <name>: <value>
  <style: only if any style values differ from defaults>
```

## Live Preview

Same pattern as the existing replication workbench — server compiles, client renders:

1. UI generates template YAML + instance YAML from proposal state (client-side, instant)
2. POST to `/api/extract/preview` with the YAML
3. Server: parse YAML → `expandDslTemplate()` → `compileSceneSlide()` → returns `LayoutSlide` JSON
4. Client: render with `LayoutSlideRenderer` in a 1920×1080 scaled canvas
5. Screenshot image layered on top with opacity slider (same overlay pattern as workbench `SlideCanvas`)
6. Supports overlay mode (opacity blend) and diff mode (`mixBlendMode: "difference"`)

### POST `/api/extract/preview`

**Request:** JSON body
- `templateYaml` — the generated template file content
- `instanceYaml` — the slide instance YAML

**Processing:**
1. Parse template YAML into `DslTemplateDef` (in-memory, no file writes)
2. Parse instance YAML
3. `expandDslTemplate(instance, templateDef)` → `SceneSlideData`
4. `expandBlockNodes()` if block templates present
5. `compileSceneSlide()` → `LayoutSlide`

**Response:** `LayoutSlide` JSON

## Component Structure

```
src/app/workbench/extract/page.tsx       — route page (server component wrapper)
src/components/extract/
  ExtractWorkbench.tsx                    — main client component, phase state machine
  ImageUpload.tsx                         — paste/file upload with preview
  OverlayPreview.tsx                      — stacked screenshot + regions + live render
  ProposalEditor.tsx                      — list of proposal cards
  ProposalCard.tsx                        — single proposal: name, params, styles
  FieldTable.tsx                          — param/style table with expose toggles
  YamlPreview.tsx                         — generated YAML display with copy button
```

## Tech Decisions

- **Claude Code SDK** for analysis — uses existing subscription, no API key management
- **Client-side YAML generation** — lightweight, instant feedback on expose toggles
- **Existing LayoutRenderer** for preview — no new rendering code
- **File-based output** to `content/<slug>/` — auto-discovered by the app
- **Dark theme** matching existing workbench aesthetic
