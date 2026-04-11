# Extract / Refine Backlog

## Summary

This backlog captures three follow-up directions for the extract/refine system:

1. **Multimodel support** for extraction, refine vision, and refine edit.
2. **SAM3-based geometry augmentation** to improve grounding and region localization.
3. **Diff-based / atomic-ops refinement** to move from large proposal rewrites toward smaller, validated edits.

These are not all the same size or urgency. The recommended order is:

1. **Multimodel support**
2. **SAM3 geometry augmentation**
3. **Diff-based / atomic-ops refinement**

That order is deliberate:
- multimodel support is the fastest way to learn whether better models materially improve extraction and refine quality;
- SAM3 can add deterministic geometry signals without forcing a full architecture rewrite;
- atomic ops is the deepest structural improvement, but also the largest design and implementation investment.

## Track 1: Multimodel Support

### Goal

Allow the extract stage, refine vision stage, and refine edit stage to choose models independently, instead of hardwiring the pipeline to the Claude Agent SDK.

### Why

The current pipeline is too Claude-shaped:
- model ids are Claude-specific in UI and store state,
- route handlers directly assume Claude-style invocation,
- event names and prompt capture are structured around a single provider,
- there is no clean seam to compare providers on the same stage.

If we want to compare OpenAI/Codex-path models later, or eventually support other multimodal providers, we need a provider abstraction first.

### Current Constraint

The current implementation uses `@anthropic-ai/claude-agent-sdk` in:
- `src/app/api/extract/analyze/route.ts`
- `src/lib/extract/refine.ts`

That is a good fit for the current Claude workflow, but it is not a generic model runtime abstraction.

### Scope

Build a provider-neutral model runner layer for:
- extract/analyze
- refine vision
- refine edit

The abstraction should normalize:
- model id
- effort / reasoning level
- system prompt
- user prompt
- attached images
- streamed text
- parsed raw output
- elapsed time
- cost / usage if available

### Non-Goals

- Supporting every provider immediately
- Solving local/open-model hosting in the first pass
- Replacing the prompt contracts themselves

### Recommended First Target

Start with two backend categories:

1. **Claude agent backend**
   - preserves current behavior
   - remains the baseline path

2. **OpenAI backend**
   - initially designed around OpenAI-hosted models
   - exact auth lane can be decided later (`openai-api` vs `openai-codex`)

This first step should focus on the abstraction boundary, not on adding many models at once.

### Design Questions

- Should model capability be declared per stage (`extract`, `refineVision`, `refineEdit`) rather than globally?
- How should image attachments be normalized so different providers can consume the same prompt payload?
- Should streamed events remain provider-agnostic, with provider-specific metadata nested under a generic shape?
- How much of the current `effort` concept is portable across providers?

### Deliverables

- Provider-neutral interfaces for extract and refine calls
- Stage-level model selection in store and UI
- One preserved Claude backend
- One second backend for comparison
- Benchmark support for per-stage provider/model comparisons

## Track 2: SAM3 Geometry Augmentation

### Goal

Use SAM3-style segmentation and region detection to improve geometry grounding for extraction and refinement.

### Why

The current refine failures are often not about raw model intelligence; they are about weak localization:
- text wrapping is misread,
- banner geometry is misdiagnosed as overflow vs clipping,
- local region comparisons are too fuzzy,
- broad whole-slide critique misses the actual root cause.

SAM3 is promising not as a replacement critic, but as a geometry provider:
- masks
- boxes
- coarse group boundaries
- region isolation for OCR or crop-level comparison

### Expected Use

The most promising use is on the **ORIGINAL** image to derive stable region hints for:
- title block
- warning banner
- stat card group
- note box
- flag/country rows
- large diagrams / hero graphics

These hints can then improve:
- extraction prompts
- crop-level comparison
- deterministic geometry checks
- future atomic edit targeting

### Non-Goals

- Replacing OCR
- Replacing the critique model
- Doing full object recognition / semantics solely from SAM

### Recommended Strategy

