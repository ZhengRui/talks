# Block-Level Templates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable reusable scene templates at the block/group level, not just whole slides, so that a `kind: "block"` node in a slide's children can reference a `.template.yaml` that emits a scene fragment (a group with children).

**Architecture:** Add a new `SceneBlockNode` to the `SceneNode` union with `kind: "block"`. Block templates are standard `.template.yaml` files that emit a group (no `mode: scene` wrapper). A new `expandBlockNodes()` function walks the scene tree after slide-level DSL expansion and before compilation, replacing each `kind: "block"` node with the expanded group. Block templates can define `presets:` which get merged into the parent slide's preset map.

**Tech Stack:** TypeScript, Nunjucks, YAML, Vitest

---

### Task 1: Add `SceneBlockNode` type

**Files:**
- Modify: `src/lib/scene/types.ts:168-173`

**Step 1: Write the failing test**

File: `src/lib/scene/block.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import type { SceneBlockNode, SceneNode } from "./types";

describe("SceneBlockNode type", () => {
  it("is assignable to SceneNode", () => {
    const block: SceneBlockNode = {
      kind: "block",
      id: "stats-row",
      template: "stat-card-row",
    };
    // Type-level check: SceneBlockNode is part of SceneNode union
    const node: SceneNode = block;
    expect(node.kind).toBe("block");
  });

  it("accepts optional params and style", () => {
    const block: SceneBlockNode = {
      kind: "block",
      id: "stats-row",
      template: "stat-card-row",
      params: { stats: [{ value: "42%", label: "Growth" }] },
      style: { cardHeight: 200 },
    };
    expect(block.params).toBeDefined();
    expect(block.style).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/scene/block.test.ts`
Expected: FAIL — `SceneBlockNode` does not exist in types.ts

**Step 3: Write minimal implementation**

In `src/lib/scene/types.ts`, add the `SceneBlockNode` interface and update the union:

```typescript
// After SceneGroupNode (line 166), before the SceneNode union:

export interface SceneBlockNode extends SceneNodeBase {
  kind: "block";
  template: string;
  params?: Record<string, unknown>;
  style?: Record<string, string | number>;
}

// Update SceneNode union to include SceneBlockNode:
export type SceneNode =
  | SceneTextNode
  | SceneShapeNode
  | SceneImageNode
  | SceneIrNode
  | SceneGroupNode
  | SceneBlockNode;
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/scene/block.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/scene/types.ts src/lib/scene/block.test.ts
git commit -m "feat(scene): add SceneBlockNode type to SceneNode union

- New interface SceneBlockNode with kind: block, template, params, style
- Added to SceneNode discriminated union"
```

---

### Task 2: Add `expandBlockTemplate()` — the block-level Nunjucks renderer

This function takes a block node and a `DslTemplateDef`, renders the Nunjucks body, parses the YAML, and returns a `SceneGroupNode` plus any presets the block template declared.

**Files:**
- Create: `src/lib/dsl/block.ts`
- Modify: `src/lib/scene/block.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/scene/block.test.ts`:

```typescript
import { expandBlockTemplate } from "@/lib/dsl/block";
import type { DslTemplateDef } from "@/lib/dsl/types";
import type { SceneBlockNode, SceneGroupNode, ScenePreset } from "./types";

function makeBlockDef(overrides: Partial<DslTemplateDef>): DslTemplateDef {
  return {
    name: "test-block",
    params: {},
    rawBody: "",
    ...overrides,
  };
}

describe("expandBlockTemplate", () => {
  it("expands a block template into a group node", () => {
    const def = makeBlockDef({
      params: { label: { type: "string", required: true } },
      rawBody: `
kind: group
children:
  - kind: text
    id: label
    frame: { x: 0, y: 0, w: 200 }
    text: "{{ label }}"
    style:
      fontSize: 24
      lineHeight: 1.2
`,
    });

    const blockNode: SceneBlockNode = {
      kind: "block",
      id: "my-block",
      template: "test-block",
      params: { label: "Hello" },
    };

    const result = expandBlockTemplate(blockNode, def);
    expect(result.node.kind).toBe("group");
    expect(result.node.id).toBe("my-block");
    expect((result.node as SceneGroupNode).children).toHaveLength(1);
    expect((result.node as SceneGroupNode).children[0]).toMatchObject({
      kind: "text",
      id: "my-block.label",
      text: "Hello",
    });
  });

  it("preserves frame from the block node", () => {
    const def = makeBlockDef({
      rawBody: `
kind: group
children:
  - kind: shape
    id: bg
    frame: { x: 0, y: 0, w: 100, h: 50 }
    shape: rect
    style: { fill: "#333" }
