# Design v11: Refine Loop Enhancement — Image-Grounded, Issue-Tracked

This document describes the current state of the extract refinement loop after the v11 ablation work on branch `ablation/v11-coords_edit-images-structured-issues`. It captures the prompt contracts, the runtime flow, and the issue-tracking model that ties iterations together.

For background on prior iterations, see `docs/2026-03-26-discussion-v11.md` (the original critique that motivated separating perception from encoding).

## Problem

The pre-v11 refine loop had two structural weaknesses:

1. **Vision was untethered.** Each vision pass produced a fresh, unstructured list of "differences" with no memory of what had been called out before. The same misdiagnosis could ping-pong across iterations, and a structural fix could be silently undone in the next pass.
2. **Edit was ungrounded.** The proposal-edit step operated on a JSON issue list and the proposals JSON, but did not see the rendered replica it was supposed to be patching. It was working from a description of a description.

The v11 enhancement addresses both: the edit step now sees the same `ORIGINAL` and `REPLICA` images the vision step does, and every issue is given a stable identifier so it can be tracked, re-checked, and adjudicated across iterations.

## Goal

Make refinement converge faster and stop oscillating, by:

1. Grounding both vision and edit in the literal image evidence.
2. Giving each issue a stable, reusable identifier.
3. Forcing the model to explicitly adjudicate prior issues as `resolved`, `still_wrong`, or `unclear` before proposing a new list.
4. Carrying signature-visual issues forward as "sticky" until they are visibly resolved.
5. Keeping the prompt contract minimal on the first pass (when there is no prior state to carry).

## Non-Goals

- Replacing the vision model with a programmatic differ.
- Eliminating the iteration loop in favor of a single mega-prompt.
- Tracking issue state across distinct refine sessions (priors flow within one loop only).

## Architecture Overview

The refine loop is implemented in `src/lib/extract/refine.ts`. The prompt builders live in `src/lib/extract/refine-prompt.ts`. Both are exercised by the benchmark workbench introduced in the same branch (see `BenchmarkLauncher.tsx` and `src/lib/extract/benchmark.ts`).

```text
runRefinementLoop()
  ├─ renderAndDiff(initial proposals)        ── compileProposalPreview → renderSlideToImage → compareImages
  ├─ if mismatchRatio < threshold → done
  └─ for iteration in 1..maxIterations:
       ├─ runVisionCritique()
       │    ├─ buildVisionSystemPrompt({ hasPriorIssues })
       │    ├─ buildVisionUserPrompt({ image, semanticAnchors, priorIssues })
       │    ├─ stream Claude (ORIGINAL + REPLICA + user prompt)
       │    ├─ parseVisionCritique()         ── extract JSON, normalize issues + priorIssueChecks
       │    ├─ coalescePriorIssueChecks()    ── reconcile model's adjudication with parsed issues
       │    ├─ mergeStickySignatureIssues()  ── carry forward unresolved signature_visual issues
       │    ├─ applyCategoryCoverage()       ── diversify top 3 across content/signature_visual/layout
       │    └─ buildPriorIssuesForRecheck()  ── compute the priors handed to the next iteration
       ├─ if vision returned no issues → emit refine:complete, continue
       ├─ runProposalEdit()
       │    ├─ buildEditSystemPrompt()       ── includes scene reference.md inlined
       │    ├─ buildEditUserPrompt({ images, issuesJson, proposalsJson, geometryHints })
       │    └─ stream Claude (ORIGINAL + REPLICA + user prompt) → parse JSON proposals
       ├─ renderAndDiff(new proposals)
       └─ if mismatchRatio < threshold → done
```

The two key data structures crossing the boundary between iterations are:

- **`VisionIssue[]`** — the canonical issue list, indexed by stable `issueId`.
- **`VisionPriorIssueCheck[]`** — the model's adjudication of issues from the previous iteration, with `status: "resolved" | "still_wrong" | "unclear"`.

## Issue Identity

Every issue is keyed by a stable `issueId` so it can be tracked across iterations. The schema asks the model to compose the id as `<anchor>.<kind>` — for example `title.tricolor-direction`, `badge-pill.border-style`, `hero-graphic.structure`.

