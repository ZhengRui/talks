import fs from "fs";
import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SceneBlockNode, SceneGroupNode, SceneNode, SceneSlideData } from "./types";
import { expandBlockTemplate } from "@/lib/dsl/block";
import { expandBlockNodes } from "@/lib/dsl/block-expand";
import { findTemplate, clearTemplateCache } from "@/lib/dsl/loader";
import type { DslTemplateDef } from "@/lib/dsl/types";
import { normalizeSceneNode } from "./normalize";
import { compileSceneSlide } from "./compiler";
import { resolveTheme } from "@/lib/layout/theme";

function makeBlockDef(overrides: Partial<DslTemplateDef>): DslTemplateDef {
  return {
    name: "test-block",
    params: {},
    rawBody: "",
    ...overrides,
  };
}

describe("SceneBlockNode type", () => {
  it("is assignable to SceneNode", () => {
    const block: SceneBlockNode = {
      kind: "block",
      id: "stats-row",
      template: "stat-card-row",
    };
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
      /must not emit mode.*scene/i,
    );
  });

  it("allows scope: block templates to omit kind: group", () => {
    const def = makeBlockDef({
      scope: "block",
      params: { label: { type: "string", required: true } },
      rawBody: `
name: norm
scope: block
params:
  label: { type: string, required: true }

layout: { type: stack, gap: 8 }
children:
  - kind: text
    id: label
    frame: { w: 200 }
    text: "{{ label }}"
    style: { fontSize: 24, lineHeight: 1.2 }
`,
    });

    const blockNode: SceneBlockNode = {
      kind: "block",
      id: "norm",
      template: "norm",
      params: { label: "Works" },
    };

    const result = expandBlockTemplate(blockNode, def);
    expect(result.node.kind).toBe("group");
    expect(result.node.id).toBe("norm");
    expect((result.node as SceneGroupNode).children[0]).toMatchObject({
      id: "norm.label",
      text: "Works",
    });
    expect(result.node.layout).toMatchObject({ type: "stack", gap: 8 });
  });

  it("rejects scope: slide templates used as blocks", () => {
    const def = makeBlockDef({
      scope: "slide",
      rawBody: `mode: scene\nchildren: []`,
    });

    const blockNode: SceneBlockNode = {
      kind: "block",
      id: "wrong",
      template: "test-block",
    };

    expect(() => expandBlockTemplate(blockNode, def)).toThrow(
      /scope.*slide.*cannot.*block/i,
    );
  });
});

describe("expandBlockNodes", () => {
  it("expands a kind: block node in slide children", () => {
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

  it("detects circular block references via depth guard", () => {
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

describe("scope auto-inference", () => {
  const slug = "__test-scope-infer__";
  const contentDir = path.join(process.cwd(), "content", slug);
  const templatesDir = path.join(contentDir, "templates");

  beforeAll(() => {
    fs.mkdirSync(templatesDir, { recursive: true });

    // Legacy template with mode: scene, no explicit scope
    fs.writeFileSync(
      path.join(templatesDir, "legacy-slide.template.yaml"),
      `name: legacy-slide
params:
  title: { type: string }

mode: scene
children:
  - kind: text
    id: t
    frame: { w: 100 }
    text: "{{ title }}"
    style: { fontSize: 48, lineHeight: 1 }
`,
    );

    // Legacy template with kind: group, no explicit scope
    fs.writeFileSync(
      path.join(templatesDir, "legacy-block.template.yaml"),
      `name: legacy-block
params:
  label: { type: string }

kind: group
children:
  - kind: text
    id: t
    frame: { w: 100 }
    text: "{{ label }}"
    style: { fontSize: 16, lineHeight: 1 }
`,
    );

    // New normalized slide template (scope: slide, no mode: scene)
    fs.writeFileSync(
      path.join(templatesDir, "new-slide.template.yaml"),
      `name: new-slide
scope: slide
params:
  title: { type: string }

children:
  - kind: text
    id: t
    frame: { w: 100 }
    text: "{{ title }}"
    style: { fontSize: 48, lineHeight: 1 }
`,
    );
  });

  afterAll(() => {
    clearTemplateCache();
    fs.rmSync(contentDir, { recursive: true, force: true });
  });

  it("infers scope: slide from mode: scene", () => {
    const def = findTemplate("legacy-slide", slug);
    expect(def!.scope).toBe("slide");
  });

  it("infers scope: block from kind: group", () => {
    const def = findTemplate("legacy-block", slug);
    expect(def!.scope).toBe("block");
  });

  it("preserves explicit scope: slide without mode: scene", () => {
    const def = findTemplate("new-slide", slug);
    expect(def!.scope).toBe("slide");
  });
});

describe("normalize guard for block nodes", () => {
  it("throws if a block node reaches normalization unexpanded", () => {
    const theme = resolveTheme("dark-tech");
    const blockNode = {
      kind: "block" as const,
      id: "stale",
      template: "something",
    };
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      normalizeSceneNode(blockNode as any, theme, "/test"),
    ).toThrow(/must be expanded/i);
  });
});

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
