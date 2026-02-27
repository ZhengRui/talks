import { describe, it, expect, beforeEach } from "vitest";
import { findTemplate, clearTemplateCache } from "./loader";
import { expandDslTemplate } from "./engine";
import { layoutSlide } from "@/lib/layout";
import type { SlideData, FullComposeSlideData } from "@/lib/types";

beforeEach(() => {
  clearTemplateCache();
});

/** Helper: load a DSL template, expand with params, return as SlideData */
function expandDsl(
  templateName: string,
  params: Record<string, unknown>,
): SlideData {
  const def = findTemplate(templateName);
  expect(def).not.toBeNull();
  return expandDslTemplate(
    { template: templateName, ...params },
    def!,
  ) as unknown as SlideData;
}

/** Helper: expand and layout a DSL template */
function expandAndLayout(
  templateName: string,
  params: Record<string, unknown>,
) {
  const slide = expandDsl(templateName, params);
  const layout = layoutSlide(slide, "modern", "/img");
  return { slide, layout };
}

describe("DSL integration: template expansion + layout", () => {
  it("dsl-bullets: expands and lays out", () => {
    const { slide, layout } = expandAndLayout("bullets", {
      title: "Test Bullets",
      bullets: ["Point A", "Point B", "Point C"],
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + bullets = 3 children
    expect(fc.children).toHaveLength(3);
    expect(fc.children[0]).toMatchObject({ type: "heading", text: "Test Bullets" });
    expect(fc.children[1]).toMatchObject({ type: "divider", variant: "gradient" });
    expect(fc.children[2]).toMatchObject({ type: "bullets" });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-stats: expands with title and stats", () => {
    const { slide, layout } = expandAndLayout("stats", {
      title: "Metrics",
      stats: [
        { value: "42", label: "Answer" },
        { value: "7", label: "Days" },
      ],
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + spacer + columns + spacer = 5 children
    expect(fc.children).toHaveLength(5);
    expect(fc.children[0]).toMatchObject({ type: "heading", text: "Metrics" });
    expect(fc.children[3]).toMatchObject({ type: "columns" });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-stats: expands without title", () => {
    const { slide } = expandAndLayout("stats", {
      stats: [{ value: "1", label: "One" }],
    });

    const fc = slide as FullComposeSlideData;
    // spacer + columns + spacer = 3 children (no heading/divider)
    expect(fc.children).toHaveLength(3);
    expect(fc.children[0]).toMatchObject({ type: "spacer" });
    expect(fc.children[1]).toMatchObject({ type: "columns" });
  });

  it("dsl-statement: expands with subtitle", () => {
    const { slide, layout } = expandAndLayout("statement", {
      statement: "Big Idea",
      subtitle: "Supporting text",
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + body = 3 children
    expect(fc.children).toHaveLength(3);
    expect(fc.children[0]).toMatchObject({ type: "heading", text: "Big Idea" });
    expect((slide as unknown as Record<string, unknown>).verticalAlign).toBe("center");

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-statement: expands without subtitle", () => {
    const { slide } = expandAndLayout("statement", {
      statement: "Solo Statement",
    });

    const fc = slide as FullComposeSlideData;
    // heading only = 1 child
    expect(fc.children).toHaveLength(1);
    expect(fc.children[0]).toMatchObject({ type: "heading", text: "Solo Statement" });
  });

  it("dsl-quote: expands with attribution", () => {
    const { slide, layout } = expandAndLayout("quote", {
      quote: "To be or not to be.",
      attribution: "Shakespeare",
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    expect(fc.children).toHaveLength(1);
    expect(fc.children[0]).toMatchObject({
      type: "quote",
      text: "To be or not to be.",
      attribution: "Shakespeare",
      decorative: true,
    });
    expect((slide as unknown as Record<string, unknown>).verticalAlign).toBe("center");

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-quote: expands without attribution", () => {
    const { slide } = expandAndLayout("quote", {
      quote: "Just a quote.",
    });

    const fc = slide as FullComposeSlideData;
    expect(fc.children[0]).not.toHaveProperty("attribution");
  });

  it("dsl-code: expands with title and language", () => {
    const code = 'function greet() {\n  return "hello";\n}';
    const { slide, layout } = expandAndLayout("code", {
      title: "Code Example",
      language: "typescript",
      code,
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + code = 3 children
    expect(fc.children).toHaveLength(3);
    expect(fc.children[0]).toMatchObject({ type: "heading", text: "Code Example" });
    expect(fc.children[2]).toMatchObject({
      type: "code",
      code,
      language: "typescript",
    });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-code: expands without title", () => {
    const { slide } = expandAndLayout("code", {
      code: "x = 1",
    });

    const fc = slide as FullComposeSlideData;
    // code only = 1 child
    expect(fc.children).toHaveLength(1);
    expect(fc.children[0]).toMatchObject({ type: "code" });
  });

  it("dsl-numbered-list: expands and lays out", () => {
    const { slide, layout } = expandAndLayout("numbered-list", {
      title: "Steps",
      items: ["First", "Second", "Third"],
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + bullets = 3 children
    expect(fc.children).toHaveLength(3);
    expect(fc.children[2]).toMatchObject({
      type: "bullets",
      ordered: true,
      variant: "plain",
    });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-definition: expands with multiple definitions", () => {
    const { slide, layout } = expandAndLayout("definition", {
      title: "Terms",
      definitions: [
        { term: "TDD", description: "Test-Driven Development" },
        { term: "SDD", description: "Spec-Driven Development" },
      ],
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + (term + desc + border-divider) × 2 = 8 children
    expect(fc.children).toHaveLength(8);
    expect(fc.children[0]).toMatchObject({ type: "heading", text: "Terms" });
    expect(fc.children[2]).toMatchObject({
      type: "text",
      text: "TDD",
      fontWeight: "bold",
    });
    expect(fc.children[3]).toMatchObject({
      type: "text",
      text: "Test-Driven Development",
    });
    expect(fc.children[4]).toMatchObject({ type: "divider", variant: "border" });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-blank: expands to empty compose slide", () => {
    const { slide, layout } = expandAndLayout("blank", {});

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    expect(fc.children).toHaveLength(0);

    // Blank slide should still produce a valid layout
    expect(layout).toBeDefined();
    expect(layout.background).toBeDefined();
  });

  it("dsl-end: expands with title and subtitle", () => {
    const { slide, layout } = expandAndLayout("end", {
      title: "Goodbye",
      subtitle: "Any questions?",
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + body = 3 children
    expect(fc.children).toHaveLength(3);
    expect(fc.children[0]).toMatchObject({ type: "heading", text: "Goodbye" });
    expect((slide as unknown as Record<string, unknown>).verticalAlign).toBe("center");

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-end: uses default title when none provided", () => {
    const { slide } = expandAndLayout("end", {});

    const fc = slide as FullComposeSlideData;
    expect(fc.children[0]).toMatchObject({ type: "heading", text: "Thank You" });
    // No subtitle → only heading, no divider or body
    expect(fc.children).toHaveLength(1);
  });

  it("style overrides propagate through layout", () => {
    const def = findTemplate("bullets");
    expect(def).not.toBeNull();

    const slide = expandDslTemplate(
      {
        template: "bullets",
        title: "Custom Size",
        bullets: ["A"],
        style: { titleSize: 72 },
      },
      def!,
    ) as unknown as SlideData;

    const fc = slide as FullComposeSlideData;
    expect(fc.children[0]).toMatchObject({ type: "heading", fontSize: 72 });

    const layout = layoutSlide(slide, "modern", "/img");
    expect(layout.elements.length).toBeGreaterThan(0);
  });
});
