# Reference.md Rewrite + Compiler fit/align Change — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite replicate-slides reference.md as a concise scene authoring manual, move Layer 2 to integration.md, stop propagating fit/align from template bodies, and update the extract pipeline to match.

**Architecture:** Remove fit/align propagation from DSL engine and extract preview compiler. Update extract prompts and instance YAML generator. Write reference.md from scratch (~400 lines). Extract Layer 2 content to integration.md as-is. Clean up all contradictory guidance in SKILL.md.

**Tech Stack:** TypeScript (Vitest), Markdown

---

### Task 1: Update existing tests that expect template-body fit/align

**Files:**
- Modify: `src/lib/dsl/engine.test.ts:399-436` (update "expands templates that emit mode: scene slides")
- Modify: `src/lib/dsl/engine.test.ts:571-603` (update "lets slide data override scene background and viewport fields")

**Step 1: Update the "expands templates that emit mode: scene slides" test**

The template body includes `fit: contain` and `align: center`. After the change, these must NOT appear on the expanded result. Update the test at line 399:

```typescript
it("expands templates that emit mode: scene slides", () => {
    const def = makeDef({
      params: { title: { type: "string", required: true } },
      rawBody: `
mode: scene
sourceSize: { w: 640, h: 360 }
fit: contain
align: center
background:
  type: solid
  color: "#101820"
children:
  - kind: text
    id: title
    frame: { x: 64, y: 48, w: 320 }
    text: "{{ title }}"
    style:
      fontFamily: "heading"
      fontSize: 48
      fontWeight: 700
      color: "#ffffff"
      lineHeight: 1.1
`,
    });

    const result = expandDslTemplate({ template: "test", params: { title: "Scene Title" } }, def);
    expect(result).toMatchObject({
      mode: "scene",
      sourceSize: { w: 640, h: 360 },
    });
    // fit/align from template body must NOT propagate
    expect(result).not.toHaveProperty("fit");
    expect(result).not.toHaveProperty("align");
    expect((result as unknown as { children: Record<string, unknown>[] }).children[0]).toMatchObject({
      kind: "text",
      id: "title",
      text: "Scene Title",
    });
  });
```

**Step 2: Update the "lets slide data override" test**

The template body sets `fit: contain, align: left`. Slide data sets `fit: cover, align: center`. After the change, only slide-data values appear (template values are ignored). The test at line 571 becomes:

```typescript
it("lets slide data override scene background and viewport fields", () => {
    const def = makeDef({
      rawBody: `
mode: scene
sourceSize: { w: 640, h: 360 }
fit: contain
align: left
background:
  type: solid
  color: "#111111"
children: []
`,
    });

    const result = expandDslTemplate(
      {
        template: "test",
        background: { type: "solid", color: "#202020" },
        sourceSize: { w: 800, h: 600 },
        fit: "cover",
        align: "center",
      },
      def,
    );

    expect(result).toMatchObject({
      mode: "scene",
      background: { type: "solid", color: "#202020" },
      sourceSize: { w: 800, h: 600 },
      fit: "cover",
      align: "center",
    });
  });
```

This test still passes because fit/align come from slideData (lines 158-159), not from parsed template body.

**Step 3: Run tests to verify they fail**

Run: `bun run test -- src/lib/dsl/engine.test.ts`
Expected: 1 failure — "expands templates that emit mode: scene slides" (expects no fit/align but engine still propagates them)

---

### Task 2: Remove fit/align propagation from template body in engine.ts

**Files:**
- Modify: `src/lib/dsl/engine.ts:154-155`

**Step 1: Remove the two lines**

In `engine.ts`, remove lines 154-155 from the return object:

```typescript
    // REMOVE these two lines:
    // ...(parsed.fit !== undefined ? { fit: parsed.fit as SceneSlideData["fit"] } : {}),
    // ...(parsed.align !== undefined ? { align: parsed.align as SceneSlideData["align"] } : {}),
```

The surrounding context (lines 148-163) should become:

```typescript
  return {
    mode: "scene",
    ...(parsed.background !== undefined ? { background: parsed.background as SceneSlideData["background"] } : {}),
    ...(parsed.guides !== undefined ? { guides: parsed.guides as SceneSlideData["guides"] } : {}),
    ...(presets ? { presets } : {}),
    ...(parsed.sourceSize !== undefined ? { sourceSize: parsed.sourceSize as SceneSlideData["sourceSize"] } : {}),
    ...(slideData.background !== undefined ? { background: slideData.background as SceneSlideData["background"] } : {}),
    ...(slideData.guides !== undefined ? { guides: slideData.guides as SceneSlideData["guides"] } : {}),
    ...(slideData.fit !== undefined ? { fit: slideData.fit as SceneSlideData["fit"] } : {}),
    ...(slideData.align !== undefined ? { align: slideData.align as SceneSlideData["align"] } : {}),
    ...(slideData.sourceSize !== undefined ? { sourceSize: slideData.sourceSize as SceneSlideData["sourceSize"] } : {}),
    children: (parsed.children ?? []) as SceneSlideData["children"],
    ...base,
  } as SceneSlideData & SlideBaseFields;
```

**Step 2: Run tests to verify they pass**

Run: `bun run test -- src/lib/dsl/engine.test.ts`
Expected: All tests pass

**Step 3: Run full test suite**

Run: `bun run test`
Expected: All tests pass (no other code depends on template-body fit/align)

---

### Task 3: Add explicit test for template fit/align ignored, instance fit/align honored

**Files:**
- Modify: `src/lib/dsl/engine.test.ts` (add new test)

**Step 1: Add the new test**

Add after the "lets slide data override" test:

```typescript
  it("ignores fit/align from template body, honors instance-level fit/align", () => {
    const def = makeDef({
      rawBody: `
mode: scene
sourceSize: { w: 640, h: 360 }
fit: stretch
align: top-left
children: []
`,
    });

    // No instance-level fit/align — template values should NOT appear
    const withoutOverride = expandDslTemplate({ template: "test" }, def);
    expect(withoutOverride).not.toHaveProperty("fit");
    expect(withoutOverride).not.toHaveProperty("align");
    expect(withoutOverride).toMatchObject({ sourceSize: { w: 640, h: 360 } });

    // With instance-level fit/align — those should appear
    const withOverride = expandDslTemplate(
      { template: "test", fit: "cover", align: "bottom-right" },
      def,
    );
    expect(withOverride).toMatchObject({ fit: "cover", align: "bottom-right" });
    expect(withOverride).toMatchObject({ sourceSize: { w: 640, h: 360 } });
  });
```

**Step 2: Run test to verify it passes**

Run: `bun run test -- src/lib/dsl/engine.test.ts`
Expected: All tests pass

---

### Task 4: Write test for compile-preview stripping fit/align from proposal body

**Files:**
- Create: `src/lib/extract/compile-preview.test.ts`

**Step 1: Write the failing test**

The test uses `sourceSize: { w: 800, h: 600 }` (4:3 aspect) compiled into 1920x1080 (16:9).
Under `contain`/`center`: scale = min(1920/800, 1080/600) = min(2.4, 1.8) = 1.8. Scene width = 1440, offset x = (1920-1440)/2 = 240. So the shape at `{x:0, y:0, w:800, h:600}` becomes `{x:240, y:0, w:1440, h:1080}`.
Under `stretch`/`top-left`: scale X=2.4, Y=1.8. Shape becomes `{x:0, y:0, w:1920, h:1080}`.

The test asserts the contain/center rect to prove stretch/top-left from the body was stripped.

```typescript
import { describe, it, expect } from "vitest";
import { compileProposalPreview } from "./compile-preview";
import type { Proposal } from "@/components/extract/types";

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    scope: "slide",
    name: "test-slide",
    description: "test",
    region: { x: 0, y: 0, w: 800, h: 600 },
    params: {},
    style: {},
    body: `
sourceSize: { w: 800, h: 600 }
background: { type: solid, color: "#111" }
children:
  - kind: shape
    id: bg
    frame: { x: 0, y: 0, w: 800, h: 600 }
    shape: rect
    style: { fill: "#222" }
`,
    ...overrides,
  };
}

describe("compileProposalPreview", () => {
  it("strips fit/align from proposal body and applies contain/center defaults", () => {
    // Body says stretch + top-left, but preview must override to contain + center
    const proposal = makeProposal({
      body: `
sourceSize: { w: 800, h: 600 }
fit: stretch
align: top-left
background: { type: solid, color: "#111" }
children:
  - kind: shape
    id: bg
    frame: { x: 0, y: 0, w: 800, h: 600 }
    shape: rect
    style: { fill: "#222" }
