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
name: test
params:
  title: { type: string, required: true }
base: full-compose
children:
  - type: heading
    text: "{{ title }}"
    fontSize: 56
`,
    });

    const result = expandDslTemplate({ template: "test", title: "Hello World" }, def);
    expect(result.template).toBe("full-compose");
    expect((result as unknown as { children: unknown[] }).children).toHaveLength(1);
    expect((result as unknown as { children: Record<string, unknown>[] }).children[0]).toMatchObject({
      type: "heading",
      text: "Hello World",
      fontSize: 56,
    });
  });

  it("expands array substitution to valid YAML", () => {
    const def = makeDef({
      params: { bullets: { type: "string[]", required: true } },
      rawBody: `
name: test
base: full-compose
children:
  - type: bullets
    items: {{ bullets }}
`,
    });

    const result = expandDslTemplate(
      { template: "test", bullets: ["First", "Second", "Third"] },
      def,
    );
    const children = (result as unknown as { children: Record<string, unknown>[] }).children;
    expect(children[0]).toMatchObject({ type: "bullets" });
    expect(children[0].items).toEqual(["First", "Second", "Third"]);
  });

  it("expands conditional block when value is present", () => {
    const def = makeDef({
      params: {
        statement: { type: "string", required: true },
        subtitle: { type: "string" },
      },
      rawBody: `
name: test
base: full-compose
verticalAlign: center
children:
  - type: heading
    text: "{{ statement }}"
    fontSize: 72
  {% if subtitle %}
  - type: body
    text: "{{ subtitle }}"
  {% endif %}
`,
    });

    const withSub = expandDslTemplate(
      { template: "test", statement: "Big Idea", subtitle: "Details" },
      def,
    );
    const withoutSub = expandDslTemplate(
      { template: "test", statement: "Big Idea" },
      def,
    );

    expect((withSub as unknown as { children: unknown[] }).children).toHaveLength(2);
    expect((withoutSub as unknown as { children: unknown[] }).children).toHaveLength(1);
  });

  it("expands for loops", () => {
    const def = makeDef({
      params: { stats: { type: "array", required: true } },
      rawBody: `
name: test
base: full-compose
children:
  - type: columns
    children:
      {% for s in stats %}
      - type: stat
        value: "{{ s.value }}"
        label: "{{ s.label }}"
      {% endfor %}
`,
    });

    const result = expandDslTemplate(
      {
        template: "test",
        stats: [
          { value: "42", label: "Answer" },
          { value: "7", label: "Days" },
        ],
      },
      def,
    );

    const children = (result as unknown as { children: Record<string, unknown>[] }).children;
    const columns = children[0] as unknown as { children: Record<string, unknown>[] };
    expect(columns.children).toHaveLength(2);
    expect(columns.children[0]).toMatchObject({ value: "42", label: "Answer" });
    expect(columns.children[1]).toMatchObject({ value: "7", label: "Days" });
  });

  it("supports loop.last for conditional dividers", () => {
    const def = makeDef({
      params: { defs: { type: "array", required: true } },
      rawBody: `
name: test
base: full-compose
children:
  {% for d in defs %}
  - type: text
    text: "{{ d.term }}"
    fontWeight: bold
  - type: text
    text: "{{ d.desc }}"
  {% if not loop.last %}
  - type: divider
    variant: border
  {% endif %}
  {% endfor %}
`,
    });

    const result = expandDslTemplate(
      {
        template: "test",
        defs: [
          { term: "A", desc: "Desc A" },
          { term: "B", desc: "Desc B" },
        ],
      },
      def,
    );

    const children = (result as unknown as { children: unknown[] }).children;
    // A-term, A-desc, divider, B-term, B-desc (no divider after last)
    expect(children).toHaveLength(5);
    expect((children[2] as Record<string, unknown>).type).toBe("divider");
  });

  it("applies style defaults", () => {
    const def = makeDef({
      params: { title: { type: "string", required: true } },
      style: { titleSize: { type: "number", default: 56 } },
      rawBody: `
name: test
base: full-compose
children:
  - type: heading
    text: "{{ title }}"
    fontSize: {{ style.titleSize }}
`,
    });

    const result = expandDslTemplate({ template: "test", title: "Test" }, def);
    const children = (result as unknown as { children: Record<string, unknown>[] }).children;
    expect(children[0].fontSize).toBe(56);
  });

  it("merges style overrides with defaults", () => {
    const def = makeDef({
      params: { title: { type: "string", required: true } },
      style: { titleSize: { type: "number", default: 56 } },
      rawBody: `
name: test
base: full-compose
children:
  - type: heading
    text: "{{ title }}"
    fontSize: {{ style.titleSize }}
`,
    });

    const result = expandDslTemplate(
      { template: "test", title: "Test", style: { titleSize: 72 } },
      def,
    );
    const children = (result as unknown as { children: Record<string, unknown>[] }).children;
    expect(children[0].fontSize).toBe(72);
  });

  it("throws on missing required param", () => {
    const def = makeDef({
      name: "my-template",
      params: { title: { type: "string", required: true } },
      rawBody: `
name: my-template
base: full-compose
children: []
`,
    });

    expect(() => expandDslTemplate({ template: "my-template" }, def)).toThrow(
      /requires param "title"/,
    );
  });

  it("preserves base-level props (verticalAlign, align)", () => {
    const def = makeDef({
      params: { text: { type: "string", required: true } },
      rawBody: `
name: test
base: full-compose
align: center
verticalAlign: center
children:
  - type: heading
    text: "{{ text }}"
`,
    });

    const result = expandDslTemplate({ template: "test", text: "Hi" }, def);
    expect(result).toHaveProperty("align", "center");
    expect(result).toHaveProperty("verticalAlign", "center");
  });

  it("passes through animation and theme from slide data", () => {
    const def = makeDef({
      rawBody: `
name: test
base: full-compose
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
name: test
base: full-compose
children:
  - type: code
    code: {{ code | tojson }}
`,
    });

    const code = 'function greet() {\n  return "hello";\n}';
    const result = expandDslTemplate({ template: "test", code }, def);
    const children = (result as unknown as { children: Record<string, unknown>[] }).children;
    expect(children[0].code).toBe(code);
  });

  it("handles or operator for default values", () => {
    const def = makeDef({
      params: { title: { type: "string" } },
      rawBody: `
name: test
base: full-compose
children:
  - type: heading
    text: "{{ title or 'Thank You' }}"
`,
    });

    const withTitle = expandDslTemplate({ template: "test", title: "Goodbye" }, def);
    const withoutTitle = expandDslTemplate({ template: "test" }, def);

    expect(
      (withTitle as unknown as { children: Record<string, unknown>[] }).children[0].text,
    ).toBe("Goodbye");
    expect(
      (withoutTitle as unknown as { children: Record<string, unknown>[] }).children[0].text,
    ).toBe("Thank You");
  });
});
