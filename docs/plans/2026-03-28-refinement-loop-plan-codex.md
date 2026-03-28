# Refinement Loop Implementation Plan (Codex)

## Summary

Implement step 6 as a server-orchestrated refinement loop that:

1. reuses the exact normalized image buffer from analyze
2. crops both reference and replica to extracted `contentBounds`
3. renders on the server with `renderSlideToImage()`
4. diffs with `compareImages()`
5. persists annotated diff PNGs as fetchable artifacts
6. asks Claude to patch proposals JSON surgically
7. updates a new `refine` stage plus `Iter` and `Diff` views live

This step should preserve the current Extract/Critique behavior and add refinement as a third stage rather than rewriting the existing analyze flow.

## Locked Decisions

- Refinement compares against the same normalized image buffer used during analyze, not the raw upload.
- A new extracted field, `source.contentBounds`, defines the visible slide-content rectangle inside the screenshot.
- `inventory.slideBounds` keeps its existing meaning: full screenshot bounds.
- Refine is a real third stage: `"extract" | "critique" | "refine"`.
- `Iter` is a local preview rendered from refined proposals, consistent with Extract/Critique.
- `Diff` is driven by a fetchable artifact URL, not base64 embedded in SSE.
- The refine route calls `compileProposalPreview()` and `renderSlideToImage()` directly on the server; it does not call `/api/render`.
- Cancellation must use a real `AbortController` path and server-side abort checks.

## Scope

Included in this step:

- extract schema update for `contentBounds`
- normalized-image preservation in client/store
- refine stage state and UI wiring
- refine SSE route
- refine prompt/orchestration logic
- diff annotation and in-memory artifact serving
- abort support

Explicitly out of scope:

- block extraction / factoring
- persistence of iteration history or artifacts to disk
- replacing `slide-diff.mjs`
- changing the existing render endpoint contract
- streaming full-size base64 images in SSE

## Data Model Changes

### 1. Extend extract result schema with `source.contentBounds`

Update the extract prompt and shared types so analyze returns:

```ts
source: {
  image: string;
  dimensions: { w: number; h: number };
  reportedDimensions?: { w: number; h: number };
  contentBounds?: { x: number; y: number; w: number; h: number };
}
```

Semantics:

- `dimensions`: full normalized image size
- `contentBounds`: actual visible slide-content area inside that image
- `contentBounds` defaults to the full image bounds when no chrome is visible or the model cannot distinguish it confidently

Implementation files:

- `src/lib/extract/prompts.ts`
- `src/components/extract/types.ts`
- `src/lib/extract/normalize-analysis.ts`
- relevant tests in `src/lib/extract/*.test.ts`

### 2. Preserve the normalized image file used for analyze

Today `downscaleImage()` runs in `ExtractCanvas.tsx` before upload. Preserve that processed file in the store so refine can reuse the exact same buffer.

Add to `SlideCard`:

```ts
normalizedImage: File | null;
```

Behavior:

- when analyze starts, call `downscaleImage(card.file)`
- store the returned file on the card before posting to `/api/extract/analyze`
- use the same stored file later for `/api/extract/refine`

Implementation files:

- `src/components/extract/store.ts`
- `src/components/extract/ExtractCanvas.tsx`
- `src/components/extract/store.test.ts`

### 3. Add refine stage and refine-only state

Generalize stage-aware state:

```ts
type AnalysisStage = "extract" | "critique" | "refine";
type ViewMode = "original" | "extract" | "critique" | "iter" | "diff";
```

Add to `SlideCard`:

```ts
refineAnalysis: AnalysisResult | null;
refineStatus: "idle" | "running" | "done" | "error";
refineIteration: number;
refineMaxIterations: number;
refineMismatchThreshold: number;
refineError: string | null;
refineResult: {
  proposals: Proposal[];
  mismatchRatio: number;
  regions: DiffRegion[];
  diffArtifactUrl: string;
  replicaArtifactUrl?: string | null;
} | null;
refineHistory: Array<{
  iteration: number;
  proposals: Proposal[];
  mismatchRatio: number;
  regions: DiffRegion[];
  diffArtifactUrl: string;
  replicaArtifactUrl?: string | null;
}>;
autoRefine: boolean;
diffObjectUrl: string | null;
```

Notes:

- `refineAnalysis` should reuse the `AnalysisResult` shape, usually by cloning the current final stage analysis and swapping only `proposals`.
- refine-only transport/UI artifacts stay in `refineResult` and `refineHistory`.
- `selectedTemplateIndex` must gain a `refine` key.

Implementation files:

- `src/components/extract/types.ts`
- `src/components/extract/store.ts`
- `src/components/extract/stage-utils.ts`
- store tests and any stage-dependent component tests

## Backend Plan

### 4. Add crop and annotation utilities

Create focused render utilities:

- `src/lib/render/annotate.ts`
  - input: diff PNG buffer + `DiffRegion[]`
  - output: annotated PNG buffer
  - implementation: `sharp` compositing
- `src/lib/render/crop.ts` or helper in refine module
  - input: image buffer + `{ x, y, w, h }`
  - output: cropped PNG buffer using `sharp.extract`

Requirements:

- crop reference and replica using the same integer-rounded `contentBounds`
- validate `contentBounds` against image dimensions
- fallback to full-image bounds if `contentBounds` is absent or invalid

### 5. Add an in-memory artifact store and fetch route

Create a small artifact registry for diff images:

- module: `src/lib/extract/refine-artifacts.ts`
- route: `src/app/api/extract/refine/artifacts/[artifactId]/route.ts`

Suggested API:

```ts
export interface RefineArtifact {
  contentType: "image/png";
  buffer: Buffer;
  createdAt: number;
}

export function putRefineArtifact(artifact: RefineArtifact): string;
export function getRefineArtifact(id: string): RefineArtifact | null;
export function sweepRefineArtifacts(): void;
```

Design:

- in-memory `Map<string, RefineArtifact>`
- generated opaque IDs
- TTL-based eviction, e.g. 10-30 minutes
- route returns `404` for missing/expired IDs
- no disk persistence in this step

This keeps SSE small and gives the Diff view a normal fetch path.

### 6. Implement a pure refinement orchestrator

Create `src/lib/extract/refine.ts` as the orchestration core.

Recommended exports:

```ts
export interface RefineLoopOptions {
  image: Buffer;
  proposals: Proposal[];
  baseAnalysis: AnalysisResult;
  contentBounds?: { x: number; y: number; w: number; h: number } | null;
  model: string;
  effort: string;
  maxIterations: number;
  mismatchThreshold: number;
  signal?: AbortSignal;
  onEvent?: (event: RefineEvent) => Promise<void> | void;
}

export async function runRefinementLoop(options: RefineLoopOptions): Promise<RefineLoopResult>;
```

Loop per iteration:

1. pick current proposals
2. find slide-scope proposal
3. compile with `compileProposalPreview()`
4. render with `renderSlideToImage()`
5. crop normalized reference and replica to `contentBounds`
6. diff with `compareImages()`
7. annotate diff
8. persist annotated diff artifact and emit `refine:diff`
9. if `mismatchRatio < threshold`, stop
10. build refine prompt
11. call Claude
12. parse patched proposals JSON
13. emit `refine:patch`
14. loop

Important implementation detail:

- check `signal.aborted` before each expensive step and throw an abort-specific error

### 7. Build the refine prompt and parsing helpers

Either add to `src/lib/extract/refine.ts` or split into `src/lib/extract/refine-prompt.ts`.

Prompt requirements:

- compare normalized reference, cropped replica, and annotated diff
- treat `contentBounds` as informational context
- patch only the proposals JSON
- do not rewrite from scratch unless clearly necessary
- preserve the current structure when no visible fix is needed

Parsing requirements:

- extract JSON from Claude response using the same fenced-json fallback style as analyze
- validate that the result is a proposals array
- reject empty/non-array/malformed payloads with a clear refine error

### 8. Add `POST /api/extract/refine`

Create `src/app/api/extract/refine/route.ts`.

Request fields:

- `image: File`
- `proposals: string`
- `baseAnalysis: string`
- `contentBounds?: string`
- `model?: string`
- `effort?: string`
- `maxIterations?: string`
- `mismatchThreshold?: string`

Why send `baseAnalysis`:

- the route can reconstruct `refineAnalysis` deterministically
- prompt/orchestration can inherit `source` and `inventory`
- the client does not need the server to rediscover stage context

SSE events to implement:

- `refine:start`
- `refine:diff`
- `refine:thinking`
- `refine:text`
- `refine:patch`
- `refine:complete`
- `refine:done`
- `refine:error`
- `refine:aborted`

Route behavior:

- parse multipart form
- convert the image to `Buffer`
- parse `proposals`, `baseAnalysis`, `contentBounds`
- call `runRefinementLoop()`
- stream events
- stop early on abort

Keep this route thin. The loop logic should stay in `src/lib/extract/refine.ts`.

## Frontend Plan

### 9. Wire auto-refine and manual refine trigger

Update `AnalyzeForm.tsx`:

- add `Auto-refine` checkbox next to Critique

