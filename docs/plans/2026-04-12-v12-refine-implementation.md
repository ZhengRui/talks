# v12 Refine Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the v11 prior-issue adjudication FSM with append-only iteration history + explicit binary resolution, as specified in `docs/2026-04-12-design-v12-append-only-history.md`.

**Architecture:** Vision always returns `{ resolved, issues }`. Runtime owns iteration history via `IterationRecord[]`. Two post-processing rules (missing=put back, conflict=unresolved wins) replace the six-stage pipeline. Edit receives top 5 issues with signature_visual promotion via history lookup.

**Tech Stack:** TypeScript, Vitest (TDD), existing provider abstraction unchanged.

---

### Task 1: Prompt layer — vision system prompt

**Files:**
- Modify: `src/lib/extract/refine-prompt.ts:44-46` (remove VisionSystemPromptOptions)
- Modify: `src/lib/extract/refine-prompt.ts:62-186` (rewrite buildVisionResponseSchema + buildVisionSystemPrompt)
- Test: `src/lib/extract/refine-prompt.test.ts`

**Step 1: Write the failing tests**

Replace the existing `buildVisionSystemPrompt` tests in `refine-prompt.test.ts`. The new tests should verify:

- `buildVisionSystemPrompt()` takes no parameters (remove `VisionSystemPromptOptions`)
- Returns a prompt containing the `{ "resolved": [...], "issues": [...] }` schema example
- Contains "How to evaluate prior issues" section
- Contains "How to use iteration history" section
- Does NOT contain `priorIssueChecks`, `still_wrong`, `unclear`
- Does NOT switch shape based on any parameter

Run: `bun run test -- src/lib/extract/refine-prompt.test.ts`
Expected: FAIL

**Step 2: Implement**

In `refine-prompt.ts`:
- Delete `VisionSystemPromptOptions` interface (lines 44-46)
- Delete `buildVisionResponseSchema` function (lines 62-111)
- Rewrite `buildVisionSystemPrompt()` to take no parameters. One shape always. Use the system prompt text from the design doc's "Vision Prompt Contract > System prompt" section. Key points:
  - Response schema is `{ "resolved": [...], "issues": [...] }`
  - "How to evaluate prior issues" section (binary: fixed → resolved, still wrong → re-raise, don't skip any)
  - "How to use iteration history" section (designer tolerance, self-consistency, don't hunt old problems)
  - Same analysis rules (unfixable list, directional/structural visuals, no pixel chasing)
  - Remove all `hasPriorIssues` branching, `needsObject`, `optionalFieldInstructions`, `priorIssueRules`

Run: `bun run test -- src/lib/extract/refine-prompt.test.ts`
Expected: PASS

---

### Task 2: Prompt layer — vision user prompt + history formatting

**Files:**
- Modify: `src/lib/extract/refine-prompt.ts:28-33` (VisionPromptContext)
- Modify: `src/lib/extract/refine-prompt.ts:188-219` (buildVisionUserPrompt)
- Add new exports: `formatIterationHistory`, `formatPriorIssuesChecklist`, `IterationRecord`
- Test: `src/lib/extract/refine-prompt.test.ts`

**Step 1: Write the failing tests**

Add new tests for:

- `formatIterationHistory([])` returns `""`
- `formatIterationHistory` with one record: outputs `- Iter 1: found ... ; edited ...`
- `formatIterationHistory` with resolved/unresolved backfill: outputs `→ resolved:` and `→ unresolved:` lines
- `formatIterationHistory` with `editApplied: false`: shows `(edit failed)` suffix
- `formatIterationHistory` with all issues edited: shows `edited all`
- `formatPriorIssuesChecklist([])` returns `""`
- `formatPriorIssuesChecklist` with issues: outputs `Issues from the previous iteration to evaluate:` header + one line per issue
- `buildVisionUserPrompt` includes iteration history section when provided
- `buildVisionUserPrompt` includes prior issues checklist when provided
- `buildVisionUserPrompt` with no history/checklist: no history or checklist sections

Run: `bun run test -- src/lib/extract/refine-prompt.test.ts`
Expected: FAIL

**Step 2: Implement**

- Add `IterationRecord` interface (export it):
  ```typescript
  export interface IterationRecord {
    iteration: number;
    issuesFound: Array<{ issueId: string; category: string; summary: string }>;
    issuesEdited: string[];
    editApplied: boolean;
    issuesResolved: string[];
    issuesUnresolved: string[];
  }
  ```
- Add `formatIterationHistory(records: IterationRecord[]): string` (export it). Follow the design doc format.
- Add `formatPriorIssuesChecklist(issues: Array<{ issueId: string; category: string; issue: string }>): string` (export it).
- Update `VisionPromptContext`:
  - Remove `priorIssuesJson?: string | null`
  - Add `iterationHistory?: string | null` (pre-formatted)
  - Add `priorChecklist?: string | null` (pre-formatted)
- Update `buildVisionUserPrompt`:
  - Remove `priorIssuesSection` (the old JSON-block approach)
  - Add `iterationHistorySection` from `context.iterationHistory`
  - Add `priorChecklistSection` from `context.priorChecklist`
  - Change closing line to: `Compare the ORIGINAL against the REPLICA. Evaluate any prior issues, then list every visible difference.`

Run: `bun run test -- src/lib/extract/refine-prompt.test.ts`
Expected: PASS

---

### Task 3: Prompt layer — edit system prompt update

**Files:**
- Modify: `src/lib/extract/refine-prompt.ts:243` (edit system prompt)
- Test: `src/lib/extract/refine-prompt.test.ts`

**Step 1: Write the failing test**

Update the `buildEditSystemPrompt` test to check for:
- Contains "Fix the listed issues, prioritizing by priority rank" (not "Fix the 3 highest-priority")
- Does NOT contain "sticky"

Run: `bun run test -- src/lib/extract/refine-prompt.test.ts`
Expected: FAIL

**Step 2: Implement**

In `buildEditSystemPrompt()`:
- Change line 243 from `Fix the 3 highest-priority issues from the list, plus any unresolved sticky \`signature_visual\` issues.` to `Fix the listed issues, prioritizing by priority rank.`
- Remove the `sticky` reference on line 246: change `Each issue may include: \`priority\`, \`issueId\`, \`category\`, \`ref\`, \`area\`, \`issue\`, \`fixType\`, \`observed\`, \`desired\`, \`confidence\`, \`sticky\`.` to remove `, \`sticky\``.
- Remove the line about `Treat \`sticky: true\` on a \`signature_visual\` issue as mandatory even if its priority falls below 3.`

Run: `bun run test -- src/lib/extract/refine-prompt.test.ts`
Expected: PASS

---

### Task 4: Runtime types — update VisionIssue, VisionResult, VisionOptions, remove FSM types

**Files:**
- Modify: `src/lib/extract/refine.ts` (types section, lines 93-206)
- Test: `src/lib/extract/refine.test.ts`

**Step 1: Implement type changes**

In `refine.ts`:
- Remove `VisionPriorIssueStatus` type (lines 119-122)
- Remove `VisionPriorIssueCheck` interface (lines 138-142)
- Remove `sticky?: boolean` from `VisionIssue` interface (line 135)
- Remove `VALID_PRIOR_ISSUE_STATUSES` constant (lines 197-201)
- Remove `CORE_VISION_CATEGORIES` constant (lines 202-206)
- Update `VisionResult` interface (lines 144-154):
  ```typescript
  interface VisionResult {
    resolved: string[];
    issues: VisionIssue[];
    issuesJson: string;
    editIssuesJson: string;
    rawText: string;
    cost: number | null;
    elapsed: number;
  }
  ```
  (Remove `priorIssuesJson`, `priorIssueChecks`, `resolvedIssueIds`)
- Update `VisionOptions` interface (lines 93-105):
  - Keep `priorIssues?: VisionIssue[] | null` as full `VisionIssue[]` (NOT a checklist-only shape — Rule 1 needs to re-add full issue objects when the model skips one). The checklist formatting is the prompt layer's job; the runtime keeps the full data.
  - Add `iterationHistory?: string | null` (pre-formatted history text)
  - Add `priorChecklist?: string | null` (pre-formatted checklist text)
- Update `RefineLoopOptions` (lines 53-75):
  - Remove `priorIssuesJson?: string | null`
  - Add `seedHistory?: IterationRecord[]` (import `IterationRecord` from refine-prompt)

This step will cause compilation errors in functions that reference the removed types — that's expected and will be fixed in subsequent tasks.

---

### Task 5: Runtime — postProcessVision + updated selectIssuesForEdit

**Files:**
- Modify: `src/lib/extract/refine.ts`
- Test: `src/lib/extract/refine.test.ts`

**Step 1: Write the failing tests**

Add tests for `postProcessVision`:

- **Rule 1 — missing prior added back:** Given prior `[A, B]`, resolved `[A]`, issues `[C]` → output resolved `[A]`, issues `[B, C]` (B was missing, added back)
- **Rule 2 — conflict, unresolved wins:** Given prior `[A]`, resolved `[A]`, issues `[{issueId: A, ...}]` → output resolved `[]`, issues `[A]` (A removed from resolved)
- **Both rules together:** Given prior `[A, B, C]`, resolved `[A, B]`, issues `[{issueId: B}]` → resolved `[A]`, issues `[B, C]` (B conflicted → unresolved; C missing → added back)
- **No priors (iter 1):** Given prior `[]`, resolved `[]`, issues `[A, B]` → issues `[A, B]` unchanged

Add tests for updated `selectIssuesForEdit`:

- **Top 5 cap:** Given 7 issues → returns 5
- **Signature visual swap-in:** Given 6 issues where #6 is `everSignatureVisual`, swap it in for lowest-priority non-signature in top 5
- **All signature visual:** Given 6 signature_visual issues → returns top 5 (no swap possible)
- **Under 5 issues:** Given 3 issues → returns all 3

Run: `bun run test -- src/lib/extract/refine.test.ts`
Expected: FAIL

**Step 2: Implement**

Export `postProcessVision` from `refine.ts`. Note: `priorIssues` is full `VisionIssue[]` (not a checklist-only shape) so Rule 1 can re-add complete issue objects with all fields intact (`priority`, `area`, `fixType`, `observed`, `desired`, `confidence`).

```typescript
function postProcessVision(
  resolved: string[],
  issues: VisionIssue[],
  priorIssues: VisionIssue[],
): { resolved: string[]; issues: VisionIssue[] } {
  const currentIds = new Set(issues.map(i => i.issueId));

  // Rule 2: conflict → unresolved wins
  const cleanResolved = resolved.filter(id => !currentIds.has(id));
  const cleanResolvedSet = new Set(cleanResolved);

  // Rule 1: missing priors → add back to issues
  const augmentedIssues = [...issues];
  for (const prior of priorIssues) {
    if (!cleanResolvedSet.has(prior.issueId) && !currentIds.has(prior.issueId)) {
      augmentedIssues.push(prior);
    }
  }

  return {
    resolved: cleanResolved,
    issues: sortAndReindexIssues(dedupeIssues(augmentedIssues)),
  };
}
```

Rewrite `selectIssuesForEdit`:

```typescript
function selectIssuesForEdit(
  issues: VisionIssue[],
  everSignatureVisualIds: Set<string>,
): VisionIssue[] {
  const sorted = sortAndReindexIssues(issues);
  const selected: VisionIssue[] = [];
  const seenKeys = new Set<string>();

  const take = (issue: VisionIssue | undefined): void => {
    if (!issue) return;
    const key = issueKey(issue);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    selected.push(issue);
  };

  // Top 5 by priority
  sorted.slice(0, 5).forEach(take);

  // Signature visual swap-in: protect issues that are currently signature_visual
  // OR were ever signature_visual in history. A brand-new signature_visual issue
  // in the current output must not be evicted for an older historical one.
  const isProtected = (issue: VisionIssue): boolean =>
    issue.category === "signature_visual" || everSignatureVisualIds.has(issue.issueId);

  const signatureBelow = sorted
    .slice(5)
    .filter((issue) => isProtected(issue));
  for (const sigIssue of signatureBelow) {
    const swapIndex = [...selected]
      .reverse()
      .findIndex((s) => !isProtected(s));
    if (swapIndex >= 0) {
      const actualIndex = selected.length - 1 - swapIndex;
      selected[actualIndex] = sigIssue;
    }
  }

  return reindexIssues(selected);
}
```

Delete the following functions entirely:
- `coalescePriorIssueChecks` (lines 691-730)
- `applyCategoryCoverage` (lines 732-774)
- `mergeStickySignatureIssues` (lines 776-818)
- `buildPriorIssuesForRecheck` (lines 820-852)
- `normalizePriorIssueStatus` (lines 559-567)
- `normalizePriorIssueChecks` (lines 569-591)
- `normalizeResolvedIssueIds` (lines 540-557)
- `parsePriorIssuesSeedJson` (lines 908-913)

Run: `bun run test -- src/lib/extract/refine.test.ts`
Expected: PASS

---

### Task 6: Runtime — update parseVisionCritique

**Files:**
- Modify: `src/lib/extract/refine.ts:610-689` (parseVisionCritique)
- Test: `src/lib/extract/refine.test.ts`

**Step 1: Write the failing tests**

Add/update tests for `parseVisionCritique`:

- Parses `{ "resolved": ["a"], "issues": [...] }` → returns `{ resolved: ["a"], issues: [...] }`
- Parses bare JSON array `[...]` → returns `{ resolved: [], issues: [...] }` (backward compat)
- Parses object with no `resolved` field → returns `{ resolved: [], issues: [...] }`
- Invalid JSON → returns fallback issues with `resolved: []`

Run: `bun run test -- src/lib/extract/refine.test.ts`
Expected: FAIL

**Step 2: Implement**

Simplify `parseVisionCritique` to return `{ resolved: string[]; issues: VisionIssue[]; }`:

- If parsed is an array → `{ resolved: [], issues: normalized(parsed) }`
- If parsed is an object with `issues` array → `{ resolved: normalizeResolved(object.resolved), issues: normalized(object.issues) }`
- `normalizeResolved`: filter to strings only
- Remove all `priorIssueChecks` parsing, `resolvedIssueIds` parsing, the override logic (lines 673-681)

Run: `bun run test -- src/lib/extract/refine.test.ts`
Expected: PASS

---

### Task 7: Runtime — update runVisionCritique

**Files:**
- Modify: `src/lib/extract/refine.ts:1022-1167` (runVisionCritique)
- Test: `src/lib/extract/refine.test.ts`

**Step 1: Implement**

Rewrite `runVisionCritique`:

- Build system prompt: `buildVisionSystemPrompt()` (no args)
- Build user prompt: `buildVisionUserPrompt({ imageSize, contentBounds, semanticAnchors, iterationHistory: options.iterationHistory, priorChecklist: options.priorChecklist })`
  - `options.priorChecklist` is pre-formatted by the loop (see Task 8)
- After getting the result, parse with `parseVisionCritique` → get `{ resolved, issues }` (raw model output)
- Apply `postProcessVision(resolved, issues, priorIssues ?? [])` → get cleaned `{ resolved, issues }`
- Build `everSignatureVisualIds` from the iteration records (passed via options or computed)
- Call `selectIssuesForEdit(postProcessed.issues, everSignatureVisualIds)`
- Return `VisionResult` with **both** raw and post-processed data. The raw model `resolved`/`issues` are needed by the loop for backfill (to detect which priors the model actually skipped vs. which were added back by Rule 1):
  ```typescript
  return {
    resolved: postProcessed.resolved,
    issues: postProcessed.issues,
    rawResolved: parsed.resolved,      // model's original resolved list
    rawIssueIds: new Set(parsed.issues.map(i => i.issueId)),  // model's original issue ids
    issuesJson: serializeIssues(postProcessed.issues),
    editIssuesJson: serializeIssues(editIssues),
    rawText: result.resultText,
    cost: result.totalCost,
    elapsed: result.elapsed,
  };
  ```
  Update `VisionResult` interface to include `rawResolved: string[]` and `rawIssueIds: Set<string>`.
- Remove all calls to `coalescePriorIssueChecks`, `mergeStickySignatureIssues`, `applyCategoryCoverage`, `buildPriorIssuesForRecheck`
- Update the mock provider path similarly

Run: `bun run test -- src/lib/extract/refine.test.ts`
Expected: PASS

---

### Task 8: Runtime — update runRefinementLoop

**Files:**
- Modify: `src/lib/extract/refine.ts:1293+` (runRefinementLoop)
- Test: `src/lib/extract/refine-provider.test.ts`

**Step 1: Implement**

Rewrite the loop to use `IterationRecord[]`:

- Replace `priorVisionIssues: VisionIssue[]` with `records: IterationRecord[]` and `lastPostProcessedIssues: VisionIssue[]`
- Initialize `records` from `seedHistory` if provided, otherwise `[]`
- Initialize `lastPostProcessedIssues` from `seedLastIssues` if provided, otherwise `[]`. This gives the first resumed vision call a proper prior checklist with full `VisionIssue` data (not lossy reconstruction from summaries).
  ```typescript
  let lastPostProcessedIssues: VisionIssue[] = options.seedLastIssues ?? [];
  ```
  The `RefineLoopOptions` interface needs a new optional field:
  ```typescript
  seedLastIssues?: VisionIssue[];  // full post-processed issues from the last iteration
  ```
  The store persists this alongside `refineIterationRecords` (see Task 9).
- Build `everSignatureVisualIds` from records before each vision call
- Before each vision call:
  - Format history: `formatIterationHistory(records)`
  - Format checklist: `formatPriorIssuesChecklist(lastPostProcessedIssues)`
  - Pass both to `runVisionCritique`
- After vision returns, backfill previous record using the **raw** model output (before Rule 1 adds skipped priors back). This preserves the `→ unresolved` signal in the history — issues the model skipped should show as unresolved, not silently absorbed:
  ```typescript
  if (records.length > 0) {
    const prevRecord = records[records.length - 1];
    const prevIds = new Set(prevRecord.issuesFound.map(i => i.issueId));
    const resolvedIds = new Set(visionResult.rawResolved);
    const rawCurrentIds = visionResult.rawIssueIds;
    prevRecord.issuesResolved = [...prevIds].filter(id => resolvedIds.has(id));
    prevRecord.issuesUnresolved = [...prevIds].filter(id =>
      !resolvedIds.has(id) && !rawCurrentIds.has(id)
    );
  }
  ```
- After edit + render, push new record and update `lastPostProcessedIssues`:
  ```typescript
  records.push({
    iteration: absoluteIteration,
    issuesFound: visionResult.issues.map(i => ({
      issueId: i.issueId, category: i.category, summary: i.issue,
    })),
    issuesEdited: editIssueIds,
    editApplied: editResult.status === "ok" && editResult.proposals !== null,
    issuesResolved: [],
    issuesUnresolved: [],
  });
  lastPostProcessedIssues = visionResult.issues;
  ```
- **Vision-empty path:** When vision returns no issues after post-processing, the loop skips edit and emits `refine:complete`. On this path, explicitly clear `lastPostProcessedIssues` and push an empty record before emitting:
  ```typescript
  if (noIssuesAfterPostProcessing) {
    lastPostProcessedIssues = [];
    records.push({
      iteration: absoluteIteration,
      issuesFound: [],
      issuesEdited: [],
      editApplied: false,
      issuesResolved: [],
      issuesUnresolved: [],
    });
    // emit refine:complete with updated records + empty lastIssues
  }
  ```
  This ensures the client doesn't persist stale `lastIssues` from a previous iteration.
- **Event ordering for continuation state:** Do NOT publish `iterationHistory` or `lastIssues` from `refine:vision:done` — the current iteration's record hasn't been pushed yet, so the client would persist stale state. Instead:
  - `refine:vision:done` event: emit `resolved` and `issuesJson`/`editIssuesJson` (for UI display), but NOT the continuation state.
  - `refine:complete` event (fires after record is pushed, including on vision-empty path): emit `iterationHistory: records` and `lastIssues: lastPostProcessedIssues`. The client persists continuation state from this event.
  - `refine:done` event (loop end): also emit `iterationHistory: records` and `lastIssues: lastPostProcessedIssues` as final state.

Run: `bun run test -- src/lib/extract/refine-provider.test.ts`
Expected: PASS

---

### Task 9: Store + route + ExtractCanvas updates

**Files:**
- Modify: `src/components/extract/store.ts:66` (SlideCard.refinePriorIssuesJson → refineIterationRecords)
- Modify: `src/components/extract/store.ts:136` (setRefinePriorIssuesJson → setRefineIterationRecords)
- Modify: `src/app/api/extract/refine/route.ts:27,86` (priorIssuesJson → seedHistory)
- Modify: `src/components/extract/ExtractCanvas.tsx:255-256,398-405` (request + event handling)
- Test: `src/components/extract/store.test.ts`

**Important:** The existing `refineHistory: RefineIterationResult[]` field on `SlideCard` (line 61) stores per-iteration mismatch/proposal results and is used by `TemplateInspector.tsx` for rendering iteration history in the UI. Do NOT reuse this name. The new field must be named `refineIterationRecords` (or similar) to avoid conflict.

**Step 1: Implement**

In `store.ts`:
- Add `refineIterationRecords: IterationRecord[]` to `SlideCard` (keep existing `refineHistory` for mismatch data)
- Add `refineLastIssues: VisionIssue[]` to `SlideCard` (persisted full issue objects for resume)
- Change `refinePriorIssuesJson: string | null` → remove it entirely
- Add `setRefineIterationRecords` action (sets both `refineIterationRecords` and `refineLastIssues`), remove `setRefinePriorIssuesJson`
- Update all card initializations: add `refineIterationRecords: []`, `refineLastIssues: []`, remove `refinePriorIssuesJson: null`
- Import `IterationRecord` from `@/lib/extract/refine-prompt`
- Export `VisionIssue` type from refine.ts (or define a serializable subset type for the store)

In `route.ts`:
- Remove `priorIssuesJson` from form data parsing (line 27)
- Add `seedHistory` parsing: `const seedHistory = formData.get("seedHistory") ? JSON.parse(formData.get("seedHistory") as string) : undefined`
- Add `seedLastIssues` parsing: `const seedLastIssues = formData.get("seedLastIssues") ? JSON.parse(formData.get("seedLastIssues") as string) : undefined`
- Pass both `seedHistory` and `seedLastIssues` to `runRefinementLoop` instead of `priorIssuesJson` (line 86)

In `ExtractCanvas.tsx`:
- Update the request FormData (lines 255-256): replace `priorIssuesJson` append with `seedHistory` (serialize `card.refineIterationRecords` as JSON) and `seedLastIssues` (serialize `card.refineLastIssues` as JSON)
- Update event handling: move continuation state persistence from `refine:vision:done` to `refine:complete` event handler. Read `data.iterationHistory` (the `IterationRecord[]`) and `data.lastIssues` (the full `VisionIssue[]`) from the `refine:complete` event and call `setRefineIterationRecords(cardId, iterationHistory, lastIssues)`. This ensures the persisted state includes the current iteration's record (which is pushed before `refine:complete` fires).
- Also handle `refine:done` for final state persistence.

**Step 2: Update store tests**

Update `store.test.ts` to reference `refineIterationRecords` instead of `refinePriorIssuesJson`.

Run: `bun run test -- src/components/extract/store.test.ts`
Expected: PASS

---

### Task 10: Update remaining test files

**Files:**
- Modify: `src/lib/extract/refine.test.ts` — update all remaining tests
- Modify: `src/lib/extract/refine-provider.test.ts` — update provider integration tests
- Modify: `src/components/extract/ExtractCanvas.test.tsx` — update `refinePriorIssuesJson` → `refineIterationRecords: [], refineLastIssues: []`, update continuation event assertions to check `iterationHistory` and `lastIssues` from `refine:complete`
- Modify: `src/components/extract/InspectorPanel.test.tsx` — update card fixture: add `refineIterationRecords: [], refineLastIssues: []`, remove `refinePriorIssuesJson`
- Modify: `src/components/extract/TemplateInspector.test.tsx` — update card fixture: add `refineIterationRecords: [], refineLastIssues: []`, remove `refinePriorIssuesJson`
- Modify: `src/components/extract/AnalyzeForm.test.tsx` — update card fixture: add `refineIterationRecords: [], refineLastIssues: []`, remove `refinePriorIssuesJson`

**Step 1: Update test helpers and fixtures**

In `refine.test.ts`:
- Update `createMockVisionResult` helper to return the new `VisionResult` shape (with `resolved`, without `priorIssuesJson`/`priorIssueChecks`/`resolvedIssueIds`)
- Remove tests that exercise `coalescePriorIssueChecks`, `mergeStickySignatureIssues`, `applyCategoryCoverage`, `buildPriorIssuesForRecheck`
- Update the "seeds the first vision prompt with supplied prior issues" test → change to `seedHistory`
- Update the "emits legacy vision result fields" test → check for `resolved` and `iterationHistory` instead of `priorIssueChecks`/`resolvedIssueIds`

In `refine-provider.test.ts`:
- Update provider integration tests to use `seedHistory` instead of `priorIssuesJson`
- Update assertions on vision result events

Run: `bun run test`
Expected: ALL PASS

---

### Task 11: Full test suite + cleanup

**Step 1: Run full test suite**

Run: `bun run test`
Expected: ALL PASS

**Step 2: Run lint**

Run: `bun run lint`
Expected: PASS (fix any unused imports from removed code)

**Step 3: Verify no dead code**

Search for any remaining references to removed concepts:
- `priorIssueChecks` (should only appear in design docs)
- `still_wrong` / `unclear` (should only appear in design docs)
- `coalescePriorIssueChecks` / `mergeStickySignatureIssues` / `applyCategoryCoverage` / `buildPriorIssuesForRecheck` (should be gone)
- `sticky` on VisionIssue (should be gone from runtime, may remain in mock-provider)
- `VALID_PRIOR_ISSUE_STATUSES` / `CORE_VISION_CATEGORIES` (should be gone)