`,
    });

    const blockNode: SceneBlockNode = {
      kind: "block",
      id: "panel",
      template: "test-block",
      frame: { left: 100, top: 200, w: 400, h: 300 },
    };

    const result = expandBlockTemplate(blockNode, def);
    expect(result.node.frame).toEqual({ left: 100, top: 200, w: 400, h: 300 });
  });

  it("merges block presets into returned presets", () => {
    const def = makeBlockDef({
      rawBody: `
presets:
  cardBg:
    borderRadius: 12
    style:
      fill: "#1a1a2e"
kind: group
children:
  - kind: shape
    id: card
    preset: cardBg
    frame: { x: 0, y: 0, w: 200, h: 100 }
    shape: rect
    style: { fill: "#222" }
`,
    });

    const blockNode: SceneBlockNode = {
      kind: "block",
      id: "card-block",
      template: "test-block",
    };

    const result = expandBlockTemplate(blockNode, def);
    expect(result.presets).toBeDefined();
    expect(result.presets!["card-block.cardBg"]).toMatchObject({
      borderRadius: 12,
    });
    // Preset references in children should be rewritten
    expect((result.node as SceneGroupNode).children[0]).toMatchObject({
      preset: "card-block.cardBg",
    });
  });

  it("applies style overrides from block node", () => {
    const def = makeBlockDef({
      params: { label: { type: "string", required: true } },
      style: { fontSize: { type: "number", default: 24 } },
      rawBody: `
kind: group
children:
  - kind: text
    id: label
    frame: { x: 0, y: 0, w: 200 }
    text: "{{ label }}"
    style:
      fontSize: {{ style.fontSize }}
      lineHeight: 1.2
`,
    });

    const blockNode: SceneBlockNode = {
      kind: "block",
      id: "sized",
      template: "test-block",
      params: { label: "Big" },
      style: { fontSize: 48 },
    };

    const result = expandBlockTemplate(blockNode, def);
    const text = (result.node as SceneGroupNode).children[0] as { style: { fontSize: number } };
    expect(text.style.fontSize).toBe(48);
  });

  it("throws on missing required param", () => {
    const def = makeBlockDef({
      name: "needs-label",
      params: { label: { type: "string", required: true } },
      rawBody: `
kind: group
children: []
`,
    });

    const blockNode: SceneBlockNode = {
      kind: "block",
      id: "bad",
      template: "needs-label",
    };

    expect(() => expandBlockTemplate(blockNode, def)).toThrow(
      /requires param "label"/,
    );
  });

  it("throws when block template emits mode: scene instead of kind: group", () => {
    const def = makeBlockDef({
      rawBody: `
mode: scene
children: []
`,
    });

    const blockNode: SceneBlockNode = {
      kind: "block",
      id: "wrong",
      template: "test-block",
    };

    expect(() => expandBlockTemplate(blockNode, def)).toThrow(
      /must emit.*kind.*group/i,
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/scene/block.test.ts`
Expected: FAIL — `expandBlockTemplate` does not exist

**Step 3: Write minimal implementation**

Create `src/lib/dsl/block.ts`:

```typescript
import nunjucks from "nunjucks";
import path from "path";
import { parse } from "yaml";
import type { DslTemplateDef } from "./types";
import type {
  SceneBlockNode,
  SceneGroupNode,
  SceneNode,
  ScenePreset,
} from "@/lib/scene/types";

const BUILT_IN_MACRO_DIR = path.join(process.cwd(), "src/lib/dsl/macros");
const BUILT_IN_TEMPLATE_DIR = path.join(process.cwd(), "src/lib/layout/templates");

// Same SmartArray as engine.ts — makes {{ array }} serialize as JSON
class SmartArray<T> extends Array<T> {
  override toString(): string {
    return JSON.stringify(this);
  }
}

function smartify(val: unknown): unknown {
  if (Array.isArray(val)) {
    const arr = new SmartArray<unknown>();
    for (const item of val) arr.push(smartify(item));
    return arr;
  }
  if (typeof val === "object" && val !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) out[k] = smartify(v);
    return out;
  }
  return val;
}

function createBlockEnvironment(templateDef: DslTemplateDef): nunjucks.Environment {
  const searchPaths = Array.from(new Set([
    ...(templateDef.sourcePath ? [path.dirname(templateDef.sourcePath)] : []),
    BUILT_IN_MACRO_DIR,
    BUILT_IN_TEMPLATE_DIR,
  ]));

  const loader = new nunjucks.FileSystemLoader(searchPaths, {
    noCache: process.env.NODE_ENV !== "production",
  });

  const env = new nunjucks.Environment(loader, {
    trimBlocks: true,
    lstripBlocks: true,
    autoescape: false,
  });

  env.addFilter("tojson", (val: unknown) => JSON.stringify(val));
  env.addFilter("yaml_string", (val: unknown) => {
    if (typeof val !== "string") return val;
    return val.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
  });

  return env;
}

export interface BlockExpansionResult {
  /** The expanded group node (with id from block node, children from template) */
  node: SceneGroupNode;
  /** Presets declared by the block template, namespaced to block id */
  presets?: Record<string, ScenePreset>;
}

/**
 * Prefix all `id` fields and `preset` references in a node tree with `prefix.`.
 */
function prefixNodeIds(node: SceneNode, prefix: string): SceneNode {
  const prefixed = {
    ...node,
    id: `${prefix}.${node.id}`,
    ...(node.preset ? { preset: `${prefix}.${node.preset}` } : {}),
  };
  if (node.kind === "group") {
    return {
      ...prefixed,
      children: node.children.map((child) => prefixNodeIds(child, prefix)),
    } as SceneGroupNode;
  }
  return prefixed as SceneNode;
}

/**
 * Expand a block template node into a SceneGroupNode.
 *
 * 1. Validate required params
 * 2. Build Nunjucks context from params + style
 * 3. Render and parse YAML
 * 4. Validate output is kind: group (not mode: scene)
 * 5. Prefix child ids with block node id
 * 6. Namespace presets with block node id
 * 7. Apply block node's frame to the resulting group
 */
export function expandBlockTemplate(
  blockNode: SceneBlockNode,
  templateDef: DslTemplateDef,
): BlockExpansionResult {
  // 1. Validate required params
  const params = blockNode.params ?? {};
  for (const [name, def] of Object.entries(templateDef.params)) {
    if (def.required && !(name in params)) {
      throw new Error(
        `[block] Template "${templateDef.name}" requires param "${name}" but it was not provided`,
      );
    }
  }

  // 2. Build style context
  const styleContext: Record<string, string | number> = {};
  if (templateDef.style) {
    for (const [name, def] of Object.entries(templateDef.style)) {
      styleContext[name] = def.default;
    }
  }
  if (blockNode.style) {
    for (const [k, v] of Object.entries(blockNode.style)) {
      if (v !== undefined) styleContext[k] = v;
    }
  }

  // 3. Build render context
  const context: Record<string, unknown> = { style: styleContext };
  for (const name of Object.keys(templateDef.params)) {
    if (name in params) {
      context[name] = smartify(params[name]);
    }
  }

  // 4. Render through Nunjucks
  let rendered: string;
  try {
    const env = createBlockEnvironment(templateDef);
    rendered = env.renderString(templateDef.rawBody, context);
  } catch (e) {
    throw new Error(
      `[block] Nunjucks render failed for block template "${templateDef.name}": ${e}`,
    );
  }

  // 5. Parse rendered YAML
  let parsed: Record<string, unknown>;
  try {
    parsed = parse(rendered) as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      `[block] YAML parse failed for block template "${templateDef.name}": ${e}\n\nRendered:\n${rendered}`,
    );
  }

  // 6. Validate output shape
  if (parsed.mode === "scene") {
    throw new Error(
      `[block] Block template "${templateDef.name}" must emit kind: group, not mode: scene. ` +
      `Block templates produce fragments, not whole slides.`,
    );
  }
  if (parsed.kind !== "group") {
    throw new Error(
      `[block] Block template "${templateDef.name}" must emit kind: group at the top level. ` +
      `Got kind: ${parsed.kind ?? "(missing)"}`,
    );
  }

  // 7. Extract presets (optional), namespace them
  const rawPresets = parsed.presets as Record<string, ScenePreset> | undefined;
  let namespacedPresets: Record<string, ScenePreset> | undefined;
  if (rawPresets) {
    namespacedPresets = {};
    for (const [name, preset] of Object.entries(rawPresets)) {
      namespacedPresets[`${blockNode.id}.${name}`] = preset;
    }
  }

  // 8. Build children with prefixed ids
  const rawChildren = (parsed.children ?? []) as SceneNode[];
  const prefixedChildren = rawChildren.map((child) =>
    prefixNodeIds(child, blockNode.id),
  );

  // 9. Construct the group node
  const groupNode: SceneGroupNode = {
    kind: "group",
    id: blockNode.id,
    ...(blockNode.frame ? { frame: blockNode.frame } : {}),
    ...(blockNode.preset ? { preset: blockNode.preset } : {}),
    ...(blockNode.opacity != null ? { opacity: blockNode.opacity } : {}),
    ...(blockNode.borderRadius != null ? { borderRadius: blockNode.borderRadius } : {}),
    ...(blockNode.shadow ? { shadow: blockNode.shadow } : {}),
    ...(blockNode.effects ? { effects: blockNode.effects } : {}),
    ...(blockNode.border ? { border: blockNode.border } : {}),
    ...(blockNode.entrance ? { entrance: blockNode.entrance } : {}),
    ...(blockNode.animation ? { animation: blockNode.animation } : {}),
    ...(blockNode.clipPath ? { clipPath: blockNode.clipPath } : {}),
    ...(blockNode.transform ? { transform: blockNode.transform } : {}),
    ...(blockNode.cssStyle ? { cssStyle: blockNode.cssStyle } : {}),
    ...(parsed.style ? { style: parsed.style as SceneGroupNode["style"] } : {}),
    ...(parsed.clipContent != null ? { clipContent: parsed.clipContent as boolean } : {}),
    ...(parsed.layout ? { layout: parsed.layout as SceneGroupNode["layout"] } : {}),
    children: prefixedChildren,
  };

  return {
    node: groupNode,
    presets: namespacedPresets,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/scene/block.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/dsl/block.ts src/lib/scene/block.test.ts
git commit -m "feat(dsl): add expandBlockTemplate for block-level template expansion

- Renders Nunjucks body, parses YAML, validates kind: group output
- Prefixes child ids with block node id for uniqueness
- Namespaces block presets to avoid slide-level collisions
- Carries frame, entrance, and other SceneNodeBase props from block node"
```