If the model omits the id (or provides one we cannot use), `normalizeIssueId()` in `refine.ts:415` synthesizes one from the `ref`/`area` plus a kind inferred from the issue text via `inferIssueKind()`. The kind dictionary covers the visual categories the loop sees in practice: `band-direction`, `content`, `border-style`, `background-style`, `graphic-structure`, `scale`, `position`, etc. This means a model that fixates on the same underlying problem twice will produce the same `issueId` both times, which is the foundation of the whole tracking scheme.

A single `ref` (like `title`) can host multiple simultaneous issue ids — `title.scale` and `title.tricolor-direction` are independent issues that resolve independently. The prompt explicitly tells the model not to mark an entire element resolved because one issue on that element changed.

## Prompt Contracts

### Vision system prompt

Built by `buildVisionSystemPrompt({ hasPriorIssues })` in `refine-prompt.ts:113`. The prompt has two shapes that depend on whether there are prior issues to adjudicate:

**First pass (`hasPriorIssues: false`)** — issues-only schema. The model returns a JSON array of `VisionIssue` objects. No `priorIssueChecks` field is requested. This keeps the cold-start prompt as simple as possible.

**Subsequent passes (`hasPriorIssues: true`)** — object schema with both `priorIssueChecks` and `issues`. The model is required to adjudicate every supplied prior issue before producing the new list.

Both shapes share the same hard rules about how to look at the images:

- The model is told it will receive two labeled images: `ORIGINAL` (ground truth) and `REPLICA` (the thing we are fixing).
- Scan top-to-bottom, left-to-right. Common misses are enumerated explicitly (decorative line counts, fills extending beyond borders, font weight, alignment).
- An "unfixable" allowlist is enumerated and *closed*: only emoji vs SVG icons, font rendering, and image compression artifacts may be ignored. Everything else is fixable; "hard to implement" does not count as unfixable.
- Return at most 5 issues, focused on the top 3 most visually impactful.
- `category` must be one of `content | signature_visual | layout | style`.
- `fixType` must be one of `structural_change | layout_adjustment | style_adjustment | content_fix`.
- `ref` should map to an extract inventory id when possible, or `null`.
- `confidence` is a 0–1 number that communicates how certain the model is. The current runtime does **not** use it for primary ranking or deduping; today it mainly matters when carrying `unclear` prior issues forward with confidence clamped down.
- Diversify the top 3 across categories — `content`, `signature_visual`, `layout` before second-order duplicates.
- For directional/structural visuals (tricolor bands, gradients, connectors): distinguish a *true reversal* from a *visibility problem*. If the structure is roughly present but one side dominates, report it as proportions/clipping/contrast rather than claiming the direction is inverted. This rule exists because the pre-v11 loop was prone to flipping a correctly-encoded gradient back and forth.
- Do not chase pixel alignment. Only fix what is visibly wrong at a glance.
- Only the slide content inside `contentBounds` matters; ignore presentation chrome.

When prior issues are present, additional rules apply:

- Each prior issue must appear once in `priorIssueChecks`.
- `status: "resolved"` requires that the exact prior issue *now clearly matches* in the current replica.
- `status: "still_wrong"` requires that the exact prior issue is *still visibly present*.
- `status: "unclear"` is the explicit escape hatch for ambiguous evidence — the prompt forbids forcing a binary decision when the image does not support one.
- Prior issues are framed as *hypotheses to re-check*, not as truth. The current replica wins.
- The model is forbidden from silently downgrading a prior structural `signature_visual` issue to a style issue unless the structure now clearly matches.

### Vision user prompt

Built by `buildVisionUserPrompt(context)` in `refine-prompt.ts:188`. It assembles:

- `Image size: WxH`
- `Visible slide area (contentBounds): (x, y, WxH)` plus an instruction to ignore non-slide chrome (or "the full image is slide content" when bounds are absent).
- **Signature visuals** from the extract inventory, prefixed with their importance level. These are the slide's identity constraints.
- **Must-preserve content** from the extract inventory.
- **Important regions** from the extract inventory.
- **Prior issues to re-check** as a fenced JSON block, plus the explicit instruction to classify each one in `priorIssueChecks` and to keep the same `issueId` when the same issue is still visible.