`,
    });

    const result = compileProposalPreview(proposal, [proposal], 1920, 1080);

    // Under contain/center with 800x600 -> 1920x1080:
    // scale = 1.8, scene width = 1440, x offset = 240
    // If stretch/top-left leaked through, rect.x would be 0 and rect.w would be 1920
    const bgElement = result.elements.find((e) => e.id === "bg");
    expect(bgElement).toBeDefined();
    expect(bgElement!.rect.x).toBeCloseTo(240, 0);
    expect(bgElement!.rect.w).toBeCloseTo(1440, 0);
    expect(bgElement!.rect.y).toBeCloseTo(0, 0);
    expect(bgElement!.rect.h).toBeCloseTo(1080, 0);
  });

  it("compiles a basic proposal with contain/center defaults", () => {
    const proposal = makeProposal();
    const result = compileProposalPreview(proposal, [proposal], 1920, 1080);

    // Same contain/center math: x=240, w=1440
    const bgElement = result.elements.find((e) => e.id === "bg");
    expect(bgElement).toBeDefined();
    expect(bgElement!.rect.x).toBeCloseTo(240, 0);
    expect(bgElement!.rect.w).toBeCloseTo(1440, 0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/extract/compile-preview.test.ts`
Expected: First test fails — `rect.x` is 0 (stretch) instead of 240 (contain), proving the body's fit/align leak through.

---

### Task 5: Update compile-preview.ts to strip fit/align from proposal body

**Files:**
- Modify: `src/lib/extract/compile-preview.ts:86-92`

**Step 1: Strip fit/align from parsed body, apply preview defaults**

Replace lines 86-92:

```typescript
  // Parse as SceneSlideData
  const parsed = yamlParse(renderedBody) as Record<string, unknown>;
  let sceneSlide: SceneSlideData = {
    mode: "scene",
    ...parsed,
    children: (parsed.children as SceneSlideData["children"]) ?? [],
  };
```

With:

```typescript
  // Parse as SceneSlideData — strip fit/align (consumer concerns, not template concerns)
  const parsed = yamlParse(renderedBody) as Record<string, unknown>;
  const { fit: _fit, align: _align, ...rest } = parsed;
  let sceneSlide: SceneSlideData = {
    mode: "scene",
    ...rest,
    fit: "contain",
    align: "center",
    children: (parsed.children as SceneSlideData["children"]) ?? [],
  };
```

**Step 2: Run tests to verify they pass**

Run: `bun run test -- src/lib/extract/compile-preview.test.ts`
Expected: All tests pass — rect.x is now 240 (contain/center applied)

---

### Task 6: Update extract prompts to stop instructing fit/align in template body

**Files:**
- Modify: `src/lib/extract/prompts.ts:56`

**Step 1: Update the prompt instruction**

Change line 56 from:
```
- Use the source.dimensions value you report for sourceSize in the template body, with fit: contain and align: center
```
To:
```
- Use the source.dimensions value you report for sourceSize in the template body. Do NOT include fit or align in the template body — those are set on the slide instance, not in templates.
```

**Step 2: Verify the file**

Read back prompts.ts to confirm the change.

---

### Task 7: Update yaml-gen.ts to branch on scope and add test

**Files:**
- Modify: `src/components/extract/yaml-gen.ts:44-56`
- Create: `src/components/extract/yaml-gen.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { generateInstanceYaml, generateTemplateYaml } from "./yaml-gen";
import type { Proposal } from "./types";

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    scope: "slide",
    name: "test-slide",
    description: "test",
    region: { x: 0, y: 0, w: 800, h: 600 },
    params: {
      title: { type: "string", value: "Hello" },
    },
    style: {},
    body: "sourceSize: { w: 800, h: 600 }\nchildren: []",
    ...overrides,
  };
}

describe("generateInstanceYaml", () => {
  it("emits fit and align on slide-scope instance", () => {
    const yaml = generateInstanceYaml(makeProposal());
    expect(yaml).toContain("- template: test-slide");
    expect(yaml).toContain("fit: contain");
    expect(yaml).toContain("align: center");
    expect(yaml).toContain("title: \"Hello\"");
  });

  it("emits kind: block snippet for block-scope proposals", () => {
    const yaml = generateInstanceYaml(makeProposal({
      scope: "block",
      name: "stat-card",
      params: {
        value: { type: "string", value: "42%" },
        label: { type: "string", value: "Growth" },
      },
    }));
    expect(yaml).toContain("kind: block");
    expect(yaml).toContain("template: stat-card");
    expect(yaml).toContain("id: stat-card-1");
    expect(yaml).toContain("value: \"42%\"");
    // Block snippets must NOT have fit/align
    expect(yaml).not.toContain("fit:");
    expect(yaml).not.toContain("align:");
  });
});

describe("generateTemplateYaml", () => {
  it("does not include fit or align in template output", () => {
    const yaml = generateTemplateYaml(makeProposal());
    expect(yaml).toContain("name: test-slide");
    expect(yaml).toContain("scope: slide");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/components/extract/yaml-gen.test.ts`
