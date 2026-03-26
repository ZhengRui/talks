# Grid `bottom` constraint resolution — design review

## Problem

When a grid layout has no explicit `rowHeight`, children with `bottom` or `centerY` frame constraints resolve against the **full grid container height** instead of the computed cell height. This produces large unexpected gaps.

### Root cause

In `src/lib/scene/solve.ts:compileGridChildren` (line 479-481):

```typescript
const compiled = compileSceneNode(
  child,
  { x: 0, y: 0, w: cellW, h: layout.rowHeight ?? inner.h },
  ctx,
);
```

Without `rowHeight`, the parent height passed to each child is `inner.h` (full grid height). The actual row height is only computed **after** children are compiled (line 494-495):

```typescript
const rowHeight = layout.rowHeight
  ?? rowItems.reduce((max, item) => Math.max(max, item.rect.y + item.rect.h), 0);
```

This means `bottom: 14` inside a 235px grid resolves as `y = 235 - 14 - h` instead of `y = cellHeight - 14 - h`. The label gets pushed to the bottom of the full container, not the cell.

### Divergence from CSS

CSS Grid computes row heights first (from content sizing, `grid-template-rows`, or intrinsic sizing), then positions cell contents within those bounds. A `position: absolute; bottom: 14px` inside a CSS grid cell resolves against the cell, not the grid container.

Our solver inverts this: it compiles children first to determine their extent, then derives row height from the result. This is a chicken-and-egg problem.

### Why a pre-compilation height estimator is not viable

A natural instinct is to estimate the minimum required cell height from frame constraints before compilation. However, the scene compiler has complex layout semantics that make accurate estimation impractical:

- **Frame-less groups** receive `{ w: parent.w, h: parent.h }` as a size hint in the real solver (`solve.ts:532`). An estimator that returns 0 for frame-less groups would collapse common patterns like `icon-grid-item` groups.
- **Stack layouts** accumulate child heights plus gaps and padding (`solve.ts:330`). Estimating a stack group's height requires summing children, not taking their max.
- **Row/grid layouts** have their own cursor, track, and gap logic.
- **Text nodes** require `estimateTextHeight` with width, font metrics, and line-height — the same approximate calculation already in `compileTextNode`.

To get a correct estimator, you'd replicate the full layout solver in estimation form — maintaining two parallel compilers. This defeats the purpose.

## Reproduction