---

### Task 3: Add `expandBlockNodes()` — the tree walker

This function recursively walks a slide's children, finds `kind: "block"` nodes, expands them via `expandBlockTemplate()`, and collects presets to merge into the slide. It runs after slide-level DSL expansion and before compilation.

**Files:**
- Create: `src/lib/dsl/block-expand.ts`
- Modify: `src/lib/scene/block.test.ts`

**Step 1: Write the failing test**

Add to `src/lib/scene/block.test.ts`:

```typescript
import { expandBlockNodes } from "@/lib/dsl/block-expand";
import type { SceneSlideData } from "./types";

describe("expandBlockNodes", () => {
  it("expands a kind: block node in slide children", () => {
    // Register a mock template for this test
    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "text",
          id: "title",
          frame: { x: 100, y: 50, w: 600 },
          text: "Hello",
          style: { fontSize: 48, lineHeight: 1.1 },
        },
        {
          kind: "block",
          id: "stats",
          template: "test-stat-row",
          frame: { x: 100, y: 200, w: 800, h: 200 },
          params: { items: [{ value: "42", label: "Answer" }] },
        } as SceneBlockNode,
      ],
    };

    // expandBlockNodes takes a slug for template lookup + the slide data
    // For this test we use a template factory override
    const result = expandBlockNodes(slide, undefined, {
      "test-stat-row": {
        name: "test-stat-row",
        params: { items: { type: "array", required: true } },
        rawBody: `
kind: group
children:
  {% for item in items %}
  - kind: text
    id: val-{{ loop.index0 }}
    frame: { w: 200 }
    text: "{{ item.value }}"
    style: { fontSize: 48, lineHeight: 1 }
  {% endfor %}
`,
      },
    });

    expect(result.children).toHaveLength(2);
    expect(result.children[0].kind).toBe("text");
    expect(result.children[1].kind).toBe("group");
    expect(result.children[1].id).toBe("stats");
    const group = result.children[1] as SceneGroupNode;
    expect(group.children).toHaveLength(1);
    expect(group.children[0].id).toBe("stats.val-0");
  });

  it("expands nested block nodes inside groups", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "group",
          id: "container",
          frame: { x: 0, y: 0, w: 1920, h: 1080 },
          children: [
            {
              kind: "block",
              id: "inner",
              template: "simple-block",
              params: { text: "Nested" },
            } as SceneBlockNode,
          ],
        },
      ],
    };

    const result = expandBlockNodes(slide, undefined, {
      "simple-block": {
        name: "simple-block",
        params: { text: { type: "string", required: true } },
        rawBody: `
kind: group
children:
  - kind: text
    id: label
    frame: { w: 200 }
    text: "{{ text }}"
    style: { fontSize: 24, lineHeight: 1 }
`,
      },
    });

    const container = result.children[0] as SceneGroupNode;
    expect(container.children[0].kind).toBe("group");
    expect(container.children[0].id).toBe("inner");
    const inner = container.children[0] as SceneGroupNode;
    expect(inner.children[0].id).toBe("inner.label");
  });

  it("merges block presets into slide presets", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      presets: {
        existing: { style: { fill: "#000" } },
      },
      children: [
        {
          kind: "block",
          id: "card",
          template: "preset-block",
        } as SceneBlockNode,
      ],
    };

    const result = expandBlockNodes(slide, undefined, {
      "preset-block": {
        name: "preset-block",
        params: {},
        rawBody: `
presets:
  cardBg:
    borderRadius: 12
    style:
      fill: "#1a1a2e"
kind: group
children:
  - kind: shape
    id: bg
    preset: cardBg
    frame: { x: 0, y: 0, w: 200, h: 100 }
    shape: rect
    style: { fill: "#222" }
