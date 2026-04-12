# Design v12: Append-Only History + Explicit Resolution for the Refine Loop

This document proposes replacing the v11 prior-issue adjudication FSM with an append-only iteration history and explicit binary resolution. It covers what changes, what stays, the prompt contracts, the runtime data model, and the reasoning behind each decision.

For context on the current (v11) design, see `docs/2026-04-07-design-v11-refine-enhancement.md`.

## Problem with v11

The v11 refine loop works, but the prompt contract is over-complicated:

1. **Two prompt shapes.** The vision prompt returns a JSON array on iteration 1 and a JSON object with `priorIssueChecks` + `issues` on iteration 2+. The model has to follow a different protocol depending on whether priors exist.

2. **Three-way adjudication protocol.** The model must classify every prior issue as `resolved`, `still_wrong`, or `unclear`. This is a structured state machine the model is unreliable at — half the post-processing pipeline exists to fix the model's adjudication mistakes.

3. **Heavy defensive code.** Six post-processing stages (`parseVisionCritique` → `coalescePriorIssueChecks` → `mergeStickySignatureIssues` → `applyCategoryCoverage` → `buildPriorIssuesForRecheck` → `selectIssuesForEdit`) run after every vision call. Most of this code compensates for model outputs that don't conform to the adjudication protocol.

4. **The model fights the runtime.** The runtime overrides the model's adjudication when it detects inconsistencies (e.g., an issue marked `resolved` that also appears in the current issues list). This means the model and runtime disagree about issue state, and the runtime always wins. If the runtime always wins, why ask the model to adjudicate at all?

## Design Principles

1. **Let the model do what it's good at (looking at images) and stop asking it to do what it's bad at (maintaining a state machine).** The model's job is: look at ORIGINAL, look at REPLICA, evaluate prior issues, list what's wrong. The runtime's job is: remember what happened before and present that context.

2. **Explicit resolution over implicit omission.** An issue is only resolved when the model explicitly says so. Silence is not a resolution signal — the model might have missed it, deprioritized it, or renamed it.

3. **One prompt shape always.** The model should not need to understand two different response protocols depending on iteration number.

## What Changes

### Vision output: one shape, explicit resolution

The vision prompt always returns a **JSON object** with two fields:
- `resolved`: an array of issueIds from the prior iteration's checklist that are now fixed
- `issues`: the current issues array (re-raised priors + new issues)

On iteration 1 (no prior issues to evaluate), `resolved` is `[]` and `issues` is the fresh scan. Same shape, no switching.

### Prior issue evaluation: binary yes/no, not three-way

The model is given the unresolved issues from the last iteration as a checklist and asked a simple question for each: is it fixed in the CURRENT REPLICA? Yes → put in `resolved`. No → re-raise in `issues`.

This replaces the v11 `resolved`/`still_wrong`/`unclear` three-way status with a binary decision. The `unclear` state was an escape hatch for model uncertainty — in practice it just created a third code path that the runtime had to handle with confidence clamping and special carry-forward rules.

### Post-processing: two simple rules

The six-stage v11 pipeline is replaced by two post-processing rules:

**Rule 1: Missing = not resolved, put it back.** If a prior issue appears in neither `resolved` nor `issues`, the model skipped it. The runtime adds it back to `issues` using the prior iteration's data. This prevents issues from being silently dropped by a weak vision pass.

**Rule 2: Conflict → unresolved wins.** If an issueId appears in both `resolved` and `issues`, `issues` wins — the issue is removed from `resolved` and stays in `issues`. The model contradicted itself; raising an issue is the more conservative judgment and avoids prematurely dropping a problem that the model itself flagged as still present. The issue also does **not** appear in the history's `→ resolved` line, since resolution was not clean.

### Iteration history: append-only, runtime-owned

The runtime accumulates an `IterationRecord[]` across the loop and formats it as plain text in the user prompt. The model reads it as anti-oscillation context but doesn't write to it.

### Edit budget: top 5, not top 3

The edit step receives up to 5 issues selected by priority, with history-based `signature_visual` promotion within that budget. With 5 slots instead of v11's 3, category diversity happens naturally without runtime reshuffling.

**Reasoning (rebuttal to keeping `applyCategoryCoverage`):** v11's `applyCategoryCoverage` enforces category diversity by demoting the model's priority judgment — e.g., the model ranks three `layout` issues highest because layout is genuinely the biggest problem, but the runtime demotes one to insert a lower-priority `content` issue. With 5 edit slots instead of 3, this is unnecessary. Five slots give enough room for natural diversity. The model sees the images and is better positioned to judge which 5 issues matter most than the runtime, which only sees categories and priorities. If the model returns 5 layout issues, it's probably because layout is the dominant problem.

**Note on edit budget enforcement:** Because Rule 1 can add back skipped prior issues, the post-processed issue list may exceed 5. The edit selector applies an explicit cap: top 5 by priority, with `signature_visual` promotion applied within that capped budget (see Issue Selection for Edit).

