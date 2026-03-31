# Two-Step Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the single-call refinement into a vision step (perception, images only) and an edit step (JSON patching, no images) to eliminate confirmation bias from the proposals JSON.

**Architecture:** Each refinement iteration makes two sequential API calls. `callClaudeVision()` receives 3 images and a short "list differences" prompt — no proposals JSON. It returns a plain text difference list. `callClaudeEdit()` receives the difference list + proposals JSON — no images. It returns patched proposals. The existing `runRefinementLoop()` orchestrates both calls, with `onEvent` callbacks for vision and edit sub-events. Empty vision output skips the edit step and emits unchanged proposals.

**Design doc:** `docs/plans/2026-03-31-two-step-refinement-design.md`

## Locked Decisions

- No base `refineModel`/`refineEffort` pair. Two explicit pairs: vision and edit.
- `RefineProvenance` is a new config-only type (4 fields, no elapsed/cost). `StageAnalysisProvenance` unchanged.
- Empty vision (< 20 chars) → skip edit, emit `refine:patch` with unchanged proposals, emit `refine:complete` with `visionEmpty: true`, no `refine:diff`. Iteration counts toward max.
- `refine:start` carries all four model+effort fields.
- Provenance display: one line when both steps match, two lines when they differ.

## Scope

Explicitly out of scope:
- Changing pass1/extraction provenance
- Changing the render or diff pipeline
- Adding image labeling (burning "ORIGINAL"/"REPLICA" onto images)
- Multi-turn conversation between vision and edit

---

### Task 1: Vision and edit prompt builders

Write the four new prompt builder functions and tests. Remove the old combined prompt.

**Files:**
- Modify: `src/lib/extract/refine-prompt.ts`
- Modify: `src/lib/extract/refine-prompt.test.ts`

**Step 1: Write failing tests for vision prompts**

```ts
// refine-prompt.test.ts
describe("buildVisionSystemPrompt", () => {
  it("instructs visual comparison without mentioning JSON or proposals", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).toContain("visible difference");
    expect(prompt).toContain("original");
    expect(prompt).toContain("replica");
    expect(prompt).not.toContain("JSON");
    expect(prompt).not.toContain("proposals");
    expect(prompt).not.toContain("patch");
  });

  it("lists unfixable items", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).toContain("unfixable");
    expect(prompt).toContain("Emoji");
  });
});

describe("buildVisionUserPrompt", () => {
  it("includes image size and contentBounds but no proposals", () => {
    const prompt = buildVisionUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    });
    expect(prompt).toContain("1920");
    expect(prompt).toContain("contentBounds");
    expect(prompt).not.toContain("proposals");
  });
});
```

**Step 2: Write failing tests for edit prompts**

```ts
describe("buildEditSystemPrompt", () => {
  it("instructs JSON patching without mentioning images", () => {
    const prompt = buildEditSystemPrompt();
    expect(prompt).toContain("proposals");
    expect(prompt).toContain("surgically");
    expect(prompt).not.toContain("image");
    expect(prompt).not.toContain("Image 1");
    expect(prompt).not.toContain("Image 2");
  });
});

describe("buildEditUserPrompt", () => {
  it("includes difference list and proposals JSON", () => {
    const prompt = buildEditUserPrompt({
      differences: "1. Title too large\n2. Wrong border color",
      proposalsJson: '[{"scope":"slide"}]',
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    });
    expect(prompt).toContain("Title too large");
    expect(prompt).toContain('"scope":"slide"');
    expect(prompt).toContain("contentBounds");
  });
});
```

**Step 3: Implement prompt builders**

Replace `refine-prompt.ts` contents:

- `buildVisionSystemPrompt()` — perception-only prompt. Mentions 3 images, scan methodology, unfixable scope, "things people miss" hints. No mention of JSON/proposals/patching.
- `buildVisionUserPrompt({ imageSize, contentBounds })` — image size, contentBounds, "list every visible difference" instruction.
- `buildEditSystemPrompt()` — JSON surgery prompt. Surgical patch rules, coordinate system, max 3 changes. No mention of images.
- `buildEditUserPrompt({ differences, proposalsJson, contentBounds })` — difference list verbatim, proposals JSON, contentBounds, "fix the 3 most impactful" instruction.

Remove `buildRefineSystemPrompt` and `buildRefineUserPrompt`.

**Step 4: Verify all tests green**

---

### Task 2: `callClaudeVision` and `callClaudeEdit` functions

Split `callClaudeRefine` into two functions. Add vision empty fallback.

**Files:**
- Modify: `src/lib/extract/refine.ts`
- Modify: `src/lib/extract/refine.test.ts`

**Step 1: Write failing test — vision call sends images, no JSON**

```ts
it("vision call sends 3 images and no proposals JSON", async () => {
  // Set up mock, call runRefinementLoop with 1 iteration
  // Assert first query() call has 4 content blocks (3 images + text)
  // Assert text does not contain "proposals"
  // Assert system prompt does not contain "JSON"
});
```

**Step 2: Write failing test — edit call sends differences + JSON, no images**

