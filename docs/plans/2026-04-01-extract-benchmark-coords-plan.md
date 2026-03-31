# Extract Benchmark: `control` vs `coords` Implementation Plan

## Summary
- Add a built-in benchmark launcher to the extract page that uses existing slides from `content/*`.
- Benchmark runs one slide at a time and creates two normal extract cards side by side:
  - `control`: current behavior, screenshot only
  - `coords`: same pipeline, plus exact layout rect hints
- Reuse the current extract/refine pipeline, current stage tabs, current diff view, and current mismatch-history logs. No new scoring system in v1.
- Keep the current two-stage refine flow unchanged in structure:
  - vision pass stays image-only
  - edit pass receives geometry hints again for the `coords` card only

## Key Changes
- Add a benchmark launcher UI on the extract page toolbar, plus an empty-state CTA.
- Launcher behavior:
  - choose `content` deck
  - choose one slide number
  - click `Run benchmark`
  - append two cards to the canvas, side by side, labeled `control` and `coords`
  - auto-start analyze on both cards, with auto-refine continuing as it does today
  - do not clear existing cards; select the new `control` card after creation
- Benchmark source loading:
  - server-side route lists available decks and slide counts from `content/*`
  - server-side route loads one chosen slide, renders the slide screenshot, and derives exact element rect hints from the same `LayoutSlide`
  - screenshot becomes the reference image for both cards
- Geometry hint strategy:
  - use exact absolute rects for all rendered layout elements, depth-first, including group containers, decorators, and leaf elements
  - hint payload includes enough identity to let the model map boxes to content: `id`, `kind`, `parentId`, `depth`, `rect`, and optional short text preview for text/list/table/code elements
  - `coords` card stores this payload; `control` card stores none
- Analyze behavior:
  - keep current analyze route and result handling
  - add optional `geometryHints` request field
  - when present, extend the extract prompt with a strict “geometry ground truth” section: use these rects as positions, do not re-guess layout, focus on matching content/styling/effects
  - when absent, prompt output remains unchanged
- Refine behavior:
  - keep current refine iteration loop and mismatch logging unchanged
  - keep vision prompt unchanged and image-only
  - extend only the edit prompt with optional `geometryHints`
  - for `coords`, the edit pass gets `difference list + current proposals + exact rect hints`
  - for `control`, edit stays `difference list + current proposals`
- Card/UI treatment:
  - add lightweight benchmark metadata to cards: benchmark group id, variant, slug, slide index, optional geometry hints
  - show small `control` / `coords` badges in the card header and thumbnail strip
  - do not add a new benchmark summary panel in v1; rely on existing mismatch history and diff images

## Public Interfaces / Types
- Add benchmark API endpoints:
  - `GET benchmark catalog` returning deck options and slide counts
  - `POST benchmark load` with `{ slug, slideIndex }` returning screenshot data, slide label, natural size, and geometry hints
- Add a shared geometry-hint type used by benchmark load, card state, analyze route, and refine route:
  - `source: "layout"`
  - `elements: Array<{ id, kind, parentId?, depth, rect: { x, y, w, h }, text? }>`
- Extend extract-page card state with optional benchmark metadata:
  - `variant: "control" | "coords"`
  - `groupId`
  - `slug`
  - `slideIndex`
  - `geometryHints?`
- Extend analyze/refine route inputs with optional `geometryHints` form data
- Extend prompt-builder signatures so hint sections are injected only when the optional payload is present

## Test Plan
- Prompt tests:
  - extract prompt includes geometry-ground-truth instructions only when hints are provided
  - refine vision prompt remains unchanged
  - refine edit prompt includes hint instructions only when hints are provided
- Geometry-hint tests:
  - flattening preserves absolute rects
  - nested groups and decorators are included
  - text-bearing nodes include short text previews
- Benchmark route tests:
  - catalog returns known `content/*` decks
  - load returns one rendered screenshot plus hint payload for a chosen slide
- Extract page/store tests:
  - launching a benchmark creates exactly two cards with shared group id and correct variants
  - `coords` card sends `geometryHints` on analyze and refine; `control` does not
  - paired cards auto-start analysis and preserve existing refine behavior
  - badges/labels render correctly in the existing UI
- Acceptance scenario:
  - choose one built-in slide, run benchmark, observe two cards side by side, each showing existing extract mismatch and refine-iteration mismatch logs, with the `coords` run using the same UI but lower/faster-converging mismatch if geometry helps

## Assumptions / Defaults
- V1 is one slide at a time, not whole-deck batch mode.
- Benchmark pairs append to the canvas instead of replacing existing cards.
- The benchmark uses the existing mismatch history and diff visuals; no new benchmark-specific metric UI is added in v1.
- All rendered layout elements are included in the hint payload, even if some are decorative or container groups.
- The refine structure stays two-stage exactly as it is today; only the edit stage gets rect hints in the `coords` variant.