### Signature visual promotion: history-based, not sticky-based

v11 uses a cross-iteration `sticky` flag on `VisionIssue` to force recurring `signature_visual` issues into the edit set. This is removed. Instead, `selectIssuesForEdit` promotes any issue whose `issueId` was **ever** categorized as `signature_visual` in the iteration history.

**Reasoning (rebuttal to keeping `sticky`):** The `sticky` flag solves a real problem — the model might temporarily re-categorize an identity issue as `style` or omit it, and it loses guaranteed edit budget. But `sticky` requires cross-iteration mutable state on the issue object, and the runtime has to decide when to set and clear it. The history-based approach achieves the same protection using data we're already accumulating. If `hero-graphic.structure` was ever `signature_visual` in any iteration record, it gets promoted regardless of what the model calls it this time. This is a read-only lookup against immutable history, not a mutable flag.

```typescript
const everSignatureVisualIds = new Set(
  records.flatMap(r => r.issuesFound
    .filter(i => i.category === "signature_visual")
    .map(i => i.issueId))
);
```

## What Stays

- **Issue identity.** Stable `issueId` values (`title.scale`, `hero-graphic.structure`) are still the model's responsibility. `normalizeIssueId` / `inferIssueKind` normalization stays.
- **Vision + edit two-phase structure.** Each iteration is still: vision (what's wrong?) → edit (fix it) → render + diff.
- **Image grounding.** Both vision and edit receive ORIGINAL + REPLICA images.
- **Provider abstraction.** `runProviderTurn` dispatches to Claude Code, OpenAI Codex, or mock. Unchanged.
- **Mismatch threshold.** The pixel diff is still the loop's convergence signal. Unchanged. Mismatch ratio is **not** fed back to the model — it is dominated by background color differences and can be misleading. It stays as the loop's stop condition and a UI metric only.
- **Edit prompt contract.** The edit system/user prompts receive an issue list and proposals, return patched proposals. Changes from v11: the edit step receives up to 5 issues instead of 3, and persistent issues are annotated with `_persistence` metadata + a system prompt rule to try structurally different fixes (see Persistence Escalation).
- **Semantic anchors.** signatureVisuals, mustPreserve, regions from the extract inventory are still injected into the vision user prompt.

## Iteration History: Data Model

```typescript
interface IterationRecord {
  iteration: number;
  issuesFound: Array<{
    issueId: string;
    category: string;
    summary: string;       // the `issue` field from VisionIssue
  }>;
  issuesEdited: string[];  // issueIds sent to the edit step
  editApplied: boolean;    // false if edit parse failed or proposals unchanged
  issuesResolved: string[];  // explicitly resolved by the next iteration's vision
  issuesUnresolved: string[];// in prior found but missing from both resolved and re-raised
}
```

The runtime maintains `IterationRecord[]` across the loop. After each iteration:

1. Vision returns `{ resolved, issues }` → record `issuesFound` from `issues`.
2. `selectIssuesForEdit` picks the edit set → record `issuesEdited`.
3. Edit runs → record `editApplied` (true only if parse succeeded and proposals actually changed).
4. **Backfill the previous record** using the current vision output (see below).

### Backfill logic

After vision returns for iteration N, the runtime categorizes each issue from record N-1:

```typescript
if (records.length > 0) {
  const prevRecord = records[records.length - 1];
  const prevIds = new Set(prevRecord.issuesFound.map(i => i.issueId));
  const currentIds = new Set(visionResult.issues.map(i => i.issueId));
  const resolvedIds = new Set(visionResult.resolved);

  prevRecord.issuesResolved = [...prevIds].filter(id => resolvedIds.has(id));
  prevRecord.issuesUnresolved = [...prevIds].filter(id =>
    !resolvedIds.has(id) && !currentIds.has(id)
  );
}
```

Three possible fates for each prior issue:
- **In `resolved`** → the model explicitly confirmed it's fixed → `issuesResolved`
- **In `issues`** → the model re-raised it → still active (appears in current record's `issuesFound`)
- **In neither** → the model skipped it → `issuesUnresolved` + added back to current `issues` by Rule 1

## Vision Prompt Contract

### System prompt (same shape always)

```
You are visually comparing a slide replica against the original screenshot.

You will receive two images, each labeled:
- ORIGINAL: the unchanging reference screenshot. This is the ground truth.
- REPLICA: the current rendered version we are trying to improve.

## How to analyze

Look at the ORIGINAL carefully — this is the target. Then look at the REPLICA —
this is what we built. Describe what the REPLICA does wrong compared to the
ORIGINAL. Do not rush, do not skip areas. Scan top-to-bottom, left-to-right.

Common things people miss:
- Decorative elements: wrong number of lines, wrong line pattern, wrong visual weight
- Text too small or too large relative to its container
- Fills that should extend beyond borders (or vice versa)
- Elements not centered when they should be
- Wrong font weight, wrong text alignment, wrong colors

**Only these are unfixable** (ignore them entirely):
- Emoji vs line-art/SVG icons
- Font rendering engine differences
- Image compression artifacts

Everything else is fixable. "Hard to implement" is not unfixable.

## How to use iteration history

If iteration history is provided, use it as lightweight context:
- If an issue was edited in the prior iteration and the result is close enough
  that a designer would sign off and move on, treat it as resolved. Do not
  re-raise minor residual imperfections from a recently-fixed issue.
- Be self-consistent: do not mark an issue resolved and also raise it
  in the issues array.
- Issues resolved in older iterations should stay resolved. Only re-raise
  a previously resolved issue if there is an obvious regression — a prior
  fix visibly undone by a later edit. Do not hunt for old problems.
- If an issue has been edited multiple times without being resolved, describe
  the problem more precisely or suggest a different approach rather than
  repeating the same generic wording.
- Focus your attention on genuinely unresolved issues and new problems visible
  in the CURRENT REPLICA.

## How to evaluate prior issues

If a checklist of prior issues is provided, you must account for each one:
- If the issue is fixed in the CURRENT REPLICA (applying designer tolerance —
  close enough counts), include its issueId in the `resolved` array.
- If the issue is still visible, re-raise it in the `issues` array with the
  same issueId. You may update the description if the nature of the problem
  has changed.
- Do not skip any prior issue. Every prior issueId must appear in either
  `resolved` or `issues`.

## Rules

- Return ONLY a JSON object with `resolved` and `issues` fields.
- `resolved` is an array of issueIds from the prior issues checklist that are
  now fixed. Empty array `[]` when there are no prior issues or none are fixed.
- `issues` is a JSON array of current issues (re-raised priors + new issues).
- Focus on the most visually impactful differences. You may return up to
  5 issues total.
- Use this schema exactly:

```json
{
  "resolved": ["title.scale", "card-row.position"],
  "issues": [
    {
      "priority": 1,
      "issueId": "hero-graphic.structure",
      "category": "signature_visual",
      "ref": "hero-graphic",
      "area": "primary graphic group",
      "issue": "structure is wrong",
      "fixType": "structural_change",
      "observed": "Replica uses the wrong arrangement.",
      "desired": "Original uses a different structure.",
      "confidence": 0.92
    }
  ]
}
```

- `priority` must be an integer rank starting at 1.
- `issueId` must identify the specific underlying issue, not just the element.
  Reuse the same `issueId` if the same issue is still visible.
- `category` must be one of: `content`, `signature_visual`, `layout`, `style`.
- `ref` should match an extract inventory id when possible. Use `null` otherwise.
- `fixType` must be one of: `structural_change`, `layout_adjustment`,
  `style_adjustment`, `content_fix`.
- `observed` should describe what the REPLICA currently shows.
- `desired` should describe what the ORIGINAL shows.
- If semantic anchors are provided, treat `signatureVisuals` as top-priority
  identity constraints. If one is still visibly wrong, rank it above local
  text clipping or minor polish.
- For diagrams, decorative systems, repeating structures, and multi-part graphics:
  judge structure, topology, count, and attachment pattern before weight,
  opacity, or color.
- For ordered bands, layered graphics, repeated stripes, directional gradients,
  connector systems, and other directional/structural visuals: distinguish a true
  reversal from a visibility problem.
- Only call something reversed or structurally inverted when that conclusion is
  visually unambiguous. If evidence is mixed, use lower confidence and prefer
  the less destructive diagnosis.
- **Do not chase pixel alignment.** Only fix things visibly wrong at a glance.
- Only the slide content inside contentBounds matters. Ignore presentation chrome.

Return ONLY the JSON object.
```

**Reasoning:**
- One shape always (`{ resolved, issues }`), even on iteration 1 where `resolved` is just `[]`.
- The `resolved` array is a simple list of issueIds — no status/note objects, no three-way classification.
- "How to evaluate prior issues" is a clear binary protocol: fixed → `resolved`, still wrong → `issues`, don't skip any.
- "How to use iteration history" provides anti-oscillation context without requiring the model to maintain state.
- The designer-tolerance rules prevent re-litigating recently-fixed issues while allowing flagging obvious regressions.

### User prompt

```
Image size: {w}x{h}
Visible slide area (contentBounds): ({x}, {y}, {w}x{h})
{boundsMode}
{signatureVisualsSection}
{mustPreserveSection}
{regionsSection}
{iterationHistorySection}
{priorIssuesChecklist}

Compare the ORIGINAL against the REPLICA. Evaluate any prior issues, then list
every visible difference.
```

#### Iteration history section

Empty on iteration 1, grows by one entry per iteration:

```
Iteration history:
- Iter 1: found title-bands.direction (signature_visual), title.scale (style),
          card-row.position (layout), subtitle.color (style), icon-row.gap (layout)
        ; edited all
        → resolved: title.scale, card-row.position, icon-row.gap
        → unresolved: subtitle.color
- Iter 2: found title-bands.direction (signature_visual), subtitle.color (style),
          new-gradient.color (style)
        ; edited all
```

**Format rules:**
- Each iteration is one entry with lines: `found`, `edited`, `→ resolved` (optional), `→ unresolved` (optional).
- `found` lists all issues vision returned, with category in parens.
- `edited` lists the issueIds sent to the edit step, or `all` if all found issues were edited. If edit parse failed, suffix with `(edit failed)`.
- `→ resolved` lists issues explicitly resolved by the next vision call. Omitted for the most recent iteration (not yet known) and when empty.
- `→ unresolved` lists issues that were neither resolved nor re-raised — the model skipped them, so the runtime carried them forward. Omitted when empty.
- No numeric values from previous model outputs. Only issueId, category, and the short `issue` summary.

**Reasoning:**
- The model can see which issues persist across edits (anti-oscillation).
- The model can see which issues were deferred or skipped (so it can re-raise them).
- The model can see which edits succeeded (resolved) vs. failed (still appearing).
- `→ unresolved` signals that the runtime carried an issue forward because a prior vision pass missed it — the model should check it again.
- `(edit failed)` tells the model the proposals weren't actually changed.
- No stale numeric anchoring from previous model guesses.
- Token cost: ~200 tokens per iteration record. At 5 iterations that's ~1K tokens, negligible vs. the ~400K token image pair.

#### Prior issues checklist

Empty on iteration 1. On iteration 2+, lists the unresolved issues from the previous iteration for explicit evaluation:

```
Issues from the previous iteration to evaluate:
- title-bands.direction (signature_visual): bands still reversed
- subtitle.color (style): wrong text color
- new-gradient.color (style): gradient color too warm
```

This is the post-processed issue list from the previous iteration (after Rule 1 backfill). The model must account for each one in either `resolved` or `issues`.

**Reasoning:**
- This is the focused checklist — what the model must evaluate right now.
- The iteration history above gives broader context (what happened across all iterations).
- The two sections serve different purposes: history = anti-oscillation context, checklist = resolution evaluation.

### History formatting function

```typescript
function formatIterationHistory(records: IterationRecord[]): string {
  if (records.length === 0) return "";
  const lines = records.map((r) => {
    const found = r.issuesFound
      .map((i) => `${i.issueId} (${i.category})`)
      .join(", ");
    const allEdited = r.issuesEdited.length === r.issuesFound.length;
    const editedSuffix = r.editApplied ? "" : " (edit failed)";
    const edited = allEdited
      ? `all${editedSuffix}`
      : r.issuesEdited.join(", ") + editedSuffix;
    const resolved = r.issuesResolved.length > 0
      ? `\n        → resolved: ${r.issuesResolved.join(", ")}`
      : "";
    const unresolved = r.issuesUnresolved.length > 0
      ? `\n        → unresolved: ${r.issuesUnresolved.join(", ")}`
      : "";
    return `- Iter ${r.iteration}: found ${found}\n        ; edited ${edited}${resolved}${unresolved}`;
  });
  return `\nIteration history:\n${lines.join("\n")}`;
}

function formatPriorIssuesChecklist(issues: VisionIssue[]): string {
  if (issues.length === 0) return "";
  const lines = issues.map((i) =>
    `- ${i.issueId} (${i.category}): ${i.issue}`
  );
  return `\nIssues from the previous iteration to evaluate:\n${lines.join("\n")}`;
}
```

## Edit Prompt Contract

The edit system prompt and user prompt change from v11 in three ways:
- The edit step receives up to 5 issues instead of 3.
- The edit system prompt instruction changes from "Fix the 3 highest-priority issues" to "Fix the listed issues, prioritizing by priority rank."
- Persistent issues (edited 2+ times without resolution) are annotated with `_persistence` and `_persistenceNote` fields, and the system prompt includes a rule to try structurally different fixes for these issues (see Persistence Escalation).

**Reasoning:** The edit step doesn't need full iteration history. It receives a focused issue list (with per-issue persistence annotations when relevant) and images — that's sufficient context for surgical patching. The persistence annotations are lightweight (~20 tokens per persistent issue) and targeted, avoiding the token cost of full history.

## Issue Selection for Edit

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

**Reasoning (rebuttal to keeping `sticky`):** v11's `sticky` flag solves a real problem — the model might temporarily re-categorize an identity issue as `style` and it loses guaranteed edit budget. But `sticky` requires cross-iteration mutable state on the issue object, and the runtime must decide when to set and clear it.

The history-based approach achieves the same protection using data already being accumulated. If `hero-graphic.structure` was `signature_visual` in any iteration record, it gets promoted regardless of what the model calls it this time. This is a read-only lookup against immutable history, not a mutable flag. It is also strictly stronger than `sticky` — `sticky` could be cleared by the runtime under certain conditions, but "was ever signature_visual in history" is permanent and cannot be lost.

## Category Coverage

The v11 `applyCategoryCoverage` post-processing is **removed**.

**Reasoning (rebuttal to keeping runtime category coverage):** v11's `applyCategoryCoverage` enforced category diversity by demoting the model's priority judgment — e.g., the model ranks three `layout` issues highest because layout is genuinely the biggest problem, but the runtime demotes one to insert a lower-priority `content` issue.

This was necessary with a 3-slot edit budget where one fixation could consume all slots. With 5 edit slots, the problem is significantly reduced. Five slots give enough room for natural diversity — even if the model returns 3 layout issues, there are still 2 slots for other categories.

The model sees the images and is better positioned to judge which issues matter most than the runtime, which only sees categories and priority numbers. If the model returns 5 layout issues, it's probably because layout is genuinely the dominant problem, and the runtime shouldn't override that judgment.

The hard top-5 cap in `selectIssuesForEdit` (applied after Rule 1 backfill) ensures the edit budget is bounded. Within that cap, `signature_visual` promotion swaps in identity issues for the lowest-priority non-signature issue, so the budget is respected while still protecting slide identity.

If diversity remains a problem in practice, it can be addressed as a prompt-level instruction:

```
If multiple issue categories are visibly present, prefer a diverse set
covering different categories when possible.
```

This is a soft nudge that respects the model's priority judgment rather than a hard runtime override.

## Vision Result (simplified)

```typescript
interface VisionResult {
  resolved: string[];              // issueIds explicitly resolved
  issues: VisionIssue[];           // current issues (post Rule 1 & 2)
  issuesJson: string;              // full list (for UI/events)
  editIssuesJson: string;          // for edit step
  rawText: string;
  cost: number | null;
  elapsed: number;
}
```

Removed from v11's `VisionResult`:
- `priorIssuesJson` — the runtime owns the carry-forward via `IterationRecord[]`
- `priorIssueChecks` — replaced by the `resolved` array
- `resolvedIssueIds` — now just `resolved` directly from model output

## VisionIssue (simplified)

```typescript
interface VisionIssue {
  priority: number;
  issueId: string;
  category: VisionIssueCategory;
  ref?: string | null;
  area: string;
  issue: string;
  fixType: VisionIssueFixType;
  observed: string;
  desired: string;
  confidence: number;
}
```

Removed:
- `sticky?: boolean` — replaced by history-based `everSignatureVisualIds` lookup

## Loop Flow

```
runRefinementLoop()
  records: IterationRecord[] = []
  ├─ renderAndDiff(initial proposals)
  ├─ if mismatchRatio < threshold → done
  └─ for iteration in 1..maxIterations:
       ├─ priorIssues = (iteration == 1) ? [] : lastPostProcessedIssues
       ├─ runVisionCritique()
       │    ├─ buildVisionSystemPrompt()                ← always same shape
       │    ├─ buildVisionUserPrompt({                  ← includes history + checklist
       │    │     history: formatIterationHistory(records),
       │    │     priorChecklist: formatPriorIssuesChecklist(priorIssues),
       │    │   })
       │    ├─ stream provider (ORIGINAL + REPLICA + user prompt)
       │    └─ parse { resolved, issues }
       ├─ backfillPreviousRecord(records, visionResult) ← fill resolved/unresolved
       ├─ postProcess(visionResult, priorIssues)        ← Rule 1 + Rule 2
       │    ├─ Rule 1: missing priors → add back to issues
       │    └─ Rule 2: in both resolved & issues → unresolved wins
       ├─ record = { issuesFound, issuesEdited, editApplied,
       │             issuesResolved: [], issuesUnresolved: [] }
       ├─ if no issues after post-processing → emit refine:complete, continue
       ├─ selectIssuesForEdit(issues, everSignatureVisualIds)
       ├─ runProposalEdit()
       │    ├─ buildEditSystemPrompt()                  ← 5-issue budget + persistence rule
       │    ├─ buildEditUserPrompt()                    ← issues list now up to 5
       │    └─ stream provider → parse JSON proposals
       ├─ record.editApplied = (parse succeeded && proposals changed)
       ├─ records.push(record)
       ├─ lastPostProcessedIssues = visionResult.issues ← for next iteration's checklist
       ├─ renderAndDiff(new proposals)
       └─ if mismatchRatio < threshold → done
```

### Post-processing detail

```typescript
function postProcessVision(
  resolved: string[],
  issues: VisionIssue[],
  priorIssues: VisionIssue[],
): { resolved: string[]; issues: VisionIssue[] } {
  const currentIds = new Set(issues.map(i => i.issueId));

  // Rule 2: conflict → unresolved wins. Remove conflicting ids from resolved.
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

## Walkthrough: 3-Iteration Example

### Iteration 1 (cold start)

**Vision input:** ORIGINAL + REPLICA images, no history, no prior checklist.

**Vision output:**
```json
{
  "resolved": [],
  "issues": [
    { "issueId": "title-bands.direction", "category": "signature_visual", "issue": "bands run wrong direction", ... },
    { "issueId": "title.scale", "category": "style", "issue": "title font too large", ... },
    { "issueId": "card-row.position", "category": "layout", "issue": "card row too high", ... },
    { "issueId": "subtitle.color", "category": "style", "issue": "wrong text color", ... },
    { "issueId": "icon-row.gap", "category": "layout", "issue": "icons too close together", ... }
  ]
}
```

**Post-processing:** No priors → Rule 1 and Rule 2 are no-ops. Issues pass through as-is.

**Edit receives** all 5 issues. Edit succeeds.

**Record:**
```
{ iteration: 1, issuesFound: [A,B,C,D,E], issuesEdited: [A,B,C,D,E],
  editApplied: true, issuesResolved: [], issuesUnresolved: [] }
```

`issuesResolved` and `issuesUnresolved` not yet known — backfilled after iter 2's vision.

---

### Iteration 2

**Vision input:** ORIGINAL + new REPLICA + history + prior checklist:

```
Iteration history:
- Iter 1: found title-bands.direction (signature_visual), title.scale (style),
          card-row.position (layout), subtitle.color (style), icon-row.gap (layout)
        ; edited all

Issues from the previous iteration to evaluate:
- title-bands.direction (signature_visual): bands run wrong direction
- title.scale (style): title font too large
- card-row.position (layout): card row too high
- subtitle.color (style): wrong text color
- icon-row.gap (layout): icons too close together
```

**Vision output:**
```json
{
  "resolved": ["title.scale", "card-row.position", "icon-row.gap"],
  "issues": [
    { "issueId": "title-bands.direction", "category": "signature_visual", "issue": "bands still reversed", ... },
    { "issueId": "new-gradient.color", "category": "style", "issue": "gradient color too warm", ... }
  ]
}
```

The model:
- Explicitly resolved `title.scale`, `card-row.position`, `icon-row.gap` ✓
- Re-raised `title-bands.direction` ✓
- **Skipped `subtitle.color`** — not in resolved, not in issues

**Backfill iter 1 record:**
```
issuesResolved: ["title.scale", "card-row.position", "icon-row.gap"]
issuesUnresolved: ["subtitle.color"]
```

**Post-processing:**
- Rule 2: no conflicts (nothing in both resolved and issues)
- Rule 1: `subtitle.color` missing from both → **add it back to issues** using iter 1's data

Final issues: `[title-bands.direction, new-gradient.color, subtitle.color]`

**Edit receives** all 3 (+ `title-bands.direction` promoted via `everSignatureVisualIds`).

**Record:**
```
{ iteration: 2, issuesFound: [title-bands.direction, new-gradient.color, subtitle.color],
  issuesEdited: [title-bands.direction, new-gradient.color, subtitle.color],
  editApplied: true, issuesResolved: [], issuesUnresolved: [] }
```

---

### Iteration 3

**Vision input:** ORIGINAL + newest REPLICA + history + prior checklist:

```
Iteration history:
- Iter 1: found title-bands.direction (signature_visual), title.scale (style),
          card-row.position (layout), subtitle.color (style), icon-row.gap (layout)
        ; edited all
        → resolved: title.scale, card-row.position, icon-row.gap
        → unresolved: subtitle.color
- Iter 2: found title-bands.direction (signature_visual), new-gradient.color (style),
          subtitle.color (style)
        ; edited all

Issues from the previous iteration to evaluate:
- title-bands.direction (signature_visual): bands still reversed
- new-gradient.color (style): gradient color too warm
- subtitle.color (style): wrong text color
```

**Vision output:**
```json
{
  "resolved": ["title-bands.direction", "new-gradient.color"],
  "issues": [
    { "issueId": "subtitle.color", "category": "style", "issue": "subtitle still has wrong color", ... }
  ]
}
```

**Backfill iter 2 record:**
```
issuesResolved: ["title-bands.direction", "new-gradient.color"]
issuesUnresolved: []
```

**Post-processing:** All priors accounted for. No missing, no conflicts.

Final issues: `[subtitle.color]`

Edit receives `[subtitle.color]`. Loop continues.

## What This Removes

| v11 concept | v12 replacement |
|---|---|
| `priorIssueChecks` (3-way adjudication) | `resolved` array (binary yes/no) + 2 post-processing rules |
| `resolved` / `still_wrong` / `unclear` FSM | Binary: in `resolved` or not |
| `coalescePriorIssueChecks()` | Rule 1 (missing → put back) + Rule 2 (conflict → unresolved wins) |
| `mergeStickySignatureIssues()` | `everSignatureVisualIds` lookup against history |
| `applyCategoryCoverage()` | Removed (5 edit slots make it unnecessary) |
| `buildPriorIssuesForRecheck()` | Post-processed issues carry forward directly |
| `sticky` field on VisionIssue | Removed |
| `VisionPriorIssueCheck` type | Removed |
| Two prompt shapes (array/object) | One shape always (`{ resolved, issues }`) |
| ~300 lines of post-processing | ~50 lines (2 rules + top-5 cap + history formatting + backfill) |

## Event Changes

```typescript
// v11
event: "refine:vision:done"
data: {
  issuesJson, editIssuesJson, priorIssuesJson,
  priorIssueChecks, resolvedIssueIds, ...
}

// v12
event: "refine:vision:done"
data: {
  issuesJson, editIssuesJson,
  resolved,                    // issueIds explicitly resolved this iteration
  iterationHistory: records,   // full IterationRecord[] for UI inspection
  ...
}
```

The UI (InspectorPanel, TemplateInspector) will need to adapt from showing `priorIssueChecks` to showing `iterationHistory`. This is a simpler data structure to render — a flat list of iteration summaries with resolved/unresolved markers.

## RefineLoopOptions Changes

```typescript
// v11
interface RefineLoopOptions {
  priorIssuesJson?: string | null;  // seed from a previous session
  // ...
}

// v12
interface RefineLoopOptions {
  seedHistory?: IterationRecord[];  // optional: resume from a previous session
  // ...
}
```

If `seedHistory` is provided, it is used as the initial `records` array. This supports the "continue refinement" use case where a user resumes a paused refine session.

## Migration Path

1. **Prompt changes** (`refine-prompt.ts`): Remove `VisionSystemPromptOptions`, `hasPriorIssues` branching, `buildVisionResponseSchema` switching. Add `formatIterationHistory`, `formatPriorIssuesChecklist`. Single `buildVisionSystemPrompt()` with no parameters. Response schema changes to `{ resolved, issues }`.

2. **Runtime changes** (`refine.ts`): Remove `coalescePriorIssueChecks`, `mergeStickySignatureIssues`, `buildPriorIssuesForRecheck`, `applyCategoryCoverage`, `VisionPriorIssueCheck`, `sticky` field. Add `IterationRecord`, `postProcessVision`, backfill logic. Simplify `parseVisionCritique` (always expects `{ resolved, issues }`). Update `selectIssuesForEdit` (all issues + history-based signature_visual promotion).

3. **Store changes** (`store.ts`): `refinePriorIssuesJson` on `SlideCard` → `refineIterationRecords: IterationRecord[]` + `refineLastIssues: VisionIssue[]` (note: NOT `refineHistory`, which is already used for per-iteration mismatch/proposal results). The "continue refinement" flow passes `seedHistory` and `seedLastIssues` instead of `priorIssuesJson`.

4. **UI changes**: Inspector panels show iteration history records instead of prior issue checks. Simpler to render — flat list of iteration summaries.

5. **Test changes**: Remove all test cases for adjudication logic. Add tests for `postProcessVision` (Rule 1 + Rule 2), `formatIterationHistory`, `formatPriorIssuesChecklist`, and backfill logic.

## Persistence Escalation

### The Problem

When the same issue is raised and edited across multiple iterations without resolution, both the vision and edit models can get stuck in a local minimum:

1. **Vision anchoring:** The iteration history says "background lacks warm glow" three times. The vision model reads that context and is primed to confirm the same diagnosis, even if the gradient IS rendering but is too subtle to notice, or the root cause is different from what was described. History becomes confirmation bias.

2. **Edit anchoring:** The edit model sees the same `style_adjustment` diagnosis and defaults to the same class of fix (e.g., tweaking CSS gradient rgba values by 0.1). Even knowing it's been tried before, it makes another incremental adjustment of the same kind rather than trying a fundamentally different encoding.

Real-world example: `background.gradient` was edited 4 times with progressively stronger `rgba()` gradient values (0.55 → 0.7 → 0.8 → more layers), but the mismatch ratio never changed. The edit model was stuck nudging the same parameter while the vision model kept re-raising the same issue with nearly identical wording.

### Design: Prompt-Only Escalation (Narrow Path)

The runtime computes a **persistence count** per issue from the iteration history and uses it to change prompt wording at graduated thresholds. Escalation is prompt-only — it never authorizes the edit model to skip issues or leave proposals unchanged. The edit model must always attempt a fix.

**Why prompt-only (not behavioral):** An earlier draft allowed the edit model to skip persistent issues ("leave proposals unchanged"). This creates a feedback loop: the skip counts as an edit attempt, which increments persistence, which triggers more skipping. The `IterationRecord` only tracks batch-level `editApplied` and a flat `issuesEdited` list — there is no per-issue edit outcome to distinguish "sent and changed" from "sent and deliberately skipped." Adding per-issue outcomes would require the edit model to report which issues it actually touched, which is hard to extract reliably from a JSON proposal diff. The narrow path avoids this entirely by keeping escalation as wording changes only.

#### Computing persistence count

```typescript
function computePersistenceCounts(records: IterationRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    // Only count iterations where the edit was actually applied.
    // Parse failures (editApplied: false) don't represent real attempts.
    if (!record.editApplied) continue;
    for (const id of record.issuesEdited) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const id of record.issuesResolved) {
      counts.delete(id);
    }
  }
  return counts;
}
```

Key rules:
- Only increment for iterations where `editApplied: true`. Parse failures don't count as real attempts.
- Reset to 0 when resolved. If the issue reappears later (regression), counting starts fresh.

#### Vision escalation (persistence >= 3)

For issues in the prior checklist with persistence >= 3, the checklist format changes from:

```
- background.gradient (signature_visual): missing warm reddish-brown gradient
```

to:

```
- background.gradient (signature_visual): missing warm reddish-brown gradient
  [PERSISTENT — edited 3x without resolution. Before re-raising: reconsider whether
  your diagnosis is accurate. Could the fix be partially working but too subtle?
  Could the root cause be different? If you re-raise, provide a more specific
  diagnosis than previous iterations.]