```ts
it("edit call sends difference list and proposals, no images", async () => {
  // Assert second query() call has 1 content block (text only)
  // Assert text contains the difference list from vision output
  // Assert text contains proposals JSON
  // Assert no image content blocks
});
```

**Step 3: Write failing test — empty vision skips edit**

```ts
it("skips edit and keeps proposals when vision returns empty", async () => {
  // Mock vision to return empty/whitespace
  // Assert query() called only once (vision only)
  // Assert proposals unchanged
  // Assert refine:complete emitted with visionEmpty: true
});
```

**Step 4: Implement `callClaudeVision`**

New function signature:
```ts
interface VisionOptions {
  referenceImage: Buffer;
  referenceMediaType: string;
  replicaImage: Buffer;
  imageSize: { w: number; h: number };
  contentBounds?: CropBounds | null;
  model: string;
  effort: string;
  signal?: AbortSignal;
  onEvent?: (event: RefineEvent) => Promise<void> | void;
}

interface VisionResult {
  differences: string;   // plain text
  cost: number | null;
  elapsed: number;
}
```

- Builds vision prompt (no proposals JSON)
- Sends 3 images via `makeVisionPrompt` (reuse existing image assembly)
- Streams `refine:vision:thinking` and `refine:vision:text` events (same streaming pattern as edit step)
- Returns full text output as `differences`
- Mock path: if `isMockClaudeModel(model)`, return a canned difference list that clears the 20-char threshold (e.g. "1. Mock difference: title font is too large compared to original. 2. Background gradient is missing.") and skip the API call

**Step 5: Implement `callClaudeEdit`**

New function signature:
```ts
interface EditOptions {
  differences: string;
  proposals: Proposal[];
  contentBounds?: CropBounds | null;
  model: string;
  effort: string;
  signal?: AbortSignal;
  onEvent?: (event: RefineEvent) => Promise<void> | void;
}

// Returns same ClaudeRefineResult as today
```

- Builds edit prompt (no images)
- Sends text-only user message
- Streams events as `refine:edit:thinking` / `refine:edit:text`
- Parses JSON output (existing guards: no_json, invalid_json, not_array)
- Mock path: if `isMockClaudeModel(model)`, use existing `createMockRefineProposals()` and skip the API call

**Step 6: Implement vision empty validation**

In the loop, after `callClaudeVision` returns:
- If `differences.trim().length < 20` → skip `callClaudeEdit`, emit `refine:patch` with unchanged proposals, emit `refine:complete` with `{ visionEmpty: true }`, skip render-diff. Continue to next iteration.

**Step 7: Verify all tests green**

---

### Task 3: Wire into `runRefinementLoop`

Replace the single `callClaudeRefine` call with vision → edit sequence.

**Files:**
- Modify: `src/lib/extract/refine.ts`

**Step 1: Update `RefineLoopOptions`**

Replace `model`/`effort` with:
```ts
visionModel: string;
visionEffort: string;
editModel: string;
editEffort: string;
```

**Step 2: Update the iteration loop**

Replace:
```ts
const refineResult = await callClaudeRefine({ ... });
```

With:
```ts
// Step 1: Vision
await emit(onEvent, { event: "refine:vision:start", data: { iteration } });
const visionResult = await callClaudeVision({
  referenceImage, referenceMediaType, replicaImage,
  imageSize, contentBounds,
  model: visionModel, effort: visionEffort, signal, onEvent,
});
await emit(onEvent, { event: "refine:vision:done", data: visionResult });

// Empty vision fallback
if (visionResult.differences.trim().length < 20) {
  // emit refine:patch with unchanged proposals
  // emit refine:complete with visionEmpty: true
  // accumulate visionResult.cost into totalCost
  // continue (no render-diff, no refine:diff)
}

// Step 2: Edit
await emit(onEvent, { event: "refine:edit:start", data: { iteration } });
const editResult = await callClaudeEdit({
  differences: visionResult.differences,
  proposals: currentProposals, contentBounds,
  model: editModel, effort: editEffort, signal, onEvent,
});
await emit(onEvent, { event: "refine:edit:done", data: editResult });

// accumulate costs from both steps
```

**Step 3: Update `refine:start` event payload**

Add `visionModel`, `visionEffort`, `editModel`, `editEffort` to the start event data.

**Step 4: Remove old `callClaudeRefine` and combined `makePrompt`**

Split `makePrompt` into `makeVisionPrompt` (with images) and `makeEditPrompt` (text only). Remove the old combined function.

**Step 5: Remove old `buildRefineSystemPrompt` / `buildRefineUserPrompt` imports if not already done**

**Step 6: Run full test suite, verify green**

---

### Task 4: `RefineProvenance` type and store changes

Add the new provenance type, replace `refineModel`/`refineEffort` globals, update per-card freezing.

**Files:**
- Modify: `src/components/extract/types.ts`
- Modify: `src/components/extract/store.ts`
- Modify: `src/components/extract/store.test.ts`

**Step 1: Add `RefineProvenance` to types.ts**

```ts
export interface RefineProvenance {
  visionModel: string;
  visionEffort: string;
  editModel: string;
  editEffort: string;
}
```