Expected: Both instance tests fail — current code emits the same format for all scopes, no fit/align, no kind: block.

**Step 3: Update generateInstanceYaml to branch on scope**

In `yaml-gen.ts`, replace `generateInstanceYaml` (lines 44-57):

```typescript
export function generateInstanceYaml(proposal: Proposal): string {
  const lines: string[] = [];

  if (proposal.scope === "block") {
    // Block templates are referenced as kind: block nodes inside slide children
    lines.push(`- kind: block`);
    lines.push(`  id: ${proposal.name}-1`);
    lines.push(`  template: ${proposal.name}`);
    lines.push(`  frame: { x: 0, y: 0, w: ${proposal.region.w}, h: ${proposal.region.h} }`);
  } else {
    // Slide templates are top-level slide instances with explicit fit/align
    lines.push(`- template: ${proposal.name}`);
    lines.push("  fit: contain");
    lines.push("  align: center");
  }

  const params = Object.entries(proposal.params);
  if (params.length > 0) {
    lines.push("  params:");
    for (const [name, field] of params) {
      lines.push(`    ${name}: ${yamlValue(field.value)}`);
    }
  }

  return lines.join("\n");
}
```

**Step 4: Run tests to verify they pass**

Run: `bun run test -- src/components/extract/yaml-gen.test.ts`
Expected: All tests pass

---

### Task 8: Create integration.md with Layer 2 content

**Files:**
- Create: `.claude/skills/replicate-slides/integration.md`

**Step 1: Extract Layer 2 sections from current reference.md**

Copy the following sections from the current `reference.md` into `integration.md` as-is (no rewriting):
- "Two-Layer Model" (lines 60-84)
- "Replication Workflow" steps 0 and 5 (layer choice + verify) (lines 88-94, 140-153)
- "Service-Safe Rules" (lines 156-213)
- "Repo Adapter Workflow" (lines 219-227)
- "Deck-Local Template Output" file location and Layer 2 notes (lines 261-277)
- "Verification Tooling" (lines 837-873)

Add a header noting this is for repo integration and will be optimized in future.

**Step 2: Verify the file exists and reads correctly**

Read the file back to confirm structure.

---

### Task 9: Write fresh reference.md

**Files:**
- Overwrite: `.claude/skills/replicate-slides/reference.md`

**Step 1: Write the new reference.md**

Write from scratch with the following 13 sections. Total target: ~400 lines. Use the current reference.md only as a checklist to ensure no authoring concepts are missed. Content sources:

- Scene nodes (5 kinds): `src/lib/scene/types.ts`
- IR elements (5 kinds): `src/lib/layout/types.ts` lines 185-263
- FrameSpec: `src/lib/scene/types.ts:19-30`
- Guides/anchors: `src/lib/scene/types.ts:32-35`, `src/lib/scene/solve.ts`
- Layouts: `src/lib/scene/types.ts:130-158`
- Backgrounds: `src/lib/scene/types.ts:191-194`

Section outline:

```markdown
# Scene Authoring Reference

## Intro
- Scene-only repo, all slides use mode: scene
- Extraction always produces fresh templates with explicit styles
- Never use built-in themes or templates for extraction
- Suffix template names with slug or unique string to avoid collisions

## Template System
- Two scopes: slide (whole-slide composition) and block (reusable fragment)
- Slide template reference syntax (nested params:)
- Block template reference syntax (kind: block node)
- Reuse hierarchy: presets > macros > block templates > slide templates

## Coordinate Space
- sourceSize: template-intrinsic, declares authoring coordinate space
- fit/align: consumer-specified at slide instance level only, NOT in templates
- When sourceSize is present, compiler scales all geometry + visual metrics to target canvas

## Scene Nodes
- text: text, style properties. Accepts plain string, markdown, or TextRun[]
- shape: shape types, style (fill, stroke, gradient, patternFill)
- image: src, objectFit, clipCircle, borderRadius
- group: children, style?, clipContent?, layout?
- ir: element (wraps raw LayoutElement)
- All nodes share: id, preset?, frame?, opacity?, borderRadius?, shadow?, effects?, border?, entrance?, animation?, clipPath?, transform?, cssStyle?

## IR Elements
- Two-layer geometry: the scene node has a `frame` (positioned by the solver like any node), and contains a nested `element` with its own `rect`. The solver fits/scales the element into the resolved frame. Author the outer `frame` for positioning and the inner `element.rect` as the element's local coordinate space (typically `{x:0, y:0, w, h}`).
- code: code, language?, style: { fontFamily, fontSize, color, background, borderRadius, padding }
- table: headers, rows, headerStyle, cellStyle, borderColor
- list: items, ordered, itemStyle, bulletColor?, itemSpacing
- video: src, poster?
- iframe: src
- All IR elements inherit ElementBase: rect, opacity?, borderRadius?, shadow?, effects?, border?, entrance?, animation?, clipPath?, transform?

## FrameSpec
- Available constraints: x, y, w, h, left, top, right, bottom, centerX, centerY
- Partial specs OK
- Examples

## Guides & Anchors
- Guides: named alignment points
- Anchors: reference compiled siblings
- Rules

## Presets
- Named style defaults, extends, merge behavior

## Layouts
- stack, row, grid
- Grid rowHeight pitfall

## Backgrounds
- v9 background spec

## Template Skeletons
- Slide-scope (with sourceSize, WITHOUT fit/align)
- Block-scope
- Slide instance (WITH fit/align)

## Common Patterns
- Asymmetric split, watermark, mixed emphasis, repeating sub-regions, escape hatch

## Pitfalls
- Trimmed to actionable items only
- Includes: fit/align go on slide instance, not in template body
```

**Step 2: Review the written file**

Read back and verify all 13 sections are present and total is ~400 lines.

---

### Task 10: Update SKILL.md — all pointers and contradictory guidance

**Files:**
- Modify: `.claude/skills/replicate-slides/SKILL.md`

**Step 1: Update line 10 — built-in template statement**

Change:
```
This repo is scene-only. Do not use the removed component tree (`box`, `raw`, `heading`, `stat`, etc.). Built-in templates still exist, but for screenshot replication they are only for exact structural matches.
```
To:
```
This repo is scene-only. Do not use the removed component tree (`box`, `raw`, `heading`, `stat`, etc.). Built-in templates exist for slide generation but are not used for extraction. Always extract fresh templates with explicit styles.
```

**Step 2: Update line 14 — reference pointer**

Change:
```
See [reference.md](reference.md) for template system, layer model, scene syntax, file rules, verification tooling, and pitfalls.
```
To:
```
See [reference.md](reference.md) for scene authoring, template syntax, and node types. See [integration.md](integration.md) for repo integration, file paths, and verification tooling.
```

**Step 3: Update lines 39 — sourceSize/fit/align guidance in Default Output**

Change:
```
- For screenshot replication, use `sourceSize` from the reference image by default
```
To:
```
- Set `sourceSize` in templates from the reference image dimensions
- Set `fit`/`align` on slide instances, not in templates
```

**Step 4: Update lines 80-84 — Choose The Authoring Path**

Change:
```
- Use an exact built-in template only if the source already matches it closely.
- Otherwise create reusable templates by default:
  - One slide-scope template for the overall layout
  - Block-scope templates for repeating sub-regions
- Use an inline scene slide only if the composition is too idiosyncratic to template.
```
To:
```
- Always create fresh reusable templates:
  - One slide-scope template for the overall layout
  - Block-scope templates for repeating sub-regions
- Use an inline scene slide only if the composition is too idiosyncratic to template.
```

**Step 5: Update line 88 — Build The Scene sourceSize/fit/align**

Change:
```
- Set `sourceSize` to the reference image size. Use `fit: contain` and `align: center`.
```
To:
```
- Set `sourceSize` to the reference image size in the template. Set `fit: contain` and `align: center` on the slide instance.
```

**Step 6: Update line 117 — Replication Heuristics**

Change:
```
- Prefer scene over built-in templates unless there is a close structural match.
```
To:
```
- Always extract fresh templates. Do not use built-in templates for extraction.
```

**Step 7: Update line 131 — Output Format**

Change:
```
2. a short build note: layer, built-in vs reusable vs one-off, `sourceSize` decision
```
To:
```
2. a short build note: layer, reusable vs one-off, `sourceSize` decision
```

**Step 8: Verify the file**

Read back SKILL.md to confirm all changes are consistent and no contradictory guidance remains.

---

### Task 11: Run full test suite and verify

**Step 1: Run unit tests**

Run: `bun run test`
Expected: All tests pass

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors
