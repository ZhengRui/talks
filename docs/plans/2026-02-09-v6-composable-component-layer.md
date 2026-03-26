# v6: Composable Component Layer — Implementation Plan

See `docs/design-v6.md` for architecture.

## Phase 1: Freeform Passthrough (validate Claude's IR generation) — DONE

### 1.1 Add `freeform` slide type
- **File**: `src/lib/types.ts`
- Add `FreeformSlideData` to the `SlideData` discriminated union:
  ```typescript
  interface FreeformSlideData {
    template: "freeform";
    background?: string;
    backgroundImage?: string;
    overlay?: string;
    elements: LayoutElement[];
  }
  ```
- Elements use the existing `LayoutElement` type — no new IR

### 1.2 Add freeform layout function
- **File**: `src/lib/layout/templates/freeform.ts` (new)
- Passthrough: takes `FreeformSlideData`, returns `LayoutSlide` with elements as-is
- Apply background/overlay if specified, otherwise use theme bg
- Register in `src/lib/layout/templates/index.ts`

### 1.3 Add freeform YAML validation
- **File**: `src/lib/loadPresentation.ts`
- Validate that `elements` array exists and each element has required fields (kind, rect)
- Fail gracefully on malformed elements with clear error messages

### 1.4 Write tests
- Unit test: freeform layout function passes through elements correctly
- Unit test: loadPresentation handles freeform slides
- Integration test: freeform slide renders in web (LayoutRenderer already handles all element types)
- Integration test: freeform slide exports to PPTX

### 1.5 Write skill prompt (out of repo — in frontend-slides skill or separate)
- Document Level 2 IR format: all 7 element types with full prop reference
- Canvas conventions: 1920×1080, content area 160..1760 x 60..1020
- Theme values: how to read ResolvedTheme, common color/font slots
- Component recipes: "how to make a seal", "how to make a stat block", "how to make a tag"
- Example: one complete freeform slide in YAML showing a split layout with mixed components

### 1.6 Validate with real presentations
- Generate 3-5 presentations using Claude + skill prompt + freeform template
- Track: which component patterns recur, where Claude makes spatial errors, token cost per slide
- Document findings → input to Phase 2 component vocabulary

**Exit criteria**: Claude can produce visually good freeform slides. We have data on common patterns. ✅

---

## Phase 2: Composable Templates — DONE

### 2.1 Define component types
- **File**: `src/lib/layout/components/types.ts` (new)
- Based on Phase 1 data, define discriminated union of component types:
  ```typescript
  type SlideComponent =
    | { type: "heading"; text: string; level?: 1 | 2 | 3 }
    | { type: "body"; text: string }
    | { type: "bullets"; items: string[] }
    | { type: "stat"; value: string; label: string }
    | { type: "tag"; text: string; color?: string }
    | { type: "divider"; variant?: "solid" | "gradient" | "ink" }
    | { type: "quote"; text: string; attribution?: string }
    | { type: "card"; title: string; body: string; dark?: boolean }
    | { type: "image"; src: string; height?: number }
    | { type: "code"; code: string; language?: string }
    | { type: "spacer"; height: number }
    | { type: "raw"; height: number; elements: LayoutElement[] }
  ```
- Vocabulary will be adjusted based on Phase 1 findings

### 2.2 Build component resolvers
- **File**: `src/lib/layout/components/resolvers.ts` (new)
- One function per component type: `(component, theme, panelRect) → { elements: LayoutElement[], height: number }`
- Each resolver returns the elements (with positions relative to panel) AND the consumed height
- Use existing helpers (`headingStyle`, `bodyStyle`, `estimateTextHeight`, etc.)

### 2.3 Build vertical stacker
- **File**: `src/lib/layout/components/stacker.ts` (new)
- Input: `SlideComponent[]`, panel rect `{x, y, w, h}`, theme, gap (default ~30px)
- For each component: resolve it, position at current y offset, advance y by component height + gap
- Output: `LayoutElement[]` with absolute positions on the 1920×1080 canvas
- Dev mode: warn if total content height exceeds panel height

### 2.4 Theme token resolution
- **File**: `src/lib/layout/components/theme-tokens.ts` (new)
- Parse string values like `"theme.accent"` → look up in ResolvedTheme → substitute concrete value
- Apply during component resolution, before generating LayoutElements

### 2.5 Add `split` template
- **File**: `src/lib/layout/templates/split-compose.ts` (new)
- Add `SplitComposeSlideData` to types.ts:
  ```typescript
  interface SplitComposeSlideData {
    template: "split-compose";
    left: { background?: string; textColor?: string; children: SlideComponent[] };
    right: { background?: string; textColor?: string; children: SlideComponent[] };
    ratio?: number; // default 0.5
  }
  ```
- Split canvas into two panels based on ratio
- Apply panel background as ShapeElement
- Run stacker on each panel's children
- Register in templates/index.ts

### 2.6 Add `full-compose` template
- **File**: `src/lib/layout/templates/full-compose.ts` (new)
- Add `FullComposeSlideData` to types.ts:
  ```typescript
  interface FullComposeSlideData {
    template: "full-compose";
    background?: string;
    children: SlideComponent[];
    align?: "left" | "center";
  }
  ```
- Single content area with standard margins (CONTENT_X, PADDING_Y)
- Run stacker on children
- Register in templates/index.ts

### 2.7 Write tests
- Unit test: each component resolver produces correct elements and height
- Unit test: stacker positions components correctly with gaps, warns on overflow
- Unit test: theme token resolution
- Integration test: split-compose slide renders correctly on web
- Integration test: split-compose slide exports correctly to PPTX
- Integration test: full-compose slide renders + exports
- Integration test: `raw` escape hatch within composable templates

### 2.8 Update skill prompt
- Document composable template format (split-compose, full-compose)
- Document all component types with props
- Document theme tokens
- When to use composable vs freeform vs rigid templates
- Examples: 2-3 complete composable slides

**Exit criteria**: Composable templates work end-to-end. Claude can generate them via skill prompt. Common patterns are automated; `raw` is available for novel components. ✅

**Note**: Step 2.8 evolved beyond the original plan. Instead of a separate compose-slides skill, the skill was unified into `create-slides` (`.claude/skills/create-slides/`) which covers all three approaches: old template shortcuts, compose templates, and freeform. The `freeform-slides` skill remains as a separate specialized skill.

---

## Phase 3: Evolve Vocabulary (ongoing) — NOT STARTED

### 3.1 Graduate raw patterns
- Review `raw` usage across generated presentations
- When a pattern appears 3+ times, promote to a named component
- Add resolver, add to types, add tests

### 3.2 Refine height estimation
- Compare estimated heights vs actual rendered heights
- Tune constants in estimateTextHeight and component resolvers
- Consider per-font metrics if estimation is consistently off for specific fonts

### 3.3 Expand component props
- Add variant/size options to existing components based on usage
- Examples: `heading` with `align`, `bullets` with `icon` or `numbered`, `card` with `variant`

### 3.4 Consider multi-column within panels
- If presentations frequently need side-by-side components within a panel (e.g., 2 stats in a row), add a `row` meta-component that distributes children horizontally

**Exit criteria**: Component vocabulary covers 80%+ of Claude's output without `raw`.

---

## File Summary

New files:
- `src/lib/layout/templates/freeform.ts` — Phase 1
- `src/lib/layout/components/types.ts` — Phase 2
- `src/lib/layout/components/resolvers.ts` — Phase 2
- `src/lib/layout/components/stacker.ts` — Phase 2
- `src/lib/layout/components/theme-tokens.ts` — Phase 2
- `src/lib/layout/templates/split-compose.ts` — Phase 2
- `src/lib/layout/templates/full-compose.ts` — Phase 2

Modified files:
- `src/lib/types.ts` — add FreeformSlideData (P1), SplitComposeSlideData, FullComposeSlideData (P2)
- `src/lib/layout/templates/index.ts` — register new templates
- `src/lib/loadPresentation.ts` — validation for new slide types

Unchanged:
- `src/components/LayoutRenderer.tsx` — renders LayoutElement[], doesn't care about source
- `src/lib/export/pptx.ts` — same
- `src/lib/layout/types.ts` — LayoutElement types unchanged
- `src/lib/layout/theme.ts` — ResolvedTheme unchanged
- All existing templates — backward compatible