This was observed in an AI-generated `stat-cards-grid` block template (not checked into the repo) that uses a 2×2 grid (h=235, no `rowHeight`) with card groups containing:
- value text: `frame: { top: 16 }` — resolves correctly (top doesn't need container height)
- label text: `frame: { bottom: 14 }` — resolves against 235px instead of ~111px cell

Result: ~150px gap between value and label instead of ~26px.

Note: the existing `stat_panel` macro in `src/lib/dsl/macros/scene/blocks.njk` already avoids this by assigning explicit `frame.h` to each grid child. The bug surfaces when AI-generated templates omit explicit heights and rely on `bottom` constraints — a pattern that is natural to authors familiar with CSS Grid but broken in the current solver.

## Options

### Option A: Document the pitfall

Add a warning to `.claude/skills/replicate-slides/reference.md` pitfalls section:

```markdown
- Do not use `bottom`, `centerY`, or height-relative constraints inside grid children
  unless `rowHeight` is set on the grid layout. Without it, children compile against the
  full grid container height, not the computed cell height. Use `top` positioning, anchor
  references, or explicit `frame.h` on grid children instead.
```

**Pros:** Zero risk, fast, covers both human and AI authors via the skill reference.
**Cons:** Authors must remember the rule. Inconsistent with CSS mental model.

### Option C: Pre-compute row heights from explicit child heights

Before compiling, scan direct grid children for explicit `frame.h` values. If all children in a row have explicit heights, use the max as row height. Fall back to `inner.h` only when heights are truly unknown.

```typescript
const precomputedRowHeights: (number | undefined)[] = [];
for (let rowStart = 0; rowStart < children.length; rowStart += layout.columns) {
  const rowSlice = children.slice(rowStart, rowStart + layout.columns);
  const heights = rowSlice.map(c => resolveValue(c.frame?.h, ctx));
  if (heights.every(h => h !== undefined)) {
    precomputedRowHeights.push(Math.max(...(heights as number[])));
  } else {
    precomputedRowHeights.push(undefined);
  }
}
```

Then use `precomputedRowHeights[rowIndex] ?? inner.h` when compiling children, and use the same value for `cursorY` advance:

```typescript
// In the per-row loop:
const precomputedH = precomputedRowHeights[rowIndex];
const compileH = precomputedH ?? inner.h;

const compiled = compileSceneNode(child, { x: 0, y: 0, w: cellW, h: compileH }, ctx);

// After processing row items:
const rowHeight = layout.rowHeight
  ?? precomputedH
  ?? rowItems.reduce((max, item) => Math.max(max, item.rect.y + item.rect.h), 0);
cursorY += rowHeight + rowGap;
```

**Pros:** Single pass. Simple. No estimation heuristics. Preserves content-driven sizing for rows without explicit heights. Already covers the existing repo pattern (`stat_panel` macro assigns explicit `frame.h` to grid children).
**Cons:** Doesn't fix the case where children have no explicit `h` (frame-less groups with `bottom` constraints). Falls back to current broken behavior for those cases.

### Option D: Equal-row-height default

When `rowHeight` is not set, divide available height equally among rows:

```typescript
const rowCount = Math.ceil(children.length / layout.columns);
const equalRowHeight = (inner.h - rowGap * Math.max(0, rowCount - 1)) / rowCount;
```

Then use `equalRowHeight` both as the parent height when compiling children and as the row advance step:

```typescript
const rowHeight = layout.rowHeight ?? equalRowHeight;
const compiled = compileSceneNode(child, { x: 0, y: 0, w: cellW, h: rowHeight }, ctx);
// ...
cursorY += rowHeight + rowGap;
```

**Pros:** Predictable. `bottom` constraints resolve correctly for all cases.
**Cons:** This is a **breaking behavior change**. The current contract for grids without `rowHeight` is content-driven: row height equals the tallest child's extent, and rows pack tightly. This is codified in the existing test at `src/lib/scene/compiler.test.ts:184` — a 330×120 grid with 5 items (h=40 each, rowGap=20) places row 2 at y=60 (content-derived: 40+20), not y=70 (equal-split: (120-20)/2 + 20). Adopting Option D requires:
- Updating the existing grid test expectations
- Auditing all grid usages in templates and macros for regressions
- A clear migration note

### Option E: Two-pass compile (future)

Compile children fully in pass 1 with `h: inner.h`, compute content-driven row height, then recompile children that contain `bottom`/`centerY` descendants with the actual row height in pass 2.

This is the theoretically correct approach but has an unresolved design issue: pass-1 measurements for rows containing `bottom`-anchored elements are inflated by the wrong container height. A frame-less group compiled with `h: inner.h` produces a group rect of height `inner.h`, so the content-derived row height equals `inner.h` — the same value we're trying to fix. Solving this requires either stripping `bottom`/`centerY` contributions from measurement (complex) or a different measurement model entirely.

**Status:** Not ready for implementation. Noted as a future direction if grid usage grows complex enough to justify the investment.

## Recommendation

**Option A + C** as the recommended approach:

1. **Option A** (document the pitfall) — immediate mitigation. Update `.claude/skills/replicate-slides/reference.md` pitfalls section and the grid layout documentation to warn against `bottom`/`centerY` inside grid children without `rowHeight`. This covers both human and AI template authors.

2. **Option C** (pre-compute from explicit `frame.h`) — targeted compiler fix. When all children in a grid row have explicit `frame.h`, the solver uses the max as the row's compile height. This makes `bottom` constraints resolve correctly for the well-authored case and encourages the right pattern: grid children should declare their height.

The remaining gap — frame-less groups with `bottom` constraints inside grids, no explicit heights — is a rare and unnatural authoring pattern. The skill reference guides authors toward explicit `frame.h` on grid children or anchor references. This is a documentation-shaped problem more than a compiler-shaped one.

**Option D** (equal rows) is clean but changes the existing grid contract. Consider it only if the content-driven default proves to be more confusing than useful across real template usage.

**Option E** (two-pass) is the theoretically correct long-term solution but has unresolved measurement issues. Worth revisiting if grid usage grows significantly more complex.

All options should be paired with a new test case verifying that `bottom` constraints inside grid children with explicit `frame.h` resolve against cell height, not container height.
