# Design: Refinement Loop

> Step 6 of the v11 feedback loop plan (see `docs/2026-03-26-discussion-v11.md`)

## Context

Steps 4 and 5 delivered the render endpoint (`POST /api/render`) and the image diff library (`compareImages()`). This step wires them into an iterative refinement loop: after extraction produces a template, the system renders it, compares the render against the analysis reference image, and feeds the evidence back to Claude for patching — repeating until the replica converges or a max iteration count is reached.

Important contracts for this step:

- Refinement uses the exact normalized image buffer that extraction used, not the raw upload.
- Diffing happens against a masked/cropped slide region so presentation chrome does not contribute mismatch pixels.
- The crop source is a new extracted field, `contentBounds`, which represents the actual slide-content rectangle inside the screenshot. `slideBounds` keeps its existing meaning: the full screenshot bounds.
- Refine is a real third stage alongside Extract and Critique, but refine-only artifacts (diff image, mismatch ratio, iteration history) stay adjacent to the refined stage result instead of being forced into the existing `AnalysisResult` shape.

The extract UI currently has three view modes: Original, Extract, and Critique. This design adds two more — Iter (refined preview) and Diff (annotated heatmap) — without modifying the existing extract/critique views.

## Loop Mechanics

```
Extract completes → proposals available
         |
   [auto-refine (default) or manual trigger]
         |
   ┌─── iteration N ────────────────────────────────┐
   │  1. Compile current stage proposals → LayoutSlide │
   │  2. renderSlideToImage() → replica PNG            │
   │  3. compareImages(maskedReference, replica)       │
   │     → { mismatchRatio, diffImage, regions }       │
   │  4. Annotate diff image with region bboxes        │
   │     and persist as fetchable artifact             │
   │  5. mismatchRatio < threshold? → DONE             │
   │  6. Claude refine call with:                      │
   │     - normalized reference image                  │
   │     - replica image                               │
   │     - annotated diff image                        │
   │     - regions JSON list                           │
   │     - current proposals JSON                      │
   │     → patched proposals                           │
   │  7. Update refine stage + Iter/Diff views         │
   └────────────────────────────────────────────────┘
         | (loop back to step 1, max 3 iterations)
```

### Stopping criteria

- `mismatchRatio < 0.05` (95% pixel match) → converged, stop
- Max 3 iterations reached → stop with best result
- User manually stops via a real request abort path (cancel button + `AbortController`)

### Trigger

- **Default: auto-refine.** After extract completes, the loop starts automatically.
- **Manual option:** An "Auto-refine" checkbox in AnalyzeForm (default: checked). When unchecked, a "Refine" button appears after extract completes.

## UI Changes

### View mode toggles

The toggle bar extends from:

```
Original | Extract | [Critique]
```

To:

```
Original | Extract | [Critique] | [Iter] | [Diff]
```

- `Iter` and `Diff` only appear once refinement has started (at least one iteration).
- `Iter` shows the latest refine-stage proposals rendered locally via `LayoutSlideRenderer`, just like Extract/Critique previews.
- `Diff` shows the annotated diff heatmap fetched from a server artifact URL and displayed as an `<img>`.
- Both update live as each iteration completes.

### Iteration badge

Small counter on the Iter toggle showing the current iteration and mismatch percentage, e.g. `Iter 2/3 · 8.2%`.

### AnalyzeForm

Add an "Auto-refine" checkbox (default: checked). Follows the same pattern as the existing "Critique" checkbox.

### InspectorPanel

Add a "Refine" stage tab alongside Extract and Critique. Refine is a first-class stage for proposal inspection. The tab shows the refined YAML, iteration history, mismatch status, and links to diff artifacts.

## Refine Prompt Inputs

Each iteration sends Claude three images plus structured data:

1. **Original image** — the normalized reference screenshot used for analysis (ground truth for perception)
2. **Replica image** — the rendered template output (so Claude can see what its template actually produced, in the same pixel space as the original)
3. **Annotated diff image** — the red heatmap with region bounding boxes overlaid as labeled rectangles (e.g. cyan outline, label `R1: 47%` at top-left of each bbox). The heatmap is generated from the masked slide region so non-slide chrome does not appear as a mismatch.
4. **Regions JSON list** — structured ground truth: `{ x, y, w, h, mismatchRatio }` for each region. Claude can reference these numbers precisely even if the visual labels are hard to read.
5. **Content bounds** — the slide-content crop box used for diffing
6. **Current proposals JSON** — what Claude needs to patch.
7. **Mismatch ratio** — single overall number as text context.