```

**Reasoning:** The vision model's job is perception — but repeated identical perception that never leads to resolution suggests the perception itself may be wrong. The escalation asks the model to challenge its own framing rather than rubber-stamp the history. This counters the confirmation bias that history context can create.

The prompt guidance in the system prompt's "How to evaluate prior issues" section adds:

```
- If an issue has been edited 3+ times without resolution, your previous
  diagnosis may be inaccurate or too vague for the edit model to act on.
  Before re-raising it, reconsider: is the issue actually what you described?
  Could the fix be working but the effect is too subtle to see? Could the
  root cause be different? If you re-raise, provide a more specific and
  actionable diagnosis.
```

#### Edit escalation (persistence >= 2)

Issues passed to the edit model are annotated with persistence metadata when the count reaches 2+:

```json
{
  "priority": 1,
  "issueId": "background.gradient",
  "category": "signature_visual",
  "issue": "Missing warm reddish-brown gradient",
  "_persistence": 3,
  "_persistenceNote": "Edited 3x without resolution. Previous incremental adjustments are not working."
}
```

The `_persistence` and `_persistenceNote` fields are injected by the runtime before serializing the edit issue list. The vision model never sees them — they only appear in the edit prompt.

The edit system prompt adds a rule for persistent issues:

```
- When an issue has `_persistence >= 2`, previous approaches have failed.
  Do not make another incremental adjustment of the same kind.
  Try a structurally different fix: different CSS approach, different node
  structure, different encoding strategy.