The user prompt closes with: *"Compare the ORIGINAL against the REPLICA and list every visible difference."*

### Edit system prompt

Built by `buildEditSystemPrompt()` in `refine-prompt.ts:222`. The prompt now opens by telling the model it will receive two images (`ORIGINAL` and `REPLICA`) plus the structured issue list, the current proposals JSON, and `contentBounds`. The full scene authoring reference (`.claude/skills/replicate-slides/reference.md`) is inlined into the system prompt at module load time so the model has the complete scene YAML grammar available without a tool call.

Hard rules:

- Fix the 3 highest-priority issues plus any `signature_visual` issues marked `sticky: true`. Sticky overrides priority.
- The `ORIGINAL` and `REPLICA` images are the source of truth. The structured issue list is *guidance*, not a literal patch recipe.
- **Image-space vs proposal-space are separate** and must not be mixed. `contentBounds` is in image pixels and only describes the visible slide area in the images. The proposals may live in a different authored coordinate space; preserve it.
- Patch *surgically*. Do not rewrite, restructure, rename, or reorganize proposals.
- For `fixType: structural_change`, the model may replace the minimal subsection required to fix the issue.
- **High-reversal edit guard.** Before flipping direction/order/topology or undoing a previous structural fix, verify that the current proposal does not already encode the desired structure. If it already does, do not blindly reverse it again. Prefer lower-level fixes (proportions, clip bounds, band heights, opacity, contrast, color strength) before another structural reversal. This rule is the edit-side complement to the vision-side anti-flipping rule, and exists to break the same oscillation pattern.
- Do not invent a new coordinate system or hidden scaling factor.
- If geometry ground truth is provided in the user prompt, treat those rectangles as exact and patch toward them rather than re-guessing.
- The template body uses Nunjucks; do not use `| min`, `| max`, `| abs`, `| round` filters — they are not available. Use pre-computed numeric values.
- If the issue list is weak or unhelpful, keep proposals unchanged.
- Coordinate origin is top-left, x right, y down.

The model returns a JSON array of proposals wrapped in ```` ```json ```` fences.

### Edit user prompt

Built by `buildEditUserPrompt(context)` in `refine-prompt.ts:269`. It assembles:

- A line that explicitly tells the model the two labeled images precede this prompt.
- **Image context**: image size, visible slide area in image pixels (with the chrome-vs-content note), or "full image is slide content" when bounds are absent.
- **Proposal context**: the proposal-space dimensions if known, plus the explicit instruction to preserve the proposal-space coordinate system rather than rescaling to match the image dimensions.
- **Geometry ground truth** (optional): when `geometryHints` are provided by the benchmark workbench, they are inlined as a fenced JSON block of element rectangles from the framework's actual rendered layout. The prompt explains that these are exact and should be reused instead of re-estimating positions from the image. See `src/lib/extract/geometry-hints.ts`.
- **Structured issues**: the issue JSON selected by `selectIssuesForEdit()` (top 3 plus sticky signature_visual).
- **Current proposals**: the full proposals JSON.

The prompt closes with: *"Fix the listed issues. Return the full proposals JSON array."*

## Message Structure

The two phases share the same wire shape: a `system` prompt plus a single `user` message whose `content` array interleaves text and base64 images. The exact assembly happens in `makeVisionPrompt` and `makeComparisonEditPrompt` (`refine.ts:977` and `refine.ts:1016`).

### Vision phase — request

```text
┌─ Claude query (vision) ─────────────────────────────────────────────┐
│                                                                     │
│  system : buildVisionSystemPrompt({ hasPriorIssues })               │
│           ├─ How to analyze (scan order, common misses)             │
│           ├─ Closed unfixable allowlist                             │
│           ├─ Response schema  (array  if !hasPriorIssues)           │
│           │                   (object if  hasPriorIssues)           │
│           ├─ Field rules (priority, issueId, category, fixType…)    │
│           ├─ Anti-flip rule for directional/structural visuals      │
│           └─ Prior-issue adjudication rules (only if hasPriorIssues)│
│                                                                     │
│  user.content[]                                                     │
│   ┌───┬──────────────────────────────────────────────────────────┐  │
│   │ 0 │ text  : "ORIGINAL slide:"                                │  │
│   │ 1 │ image : <reference screenshot, base64>                   │  │
│   │ 2 │ text  : "REPLICA slide:"                                 │  │
│   │ 3 │ image : <rendered replica, base64>                       │  │
│   │ 4 │ text  : buildVisionUserPrompt(...)                       │  │
│   │   │         ├─ Image size: WxH                               │  │
│   │   │         ├─ Visible slide area (contentBounds)            │  │
│   │   │         ├─ signatureVisuals (from extract inventory)     │  │
│   │   │         ├─ mustPreserve     (from extract inventory)     │  │
│   │   │         ├─ regions          (from extract inventory)     │  │
│   │   │         ├─ priorIssuesJson  (only if priors exist)       │  │
│   │   │         └─ "Compare ORIGINAL against REPLICA…"           │  │
│   └───┴──────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Vision phase — response