`,
      },
    });

    expect(result.presets).toHaveProperty("existing");
    expect(result.presets).toHaveProperty("card.cardBg");
  });

  it("detects circular block references", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "block",
          id: "a",
          template: "circular-a",
        } as SceneBlockNode,
      ],
    };

    // circular-a expands to contain a kind: block referencing circular-a
    // Since templates are rendered at Nunjucks time (not runtime), true circularity
    // would require a block template that itself contains kind: block in its output.
    // The depth guard catches this.
    const templates: Record<string, DslTemplateDef> = {
      "circular-a": {
        name: "circular-a",
        params: {},
        rawBody: `
kind: group
children:
  - kind: block
    id: nested
    template: circular-a
`,
      },
    };

    expect(() => expandBlockNodes(slide, undefined, templates)).toThrow(
      /maximum.*depth|circular/i,
    );
  });

  it("passes through slides with no block nodes unchanged", () => {
    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "text",
          id: "title",
          frame: { x: 0, y: 0, w: 600 },
          text: "No blocks",
          style: { fontSize: 48, lineHeight: 1.1 },
        },
      ],
    };

    const result = expandBlockNodes(slide);
    expect(result).toEqual(slide);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/scene/block.test.ts`
Expected: FAIL — `expandBlockNodes` does not exist

**Step 3: Write minimal implementation**

Create `src/lib/dsl/block-expand.ts`:

```typescript
import type { DslTemplateDef } from "./types";
import type {
  SceneBlockNode,
  SceneGroupNode,
  SceneNode,
  ScenePreset,
  SceneSlideData,
} from "@/lib/scene/types";
import { expandBlockTemplate } from "./block";
import { findTemplate } from "./loader";

const MAX_EXPANSION_DEPTH = 5;

interface ExpansionContext {
  slug?: string;
  depth: number;
  collectedPresets: Record<string, ScenePreset>;
  templateOverrides?: Record<string, DslTemplateDef>;
}

function resolveTemplate(
  name: string,
  ctx: ExpansionContext,
): DslTemplateDef | null {
  if (ctx.templateOverrides?.[name]) {
    return ctx.templateOverrides[name];
  }
  return findTemplate(name, ctx.slug);
}

function expandNodeTree(
  nodes: SceneNode[],
  ctx: ExpansionContext,
): SceneNode[] {
  return nodes.map((node) => {
    if (node.kind === "block") {
      if (ctx.depth >= MAX_EXPANSION_DEPTH) {
        throw new Error(
          `[block] Maximum block expansion depth (${MAX_EXPANSION_DEPTH}) exceeded ` +
          `while expanding "${node.template}". Possible circular reference.`,
        );
      }

      const def = resolveTemplate(node.template, ctx);
      if (!def) {
        throw new Error(
          `[block] Block template "${node.template}" not found for node "${node.id}"`,
        );
      }

      const result = expandBlockTemplate(node, def);

      // Collect presets
      if (result.presets) {
        Object.assign(ctx.collectedPresets, result.presets);
      }

      // Recursively expand any block nodes in the expanded group's children
      const innerCtx: ExpansionContext = {
        ...ctx,
        depth: ctx.depth + 1,
      };
      const expandedChildren = expandNodeTree(
        (result.node as SceneGroupNode).children,
        innerCtx,
      );

      return {
        ...result.node,
        children: expandedChildren,
      } as SceneGroupNode;
    }

    if (node.kind === "group") {
      return {
        ...node,
        children: expandNodeTree(node.children, ctx),
      } as SceneGroupNode;
    }

    return node;
  });
}

/**
 * Walk a slide's children tree and expand all `kind: "block"` nodes.
 *
 * Block presets are collected and merged into the slide's preset map.
 * Supports nested block templates up to MAX_EXPANSION_DEPTH.
 *
 * @param templateOverrides — test-only: supply templates without hitting the filesystem
 */
export function expandBlockNodes(
  slide: SceneSlideData,
  slug?: string,
  templateOverrides?: Record<string, DslTemplateDef>,
): SceneSlideData {
  // Quick check: any block nodes at all?
  if (!hasBlockNodes(slide.children)) {
    return slide;
  }

  const ctx: ExpansionContext = {
    slug,
    depth: 0,
    collectedPresets: {},
    templateOverrides,
  };

  const expandedChildren = expandNodeTree(slide.children, ctx);

  // Merge collected presets into slide presets
  const mergedPresets =
    Object.keys(ctx.collectedPresets).length > 0
      ? { ...(slide.presets ?? {}), ...ctx.collectedPresets }
      : slide.presets;

  return {
    ...slide,
    ...(mergedPresets ? { presets: mergedPresets } : {}),
    children: expandedChildren,
  };
}

function hasBlockNodes(nodes: SceneNode[]): boolean {
  return nodes.some((node) => {
    if (node.kind === "block") return true;
    if (node.kind === "group") return hasBlockNodes(node.children);
    return false;
  });
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/scene/block.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/dsl/block-expand.ts src/lib/scene/block.test.ts
git commit -m "feat(dsl): add expandBlockNodes tree walker for block template expansion

- Recursively walks slide children, expands kind: block nodes
- Merges block presets into slide presets with namespacing
- Depth guard (max 5) prevents circular references
- Test-only templateOverrides param for isolated testing"
```