**Step 2: Update `ExtractCard.refinePass` type**

Change from `StageAnalysisProvenance | null` to `RefineProvenance | null`.

**Step 3: Update `ExtractState` globals and setter actions**

Replace `refineModel`/`refineEffort` with four fields:
```ts
refineVisionModel: string;   // default "claude-opus-4-6"
refineVisionEffort: string;  // default "medium"
refineEditModel: string;     // default "claude-opus-4-6"
refineEditEffort: string;    // default "medium"
```

Replace `setRefineModel`/`setRefineEffort` actions with:
```ts
setRefineVisionModel: (model: string) => void;
setRefineVisionEffort: (effort: string) => void;
setRefineEditModel: (model: string) => void;
setRefineEditEffort: (effort: string) => void;
```

Also update the per-card setters (`setCardRefineModel`/`setCardRefineEffort` in store.ts ~line 783) — replace with per-card setters for all four fields: `setCardRefineVisionModel`, `setCardRefineVisionEffort`, `setCardRefineEditModel`, `setCardRefineEditEffort`. These must be preserved — the locked-settings path in `AnalyzeForm` uses card-level setters to let users adjust refine settings for one analyzed card without changing global defaults.

**Step 4: Update `currentRefinePass()`**

Snapshot all four fields into `RefineProvenance`.

**Step 5: Update per-card freezing/locking**

All places that read/write `refinePass` now use `RefineProvenance`. Update `startAnalysis`, `continueRefinement`, and any other actions that touch `refinePass`.

**Step 6: Update store tests**

Verify `refinePass` snapshots contain four fields. Update existing test assertions.

**Step 7: Run tests, verify green**

---

### Task 5: Route and client plumbing

Update the refine API route and `ExtractCanvas` to carry four step-specific fields.

**Files:**
- Modify: `src/app/api/extract/refine/route.ts`
- Modify: `src/components/extract/ExtractCanvas.tsx`
- Modify: `src/components/extract/ExtractCanvas.test.tsx`

**Step 1: Update route to parse four fields**

Read `visionModel`, `visionEffort`, `editModel`, `editEffort` from the request body (FormData). Pass to `runRefinementLoop`.

**Step 2: Update `ExtractCanvas` — send four fields in refine request**

When building the FormData for the refine route, read from `card.refinePass` (now `RefineProvenance`) and append all four fields.

**Step 3: Update `ExtractCanvas` — handle new SSE events**

Add handlers for `refine:vision:start`, `refine:vision:thinking`, `refine:vision:text`, `refine:vision:done`, `refine:edit:start`, `refine:edit:thinking`, `refine:edit:text`, `refine:edit:done`. Both vision and edit stream thinking + text to the log.

**Log step separation:** The current store merges adjacent `text`/`thinking` entries by type, but existing `status` entries do not merge. Use that existing log shape instead of inventing a new `separator` type. On `refine:vision:done`, if `visionEmpty !== true`, append a `status` entry such as `Vision complete — starting edit` before the first edit event so the edit stream starts a fresh block. This prevents the store's merge logic from collapsing vision and edit text into one run without requiring `store.ts` or `log-utils.tsx` changes.

Handle `visionEmpty` on `refine:complete` — show `No differences found — skipped edit` and do **not** append the `Vision complete — starting edit` line on that path.

**Step 4: Update `refine:start` log formatting**

Format the start log line with both model pairs (or single line when they match).

**Step 5: Run tests, verify green**

---

### Task 6: Inspector and settings UI

Update provenance display and add step-specific model+effort selectors.

**Files:**
- Modify: `src/components/extract/TemplateInspector.tsx`
- Modify: `src/components/extract/TemplateInspector.test.tsx`
- Modify: `src/components/extract/AnalyzeForm.tsx`
- Modify: `src/components/extract/AnalyzeForm.test.tsx`

**Step 1: Update `TemplateInspector` provenance display**

Read `refinePass` as `RefineProvenance`. When all four fields resolve to the same model+effort, render one line. When they differ, render two lines: `vision: model · effort` / `edit: model · effort`.

**Step 2: Update `AnalyzeForm` — replace single refine model/effort selector**

Replace the single model+effort selector with two pairs:
- Vision: model dropdown + effort dropdown
- Edit: model dropdown + effort dropdown

Effort options depend on the selected model (existing logic in `AnalyzeForm` already handles this for the single selector — replicate for both).

Wire to `refineVisionModel`/`refineVisionEffort`/`refineEditModel`/`refineEditEffort` store actions.

**Step 3: Update tests**

Update inspector and form tests for new field names and two-pair display.

**Step 4: Run full test suite, verify green**

---

### Task 7: End-to-end verification

**Step 1: Run `bun run test` — all tests pass**

**Step 2: Manual test with a real slide**

- Start the dev server
- Open a slide in the extract UI
- Run refinement
- Verify the log shows vision step (difference list) then edit step (JSON output)
- Verify Iter view updates with refined proposals
- Verify inspector shows correct provenance
- Try with different models for vision and edit
- Verify cancel works mid-iteration (both steps)