### Why three images?

- The **original + replica** pair lets Claude compare in real pixel space. Claude is a vision model — it can see "the title font is too large" or "the gradient stops too early" by looking at two images side by side.
- The **annotated diff** is guidance, not the primary signal. It shows *where* things are wrong so Claude doesn't miss subtle differences, but only the actual images show *what* is wrong and *how* to fix it.
- The **regions JSON** provides precision. Claude can look at the annotated diff image and say "R1 is the title area," then check the JSON to confirm the exact coordinates and severity.

### Refine prompt structure

The refine prompt should instruct Claude to:

- Look at the original and replica images to understand the visual delta
- Use the annotated diff and regions to prioritize fixes
- Patch the proposals JSON surgically (do not rewrite from scratch)
- Return only the modified proposals JSON

This is similar to the existing critique prompt but with render-based evidence instead of self-review.

## Diff Image Annotation

The `compareImages()` function returns a raw diff heatmap and a `regions` array. Before sending to Claude, a new annotation step overlays the region bounding boxes onto the heatmap:

- Each region drawn as a bright outline (cyan or similar — visually distinct from the red heatmap pixels)
- Label at the top-left corner of each bbox: `R1: 47%` (region index + mismatch ratio as percentage)
- Annotation is done server-side via `sharp` compositing

This produces a single annotated image that combines the heatmap and the spatial region guidance.

### Diff masking

Before diffing, the server derives a slide-only reference buffer from the normalized analysis image:

- The extract result includes `contentBounds`, a bbox describing the visible slide-content area inside the screenshot
- Crop both the normalized reference image and the rendered replica to `contentBounds` before diffing
- If the screenshot contains presentation chrome outside `contentBounds`, exclude it from the reference buffer
- Run `compareImages()` only on the slide region
- Generate the diff heatmap from that masked/cropped reference buffer

This keeps `mismatchRatio` aligned with actual slide fidelity rather than viewer UI noise.

## State Extensions

New fields on `SlideCard` in the Zustand store:

```ts
// Analysis stages
activeStage: "extract" | "critique" | "refine";
selectedTemplateIndex: Record<"extract" | "critique" | "refine", number>;
viewMode: "original" | "extract" | "critique" | "iter" | "diff";

// Refine stage proposals/source
refineAnalysis: AnalysisResult | null;   // same proposal/source shape used by TemplateInspector

// Refinement state
refineStatus: "idle" | "running" | "done" | "error";
refineIteration: number;              // current iteration (0 = not started)
refineMaxIterations: number;          // default 3
refineMismatchThreshold: number;      // default 0.05
refineAbortControllerId: string | null; // client/server abort coordination token

// Latest iteration result
refineResult: {
  proposals: Proposal[];              // latest refined proposals
  mismatchRatio: number;
  regions: DiffRegion[];
  diffArtifactUrl: string;            // fetchable URL for annotated diff PNG
  replicaArtifactUrl?: string | null; // optional future debug artifact for exact server-scored PNG
} | null;

// Iteration history (all iterations for UI review)
refineHistory: Array<{
  iteration: number;
  mismatchRatio: number;
  proposals: Proposal[];
  regions: DiffRegion[];
  diffArtifactUrl: string;
  replicaArtifactUrl?: string | null;
}>;

// Config
autoRefine: boolean;                  // checkbox state, default true
normalizedImage: File | null;         // exact image buffer used for analyze/refine
contentBounds: { x: number; y: number; w: number; h: number } | null; // extracted visible slide area used for diff crop
```

### Store actions

- `startRefinement(id)` — set refineStatus to "running", initialize iteration state, create abort controller token
- `updateRefinement(id, iterationResult)` — update refineAnalysis/refineResult, push to refineHistory
- `completeRefinement(id)` — set refineStatus to "done"
- `failRefinement(id, error)` — set refineStatus to "error"
- `cancelRefinement(id)` — abort the in-flight request, stop the loop, keep best result

## Server-Side Orchestration

