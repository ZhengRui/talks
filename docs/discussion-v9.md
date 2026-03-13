# v9 Discussion: What The Prototype Proved, What Changed, What Comes Next

This note complements `design-v9.md`. It focuses on conclusions from the working prototype in this branch rather than the original proposal state.

## What The Prototype Already Proved

The current branch is enough to answer the main architectural question for screenshot replication:

- new slide authoring does not need to go through the runtime component layer
- a small scene-first compiler is already easier to reason about than v8 components for replicated slides
- the existing `LayoutElement` / `LayoutSlide` IR remains a good backend contract

This matters because the renderer/export layer was not rewritten. The improvement came from changing the authoring/compiler layer, not from changing the backend.

## Why The New Path Feels Better

The improvement is not only model quality.

Better visual judgment from a stronger model helps with:

- choosing closer colors
- choosing better spacing values on the first pass
- recognizing grouping in a screenshot

But the more important structural win is that v9 scene slides no longer force screenshot replication through:

1. semantic component guesses
2. resolver defaults
3. pseudo-flex / pseudo-grid behavior

That change removes a whole class of avoidable surprises.

## Scene vs Raw / Freeform

The prototype clarified an important point: v9 scene mode is much closer to old raw/freeform slides than to v8 components.

At a high level, old raw/freeform already behaved like a scene graph:

- each IR element was a visual node
- each slide was a tree of visual nodes

So v9 did not invent a completely different model. The real change is this:

- raw/freeform authored the final IR directly
- scene authors a source format above the IR and compiles it down

That distinction is valuable because scene can add authoring-time features that raw did not have:

- `FrameSpec` instead of mandatory final `rect`
- guides
- root `sourceSize` / `fit` / `align`
- recursive scaling of geometry and style metrics
- local geometry helpers (`stack`, `row`)

This is why scene is more practical for screenshot replication than old raw/freeform, even though both are fundamentally spatial.

## Why Not Mirror The Entire IR Immediately

One tempting direction would be to add a scene-node form for every IR element kind right away.

I do not recommend that as the next step.

If scene simply mirrors every IR element one-to-one, it risks becoming:

- "IR with a different spelling"
- a second API surface to maintain
- a larger language without clear authoring benefits

The better rule is:

- make scene-native nodes small and geometry-focused
- add first-class nodes only when compile-time behavior adds real value
- keep one low-level escape hatch so scene is never less expressive than raw/freeform

This preserves the benefits of scene without rebuilding the entire backend schema under a new name.

## Escape Hatch Strategy

The next important capability is a low-level scene escape hatch.

That escape hatch should guarantee:

- scene is never less expressive than raw/freeform IR
- unusual or low-frequency IR constructs do not block migration
- authoring can still benefit from scene placement/scaling when needed

Recommended direction:

- allow a scene node that wraps a raw IR element
- ideally let that wrapper still participate in `FrameSpec`, guides, and source-space normalization

That is a better migration tool than rushing to add scene-native `table`, `video`, `iframe`, and every other element form immediately.

## What Is Still Missing

The branch now covers the core scene-geometry backlog that mattered most for replication:

- low-level escape hatch
- scene-template DSL output
- presets / macro-friendly scene authoring
- diagnostics for bad guides / duplicate ids
- anchors
- `grid`

What remains is now a different class of work:

- they are no longer blockers to the architectural argument
- they are now maturity / ergonomics backlog

Examples:

- `distribute`
- richer diagnostics / debug tooling
- additional template-time ergonomics if scene YAML still feels too heavy

The prototype already answered the important question: for screenshot replication, the scene-first path is better aligned than the component-first path.

## The Real Remaining Problem: Verbosity

The current `v9-test-replicate` examples are still verbose. That criticism is correct.

The prototype improved:

- layout predictability
- scaling accuracy
- correspondence to screenshot structure

But it did **not** yet solve authoring ergonomics.

So the current trade is:

- v8 components: shorter in some cases, but more misleading and less predictable
- v9 scene: more direct and more stable, but still too many lines for repeated text and shape patterns

That means the next major investment should not be more semantic components. It should be scene authoring ergonomics.

## What Should Come Next

Priority order:

1. add a low-level scene escape hatch
2. let templates emit `mode: scene` slides directly
3. add macros / presets to reduce repetition
4. add diagnostics
5. add anchors and `grid` only if repeated real slides need them

Status in this branch:

- done: 1, 2, 3, 5, and a focused version of 4
- remaining likely next step: `distribute`, or additional template-time ergonomics if authoring still feels too verbose

This order matters.

The highest-value next work is not "more node kinds" or "more layout primitives." It is making the scene path practical enough that people will actually prefer writing it.

## Template Direction

The original v7-v8 template system remains useful, but the output target should change over time.

Current state:

- DSL templates still expand into component slides

Desired direction:

- DSL templates emit scene slides directly
- reuse comes from template expansion, macros, presets, and guide conventions
- runtime components stop being the mechanism for reuse

That keeps reuse while removing runtime semantics as a source of surprise.

## What v9 Should Still Avoid

The original traps remain valid:

### Trap 1: Rebuild Components Under A New Name

If scene macros turn into hidden runtime semantics, the problem returns.

Reuse should stay at template-expansion time, not runtime resolution time.

### Trap 2: Build Another Partial CSS Engine

Do not chase browser-like behavior unless the plan is to use an actual browser-backed compiler.

Prefer a small explicit geometry language with slide semantics.

### Trap 3: Throw Away The Existing IR

The current IR is still one of the repo's strongest assets.

v9 should continue to treat the IR as the stable backend contract for both:

- the web renderer
- the PPTX exporter

## Current Recommendation

The current evidence supports this direction:

1. keep v8 alive during migration
2. use v9 scene mode for screenshot-first slides
3. add the escape hatch and scene-template ergonomics next
4. port a few real replicated decks and a few built-in templates
5. remove the component layer only after scene plus its escape hatch covers real authoring needs

So the prototype result is not "components are gone already." It is:

- components are no longer the right default authoring abstraction for replication
- scene plus compile-time geometry is the right foundation
- the next step is to make that foundation comfortable to author at scale