The two response shapes are switched by `hasPriorIssues`:

```text
hasPriorIssues = false                hasPriorIssues = true
──────────────────────                ─────────────────────
[                                     {
  {                                     "priorIssueChecks": [
    "priority": 1,                        {
    "issueId": "...",                       "issueId": "...",
    "category": "...",                      "status": "resolved"
    "ref": "...",                                  | "still_wrong"
    "area": "...",                                 | "unclear",
    "issue": "...",                         "note": "..."
    "fixType": "...",                     }
    "observed": "...",                  ],
    "desired": "...",                   "issues": [
    "confidence": 0.92                    { …same shape as ← }
  },                                    ]
  …                                   }
]
```

### Vision post-processing pipeline

`runVisionCritique` does not hand the model's raw output to the edit step. It runs the response through a six-stage pipeline before producing the three derived JSON blobs the rest of the loop consumes.

```text
streamClaudeText → resultText
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│ parseVisionCritique                                       │
│   • extractJsonPayload (fenced or bare)                   │
│   • JSON.parse                                            │
│   • normalizeVisionIssue × N      (synthesize issueId,    │
│                                    infer category, etc.) │
│   • normalizePriorIssueChecks                             │
│   • override: if id ∈ issues ∧ status=resolved            │
│               → status := still_wrong                     │
└───────────────────────────────┬───────────────────────────┘
                                ▼
┌───────────────────────────────────────────────────────────┐
│ coalescePriorIssueChecks                                  │
│   For each priorIssue, fill in a check if missing:        │
│     • id ∈ currentIssues          → still_wrong           │
│     • id ∈ resolvedIssueIds(legacy)→ resolved             │
│     • else                         → unclear              │
└───────────────────────────────┬───────────────────────────┘
                                ▼
┌───────────────────────────────────────────────────────────┐
│ mergeStickySignatureIssues                                │
│   Carry forward unresolved signature_visual priors        │
│   as sticky entries (upgrade existing or append).         │
└───────────────────────────────┬───────────────────────────┘
                                ▼
┌───────────────────────────────────────────────────────────┐
│ applyCategoryCoverage                                     │
│   Reorder so the top 3 cover                              │
│   {signature_visual, content, layout} when possible.      │
│   → produces rankedIssues                                 │
└──────┬──────────────────┬──────────────────────┬──────────┘
       │                  │                      │
       │                  ▼                      ▼
       │       ┌──────────────────────┐  ┌────────────────────┐
       │       │ selectIssuesForEdit  │  │ buildPriorIssues   │
       │       │   top 3 + sticky     │  │   ForRecheck       │
       │       │   signature_visual   │  │ • carry current    │
       │       │                      │  │ • carry still_wrong│
       │       │                      │  │   / unclear priors │
       │       │                      │  │ • drop resolved    │
       │       │                      │  │ • clamp conf ≤ 0.5 │
       │       │                      │  │   for unclear      │
       │       └──────────┬───────────┘  └─────────┬──────────┘
       ▼                  ▼                        ▼
 ┌──────────────┐  ┌──────────────────┐   ┌─────────────────┐
 │ issuesJson   │  │ editIssuesJson   │   │ priorIssuesJson │
 │ full ranked  │  │ top 3 + sticky   │   │ → next vision   │
 │ → UI/events  │  │ → edit phase     │   │   iteration     │
 └──────────────┘  └──────────────────┘   └─────────────────┘
```