```

**Note:** The edit model is NOT authorized to skip or leave proposals unchanged for persistent issues. It must always attempt a fix. The escalation only changes what kind of fix is expected (structural vs. incremental).

**Reasoning:** The edit model needs a signal to break out of its incremental pattern, but not permission to give up. If it truly cannot find a different approach, it will make another incremental attempt — which is still better than a no-op that would feed back into the persistence counter.

#### Escalation thresholds summary

| Persistence | Vision behavior | Edit behavior |
|---|---|---|
| 0-1 | Normal checklist evaluation | Normal fix |
| 2 | Normal | "Previous approaches failing, try structurally different" |
| 3+ | "Reconsider your diagnosis" | "Try structurally different" (same as 2, stronger wording) |

#### What this does NOT do

- Does not authorize skipping issues. The edit model must always attempt a fix.
- Does not remove the issue from the checklist. Persistent issues still get evaluated — they just get evaluated with more skepticism.
- Does not change the `resolved`/`issues` response schema. The model still uses the same binary output format.
- Does not require new data structures. Persistence count is computed on-the-fly from the existing `IterationRecord[]`.
- Does not feed full iteration history to the edit model. Only a per-issue count and note are injected — ~20 tokens per persistent issue.
- Does not count failed edit iterations (`editApplied: false`). Only successful edits increment persistence.

#### Future: per-issue edit outcomes

If the prompt-only approach proves insufficient — i.e., the edit model still makes the same incremental adjustment despite the "try different" wording — a future enhancement could add per-issue edit outcomes to `IterationRecord`:

```typescript
interface IssueEditOutcome {
  issueId: string;
  changed: boolean;  // whether the edit actually modified the proposal for this issue
}
```

This would enable:
- Accurate persistence counting (only count issues where `changed: true`)
- The "skip" escape hatch (since we could distinguish deliberate skips from real attempts)
- Richer history context ("edited background.gradient 3x with actual changes, 1x skipped")

This is deferred because detecting per-issue changes requires diffing proposals before and after the edit, which adds complexity for uncertain benefit. The prompt-only approach should be tried first.

## Open Questions

- **Should the `issue` summary text be included in the history `found` line?** Currently proposed: only `issueId (category)`. Including the summary gives the model more context about what was found, at the cost of ~10 tokens per issue per iteration. Likely worth it for issues that persist — the model can see the wording used before and refine it.

- **Maximum history length.** At ~200 tokens per record, 5 iterations = ~1K tokens. Even 10 iterations would be ~2K tokens, negligible vs. the image pair. No truncation needed for practical iteration counts. If the loop ever runs 20+ iterations, consider keeping only the last 10 records.

- **Structured output enforcement.** The `{ resolved, issues }` schema can be enforced via structured output / tool_use on providers that support it. This would guarantee the model always returns both fields and accounts for every prior issueId, making Rule 1 (missing = not resolved) a safety net that rarely fires rather than a primary mechanism.
