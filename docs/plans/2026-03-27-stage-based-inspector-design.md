# Design: Stage-Based Inspector Panel

Date: 2026-03-27
Status: Draft
Context: UI/UX redesign to support multi-stage extraction (Extract + Critique)

## Problem

The inspector panel treats analysis as a single pass. With the critique feature (step 3), there are now two stages (Extract and Critique), each producing its own analysis result, logs, and metadata. The current UI has no way to:
- View pass 1 vs pass 2 results separately
- See per-stage logs, model info, and cost
- Compare Original vs Extract vs Critique replicas on the slide card
- The critique toggle takes up a full row unnecessarily
- Model/time info overflows when critique provenance is shown

## Solution

Reorganize the inspector panel around stage tabs, with per-stage metadata, logs, and template content. Add a 3-value toggle on slide cards for Original/Extract/Critique.

## Layout

### AnalyzeForm (idle state)

Before:
```
[ Opus 4.6 ▼ ] [ High ▼ ]
[☑ Critique  Run a second pass for higher fidelity]
[error message if any]
[     ✨ Analyze     ]
```

After:
```
[ Opus 4.6 ▼ ] [ High ▼ ] [☑ Critique]
[error message if any]
[     ✨ Analyze     ]
```

Critique toggle becomes a compact checkbox (checkbox + "Critique" label only, no helper text) on the same flex row as model/effort dropdowns.

### TemplateInspector (analyzed state)

Before:
```
┌────────────────────────────┐
│ 📋Log  ↻Reset  opus·12s   │  action bar
│ [Template1] [Template2]    │  template tabs
│ ─── scrollable ─────────── │
│ Inventory (collapsible)    │
│ Params & Style             │
│ YAML                       │
└────────────────────────────┘
```

After:
```
┌────────────────────────────┐
│ [Extract] [Critique]   [↻] │  stage tabs + floating reset
│ 📋 Log   opus · 12s · $0.82│  stage-specific meta
│ [Template1] [Template2]    │  template tabs (for active stage)
│ ─── scrollable ─────────── │
│ Inventory (collapsible)    │
│ Params & Style             │
│ YAML                       │
└────────────────────────────┘
```

### SlideCard toggle

Before: `[ Original ] [ Replica ]`

After: `[ Original ] [ Extract ] [ Critique ]`

"Critique" option only appears when critique succeeded (`card.pass2 !== null`).

## Component Details

### Stage tabs row

- Pill-style horizontal tabs, left-aligned
- `[ Extract ]` — always present when analyzed
- `[ Critique ]` — appears when `card.usedCritique && card.pass2 !== null`
- When critique was requested but failed (`usedCritique && !pass2`): show "Critique" tab grayed with a warning icon. **Clickable** — selecting it shows the critique-stage log entries (error/status messages) and a "Critique failed" note in the content area. This ensures failed critique logs are always accessible.
- Active tab: filled background. Inactive: ghost/outline style.
- Reset button: small icon button (RotateCcw), floated to the right end of the tab row. Keeps existing confirmation popover behavior.
- Clicking a stage tab calls `setActiveStage(cardId, stage)`

### Stage-specific meta row

Shows metadata for the currently active stage:
- **Log button** (FileText icon): opens log modal filtered to the active stage's entries
- **Model info**: shortened model name (e.g., "opus-4-6") + effort level
- **Timing**: elapsed seconds for that stage
- **Cost**: dollar amount for that stage
- Text truncates with ellipsis if it overflows — no wrapping

When Extract tab is active: shows pass1 model, effort, time, cost.
When Critique tab is active (succeeded): shows pass2 model, effort, time, cost.
When Critique tab is active (failed): meta row shows only the log button and "Critique failed" text. No model/effort/time/cost (pass2 provenance is null).

### Template tabs + scrollable content

Content changes based on active stage:
- **Extract active**: shows `pass1Analysis.proposals`, inventory from pass 1
- **Critique active (succeeded)**: shows `analysis.proposals` (the final/revised proposals), inventory from pass 2
- **Critique active (failed)**: no template tabs, no inventory, no params/style, no YAML. Shows a failure note ("Critique pass failed — showing extract results") and the critique-stage log entries inline. This is a read-only diagnostic view.

If critique succeeded but produced no changes (pass2 proposals identical to pass1), show a note: "No changes from extract pass."

### Slide card 3-value toggle

- Same pill-toggle style with animated sliding background
- Values: `"original"`, `"extract"`, `"critique"`
- `"critique"` option only rendered when `card.pass2 !== null`
- Extract renders pass 1 proposal via `compileProposalPreview`
- Critique renders pass 2 (final) proposal via `compileProposalPreview`
- Clicking a view mode also switches the inspector's active stage to match (extract click → activeStage: extract, critique click → activeStage: critique)

## Store Changes

### New/modified fields on `SlideCard`

```typescript
// viewMode expands from 2 to 3 values
viewMode: "original" | "extract" | "critique";

// Active inspector stage
activeStage: "extract" | "critique";

// Pass 1 analysis stored separately
pass1Analysis: AnalysisResult | null;

// analysis remains the "final" result (pass2 if critique succeeded, else pass1)
analysis: AnalysisResult | null;

// Per-stage template selection (avoids stale index when switching stages)
selectedTemplateIndex: Record<"extract" | "critique", number>;

// Per-stage timing and cost
pass1Elapsed: number;
pass2Elapsed: number;
pass1Cost: number | null;
pass2Cost: number | null;
```

### Log entry stage tagging

```typescript
export interface LogEntry {
  type: "status" | "thinking" | "text" | "tool" | "tool_result" | "error";
  content: string;
  timestamp: number;
  stage?: "extract" | "critique";  // new
}
```

The route handler includes a `stage` field on every SSE event (`"extract"` or `"critique"`), since it already knows which pass is active. The client-side `appendLog` reads this field directly — no text parsing needed. The log modal filters entries by the active stage.

### New actions

```typescript
setActiveStage: (id: string, stage: "extract" | "critique") => void;
```

### Modified actions

- `selectTemplate`: writes to `selectedTemplateIndex[activeStage]` instead of a flat number. Readers use `selectedTemplateIndex[activeStage]` to get the current index for the visible stage. Each stage has its own independent selection.
- `completeAnalysis`: receives `AnalysisResultPayload` with both pass1 and final analysis. Stores `pass1Analysis` separately. Stores per-stage elapsed/cost from provenance. Resets `selectedTemplateIndex` to `{ extract: 0, critique: 0 }`.
- `startAnalysis`: resets `activeStage` to `"extract"`, resets `viewMode` to `"original"`. This prevents stale critique state when re-running.
- `setViewMode`: when setting to "extract", also sets `activeStage: "extract"`. When setting to "critique", also sets `activeStage: "critique"`. When setting to "original", activeStage unchanged.
- `resetAnalysis`: clears `pass1Analysis`, `pass1Elapsed`, `pass2Elapsed`, `pass1Cost`, `pass2Cost`, resets `activeStage` to "extract", resets `viewMode` to "original", resets `selectedTemplateIndex` to `{ extract: 0, critique: 0 }`.

## Route Handler Changes

The route handler needs to send pass1 analysis separately so the store can keep both. Extend the result SSE event:

```typescript
const pass1Normalized = normalizeAnalysisRegions(pass1Parsed, actualSize);
// ...
send("result", {
  ...analysis,          // final (pass2 if critique, else pass1) — already normalized
  pass1Analysis: critique ? pass1Normalized : null,  // normalized pass 1
  provenance: {
    usedCritique: critique,
    pass1: { model, effort, elapsed: pass1Elapsed, cost: pass1Cost },
    pass2: critiqueSucceeded ? { model, effort, elapsed: pass2Elapsed, cost: pass2Cost } : null,
  },
});
```

Per-stage elapsed and cost are captured from the `result` event of each `runPass` call.

## Backwards Compatibility

- Cards analyzed before this change have `viewMode: "original" | "replica"`. The store migration maps `"replica"` to `"extract"` on load.
- Cards without `pass1Analysis` show only the Extract tab with `analysis` as the data source.
- Cards without `stage` tags on log entries show all entries regardless of active stage filter.

## File Changes

| File | Change |
|------|--------|
| `store.ts` | Add `activeStage`, `pass1Analysis`, `pass1Elapsed`, `pass2Elapsed`, `pass1Cost`, `pass2Cost`, `stage` on LogEntry. Change `viewMode` type. Add `setActiveStage`. Modify `completeAnalysis`, `setViewMode`, `resetAnalysis`. |
| `TemplateInspector.tsx` | New layout: stage tabs row (with reset) → meta row → template tabs → scroll. Stage-aware data selection. |
| `SlideCard.tsx` | 3-value toggle. Render correct proposal per viewMode. Sync activeStage on toggle click. |
| `AnalyzeForm.tsx` | Move critique toggle inline with model/effort row. Remove helper text. |
| `InspectorPanel.tsx` | Minor: pass activeStage if needed for conditional rendering. |
| `ExtractCanvas.tsx` (or SSE consumer) | Pass `stage` field from SSE event data through to `appendLog` when constructing `LogEntry` objects. |
| `route.ts` | Send `pass1Analysis` in result event. Capture per-stage elapsed/cost. Add `stage` field to all SSE events. |
| `types.ts` | Add `AnalysisResultPayload` extending `AnalysisResult` with `pass1Analysis`, `provenance` (including per-stage elapsed/cost). `AnalysisResult` itself stays unchanged — the new type is the SSE transport shape consumed by `completeAnalysis`. |

## Test Plan

### `store.test.ts` (extend)

- **viewMode 3 values**: verify setViewMode accepts "original", "extract", "critique"
- **activeStage sync**: verify setting viewMode to "extract" sets activeStage to "extract"; same for "critique"
- **pass1Analysis stored**: verify completeAnalysis with critique stores pass1Analysis separately
- **resetAnalysis clears stages**: verify all stage fields reset
- **Log stage tagging**: verify appendLog stores stage field from SSE event
- **Per-stage template index**: verify selectTemplate writes to activeStage's index; switching stages restores the correct index
- **startAnalysis resets activeStage**: verify re-running analysis forces activeStage back to "extract"

### `TemplateInspector.test.tsx` (extend)

- **Stage tabs render**: verify Extract tab always shows, Critique tab shows when pass2 exists
- **Stage tab switching**: verify clicking Critique tab changes displayed proposals/inventory
- **Meta row shows correct stage info**: verify pass1 info on Extract, pass2 info on Critique
- **Reset in tab row**: verify reset button renders in stage tabs row

### `SlideCard.test.tsx` (new or extend)

- **3-value toggle**: verify all three options render when critique succeeded
- **2-value toggle**: verify only Original/Extract when no critique
- **Correct proposal per viewMode**: verify extract renders pass1, critique renders final

### `AnalyzeForm.test.tsx` (new or extend)

- **Inline critique toggle**: verify critique checkbox renders on same row as model/effort

## What Does NOT Change

| Component | Why unchanged |
|-----------|---------------|
| `compileProposalPreview` | Still takes proposals, unchanged |
| `LayoutRenderer` | No knowledge of stages |
| `YamlModal` | Shows YAML for selected proposal regardless of stage |
| `normalize-analysis.ts` | Normalization is stage-agnostic |
| `prompts.ts` | No prompt changes |
