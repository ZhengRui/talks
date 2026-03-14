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
- visual regression / screenshot overlay tooling
- additional template-time ergonomics if scene YAML still feels too heavy
- migration of the remaining real v8 decks

The branch now has a first practical version of that tooling:

- a replication workbench UI at `/workbench/replicate`
- overlayable viewer routes through query params
- a `slide:diff` script that captures a slide and produces rendered/diff/report artifacts

The prototype already answered the important question: for screenshot replication, the scene-first path is better aligned than the component-first path.

## The Real Remaining Problem: Verbosity

The current direct scene replications and scene-backed templates are still verbose. That criticism is correct.

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

Priority order now:

1. sync the docs and mental model to the branch as it exists today
2. extract a small shared macro / preset layer from the migrated built-ins
3. port the remaining real v8 presentation decks
4. promote only the fragments that repeat there too
5. add visual regression / overlay tooling
6. only then revisit whether `distribute` or more primitives are still necessary

This order matters.

The highest-value next work is not "more node kinds" or "more layout primitives." It is making the scene path practical enough that people will actually prefer writing it, while proving it against real decks rather than only the built-in template set.

## Template Direction

The original v7-v8 template system remains useful, but the output target should change over time.

Current state:

- DSL templates can now emit scene slides directly
- built-in and deck-local macro imports are available for scene templates
- all built-in templates are now scene-backed
- the shared macro library is still intentionally small and should grow only from repeated real patterns

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

1. treat scene as the default authoring model for all new work
2. keep expanding shared macros/presets slowly and only from repeated fragments
3. port the remaining real v8 decks through the scene path
4. use parity tooling to verify migration quality continuously
5. keep the IR as the stable backend contract for both web and PPTX

So the branch result is now:

- components are no longer the right default authoring abstraction for replication
- scene plus compile-time geometry is the right foundation
- the legacy component/autolayout path has now been removed
- the remaining work is ergonomics, migration completion, and parity verification
