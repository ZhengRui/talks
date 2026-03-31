# Design: Two-Step Refinement (Vision + Edit)

## Problem

The current single-call refinement sends 3 images + the full proposals JSON to Claude in one prompt. The proposals JSON (often thousands of tokens of nested YAML template code) biases Claude's visual perception: it "sees" what the JSON says should be there instead of what the images actually show. This causes:

- Hallucinated visual details (e.g. claiming a title is left-aligned when it's centered, because the JSON has `textAlign: left`)
- Confirming features that only exist in the replica (e.g. "both versions have left accent borders" when only the replica has them)
- Ignoring obvious visual differences (wrong line patterns, wrong number of decorative elements)
- Spending thinking budget on JSON structure instead of visual comparison

We tried prompt engineering (geometry tables, checklists, analysis phases) but each addition made the problem worse by adding more structured data that competes with visual attention.

## Insight

Claude can accurately perceive visual differences when it sees images without the proposals JSON in context. The JSON creates confirmation bias — the model starts planning its output early and looks for evidence that confirms what's already in the JSON.

## Design

Split each refinement iteration into two sequential API calls:

```
┌─── iteration N ─────────────────────────────────┐
│                                                   │
│  Step 1: VISION (perception)                      │
│  ┌──────────────────────────────────────────────┐ │
│  │ Input:  3 images (side-by-side, original,    │ │
│  │         replica) + short "list differences"  │ │
│  │         prompt                                │ │
│  │ NO proposals JSON                             │ │
│  │ Output: plain text list of differences        │ │
│  │ Model:  configurable (default: same as edit)  │ │
│  └──────────────────────────────────────────────┘ │
│                    │                               │
│                    ▼                               │
│  Step 2: EDIT (JSON patching)                     │
│  ┌──────────────────────────────────────────────┐ │
│  │ Input:  difference list from Step 1 +         │ │
│  │         proposals JSON + contentBounds        │ │
│  │ NO images                                     │ │
│  │ Output: patched proposals JSON                │ │
│  │ Model:  configurable (default: same as vision)│ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
└───────────────────────────────────────────────────┘
```

### Step 1 — Vision Call

**System prompt** — minimal, focused on perception:
- "You are comparing two slide images. Describe every visible difference."
- "Scan top-to-bottom, left-to-right. Do not skip areas."
- Short "things people miss" hint list (decorative patterns, text sizing, containment)
- Unfixable scope (emoji vs SVG, font rendering, compression artifacts)
- No mention of JSON, proposals, or patching

**User prompt:**
- Image size and contentBounds (so it knows what region matters)
- "List every visible difference between the original (Image 2) and replica (Image 3)."

**Images:** Same 3 as today (side-by-side, original full-res, replica full-res).

**Output format:** Numbered plain text list. No JSON. Example:
```
1. The replica has orange left-side accent borders on all cards. The original has no accent borders — cards have subtle all-around borders only.
2. The connector lines in the replica form a complex star/diamond pattern (8 lines with rotations). The original has 4 simple straight lines from hub to each card.
3. The title text in the replica is noticeably larger than the original.
```

### Step 2 — Edit Call

**System prompt** — focused on surgical JSON editing:
- "You are patching a slide template's proposals JSON to fix specific visual issues."
- "A visual comparison has identified the following differences. Fix them."
- Surgical patch rules (don't rewrite, don't restructure, max 3 changes)
- Coordinate system reminder (top-left origin, contentBounds)
- No mention of images or visual comparison

**User prompt:**
- The difference list from Step 1 (verbatim)
- The full proposals JSON
- contentBounds
- "Fix the 3 most impactful differences. Return the full proposals JSON array."

**Images:** None.

**Output:** JSON array of proposals in ```json fences (same as today).

### Model Configuration

**No base pair.** The existing `refineModel`/`refineEffort` are replaced (not supplemented) by two explicit pairs — one per step. There is no inheritance or override semantics. Each step always uses its own explicit model and effort.

**Global settings** (`ExtractState`) — replace `refineModel`/`refineEffort`:

```typescript
// Replace these:
//   refineModel: string;
//   refineEffort: string;
// With these:
refineVisionModel: string;   // initialized to "claude-opus-4-6"
refineVisionEffort: string;  // initialized to "medium"
refineEditModel: string;     // initialized to "claude-opus-4-6"
refineEditEffort: string;    // initialized to "medium"
```

The UI presents two model+effort selectors. Changing one does not affect the other.

**Per-card frozen provenance** — introduce a new `RefineProvenance` type. `StageAnalysisProvenance` stays unchanged (used by pass1):

```typescript
// Unchanged — used by pass1
interface StageAnalysisProvenance extends AnalysisProvenance {
  elapsed?: number;
  cost?: number | null;
}

// New — used only by refinePass (config-only, no runtime state)
interface RefineProvenance {
  visionModel: string;
  visionEffort: string;
  editModel: string;
  editEffort: string;
}
```

The `refinePass` field on `ExtractCard` changes type from `StageAnalysisProvenance` to `RefineProvenance`. Pass1 is completely unaffected.

`currentRefinePass()` snapshots all four fields when a card starts refinement. No optional/nullable step fields — always explicit.

**Loop options** — same explicit-pair pattern:

```typescript
interface RefineLoopOptions {
  // ... existing fields (maxIterations, mismatchThreshold, etc.) ...
  visionModel: string;
  visionEffort: string;
  editModel: string;
  editEffort: string;
}
```

Each step calls `buildQueryOptions` with its own model/effort, so thinking config is always correct for the chosen model.

**UI provenance display** — `TemplateInspector.tsx` renders:
- One line when both steps use the same model+effort: `opus-4-6 · medium`
- Two lines when they differ: `vision: opus-4-6 · medium` / `edit: sonnet-4-6 · high`

### Event Stream

The existing `refine:start` event now carries both model pairs so the client can log them:

```
refine:start           { iteration, maxIterations, mismatchThreshold,
                          visionModel, visionEffort, editModel, editEffort }
```

The client formats this as `"vision: opus-4-6 · medium / edit: sonnet-4-6 · high"` (or a single `"opus-4-6 · medium"` when both match).

New step-level events:

```
refine:vision:start    { iteration }
refine:vision:thinking { text }       // thinking deltas from vision call
refine:vision:text     { text }       // text output streaming from vision call
refine:vision:done     { differences, cost, elapsed }
refine:edit:start      { iteration }
refine:edit:thinking   { text }       // thinking deltas from edit call
refine:edit:text       { text }       // JSON output streaming
refine:edit:done       { cost, elapsed }
```

Existing events (`refine:patch`, `refine:complete`, `refine:diff`) remain unchanged — they fire after the edit step completes, same as today.

### Cost & Elapsed Tracking

`RefineProvenance` is config-only — no runtime state. Elapsed and cost totals continue to live on the card as `refineElapsed`/`refineCost` (updated during refinement as today). Per-step breakdown is available in the SSE event stream (`refine:vision:done` and `refine:edit:done` each report their own cost/elapsed) and visible in the log UI.

### Vision Output Validation

The difference list is a new failure surface. If the vision call returns empty or extremely short output (< 20 characters after trimming), the edit step is skipped and proposals are kept unchanged — same safe fallback as today's "bad model output => keep proposals" guard.

Specifically:
- Empty or too-short → skip edit, keep proposals unchanged
- Non-empty → pass verbatim to edit step (no structural validation — it's free-form text)

**Client-state contract for empty vision:** The iteration is still visible in the UI. The loop emits the full normal event sequence so the client state machine stays consistent:

1. `refine:vision:done` with `{ differences: "", visionEmpty: true }`
2. No render-diff cycle (proposals unchanged, so the replica image is identical) — **no new `refine:diff` event**. The client reuses the previous iteration's diff artifact for this history entry.
3. `refine:patch` with unchanged proposals
4. `refine:complete` with `{ visionEmpty: true, mismatchRatio: <previous> }`

This ensures `ExtractCanvas` seeds `refineResult` and `store` records the iteration in history. The log UI shows "No differences found — skipped edit" for that iteration. The Diff view shows the prior diff since nothing changed.

The edit step's existing JSON parse guards (`no_json`, `invalid_json`, `not_array`) remain unchanged and apply to the edit call's output.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/extract/refine-prompt.ts` | Replace single prompt with `buildVisionSystemPrompt`, `buildVisionUserPrompt`, `buildEditSystemPrompt`, `buildEditUserPrompt`. Remove old `buildRefineSystemPrompt`/`buildRefineUserPrompt`. |
| `src/lib/extract/refine.ts` | Split `callClaudeRefine` into `callClaudeVision` + `callClaudeEdit`. Separate option types per step. Add `visionModel`/`visionEffort`/`editModel`/`editEffort` to `RefineLoopOptions`. Update loop to call vision → edit sequentially. New event types. Vision empty fallback (emit patch with unchanged proposals). |
| `src/lib/extract/refine-prompt.test.ts` | Replace existing tests with vision/edit prompt tests. |
| `src/lib/extract/refine.test.ts` | Update integration tests: mock both calls, verify vision gets no JSON, edit gets no images, difference list flows between them. Test empty vision → unchanged proposals + `visionEmpty` flag. |
| `src/components/extract/types.ts` | Add new `RefineProvenance` type with `visionModel`/`visionEffort`/`editModel`/`editEffort`. `StageAnalysisProvenance` unchanged (used by pass1). |
| `src/components/extract/store.ts` | Replace `refineModel`/`refineEffort` with `refineVisionModel`/`refineVisionEffort`/`refineEditModel`/`refineEditEffort`. Change `refinePass` type from `StageAnalysisProvenance` to `RefineProvenance`. Update `currentRefinePass()` to snapshot four fields. Update all per-card freezing/locking. |
| `src/components/extract/AnalyzeForm.tsx` | Wire step-specific model+effort selectors into settings UI (vision model/effort, edit model/effort). Effort options depend on selected model. |
| `src/app/api/extract/refine/route.ts` | Accept `visionModel`/`visionEffort`/`editModel`/`editEffort` from request body, pass to `runRefinementLoop`. |
| `src/components/extract/ExtractCanvas.tsx` | Handle new `refine:vision:*` and `refine:edit:*` SSE events. Surface vision difference list in the log UI. Pass step-specific model+effort when calling the refine route. Show "No differences found" for `visionEmpty` iterations. |
| `src/components/extract/TemplateInspector.tsx` | When step-specific overrides are present on `refinePass`, render two provenance lines (vision/edit) instead of one. |

## Trade-offs

**Pros:**
- Vision step sees images without JSON bias — should fix hallucination
- Edit step focuses on JSON surgery — no image distraction
- Per-step model selection enables cost optimization (e.g. Sonnet for vision, Opus for editing)
- Difference list is inspectable — easier to debug what the model sees
- Each call is simpler/faster individually

**Cons:**
- 2 API calls per iteration — ~1.5-2x latency per iteration
- Difference list is a lossy bottleneck — if vision misses it, edit can't fix it
- More code to maintain (two prompt builders, two call functions)
- Total token usage may increase slightly (two system prompts, repeated contentBounds)

## Implementation Order

1. Write vision and edit prompt builders + tests (TDD)
2. Write `callClaudeVision` and `callClaudeEdit` functions + tests (including empty vision fallback with full event sequence, no `refine:diff` on empty)
3. Wire into `runRefinementLoop` with explicit `visionModel`/`visionEffort`/`editModel`/`editEffort` (no base pair)
4. Add `RefineProvenance` type in `types.ts`, change `refinePass` from `StageAnalysisProvenance` to `RefineProvenance`
5. Update route to accept/forward all four step-specific fields
6. Update store: replace `refineModel`/`refineEffort` with four step-specific globals, update `currentRefinePass()` and per-card freezing
7. Update `ExtractCanvas.tsx` to handle new SSE events, surface vision difference list in log, handle `visionEmpty` iterations, pass four step fields to route
8. Update `TemplateInspector.tsx` to render one or two provenance lines depending on whether both steps match
9. Update `AnalyzeForm.tsx` with two model+effort selectors (effort options depend on selected model)
10. Test end-to-end with a real slide