Update `ExtractCanvas.tsx`:

- after `completeAnalysis(cardId, result)`, check `autoRefine`
- if enabled, immediately start refine using the final analysis stage result
- if disabled, expose a manual refine action from the inspector or card

Refine should start from:

- `card.analysis` when critique is off or critique succeeded
- not from `pass1Analysis`

### 10. Add client-side refine request handling

In `ExtractCanvas.tsx`:

- add `handleRefine(cardId)`
- create an `AbortController` per card
- post `normalizedImage`, current proposals, base analysis, and `contentBounds`
- parse new SSE event types
- update store incrementally

Diff artifact handling:

- on `refine:diff`, fetch `diffArtifactUrl`
- convert response to `blob`
- create `URL.createObjectURL(blob)`
- store that object URL on the card for the Diff view
- revoke previous object URL when replaced/reset/removed to avoid leaks

### 11. Update store actions

Add actions such as:

- `setNormalizedImage(id, file)`
- `setAutoRefine(enabled)`
- `startRefinement(id, options)`
- `updateRefinement(id, payload)`
- `completeRefinement(id)`
- `failRefinement(id, error)`
- `abortRefinement(id)`
- `setDiffObjectUrl(id, objectUrl)`
- `clearRefinement(id)`

Reset/remove behavior:

- `resetAnalysis()` should also clear refine state
- `removeCard()` should revoke any stored `previewUrl` and diff object URL

### 12. Update SlideCard preview modes

In `src/components/extract/SlideCard.tsx`:

- extend preview pill to include `Iter` and `Diff` when refinement has started
- `Iter` renders `refineAnalysis` via the existing `ReplicaPreview`
- `Diff` renders the fetched object URL via `<img>`
- keep Original/Extract/Critique behavior unchanged

Do not render Iter from the server PNG in this step; use refined proposals for consistency with existing preview architecture.

### 13. Update InspectorPanel / TemplateInspector / LogModal

Add refine as a first-class stage:

- stage tabs: `Extract`, `Critique`, `Refine`
- `TemplateInspector` must understand `card.activeStage === "refine"`
- `selectedTemplateIndex` and template tab switching must work for refine
- stage logs should support `refine`
- expose mismatch summary and iteration history in the refine stage panel
- expose manual Refine button when auto-refine is off
- expose Cancel while refine is running

Implementation files:

- `src/components/extract/InspectorPanel.tsx`
- `src/components/extract/TemplateInspector.tsx`
- `src/components/extract/LogModal.tsx`
- related tests

## Suggested Implementation Order

1. Add `source.contentBounds` to prompt/types/normalization and tests.
2. Preserve `normalizedImage` in store during analyze.
3. Generalize `AnalysisStage` and store shape to include `refine`.
4. Implement crop helper, annotation helper, and artifact store.
5. Implement `runRefinementLoop()` with injected event emission and abort support.
6. Add `/api/extract/refine` and artifact route.
7. Wire client-side refine request + SSE parsing + object URL lifecycle.
8. Update `SlideCard`, `TemplateInspector`, and `LogModal`.
9. Add auto-refine/manual refine UI wiring.
10. Run tests and fix stage-related regressions.

## Test Plan

### Unit tests

- `src/lib/extract/normalize-analysis.test.ts`
  - rescales `source.contentBounds`
  - falls back cleanly when absent
- `src/lib/render/annotate.test.ts`
  - returns valid PNG
  - draws region labels/bboxes
- `src/lib/extract/refine-artifacts.test.ts`
  - put/get/expire behavior
- `src/lib/extract/refine.test.ts`
  - loop stops on threshold
  - loop respects max iterations
  - loop aborts cleanly
  - malformed Claude response becomes refine error

### Store/component tests

- `src/components/extract/store.test.ts`
  - refine stage initialization
  - selected template index includes refine
  - reset clears refine state
  - object URLs are cleared on reset/remove
- `src/components/extract/SlideCard.test.tsx`
  - Iter/Diff toggles appear when refinement starts
  - Iter uses refine proposals
  - Diff renders fetched object URL
- `src/components/extract/TemplateInspector.test.tsx`
  - Refine stage tab works
  - mismatch/iteration info appears

### Route/integration tests

Prefer testing `runRefinementLoop()` directly with mocked dependencies rather than building heavy end-to-end route tests.

Add at most one thin route test for:

- invalid multipart inputs return `400`

## Verification

Minimum verification commands after implementation:

```bash
bun run test -- src/lib/extract src/lib/render src/components/extract
bun run lint
```

If Playwright render tests are used, note any environment-specific Chromium limitations rather than broadening scope to debug them in this step.