Use a hybrid pipeline:
- SAM3 for masks / regions / boxes
- OCR for text-bearing regions
- current extract inventory for semantic labels
- current render/layout hints where exact geometry is already available

SAM should augment geometry where the screenshot is the only source of truth, not compete with framework-native geometry where exact rects already exist.

### Design Questions

- Should SAM3 run only on the ORIGINAL, or also on the REPLICA for region-to-region matching?
- Should SAM-derived regions become persistent inventory ids, or remain prompt-only hints?
- How should SAM regions merge with current `geometryHints` from rendered layout?
- Which classes of issues should become deterministic geometry checks once region boxes exist?

### Deliverables

- A region extraction step for selected slides / benchmarks
- A normalized region-hint payload
- Integration into extract and/or refine prompts
- Benchmark evidence on whether SAM reduces geometry hallucinations

## Track 3: Diff-Based / Atomic-Ops Refinement

### Goal

Move refine from “rewrite the whole proposals JSON array” toward “apply a small set of validated operations against stable objects.”

### Why

The current refine loop still has structural weaknesses:
- edit rewrites too much at once,
- issue identity is unstable across similar symptoms,
- reversals are easy,
- validation is weak because edits are not expressed as small operations.

An atomic-ops approach would make refine more controllable and inspectable.

### Important Clarification

This does **not** mean switching to raw pixel diffing or a bitmap editing workflow.

The promising direction is:
- keep the current semantic proposal IR as source of truth,
- normalize it into a stable editable object model,
- apply atomic ops to that object model,
- continue rendering with DOM/scene/compiler infrastructure initially.

This is closer to a retained-mode scene graph than a literal HTML canvas rewrite.

### Candidate Operation Types

- move object
- resize object
- set text
- set font size / weight / color
- set fill / stroke / opacity
- set padding / gap / alignment
- adjust clip bounds
- reorder or regroup a small local structure

### Benefits

- smaller and safer edits
- clearer diffs
- easier rollback
- deterministic validation hooks
- better issue-to-action mapping
- less oscillation from broad rewrites

### Risks

- too much upfront design work
- object model could become too low-level or too bespoke
- risk of adding an abstraction layer that duplicates current IR without enough payoff

### Recommended Pilot

Do **not** refactor the entire slide system first.

Pilot the idea only inside refine:
- choose a small subset of common editable objects,
- normalize current proposals into a minimal object graph,
- let refine emit atomic ops for a constrained set of properties,
- validate and render through the current runtime.

Good first pilot targets:
- title text
- warning banner
- stat card group
- note box
- simple repeated chips / rows

### Design Questions

- What is the minimum viable normalized object schema?
- Which operations are safe enough to expose first?
- Should validation happen before or after proposal regeneration?
- Should issues map directly to ops, or should there be an intermediate planner?

### Deliverables

- A normalized editable object model for refine
- A small op schema
- An op application layer back to proposals
- Validation rules for bounds / clipping / visibility / alignment
- A pilot benchmark on a few troublesome slides

## Cross-Track Recommendation

These tracks should not proceed independently.

Recommended sequencing:

1. **Multimodel support**
   - create the provider abstraction
   - preserve current Claude behavior
   - make experimentation cheap

2. **SAM3 geometry augmentation**
   - improve grounding
   - reduce geometry hallucinations
   - produce better region hints for later systems

3. **Atomic-ops refine pilot**
   - use the lessons from better models and better geometry
   - design the edit abstraction around real observed failure modes

## Exit Criteria For Each Track

### Multimodel support
- The same slide can be run through extract and refine with stage-specific model choices.
- Prompt and event capture remain comparable across providers.
- Claude remains the fallback baseline.

### SAM3 geometry augmentation
- Region hints are available in a normalized form.
- At least one benchmark class shows fewer geometry-related hallucinations or faster convergence.

### Atomic ops
- At least one refine benchmark class can be patched through small operations rather than full proposal rewrites.
- Ops are easier to inspect and validate than current free-form rewrite output.