### New endpoints

- `POST /api/extract/refine` — SSE endpoint orchestrating the render → diff → Claude loop
- `GET /api/extract/refine/artifacts/[artifactId]` — serves annotated diff PNGs (and optionally future replica PNG artifacts)

The refine SSE endpoint orchestrates the render → diff → Claude loop server-side. The client posts the normalized analysis image and current proposals, then receives streaming events as each iteration progresses.

**Why a new endpoint instead of extending `/api/extract/analyze`?**

The analyze route handles image analysis (extract + critique). The refine route handles iterative template patching with render feedback. These are different concerns:

- Analyze: image → inventory + proposals (1-2 passes)
- Refine: proposals → render → diff → patch → render → ... (N iterations)

Keeping them separate avoids overloading the analyze route with loop orchestration and makes the refine endpoint independently testable.

**Request:**

```
POST /api/extract/refine
Content-Type: multipart/form-data

Fields:
  image: File                  // normalized reference image used during analyze
  proposals: string            // JSON array of current proposals
  model?: string               // default: claude-opus-4-6
  effort?: string              // default: medium
  maxIterations?: number       // default: 3
  mismatchThreshold?: number   // default: 0.05
```

**SSE events:**

``` 
{ event: "refine:start",     data: { iteration: 1, maxIterations: 3 } }
{ event: "refine:diff",      data: { iteration: 1, mismatchRatio: 0.23,
                                     diffArtifactUrl: "/api/extract/refine/artifacts/...",
                                     regions: [...] } }
{ event: "refine:thinking",  data: { iteration: 1, text: "..." } }
{ event: "refine:text",      data: { iteration: 1, text: "..." } }
{ event: "refine:patch",     data: { iteration: 1, proposals: [...] } }
{ event: "refine:complete",  data: { iteration: 1, mismatchRatio: 0.08 } }
  ... (next iteration)
{ event: "refine:done",      data: { finalIteration: 2, mismatchRatio: 0.04,
                                     converged: true } }
```

Or on failure:

```
{ event: "refine:error",     data: { iteration: 2, error: "..." } }
{ event: "refine:aborted",   data: { iteration: 2 } }
```

The client fetches `diffArtifactUrl`, converts the response to a blob, and uses `URL.createObjectURL(blob)` for the Diff view. This avoids embedding large base64 images in SSE payloads.

### Server-side iteration flow

For each iteration, the refine endpoint:

1. Compiles the current proposals to a `LayoutSlide` via `compileProposalPreview()`
2. Renders the slide to PNG via `renderSlideToImage()` directly on the server
3. Uses extracted `contentBounds` to crop the normalized analysis image and the rendered replica to the visible slide area
4. Compares the cropped render against that cropped reference image via `compareImages()`
5. Checks stopping criteria — if met, emits `refine:done` and ends
6. Annotates the diff image with region bboxes via `sharp` compositing
7. Persists the annotated diff and emits a fetchable artifact URL
8. Calls the Claude API with: normalized reference image, cropped replica image, annotated diff, regions JSON, content bounds, current proposals JSON
9. Parses the patched proposals from Claude's response
10. Emits iteration events, loops back to step 1

### Abort handling

Cancellation must stop real server work, not just flip client state:

- Client creates an `AbortController` for the refine request
- Cancel button calls `abort()`
- The refine route checks `request.signal.aborted` between render/diff/model steps and exits early
- If aborted, emit `refine:aborted` when possible and keep the best completed iteration in store

## File Organization

- `src/app/api/extract/refine/route.ts` — SSE endpoint orchestrating the loop
- `src/app/api/extract/refine/artifacts/[artifactId]/route.ts` — serves diff artifacts by ID
- `src/lib/extract/refine.ts` — refine prompt builder, iteration orchestration logic
- `src/lib/render/annotate.ts` — diff image annotation (overlay region bboxes via sharp)
- Store extensions in `src/components/extract/store.ts`
- UI extensions in `src/components/extract/SlideCard.tsx` and `InspectorPanel.tsx`

## Non-Goals

- Modifying the existing extract or critique stages
- Block extraction during refinement (slide-only, per the v11 discussion)
- Replacing `slide-diff.mjs`
- Persisting iteration history to disk
- Streaming full-size base64 images through SSE
