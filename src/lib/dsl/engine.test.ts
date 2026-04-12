import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect } from "vitest";
import { expandDslTemplate } from "./engine";
import type { DslTemplateDef } from "./types";

function makeDef(overrides: Partial<DslTemplateDef>): DslTemplateDef {
  return {
    name: "test",
    params: {},
    rawBody: "",
    ...overrides,
  };
}

describe("expandDslTemplate", () => {
  it("expands simple variable substitution", () => {
    const def = makeDef({
      params: { title: { type: "string", required: true } },
      rawBody: `
mode: scene
children:
  - kind: text
    id: title
    frame: { x: 0, y: 0, w: 640 }
    text: "{{ title }}"
    style:
      fontFamily: "heading"
      fontSize: 56
      fontWeight: 700
      color: "#ffffff"
      lineHeight: 1.1
`,
    });

    const result = expandDslTemplate({ template: "test", params: { title: "Hello World" } }, def);
    expect(result).not.toHaveProperty("template");
    expect((result as unknown as { children: unknown[] }).children).toHaveLength(1);
    expect((result as unknown as { children: Record<string, unknown>[] }).children[0]).toMatchObject({
      kind: "text",
      id: "title",
      text: "Hello World",
      style: { fontSize: 56 },
    });
  });

  it("expands array substitution to valid YAML", () => {
    const def = makeDef({
      params: { bullets: { type: "string[]", required: true } },
      rawBody: `
mode: scene
children:
  - kind: ir
    id: bullets
    element:
      kind: list
      id: bullets-element
      rect: { x: 0, y: 0, w: 640, h: 200 }
      items: {{ bullets }}
      ordered: false
      itemStyle:
        fontFamily: "body"
        fontSize: 20
        fontWeight: 400
        color: "#ffffff"
        lineHeight: 1.4
      bulletColor: "#ffffff"
      itemSpacing: 12
`,
    });

    const result = expandDslTemplate(
      { template: "test", params: { bullets: ["First", "Second", "Third"] } },
      def,
    );
    const children = (result as unknown as { children: Record<string, unknown>[] }).children;
    expect(children[0]).toMatchObject({ kind: "ir", id: "bullets" });
    expect((children[0] as { element: { items: unknown } }).element.items).toEqual(["First", "Second", "Third"]);
  });

  it("expands conditional block when value is present", () => {
    const def = makeDef({
      params: {
        statement: { type: "string", required: true },
        subtitle: { type: "string" },
      },
      rawBody: `
mode: scene
children:
  - kind: text
    id: statement
    frame: { x: 0, y: 0, w: 800 }
    text: "{{ statement }}"
    style:
      fontFamily: "heading"
      fontSize: 72
      color: "#ffffff"
      lineHeight: 1.1
  {% if subtitle %}
  - kind: text
    id: subtitle
    frame: { x: 0, y: 96, w: 800 }
    text: "{{ subtitle }}"
    style:
      fontFamily: "body"
      fontSize: 28
      color: "#bbbbbb"
      lineHeight: 1.4
  {% endif %}
`,
    });

    const withSub = expandDslTemplate(
      { template: "test", params: { statement: "Big Idea", subtitle: "Details" } },
      def,
    );
    const withoutSub = expandDslTemplate(
      { template: "test", params: { statement: "Big Idea" } },
      def,
    );

    expect((withSub as unknown as { children: unknown[] }).children).toHaveLength(2);
    expect((withoutSub as unknown as { children: unknown[] }).children).toHaveLength(1);
  });

  it("expands for loops", () => {
    const def = makeDef({
      params: { stats: { type: "array", required: true } },
      rawBody: `
mode: scene
children:
  - kind: group
    id: stats
    children:
      {% for s in stats %}
      - kind: text
        id: "stat-{{ loop.index }}"
        frame: { x: 0, y: {{ loop.index0 * 40 }}, w: 320 }
        text: "{{ s.value }}: {{ s.label }}"
        style:
          fontFamily: "heading"
          fontSize: 32
          color: "#ffffff"
          lineHeight: 1.2
      {% endfor %}
`,
    });

    const result = expandDslTemplate(
      {
        template: "test",
        params: {
          stats: [
            { value: "42", label: "Answer" },
            { value: "7", label: "Days" },
          ],
        },
      },
      def,
    );

    const children = (result as unknown as { children: Record<string, unknown>[] }).children;
    const columns = children[0] as unknown as { children: Record<string, unknown>[] };
    expect(columns.children).toHaveLength(2);
    expect(columns.children[0]).toMatchObject({ text: "42: Answer" });
    expect(columns.children[1]).toMatchObject({ text: "7: Days" });
  });

  it("supports loop.last for conditional dividers", () => {
    const def = makeDef({
      params: { defs: { type: "array", required: true } },
      rawBody: `
mode: scene
children:
  {% for d in defs %}
  - kind: text
    id: "term-{{ loop.index }}"
    frame: { x: 0, y: {{ loop.index0 * 120 }}, w: 320 }
    text: "{{ d.term }}"
    style:
      fontFamily: "heading"
      fontSize: 28
      fontWeight: 700
      color: "#ffffff"
      lineHeight: 1.2
  - kind: text
    id: "desc-{{ loop.index }}"
    frame: { x: 0, y: {{ loop.index0 * 120 + 40 }}, w: 420 }
    text: "{{ d.desc }}"
    style:
      fontFamily: "body"
      fontSize: 20
      color: "#bbbbbb"
      lineHeight: 1.4
  {% if not loop.last %}
  - kind: shape
    id: "divider-{{ loop.index }}"
    frame: { x: 0, y: {{ loop.index0 * 120 + 92 }}, w: 240, h: 2 }
    shape: rect
    style: { fill: "#666666" }
  {% endif %}
  {% endfor %}
`,
    });

    const result = expandDslTemplate(
      {
        template: "test",
        params: {
          defs: [
            { term: "A", desc: "Desc A" },
            { term: "B", desc: "Desc B" },
          ],
        },
      },
      def,
    );

    const children = (result as unknown as { children: unknown[] }).children;
    // A-term, A-desc, divider, B-term, B-desc (no divider after last)
    expect(children).toHaveLength(5);
    expect((children[2] as Record<string, unknown>).kind).toBe("shape");
  });

  it("supports nested loops when the outer index is captured with set", () => {
    const def = makeDef({
      params: { tiers: { type: "array", required: true } },
      rawBody: `
mode: scene
children:
  {% for tier in tiers %}
  {% set tierIdx = loop.index0 %}
  {% for label in tier.leftLabels %}
  - kind: text
    id: "pyramid-label-{{ tierIdx }}-{{ loop.index0 }}"
    frame: { x: 0, y: {{ tierIdx * 100 + loop.index0 * 40 }}, w: 200 }
    text: "{{ label }}"
    style:
      fontFamily: "body"
      fontSize: 18
      color: "#ffffff"
      lineHeight: 1.2
  {% endfor %}
  {% endfor %}
`,
    });

    const result = expandDslTemplate(
      {
        template: "test",
        params: {
          tiers: [
            { leftLabels: ["Lead", "Coach"] },
            { leftLabels: ["Enable"] },
          ],
        },
      },
      def,
    );

    const children = (result as unknown as { children: Array<Record<string, unknown>> }).children;
    expect(children.map((child) => child.id)).toEqual([
      "pyramid-label-0-0",
      "pyramid-label-0-1",
      "pyramid-label-1-0",
    ]);
  });

  it("applies style defaults", () => {
    const def = makeDef({
      params: { title: { type: "string", required: true } },
      style: { titleSize: { type: "number", default: 56 } },
      rawBody: `
mode: scene
children:
  - kind: text
    id: title
    frame: { x: 0, y: 0, w: 640 }
    text: "{{ title }}"
    style:
      fontFamily: "heading"
      fontSize: {{ style.titleSize }}
      color: "#ffffff"
      lineHeight: 1.1
`,
    });

    const result = expandDslTemplate({ template: "test", params: { title: "Test" } }, def);
    const children = (result as unknown as { children: Record<string, unknown>[] }).children;
    expect((children[0] as { style: { fontSize: number } }).style.fontSize).toBe(56);
  });

  it("merges style overrides with defaults", () => {
    const def = makeDef({
      params: { title: { type: "string", required: true } },
      style: { titleSize: { type: "number", default: 56 } },
      rawBody: `
mode: scene
children:
  - kind: text
    id: title
    frame: { x: 0, y: 0, w: 640 }
    text: "{{ title }}"
    style:
      fontFamily: "heading"
      fontSize: {{ style.titleSize }}
      color: "#ffffff"
      lineHeight: 1.1
`,
    });

    const result = expandDslTemplate(
      { template: "test", params: { title: "Test" }, style: { titleSize: 72 } },
      def,
    );
    const children = (result as unknown as { children: Record<string, unknown>[] }).children;
    expect((children[0] as { style: { fontSize: number } }).style.fontSize).toBe(72);
  });

  it("throws on missing required param", () => {
    const def = makeDef({
      name: "my-template",
      params: { title: { type: "string", required: true } },
      rawBody: `
mode: scene
children: []
`,
    });

    expect(() => expandDslTemplate({ template: "my-template" }, def)).toThrow(
      /requires param "title"/,
    );
  });

  it("produces scene slides with children", () => {
    const def = makeDef({
      params: { text: { type: "string", required: true } },
      rawBody: `
mode: scene
children:
  - kind: text
    id: title
    frame: { x: 0, y: 0, w: 400 }
    text: "{{ text }}"
    style:
      fontFamily: "heading"
      fontSize: 48
      color: "#ffffff"
      lineHeight: 1.1
`,
    });

    const result = expandDslTemplate({ template: "test", params: { text: "Hi" } }, def);
    expect(result).not.toHaveProperty("template");
    expect(result).toHaveProperty("mode", "scene");
    expect(result).toHaveProperty("children");
  });

  it("passes through animation and theme from slide data", () => {
    const def = makeDef({
      rawBody: `
mode: scene
children: []
`,
    });

    const result = expandDslTemplate(
      { template: "test", animation: "fade", theme: "bold" },
      def,
    );
    expect(result).toHaveProperty("animation", "fade");
    expect(result).toHaveProperty("theme", "bold");
  });

  it("handles tojson filter for multiline strings", () => {
    const def = makeDef({
      params: { code: { type: "string", required: true } },
      rawBody: `
mode: scene
children:
  - kind: text
    id: code
    frame: { x: 0, y: 0, w: 640 }
    text: {{ code | tojson }}
    style:
      fontFamily: "mono"
      fontSize: 18
      color: "#ffffff"
      lineHeight: 1.4
`,
    });

    const code = 'function greet() {\n  return "hello";\n}';
    const result = expandDslTemplate({ template: "test", params: { code } }, def);
    const children = (result as unknown as { children: Record<string, unknown>[] }).children;
    expect(children[0].text).toBe(code);
  });

  it("handles or operator for default values", () => {
    const def = makeDef({
      params: { title: { type: "string" } },
      rawBody: `
mode: scene
children:
  - kind: text
    id: title
    frame: { x: 0, y: 0, w: 400 }
    text: "{{ title or 'Thank You' }}"
    style:
      fontFamily: "heading"
      fontSize: 56
      color: "#ffffff"
      lineHeight: 1.1
`,
    });

    const withTitle = expandDslTemplate({ template: "test", params: { title: "Goodbye" } }, def);
    const withoutTitle = expandDslTemplate({ template: "test" }, def);

    expect(
      (withTitle as unknown as { children: Record<string, unknown>[] }).children[0].text,
    ).toBe("Goodbye");
    expect(
      (withoutTitle as unknown as { children: Record<string, unknown>[] }).children[0].text,
    ).toBe("Thank You");
  });

  it("throws when a template emits a non-scene mode", () => {
    const def = makeDef({
      params: { title: { type: "string", required: true } },
      rawBody: `
mode: legacy
children: []
`,
    });

    expect(() => expandDslTemplate({ template: "test", params: { title: "No Base" } }, def)).toThrow(
      /mode.*legacy.*expected.*scene/i,
    );
  });

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

  it("preserves scene presets and deep-merges slide-level preset overrides", () => {
    const def = makeDef({
      rawBody: `
mode: scene
presets:
  card:
    borderRadius: 16
    frame: { w: 240 }
    style:
      fill: "#1f2a44"
      strokeWidth: 2
children:
  - kind: shape
    id: panel
    preset: card
    frame: { x: 40, y: 40, h: 120 }
    shape: rect
    style:
      fill: "#223355"
`,
    });

    const result = expandDslTemplate(
      {
        template: "test",
        presets: {
          card: {
            borderRadius: 24,
            style: { strokeWidth: 4 },
          },
        },
      },
      def,
    ) as unknown as { mode: string; presets: Record<string, unknown>; children: Record<string, unknown>[] };

    expect(result.mode).toBe("scene");
    expect(result.presets.card).toMatchObject({
      borderRadius: 24,
      frame: { w: 240 },
      style: {
        fill: "#1f2a44",
        strokeWidth: 4,
      },
    });
    expect(result.children[0]).toMatchObject({
      kind: "shape",
      preset: "card",
    });
  });

  it("supports importing built-in scene macro libraries", () => {
    const def = makeDef({
      rawBody: `
{% import "scene/blocks.njk" as scene %}
mode: scene
presets:
  statCard:
    borderRadius: 16
    style:
      fill: "#1f2a44"
  statValue:
    style:
      fontFamily: "heading"
      color: "#ff6b35"
  statLabel:
    style:
      fontFamily: "heading"
      color: "#ffffff"
children:
{{ scene.stat_card("first", 40, 80, 220, 120, "500", "MISSILES") }}
`,
    });

    const result = expandDslTemplate({ template: "test" }, def) as unknown as {
      mode: string;
      children: Array<Record<string, unknown>>;
    };

    expect(result.mode).toBe("scene");
    expect(result.children[0]).toMatchObject({
      kind: "group",
      id: "first",
      preset: "statCard",
      frame: { x: 40, y: 80, w: 220, h: 120 },
    });
    expect((result.children[0].children as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: "first-value",
      preset: "statValue",
      text: "500",
    });
  });

  it("supports importing deck-local macro files from template source path", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-scene-macros-"));
    const macroPath = path.join(tempDir, "local-macros.njk");
    fs.writeFileSync(macroPath, `{% macro badge(id, x, y, text) %}- kind: text
  id: "{{ id }}"
  frame: { x: {{ x }}, y: {{ y }}, w: 120 }
  text: "{{ text }}"
  style:
    fontSize: 18
    lineHeight: 1.1
{% endmacro %}
`);

    const def = makeDef({
      sourcePath: path.join(tempDir, "inline.template.yaml"),
      rawBody: `
{% import "local-macros.njk" as local %}
mode: scene
children:
{{ local.badge("badge-1", 12, 24, "Deck Local") }}
`,
    });

    try {
      const result = expandDslTemplate({ template: "test" }, def) as unknown as {
        mode: string;
        children: Array<Record<string, unknown>>;
      };

      expect(result.mode).toBe("scene");
      expect(result.children[0]).toMatchObject({
        kind: "text",
        id: "badge-1",
        text: "Deck Local",
        frame: { x: 12, y: 24, w: 120 },
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

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

  it("passes through canvasSize from slide instance", () => {
    const def = makeDef({
      rawBody: `
mode: scene
children: []
`,
    });

    const result = expandDslTemplate(
      { template: "test", canvasSize: { w: 1080, h: 1080 } },
      def,
    );
    expect(result).toMatchObject({ canvasSize: { w: 1080, h: 1080 } });
  });

  describe("scope-based mode injection", () => {
    it("allows scope: slide templates to omit mode: scene", () => {
      const def = makeDef({
        scope: "slide",
        params: { title: { type: "string", required: true } },
        rawBody: `
name: normalized
scope: slide
params:
  title: { type: string, required: true }

background: { type: solid, color: "#111" }
children:
  - kind: text
    id: title
    frame: { x: 0, y: 0, w: 640 }
    text: "{{ title }}"
    style: { fontFamily: "heading", fontSize: 56, color: "#fff", lineHeight: 1.1 }
`,
      });

      const result = expandDslTemplate(
        { template: "test", params: { title: "No Mode" } },
        def,
      );
      expect(result).toHaveProperty("mode", "scene");
      expect((result as unknown as { children: Record<string, unknown>[] }).children[0]).toMatchObject({ text: "No Mode" });
    });

    it("rejects scope: block templates at slide level", () => {
      const def = makeDef({
        scope: "block",
        params: { label: { type: "string" } },
        rawBody: `kind: group\nchildren: []`,
      });

      expect(() =>
        expandDslTemplate({ template: "test", params: { label: "Hi" } }, def),
      ).toThrow(/scope.*block.*cannot.*slide/i);
    });
  });
});