---

### Task 4: Wire `expandBlockNodes()` into `loadPresentation()`

**Files:**
- Modify: `src/lib/loadPresentation.ts:10-18`
- Modify: `src/lib/loadPresentation.test.ts` (add integration test)

**Step 1: Write the failing test**

Add to `src/lib/loadPresentation.test.ts` (or create if adding to existing):

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { loadPresentation } from "./loadPresentation";

describe("loadPresentation block expansion", () => {
  const slug = "__test-block-expand__";
  const contentDir = path.join(process.cwd(), "content", slug);
  const templatesDir = path.join(contentDir, "templates");

  beforeAll(() => {
    fs.mkdirSync(templatesDir, { recursive: true });

    // Write a block template
    fs.writeFileSync(
      path.join(templatesDir, "test-badge.template.yaml"),
      `name: test-badge
params:
  text: { type: string, required: true }

kind: group
children:
  - kind: text
    id: label
    frame: { x: 0, y: 0, w: 120 }
    text: "{{ text }}"
    style:
      fontSize: 18
      lineHeight: 1.1
`,
    );

    // Write slides.yaml using the block template
    fs.writeFileSync(
      path.join(contentDir, "slides.yaml"),
      `title: Block Test
slides:
  - mode: scene
    children:
      - kind: text
        id: title
        frame: { x: 100, y: 50, w: 600 }
        text: "Slide Title"
        style:
          fontSize: 48
          lineHeight: 1.1
      - kind: block
        id: badge
        template: test-badge
        frame: { x: 100, y: 200, w: 200, h: 60 }
        params:
          text: "NEW"
`,
    );
  });

  afterAll(() => {
    fs.rmSync(contentDir, { recursive: true, force: true });
  });

  it("expands block nodes during presentation loading", () => {
    const pres = loadPresentation(slug);
    const slide = pres.slides[0];

    expect(slide.mode).toBe("scene");
    expect(slide.children).toHaveLength(2);
    expect(slide.children[0].kind).toBe("text");
    expect(slide.children[1].kind).toBe("group");
    expect(slide.children[1].id).toBe("badge");

    const group = slide.children[1] as { children: Array<{ id: string; text: string }> };
    expect(group.children[0].id).toBe("badge.label");
    expect(group.children[0].text).toBe("NEW");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/loadPresentation.test.ts`
Expected: FAIL — block nodes are returned unexpanded (kind: "block" stays in children)

**Step 3: Write minimal implementation**

Modify `src/lib/loadPresentation.ts`:

```typescript
import fs from "fs";
import path from "path";
import { parse } from "yaml";
import type { PresentationData, PresentationSummary } from "./types";
import type { SceneSlideData } from "./scene/types";
import { findTemplate } from "./dsl/loader";
import { expandDslTemplate } from "./dsl/engine";
import { expandBlockNodes } from "./dsl/block-expand";

const CONTENT_DIR = path.join(process.cwd(), "content");

export function loadPresentation(slug: string): PresentationData {
  const filePath = path.join(CONTENT_DIR, slug, "slides.yaml");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = parse(raw) as { title: string; author?: string; theme?: string; slides: Record<string, unknown>[] };

  // Expand DSL templates into scene slides, then expand block nodes
  const slides = data.slides.map((slide) => {
    const expanded = expandSlideIfDsl(slide, slug);
    // If the slide has mode: scene, expand any block nodes in its children
    if ((expanded as Record<string, unknown>).mode === "scene") {
      return expandBlockNodes(
        expanded as unknown as SceneSlideData,
        slug,
      ) as unknown as Record<string, unknown>;
    }
    return expanded;
  });

  return { ...data, slides } as unknown as PresentationData;
}

// ... rest of file unchanged
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/loadPresentation.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `bun run test`
Expected: All existing tests still pass. The new block expansion is a no-op for slides without `kind: "block"` nodes.

**Step 6: Commit**

```bash
git add src/lib/loadPresentation.ts src/lib/loadPresentation.test.ts
git commit -m "feat(load): wire block template expansion into loadPresentation

- After slide-level DSL expansion, expandBlockNodes walks children
- No-op for slides without kind: block nodes
- Integration test with deck-local block template"
```

---

### Task 5: Handle `kind: "block"` in normalize and compiler switch statements

The normalize and compiler switch on `node.kind`. Even though `expandBlockNodes()` removes all block nodes before compilation, TypeScript's exhaustive switch check will fail since `SceneBlockNode` is now in the union. Add a guard case.

**Files:**
- Modify: `src/lib/scene/normalize.ts:289-317`
- Modify: `src/lib/scene/compiler.ts:430-469`

**Step 1: Write the failing test**

Run: `bun run test`
Expected: TypeScript compilation errors in `normalizeSceneNode` and `scaleSceneNode` switch statements (non-exhaustive). If the project uses strict mode with `noImplicitReturns`, these will surface as type errors.

If no compilation error occurs, verify by adding a unit test:

```typescript
// In src/lib/scene/block.test.ts
import { normalizeSceneNode } from "./normalize";
import { resolveTheme } from "@/lib/layout/theme";

describe("normalize guard for block nodes", () => {
  it("throws if a block node reaches normalization unexpanded", () => {
    const theme = resolveTheme("dark-tech");
    const blockNode = {
      kind: "block" as const,
      id: "stale",
      template: "something",
    };
    expect(() =>
      normalizeSceneNode(blockNode as SceneNode, theme, "/test"),
    ).toThrow(/must be expanded/i);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/scene/block.test.ts`
Expected: FAIL or type error

**Step 3: Write minimal implementation**

In `src/lib/scene/normalize.ts`, add a case in `normalizeSceneNode` (around line 296):

```typescript
case "block":
  throw new Error(
    `[scene] Block node "${mergedNode.id}" must be expanded before normalization. ` +
    `Call expandBlockNodes() before compileSceneSlide().`,
  );
```

In `src/lib/scene/compiler.ts`, add a case in `scaleSceneNode` (around line 440):

```typescript
case "block":
  throw new Error(
    `[scene] Block node "${node.id}" must be expanded before compilation. ` +
    `Call expandBlockNodes() before compileSceneSlide().`,
  );
```

Also in `compiler.ts`, add the `SceneBlockNode` import and update `validateSceneNodeIds` to walk block nodes if they somehow slip through (around line 472):

```typescript
// In validateSceneNodeIds, the group case also needs no change since block
// nodes have no children field — they'll just be visited for their id.
```

**Step 4: Run test to verify it passes**

Run: `bun run test`
Expected: All tests pass, including the new guard test.

**Step 5: Commit**

```bash
git add src/lib/scene/normalize.ts src/lib/scene/compiler.ts src/lib/scene/block.test.ts
git commit -m "fix(scene): add guard cases for unexpanded block nodes in normalize/compiler

- Throws descriptive error if kind: block reaches normalization or scaling
- Prevents silent failures if expandBlockNodes is skipped"
```

---

### Task 6: Update the loader to recognize block templates

The `extractTemplateHeader` in `loader.ts` currently stops at keys that aren't in `{name, alias, params, style}`. A block template has `kind:` at the top level instead of `mode:`. The header extraction already handles this correctly (it stops at `kind:` and only captures `name`/`params`/`style`), so the loader works as-is.

However, we should add a `scope` field to `DslTemplateDef` so the system can distinguish block templates from slide templates during discovery (useful for the replication UI).

**Files:**
- Modify: `src/lib/dsl/types.ts:14-21`
- Modify: `src/lib/dsl/loader.ts:72-107`
- Add test in: `src/lib/scene/block.test.ts`

**Step 1: Write the failing test**

```typescript
// In src/lib/scene/block.test.ts
import { findTemplate, clearTemplateCache } from "@/lib/dsl/loader";

describe("block template discovery", () => {
  const slug = "__test-block-discovery__";
  const contentDir = path.join(process.cwd(), "content", slug);
  const templatesDir = path.join(contentDir, "templates");

  beforeAll(() => {
    fs.mkdirSync(templatesDir, { recursive: true });
    fs.writeFileSync(
      path.join(templatesDir, "my-card.template.yaml"),
      `name: my-card
scope: block
params:
  title: { type: string, required: true }

kind: group
children:
  - kind: text
    id: label
    frame: { w: 200 }
    text: "{{ title }}"
    style: { fontSize: 24, lineHeight: 1 }
`,
    );
  });

  afterAll(() => {
    clearTemplateCache();
    fs.rmSync(contentDir, { recursive: true, force: true });
  });

  it("discovers block templates with scope field", () => {
    const def = findTemplate("my-card", slug);
    expect(def).not.toBeNull();
    expect(def!.name).toBe("my-card");
    expect(def!.scope).toBe("block");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/scene/block.test.ts`
Expected: FAIL — `scope` property does not exist on `DslTemplateDef`

**Step 3: Write minimal implementation**

In `src/lib/dsl/types.ts`, add `scope` to `DslTemplateDef`:

```typescript
export interface DslTemplateDef {
  name: string;
  alias?: string;
  scope?: "slide" | "block";
  params: Record<string, DslParamDef>;
  style?: Record<string, DslStyleDef>;
  sourcePath?: string;
  rawBody: string;
}
```

In `src/lib/dsl/loader.ts`, update `extractTemplateHeader` to include `scope` in allowed keys (line 112):

```typescript
const allowedTopLevelKeys = new Set(["name", "alias", "scope", "params", "style"]);
```

And in `parseTemplateFile`, pass through the scope (around line 95-102):

```typescript
return {
  name: parsed.name ?? templateName,
  ...(parsed.alias ? { alias: parsed.alias } : {}),
  ...(parsed.scope ? { scope: parsed.scope } : {}),
  params: parsed.params ?? {},
  style: parsed.style,
  sourcePath: filePath,
  rawBody: raw,
};
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/scene/block.test.ts`
Expected: PASS

**Step 5: Run full test suite**

Run: `bun run test`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/lib/dsl/types.ts src/lib/dsl/loader.ts src/lib/scene/block.test.ts
git commit -m "feat(dsl): add scope field to DslTemplateDef for block template discovery

- New optional scope: 'slide' | 'block' in template header
- Loader extracts scope from template front matter
- Enables UI to distinguish block templates from slide templates"
```

---

### Task 7: End-to-end integration test — block template through full pipeline

Verify that a slide with `kind: "block"` nodes compiles all the way through to `LayoutSlide` elements.

**Files:**
- Modify: `src/lib/scene/block.test.ts`

**Step 1: Write the test**

```typescript
import { compileSceneSlide } from "./compiler";
import { resolveTheme } from "@/lib/layout/theme";
import { expandBlockNodes } from "@/lib/dsl/block-expand";

describe("block template end-to-end", () => {
  it("compiles a slide with expanded block nodes to layout elements", () => {
    const theme = resolveTheme("dark-tech");

    const slide: SceneSlideData = {
      mode: "scene",
      children: [
        {
          kind: "text",
          id: "title",
          frame: { x: 160, y: 80, w: 800 },
          text: "Dashboard",
          style: {
            fontFamily: "heading",
            fontSize: 48,
            fontWeight: 700,
            color: "theme.heading",
            lineHeight: 1.15,
          },
        },
        {
          kind: "block",
          id: "metrics",
          template: "metric-row",
          frame: { x: 160, y: 200, w: 800, h: 120 },
          params: {
            items: [
              { value: "99.9%", label: "Uptime" },
              { value: "42ms", label: "Latency" },
            ],
          },
        } as SceneBlockNode,
      ],
    };

    // Expand block nodes with inline template override
    const expanded = expandBlockNodes(slide, undefined, {
      "metric-row": {
        name: "metric-row",
        params: { items: { type: "array", required: true } },
        rawBody: `
kind: group
layout: { type: row, gap: 32 }
children:
  {% for item in items %}
  - kind: group
    id: metric-{{ loop.index0 }}
    frame: { h: 120 }
    children:
      - kind: text
        id: metric-{{ loop.index0 }}-value
        frame: { x: 0, y: 0, w: 200 }
        text: "{{ item.value }}"
        style: { fontSize: 36, fontWeight: 700, lineHeight: 1 }
      - kind: text
        id: metric-{{ loop.index0 }}-label
        frame: { x: 0, y: 48, w: 200 }
        text: "{{ item.label }}"
        style: { fontSize: 16, lineHeight: 1.4 }
  {% endfor %}
`,
      },
    });

    // Block nodes should be gone
    expect(expanded.children[1].kind).toBe("group");

    // Compile to layout
    const layout = compileSceneSlide(expanded, theme, "/test");
    expect(layout.elements.length).toBeGreaterThanOrEqual(2);

    // Find the metrics group
    const metricsEl = layout.elements.find((el) => el.id === "metrics");
    expect(metricsEl).toBeDefined();
    expect(metricsEl!.kind).toBe("group");
    expect(metricsEl!.rect.x).toBe(160);
  });
});
```

**Step 2: Run test**

Run: `bun run test -- src/lib/scene/block.test.ts`
Expected: PASS — if all previous tasks are complete.

**Step 3: Commit**

```bash
git add src/lib/scene/block.test.ts
git commit -m "test(scene): add end-to-end test for block template through full compile pipeline

- Verifies block expansion + scene compilation produces correct LayoutSlide
- Tests id prefixing, frame propagation, and layout element generation"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | `SceneBlockNode` type | `types.ts` |
| 2 | `expandBlockTemplate()` — render one block | `dsl/block.ts` |
| 3 | `expandBlockNodes()` — tree walker | `dsl/block-expand.ts` |
| 4 | Wire into `loadPresentation()` | `loadPresentation.ts` |
| 5 | Guard cases in normalize/compiler | `normalize.ts`, `compiler.ts` |
| 6 | `scope` field for template discovery | `types.ts`, `loader.ts` |
| 7 | End-to-end integration test | `block.test.ts` |

After this, the replication UI can propose block-level templates as `.template.yaml` files with `scope: block` that emit `kind: group`, and slides can compose them with `kind: block` references.