`rankedIssues` fans out three ways: it is serialized directly as `issuesJson` for UI/event consumers, passed through `selectIssuesForEdit` to produce the trimmed `editIssuesJson` the edit phase actually receives, and combined with the parsed `priorIssueChecks` by `buildPriorIssuesForRecheck` to produce the priors carried into the next vision call. The three derived JSON blobs are independent — the edit step never sees the recheck list, and the next vision call never sees `editIssuesJson`.

### Edit phase — request

```text
┌─ Claude query (edit) ───────────────────────────────────────────────┐
│                                                                     │
│  system : buildEditSystemPrompt()                                   │
│           ├─ Image labels (ORIGINAL / REPLICA)                      │
│           ├─ <reference> reference.md inlined verbatim </reference> │
│           ├─ Surgical patching rules (no rewrite/restructure)       │
│           ├─ High-reversal guard                                    │
│           ├─ Image-space vs proposal-space separation               │
│           └─ Nunjucks filter restrictions                           │
│                                                                     │
│  user.content[]                                                     │
│   ┌───┬──────────────────────────────────────────────────────────┐  │
│   │ 0 │ text  : "ORIGINAL slide:"                                │  │
│   │ 1 │ image : <reference screenshot, base64>                   │  │
│   │ 2 │ text  : "REPLICA slide:"                                 │  │
│   │ 3 │ image : <rendered replica, base64>                       │  │
│   │ 4 │ text  : buildEditUserPrompt(...)                         │  │
│   │   │         ├─ Image context: size, contentBounds, chrome    │  │
│   │   │         ├─ Proposal context: proposal-space dims         │  │
│   │   │         ├─ Geometry ground truth (optional)              │  │
│   │   │         │    └─ exact element rects from layout          │  │
│   │   │         ├─ issuesJson (top 3 + sticky)                   │  │
│   │   │         ├─ proposalsJson (full current state)            │  │
│   │   │         └─ "Fix the listed issues. Return…"              │  │
│   └───┴──────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Edit phase — response

The model returns a fenced JSON array of proposals:

```json
[
  {
    "scope": "slide",
    "region": { "x": 0, "y": 0, "w": 1920, "h": 1080 },
    "body":  "… patched scene yaml …"
  }
]
```

The loop then runs the response through a small parse pipeline:

```text
resultText
    │
    ▼
┌─────────────────────────────────────────────────┐
│ extractJsonPayload → JSON.parse → Array.isArray │
│                                                 │
│ status ∈ { ok | no_json | invalid_json          │
│                            | not_array }        │
└────────────────────┬────────────────────────────┘
                     ▼
       on "ok":  currentProposals := parsed
                 → renderAndDiff
                 → next iteration
       else:    keep previous proposals,
                still re-render+diff to record state
```

### Iteration handoff

Three things flow from iteration N into iteration N+1: the **freshly-rendered `replicaImage`**, the **`priorIssuesForRecheck`** list, and the **patched proposals**. The `referenceImage` is the same in every iteration — it is the original user screenshot and never changes.

```text
       Iteration N                              Iteration N+1
       ───────────                              ─────────────

  ┌────────────────┐                       ┌────────────────────┐
  │   Vision N     │                       │    Vision N+1      │
  │                │                       │                    │
  │ inputs:        │                       │ inputs:            │
  │  • refImage    │                       │  • refImage        │ ◄── unchanged
  │  • replicaN-1  │                       │  • replicaN        │ ◄── new
  │  • priorsN-1   │                       │  • priorsN         │ ◄── new
  └────────┬───────┘                       └─────────┬──────────┘
           │                                         ▲
           │ rankedIssues                            │
           ▼                                         │
   ┌─────────────┐ ┌──────────────────┐              │
   │selectIssues │ │buildPriorIssues  │              │
   │  ForEdit    │ │  ForRecheck      │──────────────┼──┐
   └──────┬──────┘ └──────────────────┘   priorsN    │  │
          │ editIssuesJson                           │  │
          ▼                                          │  │
  ┌────────────────┐                                 │  │
  │   Edit  N      │                                 │  │
  │ inputs:        │                                 │  │
  │  • refImage    │                                 │  │
  │  • replicaN-1  │                                 │  │
  │  • editIssues  │                                 │  │
  │  • proposalsN-1│                                 │  │
  │ → proposalsN   │                                 │  │
  └────────┬───────┘                                 │  │
           │ proposalsN                              │  │
           ▼                                         │  │
  ┌────────────────┐                                 │  │
  │ render + diff  │                                 │  │
  │ compileProposal│                                 │  │
  │ Preview        │                                 │  │
  │ → renderSlide  │                                 │  │
  │   ToImage      │                                 │  │
  │ → compareImages│   replicaN                      │  │
  └────────┬───────┘ ──────────────────── ───────────┘  │
           │                                            │
           │ proposalsN  ───────────────────────────────┘
           ▼                       (reused as currentProposals)
       (next iter)
```

Two things are worth calling out:

- **The image handoff is the convergence signal.** After an edit, `renderAndDiff` produces a new `replicaImage` and a new `mismatchRatio`. Both feed the next iteration: the image becomes the literal pixel evidence the next vision call adjudicates against, and the ratio is what the loop checks against `mismatchThreshold` to decide whether to stop. Without the new render, vision N+1 would be looking at the same replica vision N already critiqued.
- **The three vision-derived blobs travel separately.** `editIssuesJson` is consumed only by the edit phase of the same iteration. `priorIssuesJson` is consumed only by the next iteration's vision phase. `issuesJson` is for events/UI and never feeds back into the loop. The edit phase never sees the recheck list, and the next vision call never sees `editIssuesJson`.

## The Runtime Loop

`runRefinementLoop()` in `refine.ts:1412` orchestrates the iterations.

### Initial diff

Before any model call, the loop renders the initial proposals via `compileProposalPreview` → `renderSlideToImage` → `compareImages`. If the mismatch ratio is already below `mismatchThreshold` and `forceIterations` is false, the loop short-circuits and emits `refine:done` with `converged: true`. The benchmark workbench can set `forceIterations` to make every iteration run regardless of the early exit, which is useful when measuring per-iteration deltas.

### Each iteration

For iteration `i`:

1. **Vision phase.** `runVisionCritique()` is invoked with the `referenceImage` and `replicaImage` from the previous diff cycle. It builds the vision system + user prompts (including any prior issues from the previous iteration), streams Claude with both images attached, and parses the response.

2. **Parse.** `parseVisionCritique()` extracts the JSON payload (handling both bare arrays and the `{ priorIssueChecks, issues }` object form), normalizes each issue through `normalizeVisionIssue()`, and produces an initial `priorIssueChecks` list. It also enforces a critical rule: **if an issue id appears in both the `issues` list and `priorIssueChecks` with `status: resolved`, the resolved status is overridden to `still_wrong`.** A model cannot claim a prior issue is resolved while simultaneously raising it as a current issue.

3. **Coalesce.** `coalescePriorIssueChecks()` walks every prior issue and ensures it has a check entry. If the model provided one, it is used (with the same override as above). If not, the loop fills in:
   - `still_wrong` if the prior issue id appears in the new issues list.
   - `resolved` if the prior id appears in the model's legacy `resolvedIssueIds` / `resolvedRefs` list.
   - `unclear` otherwise.

   `resolvedIssueIds` is no longer part of the main prompt contract. The parser still accepts it as a backward-compatible input shape, but the current prompt asks the model to express adjudication through `priorIssueChecks`.

4. **Sticky merge.** `mergeStickySignatureIssues()` carries forward any prior `signature_visual` issue whose status is not `resolved` or `unclear`. If it is already in the new issue list, the existing entry is upgraded to `sticky: true` with the prior id and ref. If it is missing, it is appended as a sticky entry. This is the mechanism that prevents identity-defining visuals from getting silently dropped between iterations.

5. **Category coverage.** `applyCategoryCoverage()` reorders the deduped issue list so that, when at least three of the core categories (`signature_visual`, `content`, `layout`) are represented, the top 3 cover all three. Otherwise it falls back to a best-effort fill. This pairs with the prompt-level diversification rule.

6. **Build the next-iteration priors.** `buildPriorIssuesForRecheck()` computes what to send the model on the *next* vision pass. The carry rules:
   - Every issue in the current iteration's final list is carried forward.
   - Any prior issue with status `still_wrong` or `unclear` that is *not* already in the current list is carried forward as well — sticky if it was a `still_wrong` `signature_visual`, with confidence clamped to ≤0.5 if it was `unclear`.
   - Resolved prior issues are dropped.

7. **Edit phase.** If the vision phase returned an empty issue list, the loop emits `refine:complete` and skips the edit. Otherwise `runProposalEdit()` is called with the `editIssuesJson` (the top-3 + sticky list from `selectIssuesForEdit()`) plus both images. The result is parsed; if parsing succeeds and yields an array, those become the new current proposals.

8. **Re-render and re-diff.** The new proposals are compiled, rendered, and diffed against the original. The mismatch ratio is recorded. If it crosses the threshold, the loop exits with `converged: true`.

If the loop exhausts `maxIterations` without converging, it emits `refine:done` with `converged: false` and the latest proposals.

### Events

The loop emits a structured event stream consumed by the extract canvas UI and the benchmark recorder:

- `refine:start` / `refine:done`
- `refine:vision:start` / `refine:vision:prompt` / `refine:vision:thinking` / `refine:vision:text` / `refine:vision:done`
- `refine:edit:start` / `refine:edit:prompt` / `refine:edit:thinking` / `refine:edit:text` / `refine:edit:done`
- `refine:diff` (after each render+diff cycle, includes the annotated diff artifact URL)
- `refine:patch` (the proposals after a successful edit)
- `refine:complete` (per-iteration summary, includes `visionEmpty: true` when applicable)
- `refine:error` / `refine:aborted`

The `refine:vision:done` event carries both `issuesJson` (the full normalized list) and `editIssuesJson` (the trimmed top-3 + sticky list that will actually be sent to the edit step), plus `priorIssueChecks` and a derived `resolvedIssueIds` list for inspector visibility. That derived list is computed from checks whose `status === "resolved"`; it is no longer a first-class field the prompt asks the model to emit.

## Issue Lifecycle Example

Walking through a concrete two-iteration scenario clarifies how the pieces compose.

**Iteration 1.** No priors. Vision returns:

```json
[
  { "priority": 1, "issueId": "title.tricolor-direction", "category": "signature_visual", "ref": "title", "issue": "bands run top-to-bottom but should be bottom-to-top", "fixType": "structural_change", ... },
  { "priority": 2, "issueId": "subtitle.scale",         "category": "style",              "ref": "subtitle", "issue": "subtitle font is too small", "fixType": "style_adjustment", ... },
  { "priority": 3, "issueId": "card-row.position",      "category": "layout",             "ref": "card-row", "issue": "card row is too high", "fixType": "layout_adjustment", ... }
]
```

The edit phase patches the proposals. The next render shows the bands now run bottom-to-top, but the subtitle is still small.

**Iteration 2.** The loop sends those three issues as priors. Vision sees the bands now match and returns:

```json
{
  "priorIssueChecks": [
    { "issueId": "title.tricolor-direction", "status": "resolved",    "note": "bands now run bottom-to-top in the replica" },
    { "issueId": "subtitle.scale",            "status": "still_wrong", "note": "subtitle still visibly smaller than original" },
    { "issueId": "card-row.position",         "status": "unclear",     "note": "row position is borderline" }
  ],
  "issues": [
    { "priority": 1, "issueId": "subtitle.scale", ... },
    { "priority": 2, "issueId": "hero-graphic.opacity", ... }
  ]
}
```

The post-processing pipeline:

- `parseVisionCritique` produces the issues + the three checks.
- `coalescePriorIssueChecks` accepts all three checks as-is (none of the resolved ids appear in the new issues list).
- `mergeStickySignatureIssues` does nothing — the only `signature_visual` prior was resolved.
- `applyCategoryCoverage` keeps `subtitle.scale` and `hero-graphic.opacity` as the top 2.
- `buildPriorIssuesForRecheck` for iteration 3 will carry `subtitle.scale` (still_wrong, in current list), `card-row.position` (unclear, with confidence clamped to 0.5), and `hero-graphic.opacity` (current). The resolved `title.tricolor-direction` is dropped — it will not be re-checked again unless vision flags it independently.

The high-reversal guard in the edit prompt now matters: if iteration 2 had instead claimed that `title.tricolor-direction` was *still* wrong (perhaps the model had a perception flip), the edit step would be told the proposal already encodes the requested structure and warned not to blindly reverse it again. This is intended to reduce the oscillation pattern that motivated the enhancement, but it remains a prompt-level mitigation rather than a hard runtime guarantee: the current loop does not yet enforce the anti-reversal rule in code after parsing and selecting issues.

## What Did Not Change

- The compile/render/diff mechanics (`compileProposalPreview`, `renderSlideToImage`, `compareImages`, `annotateDiffImage`) are unchanged from v8/v9.
- The proposal data model is unchanged. The edit step still returns a `Proposal[]` and the slide-scope proposal is still rendered via the scene compiler.
- The streaming Claude wrapper (`streamClaudeText`) and the Anthropic Agent SDK plumbing are unchanged.
- The mismatch threshold and iteration cap are still the convergence criteria. Issue tracking does not replace the pixel diff.

## Files

**Prompt contracts**
- `src/lib/extract/refine-prompt.ts` — vision + edit prompt builders, response schema, scene reference inlining.

**Loop runtime**
- `src/lib/extract/refine.ts` — `runRefinementLoop`, `runVisionCritique`, `runProposalEdit`, all post-processing helpers.

**Issue parsing helpers** (all in `refine.ts`)
- `parseVisionCritique` — JSON extraction + normalization.
- `normalizeVisionIssue`, `normalizeIssueId`, `inferIssueKind` — issue identity.
- `normalizePriorIssueChecks` — prior-issue adjudication parsing.
- `coalescePriorIssueChecks` — reconcile model adjudication with parsed issues.
- `mergeStickySignatureIssues` — carry signature visuals forward.
- `applyCategoryCoverage` — diversify the top 3.
- `buildPriorIssuesForRecheck` — compute next-iteration priors.
- `selectIssuesForEdit` — top-3 + sticky filter for the edit step.

**Geometry hints** (consumed by the edit user prompt)
- `src/lib/extract/geometry-hints.ts` — convert rendered `LayoutSlide` elements to `GeometryHints` for ground-truth grounding.

**Benchmark integration**
- `src/components/extract/BenchmarkLauncher.tsx` and `src/lib/extract/benchmark.ts` — control vs coords benchmark runner that consumes the `refine:*` event stream.

## Open Questions

- **Cross-session memory.** Issue ids are stable within a refine run but not across runs. A persistent issue ledger (per slide, across user sessions) would let the workbench score how often the same issue id keeps reappearing on the same slide.
- **Sticky decay.** `signature_visual` issues currently stay sticky until explicitly resolved. There is no mechanism to age them out if the model keeps flagging them as `unclear` for many iterations in a row.
- **Edit-side adjudication.** The edit step is told about sticky and prior context indirectly through the issue list, but it does not currently see the `priorIssueChecks` themselves. There may be value in handing the edit step the full check history so it can apply the high-reversal guard with full context rather than relying on the system-prompt rule alone.
