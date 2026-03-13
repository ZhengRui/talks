import { describe, it, expect, beforeEach } from "vitest";
import { findTemplate, clearTemplateCache } from "./loader";
import { expandDslTemplate } from "./engine";
import { layoutSlide } from "@/lib/layout";
import type { SlideData, ComponentSlideData, SceneSlideData, ThemeName } from "@/lib/types";
import type { DslTemplateDef } from "./types";

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

/** Helper: get inner children from the root box wrapper */
function innerChildren(slide: SlideData): unknown[] {
  const fc = slide as ComponentSlideData;
  // Templates now produce a root box wrapper; content children are inside it
  if (fc.children.length === 1 && (fc.children[0] as { type: string }).type === "box") {
    return (fc.children[0] as { children: unknown[] }).children;
  }
  return fc.children;
}

function sceneChildren(slide: SlideData): unknown[] {
  const scene = slide as SceneSlideData;
  expect(scene.mode).toBe("scene");
  return scene.children;
}

/** Helper: recursively collect all layout elements (including nested children) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function allLayoutElements(elements: any[]): any[] {
  const result: any[] = [];
  for (const el of elements) {
    result.push(el);
    if (el.children) {
      result.push(...allLayoutElements(el.children));
    }
  }
  return result;
}

/** Helper: expand and layout a DSL template */
function expandAndLayout(
  templateName: string,
  params: Record<string, unknown>,
  themeName: ThemeName = "modern",
) {
  const slide = expandDsl(templateName, params);
  const layout = layoutSlide(slide, themeName, "/img");
  return { slide, layout };
}

function makeInlineTemplate(overrides: Partial<DslTemplateDef>): DslTemplateDef {
  return {
    name: "inline-test",
    params: {},
    rawBody: "",
    ...overrides,
  };
}

describe("DSL integration: template expansion + layout", () => {
  it("bullets: expands and lays out", () => {
    const { slide, layout } = expandAndLayout("bullets", {
      title: "Test Bullets",
      bullets: ["Point A", "Point B", "Point C"],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "bullets-title", text: "Test Bullets" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "bullets-divider" });
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "bullets-list",
      layout: { type: "stack", gap: 16 },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "bullets-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "bullets-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 160, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
      style: {
        gradient: {
          type: "linear",
          angle: 135,
          stops: [
            { color: "#4f6df5", position: 0 },
            { color: "#a855f7", position: 1 },
          ],
        },
      },
    });
    expect(elements.find((element) => element.id === "bullets-list")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 272 },
    });
    expect(elements.find((element) => element.id === "bullets-card-1")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 1600, h: 80 },
      style: { fill: "#ffffff" },
      borderRadius: 12,
      border: { width: 3, color: "#4f6df5", sides: ["left"] },
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "bullets-card-1-text")).toMatchObject({
      kind: "text",
      rect: { x: 24, y: 16, w: 1552, h: 48 },
      text: "Point A",
    });
  });

  it("bullets: list variant uses IR list escape hatch", () => {
    const { slide, layout } = expandAndLayout("bullets", {
      title: "List Bullets",
      bullets: ["Point A", "Point B"],
      style: { bulletVariant: "list" },
    });

    const children = sceneChildren(slide);
    expect(children[2]).toMatchObject({ kind: "ir", id: "bullets-list" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "bullets-list-element")).toMatchObject({
      kind: "list",
      rect: { x: 160, y: 192.8, w: 1600, h: 106 },
      items: ["Point A", "Point B"],
      ordered: false,
      itemSpacing: 10,
      bulletColor: "#1a1a2e",
    });
  });

  it("stats: expands with title and stats", () => {
    const { slide, layout } = expandAndLayout("stats", {
      title: "Metrics",
      stats: [
        { value: "42", label: "Answer" },
        { value: "7", label: "Days" },
      ],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "stats-header-title", text: "Metrics" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "stats-header-divider" });
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "stats-grid",
      layout: { type: "grid", columns: 2, columnGap: 32 },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "stats-header-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "stats-header-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
      style: {
        gradient: {
          type: "linear",
          angle: 135,
          stops: [
            { color: "#4f6df5", position: 0 },
            { color: "#a855f7", position: 1 },
          ],
        },
      },
    });
    expect(elements.find((element) => element.id === "stats-grid")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 506.40000000000003, w: 1600, h: 200 },
    });
    expect(elements.find((element) => element.id === "stat-1")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 784, h: 200 },
      style: { fill: "#ffffff" },
      borderRadius: 12,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        blur: 24,
        spread: 0,
        color: "rgba(0, 0, 0, 0.06)",
      },
      border: {
        width: 3,
        color: "#4f6df5",
        sides: ["top"],
      },
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "stat-1-value")).toMatchObject({
      kind: "text",
      text: "42",
      rect: { x: 28, y: 31, w: 728, h: 82.8 },
    });
    expect(elements.find((element) => element.id === "stat-2-value")).toMatchObject({
      kind: "text",
      text: "7",
      rect: { x: 28, y: 31, w: 728, h: 82.8 },
    });
    expect(elements.find((element) => element.id === "stat-1-label")).toMatchObject({
      kind: "text",
      text: "Answer",
      rect: { x: 28, y: 121.8, w: 728, h: 39 },
    });
  });

  it("stats: expands without title", () => {
    const { slide, layout } = expandAndLayout("stats", {
      stats: [{ value: "1", label: "One" }],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      kind: "group",
      id: "stats-grid",
      layout: { type: "grid", columns: 1, columnGap: 32 },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "stats-grid")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 440, w: 1600, h: 200 },
    });
    expect(elements.find((element) => element.id === "stat-1")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 1600, h: 200 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
  });

  it("stats: uses theme-derived card chrome for neon-cyber", () => {
    const { layout } = expandAndLayout("stats", {
      stats: [{ value: "35", label: "Templates" }],
    }, "neon-cyber");

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "stat-1")).toMatchObject({
      kind: "group",
      style: { fill: "#111827" },
      borderRadius: 8,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        blur: 24,
        spread: 0,
        color: "rgba(0, 255, 204, 0.08)",
      },
      border: {
        width: 3,
        color: "#00ffcc",
        sides: ["top"],
      },
    });
  });

  it("statement: expands with subtitle", () => {
    const { slide, layout } = expandAndLayout("statement", {
      statement: "Big Idea",
      subtitle: "Supporting text",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      kind: "group",
      id: "statement-stack",
      layout: {
        type: "stack",
        gap: 28,
        align: "center",
        justify: "center",
        padding: [0, 160, 0, 160],
      },
    });
    if (children[0].kind === "group") {
      expect(children[0].children).toMatchObject([
        { kind: "text", id: "statement-title", text: "Big Idea" },
        { kind: "shape", id: "statement-divider" },
        { kind: "text", id: "statement-subtitle", text: "Supporting text" },
      ]);
    }

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "statement-title")).toMatchObject({
      kind: "text",
      text: "Big Idea",
      rect: { x: 160, y: 437.6, w: 1600, h: 93.6 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "statement-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 900, y: 559.2, w: 120, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
      style: {
        gradient: {
          type: "linear",
          angle: 135,
          stops: [
            { color: "#4f6df5", position: 0 },
            { color: "#a855f7", position: 1 },
          ],
        },
      },
    });
    expect(elements.find((element) => element.id === "statement-subtitle")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 591.2, w: 1600, h: 51.2 },
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
  });

  it("statement: expands without subtitle", () => {
    const { slide, layout } = expandAndLayout("statement", {
      statement: "Solo Statement",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      kind: "group",
      id: "statement-stack",
      layout: {
        type: "stack",
        gap: 28,
        align: "center",
        justify: "center",
        padding: [0, 160, 0, 160],
      },
    });
    if (children[0].kind === "group") {
      expect(children[0].children).toMatchObject([
        { kind: "text", id: "statement-title", text: "Solo Statement" },
      ]);
    }

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "statement-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 493.2, w: 1600, h: 93.6 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
  });

  it("quote: expands with attribution", () => {
    const { slide, layout } = expandAndLayout("quote", {
      quote: "To be or not to be.",
      attribution: "Shakespeare",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      kind: "group",
      id: "quote-stack",
      layout: {
        type: "stack",
        gap: 24,
        align: "center",
        justify: "center",
        padding: [0, 160, 0, 160],
      },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "quote-mark")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 407.7, w: 1600, h: 120 },
      text: "“",
      entrance: { type: "fade-in", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "quote-text")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 551.7, w: 1600, h: 57.6 },
      text: "To be or not to be.",
      entrance: { type: "scale-up", delay: 150, duration: 600 },
    });
    expect(elements.find((element) => element.id === "quote-attribution")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 633.3, w: 1600, h: 39 },
      text: "— Shakespeare",
      entrance: { type: "fade-up", delay: 400, duration: 600 },
    });
  });

  it("quote: expands without attribution", () => {
    const { slide } = expandAndLayout("quote", {
      quote: "Just a quote.",
    });

    const children = sceneChildren(slide);
    expect(children[0]).toMatchObject({ kind: "group", id: "quote-stack" });
    if (children[0].kind === "group") {
      expect(children[0].children).toHaveLength(2);
      expect(children[0].children.find((child) => child.id === "quote-attribution")).toBeUndefined();
    }
  });

  it("code: expands with title and language", () => {
    const code = 'function greet() {\n  return "hello";\n}';
    const { slide, layout } = expandAndLayout("code", {
      title: "Code Example",
      language: "typescript",
      code,
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "code-title", text: "Code Example" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "code-divider" });
    expect(children[2]).toMatchObject({
      kind: "ir",
      id: "code-block",
      element: {
        kind: "code",
        id: "code-block-element",
      },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "code-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      text: "Code Example",
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "code-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
    });
    expect(elements.find((element) => element.id === "code-block-element")).toMatchObject({
      kind: "code",
      rect: { x: 160, y: 192.8, w: 1600, h: 179.2 },
      code,
      language: "typescript",
      style: {
        fontFamily: "JetBrains Mono, Fira Code, monospace",
        fontSize: 24,
        color: "#cdd6f4",
        background: "#1e1e2e",
        borderRadius: 12,
        padding: 32,
      },
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
  });

  it("code: expands without title", () => {
    const { slide, layout } = expandAndLayout("code", {
      code: "x = 1",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ kind: "ir", id: "code-block" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "code-block-element")).toMatchObject({
      kind: "code",
      rect: { x: 160, y: 60, w: 1600, h: 102.4 },
      code: "x = 1",
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
  });

  it("numbered-list: expands and lays out", () => {
    const { slide, layout } = expandAndLayout("numbered-list", {
      title: "Steps",
      items: ["First", "Second", "Third"],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "numbered-list-items",
      layout: { type: "stack", gap: 20 },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "numbered-list-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      text: "Steps",
    });
    expect(elements.find((element) => element.id === "numbered-list-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 160, y: 148.8, w: 80, h: 4 },
    });
    expect(elements.find((element) => element.id === "numbered-list-items")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 196 },
    });
    expect(elements.find((element) => element.id === "numbered-list-item-1-badge")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 44, h: 44 },
      style: { fill: "#4f6df5" },
      borderRadius: 100,
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "numbered-list-item-1-num")).toMatchObject({
      kind: "text",
      rect: { x: 0, y: 0, w: 44, h: 44 },
      text: "1",
      style: expect.objectContaining({
        textAlign: "center",
        verticalAlign: "middle",
        lineHeight: 1,
      }),
    });
    expect(elements.find((element) => element.id === "numbered-list-item-1-text")).toMatchObject({
      kind: "text",
      rect: { x: 64, y: 4, w: 1536, h: 52 },
      text: "First",
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
  });

  it("definition: expands with multiple definitions", () => {
    const { slide, layout } = expandAndLayout("definition", {
      title: "Terms",
      definitions: [
        { term: "TDD", description: "Test-Driven Development" },
        { term: "SDD", description: "Spec-Driven Development" },
      ],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "definition-title", text: "Terms" });
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "definition-list",
      layout: { type: "stack", gap: 24 },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "definition-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      text: "Terms",
    });
    expect(elements.find((element) => element.id === "definition-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 160, y: 148.8, w: 80, h: 4 },
    });
    expect(elements.find((element) => element.id === "definition-list")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 216.8, w: 1600, h: 863.2 },
    });
    expect(elements.find((element) => element.id === "definition-item-1-term")).toMatchObject({
      kind: "text",
      rect: { x: 0, y: 0, w: 1600, h: 48 },
      text: "TDD",
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "definition-item-1-description")).toMatchObject({
      kind: "text",
      rect: { x: 0, y: 56, w: 1600, h: 44.800000000000004 },
      text: "Test-Driven Development",
      entrance: { type: "fade-up", delay: 300, duration: 600 },
    });
    expect(elements.find((element) => element.id === "definition-item-1-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 0, y: 124.80000000000001, w: 1600, h: 1 },
      style: { fill: "rgba(0, 0, 0, 0.06)" },
      entrance: { type: "fade-up", delay: 400, duration: 600 },
    });
  });

  it("agenda: expands with active item highlight", () => {
    const { slide, layout } = expandAndLayout("agenda", {
      title: "Agenda",
      items: ["Intro", "Demo", "Q&A"],
      activeIndex: 1,
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "agenda-title", text: "Agenda" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "agenda-divider" });
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "agenda-list",
      layout: { type: "stack", gap: 12 },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "agenda-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      text: "Agenda",
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "agenda-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 160, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
    });
    expect(elements.find((element) => element.id === "agenda-list")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 264 },
    });
    expect(elements.find((element) => element.id === "agenda-item-1")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 1600, h: 80 },
      opacity: 0.5,
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "agenda-item-2")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 92, w: 1600, h: 80 },
      style: { fill: "#ffffff" },
      borderRadius: 12,
      border: { width: 3, color: "#4f6df5", sides: ["left"] },
      clipContent: true,
      entrance: { type: "fade-up", delay: 300, duration: 600 },
    });
    expect(elements.find((element) => element.id === "agenda-item-2-text")).toMatchObject({
      kind: "text",
      rect: { x: 24, y: 16, w: 1552, h: 48 },
      text: "Demo",
      style: { fontWeight: 700 },
    });
    expect(elements.find((element) => element.id === "agenda-item-3")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 184, w: 1600, h: 80 },
      opacity: 0.5,
      entrance: { type: "fade-up", delay: 400, duration: 600 },
    });
  });

  it("agenda: without activeIndex keeps all items as active cards", () => {
    const { layout } = expandAndLayout("agenda", {
      title: "Agenda",
      items: ["Intro", "Demo"],
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "agenda-item-1")).toMatchObject({
      kind: "group",
      style: { fill: "#ffffff" },
      border: { width: 3, color: "#4f6df5", sides: ["left"] },
    });
    expect(elements.find((element) => element.id === "agenda-item-2")).toMatchObject({
      kind: "group",
      style: { fill: "#ffffff" },
      border: { width: 3, color: "#4f6df5", sides: ["left"] },
    });
  });

  it("qa: expands to centered answer card", () => {
    const { slide, layout } = expandAndLayout("qa", {
      question: "What is the architecture?",
      answer: "The system uses a layered architecture. YAML content flows through template expansion, layout composition, and rendering.",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "qa-title", text: "What is the architecture?" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "qa-divider" });
    expect(children[2]).toMatchObject({ kind: "group", id: "qa-card" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "qa-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      text: "What is the architecture?",
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "qa-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
    });
    expect(elements.find((element) => element.id === "qa-card")).toMatchObject({
      kind: "group",
      rect: { x: 360, y: 192.8, w: 1200, h: 176 },
      style: { fill: "#ffffff" },
      borderRadius: 12,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        blur: 24,
        spread: 0,
        color: "rgba(0, 0, 0, 0.06)",
      },
      border: { width: 1, color: "rgba(0, 0, 0, 0.06)" },
      clipContent: true,
      entrance: { type: "fade-in", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "qa-answer")).toMatchObject({
      kind: "text",
      rect: { x: 40, y: 40, w: 1120, h: 96 },
      text: "The system uses a layered architecture. YAML content flows through template expansion, layout composition, and rendering.",
    });
  });

  it("highlight-box: expands warning variant with centered card", () => {
    const { slide, layout } = expandAndLayout("highlight-box", {
      title: "Important",
      body: "Key point goes here.",
      variant: "warning",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "highlight-box-title", text: "Important" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "highlight-box-divider" });
    expect(children[2]).toMatchObject({ kind: "group", id: "highlight-box-card" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "highlight-box-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      text: "Important",
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "highlight-box-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
    });
    expect(elements.find((element) => element.id === "highlight-box-card")).toMatchObject({
      kind: "group",
      rect: { x: 360, y: 192.8, w: 1200, h: 144 },
      style: { fill: "rgba(234, 179, 8, 0.08)" },
      borderRadius: 12,
      border: { width: 2, color: "#eab308" },
      clipContent: true,
      entrance: { type: "scale-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "highlight-box-body")).toMatchObject({
      kind: "text",
      rect: { x: 48, y: 48, w: 1104, h: 48 },
      text: "Key point goes here.",
    });
  });

  it("blank: expands to empty compose slide", () => {
    const { slide, layout } = expandAndLayout("blank", {});

    const children = sceneChildren(slide);
    expect(children).toHaveLength(0);

    // Blank slide should still produce a valid layout
    expect(layout).toBeDefined();
    expect(layout.background).toBeDefined();
  });

  it("cover: expands with background image, subtitle, and author tag", () => {
    const { slide, layout } = expandAndLayout("cover", {
      title: "Launch Plan",
      subtitle: "Roadmap and milestones",
      author: "Jane Doe",
      image: "hero.jpg",
    });

    expect((slide as SceneSlideData).mode).toBe("scene");
    expect((slide as SceneSlideData).background).toMatchObject({
      type: "image",
      src: "hero.jpg",
      overlay: "dark",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ kind: "group", id: "cover-stack" });

    expect(layout).toMatchObject({
      background: "#f8f9fc",
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "bg-image")).toMatchObject({
      kind: "image",
      rect: { x: 0, y: 0, w: 1920, h: 1080 },
      src: "/img/hero.jpg",
      objectFit: "cover",
      opacity: 1,
    });
    expect(elements.find((element) => element.id === "bg-overlay")).toMatchObject({
      kind: "shape",
      rect: { x: 0, y: 0, w: 1920, h: 1080 },
      shape: "rect",
      style: { fill: "rgba(0, 0, 0, 0.6)" },
    });
    expect(elements.find((element) => element.id === "cover-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 394.4, w: 1600, h: 104 },
      text: "Launch Plan",
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "cover-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 900, y: 514.4, w: 120, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
    });
    expect(elements.find((element) => element.id === "cover-subtitle")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 558.4, w: 1600, h: 67.2 },
      text: "Roadmap and milestones",
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "cover-author-pill")).toMatchObject({
      kind: "shape",
      rect: { x: 884, y: 641.6, w: 152, h: 44 },
      borderRadius: 100,
      border: { width: 1, color: "rgba(255,255,255,0.2)" },
      entrance: { type: "fade-up", delay: 300, duration: 600 },
    });
    expect(elements.find((element) => element.id === "cover-author")).toMatchObject({
      kind: "text",
      rect: { x: 884, y: 641.6, w: 152, h: 44 },
      text: "Jane Doe",
      entrance: { type: "fade-up", delay: 300, duration: 600 },
    });
  });

  it("cover: uses accent-tinted author pill without image", () => {
    const { slide, layout } = expandAndLayout("cover", {
      title: "Comparison Template",
      author: "Design System",
    }, "electric-studio");

    expect((slide as SceneSlideData).background).toBeUndefined();

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "cover-author-pill")).toMatchObject({
      kind: "shape",
      style: { fill: "rgba(67, 97, 238, 0.13)" },
      border: { width: 1, color: "#4361ee" },
    });
    expect(elements.find((element) => element.id === "cover-author")).toMatchObject({
      kind: "text",
      style: { color: "#4361ee" },
    });
  });

  it("section-divider: expands with background image and subtitle", () => {
    const { slide, layout } = expandAndLayout("section-divider", {
      title: "Execution",
      subtitle: "How we build and ship",
      image: "hero.jpg",
    });

    expect((slide as SceneSlideData).mode).toBe("scene");
    expect((slide as SceneSlideData).background).toMatchObject({
      type: "image",
      src: "hero.jpg",
      overlay: "dark",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ kind: "group", id: "section-divider-stack" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "bg-image")).toMatchObject({
      kind: "image",
      rect: { x: 0, y: 0, w: 1920, h: 1080 },
      src: "/img/hero.jpg",
      objectFit: "cover",
      opacity: 1,
    });
    expect(elements.find((element) => element.id === "bg-overlay")).toMatchObject({
      kind: "shape",
      rect: { x: 0, y: 0, w: 1920, h: 1080 },
      shape: "rect",
      style: { fill: "rgba(0, 0, 0, 0.6)" },
    });
    expect(elements.find((element) => element.id === "section-divider-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 436.4, w: 1600, h: 104 },
      text: "Execution",
    });
    expect(elements.find((element) => element.id === "section-divider-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 900, y: 556.4, w: 120, h: 4 },
      borderRadius: 2,
    });
    expect(elements.find((element) => element.id === "section-divider-subtitle")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 592.4, w: 1600, h: 51.2 },
      text: "How we build and ship",
    });
  });

  it("full-image: expands with centered title and body over image background", () => {
    const { slide, layout } = expandAndLayout("full-image", {
      image: "hero.jpg",
      title: "Vision",
      body: "Build the future",
    });

    expect((slide as SceneSlideData).mode).toBe("scene");
    expect((slide as SceneSlideData).background).toMatchObject({
      type: "image",
      src: "hero.jpg",
      overlay: "dark",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ kind: "group", id: "full-image-stack" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "bg-image")).toMatchObject({
      kind: "image",
      rect: { x: 0, y: 0, w: 1920, h: 1080 },
      src: "/img/hero.jpg",
      objectFit: "cover",
      opacity: 1,
    });
    expect(elements.find((element) => element.id === "bg-overlay")).toMatchObject({
      kind: "shape",
      rect: { x: 0, y: 0, w: 1920, h: 1080 },
      shape: "rect",
      style: { fill: "rgba(0, 0, 0, 0.6)" },
    });
    expect(elements.find((element) => element.id === "full-image-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 460.4, w: 1600, h: 83.19999999999999 },
      text: "Vision",
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "full-image-body")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 571.5999999999999, w: 1600, h: 48 },
      text: "Build the future",
      entrance: { type: "fade-up", delay: 100, duration: 600 },
    });
  });

  it("end: expands with title and subtitle", () => {
    const { slide, layout } = expandAndLayout("end", {
      title: "Goodbye",
      subtitle: "Any questions?",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      kind: "group",
      id: "end-stack",
      layout: {
        type: "stack",
        gap: 28,
        align: "center",
        justify: "center",
        padding: [0, 160, 0, 160],
      },
    });
    if (children[0].kind === "group") {
      expect(children[0].children).toMatchObject([
        { kind: "text", id: "end-title", text: "Goodbye" },
        { kind: "shape", id: "end-divider" },
        { kind: "text", id: "end-subtitle", text: "Any questions?" },
      ]);
    }

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "end-title")).toMatchObject({
      kind: "text",
      text: "Goodbye",
      rect: { x: 160, y: 429.2, w: 1600, h: 104 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "end-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 900, y: 561.2, w: 120, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
      style: {
        gradient: {
          type: "linear",
          angle: 135,
          stops: [
            { color: "#4f6df5", position: 0 },
            { color: "#a855f7", position: 1 },
          ],
        },
      },
    });
    expect(elements.find((element) => element.id === "end-subtitle")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 593.2, w: 1600, h: 57.6 },
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
  });

  it("end: uses default title when none provided", () => {
    const { slide, layout } = expandAndLayout("end", {});

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      kind: "group",
      id: "end-stack",
      layout: {
        type: "stack",
        gap: 28,
        align: "center",
        justify: "center",
        padding: [0, 160, 0, 160],
      },
    });
    if (children[0].kind === "group") {
      expect(children[0].children).toMatchObject([
        { kind: "text", id: "end-title", text: "Thank You" },
      ]);
    }

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "end-title")).toMatchObject({
      kind: "text",
      text: "Thank You",
      rect: { x: 160, y: 488, w: 1600, h: 104 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
  });

  // --- Group 2 templates ---

  it("two-column: expands to columns with box children", () => {
    const { slide, layout } = expandAndLayout("two-column", {
      title: "Two Sides",
      left: "Left content",
      right: "Right content",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "two-column-header-title", text: "Two Sides" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "two-column-header-divider" });
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "two-column-layout",
      layout: { type: "row", gap: 32, align: "stretch" },
    });
    const cols = children[2] as unknown as { children: unknown[] };
    expect(cols.children).toHaveLength(2);
    expect(cols.children[0]).toMatchObject({ kind: "group", id: "left-card" });
    expect(cols.children[1]).toMatchObject({ kind: "group", id: "right-card" });
    expect(cols.children[0]).not.toHaveProperty("frame");
    expect(cols.children[1]).not.toHaveProperty("frame");

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "two-column-header-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "two-column-header-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
      style: {
        gradient: {
          type: "linear",
          angle: 135,
          stops: [
            { color: "#4f6df5", position: 0 },
            { color: "#a855f7", position: 1 },
          ],
        },
      },
    });
    expect(elements.find((element) => element.id === "two-column-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 136 },
    });
    expect(elements.find((element) => element.id === "left-card")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 784, h: 136 },
      style: { fill: "#ffffff" },
      borderRadius: 12,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        blur: 24,
        spread: 0,
        color: "rgba(0, 0, 0, 0.06)",
      },
      border: {
        width: 1,
        color: "rgba(0, 0, 0, 0.06)",
      },
      clipContent: true,
      entrance: { type: "slide-left", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "right-card")).toMatchObject({
      kind: "group",
      rect: { x: 816, y: 0, w: 784, h: 136 },
      entrance: { type: "slide-right", delay: 300, duration: 600 },
    });
    expect(elements.find((element) => element.id === "left-card-body")).toMatchObject({
      kind: "text",
      text: "Left content",
      rect: { x: 32, y: 32, w: 720, h: 48 },
    });
    expect(elements.find((element) => element.id === "right-card-body")).toMatchObject({
      kind: "text",
      text: "Right content",
      rect: { x: 32, y: 32, w: 720, h: 48 },
    });
  });

  it("two-column: expands without title", () => {
    const { slide, layout } = expandAndLayout("two-column", {
      left: "A",
      right: "B",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ kind: "group", id: "two-column-layout" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "two-column-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 60, w: 1600, h: 136 },
    });
    expect(elements.find((element) => element.id === "left-card")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 784, h: 136 },
      entrance: { type: "slide-left", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "right-card")).toMatchObject({
      kind: "group",
      rect: { x: 816, y: 0, w: 784, h: 136 },
      entrance: { type: "slide-right", delay: 100, duration: 600 },
    });
  });

  it("two-column: style.cardHeight overrides default", () => {
    const { slide, layout } = expandAndLayout("two-column", {
      left: "A",
      right: "B",
      style: { cardHeight: 500 },
    });

    const children = sceneChildren(slide);
    expect(children[0]).toMatchObject({ kind: "group", id: "two-column-layout", frame: { h: 500 } });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "two-column-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 60, w: 1600, h: 500 },
    });
    expect(elements.find((element) => element.id === "left-card")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 784, h: 500 },
    });
    expect(elements.find((element) => element.id === "right-card")).toMatchObject({
      kind: "group",
      rect: { x: 816, y: 0, w: 784, h: 500 },
    });
  });

  it("two-column: verticalAlign center matches legacy centering", () => {
    const { layout } = expandAndLayout("two-column", {
      left: "A",
      right: "B",
      verticalAlign: "center",
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "two-column-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 472, w: 1600, h: 136 },
    });
  });

  it("comparison: expands with heading + bullets per column", () => {
    const { slide, layout } = expandAndLayout("comparison", {
      title: "Before vs After",
      left: { heading: "Before", items: ["Slow", "Manual"] },
      right: { heading: "After", items: ["Fast", "Auto"] },
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "comparison-header-title", text: "Before vs After" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "comparison-header-divider" });
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "comparison-layout",
      layout: { type: "row", gap: 32, align: "stretch" },
    });
    const cols = children[2] as unknown as { children: unknown[] };
    expect(cols.children).toHaveLength(2);
    expect(cols.children[0]).toMatchObject({ kind: "group", id: "comparison-left-card" });
    expect(cols.children[1]).toMatchObject({ kind: "group", id: "comparison-right-card" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "comparison-header-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "comparison-header-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
      style: {
        gradient: {
          type: "linear",
          angle: 135,
          stops: [
            { color: "#4f6df5", position: 0 },
            { color: "#a855f7", position: 1 },
          ],
        },
      },
    });
    expect(elements.find((element) => element.id === "comparison-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 259.8 },
    });
    expect(elements.find((element) => element.id === "comparison-left-card")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 784, h: 259.8 },
      style: { fill: "#ffffff" },
      borderRadius: 12,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        blur: 24,
        spread: 0,
        color: "rgba(0, 0, 0, 0.06)",
      },
      border: {
        width: 3,
        color: "#22c55e",
        sides: ["top"],
      },
      clipContent: true,
      entrance: { type: "slide-left", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "comparison-right-card")).toMatchObject({
      kind: "group",
      rect: { x: 816, y: 0, w: 784, h: 259.8 },
      border: {
        width: 3,
        color: "#ef4444",
        sides: ["top"],
      },
      entrance: { type: "slide-right", delay: 300, duration: 600 },
    });
    expect(elements.find((element) => element.id === "comparison-left-heading")).toMatchObject({
      kind: "text",
      rect: { x: 32, y: 35, w: 720, h: 46.8 },
    });
    expect(elements.find((element) => element.id === "comparison-left-list")).toMatchObject({
      kind: "list",
      ordered: false,
      items: ["Slow", "Manual"],
      rect: { x: 32, y: 97.8, w: 720, h: 106 },
      bulletColor: "#1a1a2e",
    });
    expect(elements.find((element) => element.id === "comparison-right-list")).toMatchObject({
      kind: "list",
      ordered: false,
      items: ["Fast", "Auto"],
      rect: { x: 32, y: 97.8, w: 720, h: 106 },
      bulletColor: "#1a1a2e",
    });
  });

  it("comparison: uses theme card chrome for split-pastel", () => {
    const { layout } = expandAndLayout("comparison", {
      title: "Comparison Template",
      left: { heading: "Pros", items: ["Simple YAML content", "Type-safe templates"] },
      right: { heading: "Cons", items: ["No WYSIWYG editor", "Requires dev knowledge"] },
    }, "split-pastel");

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "comparison-left-card")).toMatchObject({
      kind: "group",
      style: { fill: "#ffffff" },
      borderRadius: 20,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        blur: 20,
        spread: 0,
        color: "rgba(0, 0, 0, 0.06)",
      },
    });
  });

  it("comparison: resolves swiss-modern heading and list fonts", () => {
    const { layout } = expandAndLayout("comparison", {
      title: "Comparison Template",
      left: { heading: "Pros", items: ["Simple YAML content", "Type-safe templates"] },
      right: { heading: "Cons", items: ["No WYSIWYG editor", "Requires dev knowledge"] },
    }, "swiss-modern");

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "comparison-left-heading")).toMatchObject({
      kind: "text",
      style: {
        fontFamily: "Archivo, Inter, system-ui, sans-serif",
        fontWeight: 700,
      },
    });
    expect(elements.find((element) => element.id === "comparison-left-list")).toMatchObject({
      kind: "list",
      itemStyle: {
        fontFamily: "Nunito, Inter, system-ui, sans-serif",
        fontWeight: 400,
      },
    });
  });

  it("comparison: verticalAlign center centers titleless cards", () => {
    const { layout } = expandAndLayout("comparison", {
      left: { heading: "Before", items: ["A"] },
      right: { heading: "After", items: ["B"] },
      verticalAlign: "center",
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "comparison-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 439.1, w: 1600, h: 201.8 },
    });
  });

  it("code-comparison: expands with labels and code", () => {
    const { slide, layout } = expandAndLayout("code-comparison", {
      title: "Refactored",
      before: { label: "Before", code: "x = 1", language: "python" },
      after: { label: "After", code: "x: int = 1", language: "python" },
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "code-comparison-title", text: "Refactored" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "code-comparison-divider" });
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "code-comparison-layout",
      layout: { type: "row", gap: 32 },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "code-comparison-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      text: "Refactored",
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "code-comparison-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
    });
    expect(elements.find((element) => element.id === "code-comparison-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 135.2 },
    });
    expect(elements.find((element) => element.id === "code-comparison-before")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 784, h: 135.2 },
      entrance: { type: "slide-left", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "code-comparison-before-label")).toMatchObject({
      kind: "text",
      rect: { x: 0, y: 0, w: 784, h: 36 },
      text: "Before",
    });
    expect(elements.find((element) => element.id === "code-comparison-before-code-element")).toMatchObject({
      kind: "code",
      rect: { x: 0, y: 52, w: 784, h: 83.2 },
      code: "x = 1",
      language: "python",
      style: {
        fontFamily: "JetBrains Mono, Fira Code, monospace",
        fontSize: 22,
        color: "#cdd6f4",
        background: "#1e1e2e",
        borderRadius: 12,
        padding: 24,
      },
    });
    expect(elements.find((element) => element.id === "code-comparison-after")).toMatchObject({
      kind: "group",
      rect: { x: 816, y: 0, w: 784, h: 135.2 },
      entrance: { type: "slide-right", delay: 300, duration: 600 },
    });
    expect(elements.find((element) => element.id === "code-comparison-after-label")).toMatchObject({
      kind: "text",
      rect: { x: 0, y: 0, w: 784, h: 36 },
      text: "After",
    });
  });

  it("code-comparison: expands without labels", () => {
    const { slide, layout } = expandAndLayout("code-comparison", {
      before: { code: "a" },
      after: { code: "b" },
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      kind: "group",
      id: "code-comparison-layout",
      layout: { type: "row", gap: 32 },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "code-comparison-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 60, w: 1600, h: 83.2 },
    });
    expect(elements.find((element) => element.id === "code-comparison-before")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 784, h: 83.2 },
      entrance: { type: "slide-left", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "code-comparison-after")).toMatchObject({
      kind: "group",
      rect: { x: 816, y: 0, w: 784, h: 83.2 },
      entrance: { type: "slide-right", delay: 100, duration: 600 },
    });
    expect(elements.find((element) => element.id === "code-comparison-before-code-element")).toMatchObject({
      kind: "code",
      rect: { x: 0, y: 0, w: 784, h: 83.2 },
      code: "a",
    });
    expect(elements.find((element) => element.id === "code-comparison-after-code-element")).toMatchObject({
      kind: "code",
      rect: { x: 0, y: 0, w: 784, h: 83.2 },
      code: "b",
    });
  });

  it("sidebar: expands with columns ratio 0.3", () => {
    const { slide, layout } = expandAndLayout("sidebar", {
      title: "Overview",
      sidebar: "Side notes",
      main: "Main content here",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      kind: "group",
      id: "sidebar-layout",
      layout: { type: "row", gap: 40, tracks: [480, 1080], align: "start" },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "sidebar-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 60, w: 1600, h: 960 },
    });
    expect(elements.find((element) => element.id === "sidebar-side-column")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 480, h: 960 },
    });
    expect(elements.find((element) => element.id === "sidebar-main-column")).toMatchObject({
      kind: "group",
      rect: { x: 520, y: 0, w: 1080, h: 174.39999999999998 },
    });
    expect(elements.find((element) => element.id === "sidebar-title")).toMatchObject({
      kind: "text",
      text: "Overview",
      rect: { x: 0, y: 0, w: 1080, h: 62.39999999999999 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "sidebar-main-body")).toMatchObject({
      kind: "text",
      text: "Main content here",
      rect: { x: 0, y: 126.39999999999999, w: 1080, h: 48 },
      entrance: { type: "slide-right", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "sidebar-panel")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 92, w: 480, h: 868 },
      style: { fill: "#ffffff" },
      borderRadius: 12,
      clipContent: true,
      entrance: { type: "slide-left", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "sidebar-panel-body")).toMatchObject({
      kind: "text",
      text: "Side notes",
      rect: { x: 40, y: 40, w: 400, h: 44.800000000000004 },
    });
  });

  it("sidebar: right position uses ratio 0.7", () => {
    const { slide } = expandAndLayout("sidebar", {
      sidebar: "Notes",
      main: "Content",
      sidebarPosition: "right",
    });

    const children = sceneChildren(slide);
    expect(children[0]).toMatchObject({
      kind: "group",
      id: "sidebar-layout",
      layout: { type: "row", gap: 40, tracks: [1080, 480], align: "start" },
    });
  });

  it("sidebar: yaml_string filter preserves multiline text", () => {
    const { slide } = expandAndLayout("sidebar", {
      title: "Test",
      sidebar: "Key concepts:\n\n• Components\n• Templates",
      main: "Main content",
    });

    const children = sceneChildren(slide);
    const columns = children[0] as { children: Array<{ id: string; children?: Array<{ id: string; text?: string }> }> };
    const sidebarColumn = columns.children[0];
    const panel = sidebarColumn.children?.find((child) => child.id === "sidebar-panel");
    expect(panel).toBeDefined();
    const body = panel?.children?.find((child) => child.id === "sidebar-panel-body");
    expect(body).toBeDefined();
    expect(body!.text).toContain("\n");
    expect(body!.text).toContain("• Components");
  });

  it("image-caption: expands with centered layout", () => {
    const { slide, layout } = expandAndLayout("image-caption", {
      title: "Photo",
      image: "photo.jpg",
      caption: "A beautiful sunset",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(4);
    expect(children[0]).toMatchObject({ kind: "text", id: "image-caption-header-title", text: "Photo" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "image-caption-header-divider" });
    expect(children[2]).toMatchObject({ kind: "image", id: "image-caption-image", src: "photo.jpg", borderRadius: 16 });
    expect(children[3]).toMatchObject({ kind: "text", id: "image-caption-caption", text: "A beautiful sunset" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "image-caption-header-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-caption-header-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
      style: {
        gradient: {
          type: "linear",
          angle: 135,
          stops: [
            { color: "#4f6df5", position: 0 },
            { color: "#a855f7", position: 1 },
          ],
        },
      },
    });
    expect(elements.find((element) => element.id === "image-caption-image")).toMatchObject({
      kind: "image",
      rect: { x: 160, y: 192.8, w: 1600, h: 768.2 },
      src: "/img/photo.jpg",
      entrance: { type: "scale-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-caption-caption")).toMatchObject({
      kind: "text",
      rect: { x: 510, y: 981, w: 900, h: 39 },
      entrance: { type: "fade-up", delay: 400, duration: 600 },
    });
  });

  it("image-caption: expands without title", () => {
    const { slide, layout } = expandAndLayout("image-caption", {
      image: "img.png",
      caption: "Caption text",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({ kind: "image", id: "image-caption-image" });
    expect(children[1]).toMatchObject({ kind: "text", id: "image-caption-caption", text: "Caption text" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "image-caption-image")).toMatchObject({
      kind: "image",
      rect: { x: 160, y: 60, w: 1600, h: 901 },
      src: "/img/img.png",
    });
    expect(elements.find((element) => element.id === "image-caption-caption")).toMatchObject({
      kind: "text",
      rect: { x: 510, y: 981, w: 900, h: 39 },
    });
  });

  it("profile: expands with avatar, name, title, and bio", () => {
    const { slide, layout } = expandAndLayout("profile", {
      name: "Jane Doe",
      title: "Software Engineer",
      image: "avatar.jpg",
      bio: "A passionate developer.",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      kind: "group",
      id: "profile-stack",
      layout: {
        type: "stack",
        align: "center",
        justify: "center",
        padding: [0, 160, 0, 160],
      },
    });
    if (children[0].kind === "group") {
      expect(children[0].children).toMatchObject([
        { kind: "image", id: "profile-avatar", clipCircle: true, src: "avatar.jpg" },
        { kind: "group", id: "profile-image-gap" },
        { kind: "text", id: "profile-name", text: "Jane Doe" },
        { kind: "group", id: "profile-title-gap" },
        { kind: "text", id: "profile-title", text: "Software Engineer" },
        { kind: "group", id: "profile-divider-gap-top" },
        { kind: "shape", id: "profile-divider" },
        { kind: "group", id: "profile-divider-gap-bottom" },
        { kind: "text", id: "profile-bio", text: "A passionate developer." },
      ]);
    }

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "profile-avatar")).toMatchObject({
      kind: "image",
      rect: { x: 860, y: 332.5, w: 200, h: 200 },
      src: "/img/avatar.jpg",
      entrance: { type: "scale-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "profile-name")).toMatchObject({
      kind: "text",
      text: "Jane Doe",
      rect: { x: 160, y: 560.5, w: 1600, h: 62.39999999999999 },
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "profile-title")).toMatchObject({
      kind: "text",
      text: "Software Engineer",
      rect: { x: 160, y: 630.9, w: 1600, h: 41.6 },
      entrance: { type: "fade-up", delay: 300, duration: 600 },
    });
    expect(elements.find((element) => element.id === "profile-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 688.5, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 350, duration: 600 },
      style: {
        gradient: {
          type: "linear",
          angle: 135,
          stops: [
            { color: "#4f6df5", position: 0 },
            { color: "#a855f7", position: 1 },
          ],
        },
      },
    });
    expect(elements.find((element) => element.id === "profile-bio")).toMatchObject({
      kind: "text",
      text: "A passionate developer.",
      rect: { x: 610, y: 708.5, w: 700, h: 39 },
      entrance: { type: "fade-up", delay: 400, duration: 600 },
    });
  });

  it("profile: expands without optional fields", () => {
    const { slide, layout } = expandAndLayout("profile", {
      name: "Solo Name",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ kind: "group", id: "profile-stack" });
    if (children[0].kind === "group") {
      expect(children[0].children).toMatchObject([
        { kind: "group", id: "profile-leading-offset" },
        { kind: "text", id: "profile-name", text: "Solo Name" },
        { kind: "group", id: "profile-divider-gap-top" },
        { kind: "shape", id: "profile-divider" },
      ]);
    }

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "profile-name")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 504.8, w: 1600, h: 62.39999999999999 },
    });
    expect(elements.find((element) => element.id === "profile-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 583.2, w: 80, h: 4 },
      borderRadius: 2,
    });
  });

  it("image-comparison: expands with images and labels", () => {
    const { slide, layout } = expandAndLayout("image-comparison", {
      title: "Before & After",
      before: { image: "old.jpg", label: "Before" },
      after: { image: "new.jpg", label: "After" },
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "image-comparison-header-title", text: "Before & After" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "image-comparison-header-divider" });
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "image-comparison-layout",
      layout: { type: "row", gap: 32, align: "stretch" },
    });
    const cols = children[2] as unknown as { children: unknown[] };
    expect(cols.children).toHaveLength(2);
    expect(cols.children[0]).toMatchObject({ kind: "group", id: "image-comparison-before-card" });
    expect(cols.children[1]).toMatchObject({ kind: "group", id: "image-comparison-after-card" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "image-comparison-header-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-comparison-header-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
      style: {
        gradient: {
          type: "linear",
          angle: 135,
          stops: [
            { color: "#4f6df5", position: 0 },
            { color: "#a855f7", position: 1 },
          ],
        },
      },
    });
    expect(elements.find((element) => element.id === "image-comparison-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 832.4 },
    });
    expect(elements.find((element) => element.id === "image-comparison-before-card")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 784, h: 832.4 },
      style: { fill: "#ffffff" },
      borderRadius: 12,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        blur: 24,
        spread: 0,
        color: "rgba(0, 0, 0, 0.06)",
      },
      border: {
        width: 1,
        color: "rgba(0, 0, 0, 0.06)",
      },
      clipContent: true,
      entrance: { type: "slide-left", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-comparison-before-image")).toMatchObject({
      kind: "image",
      rect: { x: 24, y: 24, w: 736, h: 730 },
      src: "/img/old.jpg",
      borderRadius: 8,
    });
    expect(elements.find((element) => element.id === "image-comparison-after-label")).toMatchObject({
      kind: "text",
      text: "After",
      rect: { x: 24, y: 770, w: 736, h: 38.400000000000006 },
    });
  });

  it("image-comparison: expands without labels", () => {
    const { slide, layout } = expandAndLayout("image-comparison", {
      before: { image: "a.jpg" },
      after: { image: "b.jpg" },
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ kind: "group", id: "image-comparison-layout" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "image-comparison-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 60, w: 1600, h: 778 },
    });
    expect(elements.find((element) => element.id === "image-comparison-before-card")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 784, h: 778 },
      style: { fill: "#ffffff" },
    });
    expect(elements.find((element) => element.id === "image-comparison-after-card")).toMatchObject({
      kind: "group",
      rect: { x: 816, y: 0, w: 784, h: 778 },
      style: { fill: "#ffffff" },
    });
  });

  it("image-text: expands with fill mode image panel", () => {
    const { slide, layout } = expandAndLayout("image-text", {
      title: "About Us",
      image: "hero.jpg",
      body: "We build great things.",
      bullets: ["Fast", "Reliable"],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ kind: "group", id: "image-text-root" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "image-text-image-column")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 960, h: 1080 },
      entrance: { type: "none", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-text-image")).toMatchObject({
      kind: "image",
      rect: { x: 160, y: 0, w: 780, h: 1080 },
      src: "/img/hero.jpg",
      borderRadius: 8,
      entrance: { type: "slide-left", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-text-text-column")).toMatchObject({
      kind: "group",
      rect: { x: 960, y: 0, w: 960, h: 787.2 },
      entrance: { type: "none", delay: 100, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-text-title")).toMatchObject({
      kind: "text",
      rect: { x: 20, y: 270, w: 780, h: 62.39999999999999 },
      text: "About Us",
    });
    expect(elements.find((element) => element.id === "image-text-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 20, y: 348.4, w: 80, h: 4 },
      borderRadius: 2,
    });
    expect(elements.find((element) => element.id === "image-text-body")).toMatchObject({
      kind: "text",
      rect: { x: 20, y: 602.4, w: 780, h: 47.6 },
      text: "We build great things.",
      entrance: { type: "slide-right", delay: 300, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-text-bullets-list")).toMatchObject({
      kind: "list",
      rect: { x: 20, y: 694, w: 780, h: 93.2 },
      items: ["Fast", "Reliable"],
      entrance: { type: "fade-up", delay: 400, duration: 600 },
    });
  });

  it("image-text: right position swaps panels", () => {
    const { slide, layout } = expandAndLayout("image-text", {
      title: "Reverse",
      image: "photo.jpg",
      imagePosition: "right",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "image-text-text-column")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 960, h: 352.4 },
      entrance: { type: "none", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-text-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 270, w: 780, h: 62.39999999999999 },
      text: "Reverse",
    });
    expect(elements.find((element) => element.id === "image-text-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 160, y: 348.4, w: 80, h: 4 },
    });
    expect(elements.find((element) => element.id === "image-text-image-column")).toMatchObject({
      kind: "group",
      rect: { x: 960, y: 0, w: 960, h: 1080 },
      entrance: { type: "none", delay: 100, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-text-image")).toMatchObject({
      kind: "image",
      rect: { x: 20, y: 0, w: 780, h: 1080 },
      src: "/img/photo.jpg",
      entrance: { type: "slide-right", delay: 200, duration: 600 },
    });
  });

  it("image-text: omits body and bullets when not provided", () => {
    const { slide, layout } = expandAndLayout("image-text", {
      title: "Minimal",
      image: "bg.jpg",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "image-text-image")).toMatchObject({
      kind: "image",
      rect: { x: 160, y: 0, w: 780, h: 1080 },
      src: "/img/bg.jpg",
    });
    expect(elements.find((element) => element.id === "image-text-text-column")).toMatchObject({
      kind: "group",
      rect: { x: 960, y: 0, w: 960, h: 352.4 },
    });
    expect(elements.find((element) => element.id === "image-text-title")).toMatchObject({
      kind: "text",
      rect: { x: 20, y: 270, w: 780, h: 62.39999999999999 },
      text: "Minimal",
    });
    expect(elements.find((element) => element.id === "image-text-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 20, y: 348.4, w: 80, h: 4 },
    });
    expect(elements.find((element) => element.id === "image-text-bullets-list")).toBeUndefined();
  });

  it("three-column: expands to accent-top cards", () => {
    const { slide, layout } = expandAndLayout("three-column", {
      title: "Three Columns",
      columns: [
        { icon: "A", heading: "Alpha", body: "First body" },
        { icon: "B", heading: "Beta", body: "Second body" },
        { icon: "C", heading: "Gamma", body: "Third body" },
      ],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "three-column-header-title", text: "Three Columns" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "three-column-header-divider" });
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "three-column-layout",
      layout: { type: "row", gap: 32, align: "start" },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "three-column-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 262.20000000000005 },
    });
    expect(elements.find((element) => element.id === "three-column-card-1")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 512, h: 262.20000000000005 },
      style: { fill: "#ffffff" },
      borderRadius: 12,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        blur: 24,
        spread: 0,
        color: "rgba(0, 0, 0, 0.06)",
      },
      border: { width: 3, color: "#4f6df5", sides: ["top"] },
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "three-column-card-1-icon")).toMatchObject({
      kind: "text",
      rect: { x: 32, y: 35, w: 448, h: 76.80000000000001 },
      text: "A",
    });
    expect(elements.find((element) => element.id === "three-column-card-1-heading")).toMatchObject({
      kind: "text",
      rect: { x: 32, y: 127.80000000000001, w: 448, h: 41.599999999999994 },
      text: "Alpha",
    });
    expect(elements.find((element) => element.id === "three-column-card-1-body")).toMatchObject({
      kind: "text",
      rect: { x: 32, y: 185.4, w: 448, h: 44.800000000000004 },
      text: "First body",
    });
  });

  it("three-column: verticalAlign center centers the card row", () => {
    const { layout } = expandAndLayout("three-column", {
      title: "Three Columns",
      verticalAlign: "center",
      columns: [
        { icon: "A", heading: "Alpha", body: "First body" },
        { icon: "B", heading: "Beta", body: "Second body" },
        { icon: "C", heading: "Gamma", body: "Third body" },
      ],
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "three-column-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 475.3, w: 1600, h: 262.20000000000005 },
    });
  });

  it("three-column: keeps card heights equal when body copy lengths differ", () => {
    const { layout } = expandAndLayout("three-column", {
      title: "Three Columns",
      columns: [
        { icon: "A", heading: "Alpha", body: "Short body" },
        { icon: "B", heading: "Beta", body: "A much longer body copy that wraps across multiple lines to force a taller natural card height." },
        { icon: "C", heading: "Gamma", body: "Medium-length body copy." },
      ],
    });

    const elements = allLayoutElements(layout.elements);
    const card1 = elements.find((element) => element.id === "three-column-card-1");
    const card2 = elements.find((element) => element.id === "three-column-card-2");
    const card3 = elements.find((element) => element.id === "three-column-card-3");
    const layoutGroup = elements.find((element) => element.id === "three-column-layout");

    expect(card1?.rect.h).toBe(card2?.rect.h);
    expect(card2?.rect.h).toBe(card3?.rect.h);
    expect(layoutGroup?.rect.h).toBe(card1?.rect.h);
  });

  it("top-bottom: expands to two stacked content cards", () => {
    const { slide, layout } = expandAndLayout("top-bottom", {
      title: "Top Bottom",
      top: "Top text",
      bottom: "Bottom text",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(5);
    expect(children[0]).toMatchObject({ kind: "text", id: "top-bottom-header-title", text: "Top Bottom" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "top-bottom-header-divider" });
    expect(children[2]).toMatchObject({ kind: "group", id: "top-bottom-top-panel" });
    expect(children[3]).toMatchObject({ kind: "shape", id: "top-bottom-mid-divider" });
    expect(children[4]).toMatchObject({ kind: "group", id: "top-bottom-bottom-panel" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "top-bottom-top-panel")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 383.6 },
      style: { fill: "#ffffff" },
      borderRadius: 12,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        blur: 24,
        spread: 0,
        color: "rgba(0, 0, 0, 0.06)",
      },
      border: { width: 1, color: "rgba(0, 0, 0, 0.06)" },
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "top-bottom-mid-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 860, y: 604.4000000000001, w: 200, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 300, duration: 600 },
    });
    expect(elements.find((element) => element.id === "top-bottom-bottom-panel")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 636.4000000000001, w: 1600, h: 383.6 },
      style: { fill: "#ffffff" },
      entrance: { type: "fade-up", delay: 400, duration: 600 },
    });
  });

  // --- Template aliases ---

  it("image-gallery: expands with columns of images + captions", () => {
    const { slide, layout } = expandAndLayout("image-gallery", {
      title: "Gallery",
      images: [
        { src: "a.jpg", caption: "First" },
        { src: "b.jpg", caption: "Second" },
      ],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "image-gallery-header-title", text: "Gallery" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "image-gallery-header-divider" });
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "image-gallery-layout",
      layout: { type: "row", gap: 32, align: "start" },
    });
    const items = children[2] as unknown as { children: unknown[] };
    expect(items.children).toHaveLength(2);
    expect(items.children[0]).toMatchObject({ kind: "group", id: "image-gallery-item-1" });
    expect(items.children[1]).toMatchObject({ kind: "group", id: "image-gallery-item-2" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "image-gallery-header-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      entrance: { type: "fade-up", delay: 0, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-gallery-header-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
      entrance: { type: "fade-up", delay: 100, duration: 600 },
      style: {
        gradient: {
          type: "linear",
          angle: 135,
          stops: [
            { color: "#4f6df5", position: 0 },
            { color: "#a855f7", position: 1 },
          ],
        },
      },
    });
    expect(elements.find((element) => element.id === "image-gallery-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 827.2 },
    });
    expect(elements.find((element) => element.id === "image-gallery-item-1")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 784, h: 827.2 },
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-gallery-item-1-image")).toMatchObject({
      kind: "image",
      rect: { x: 0, y: 0, w: 784, h: 764 },
      src: "/img/a.jpg",
      borderRadius: 16,
      entrance: { type: "scale-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-gallery-item-1-caption")).toMatchObject({
      kind: "text",
      rect: { x: 0, y: 792, w: 784, h: 35.2 },
      text: "First",
    });
    expect(elements.find((element) => element.id === "image-gallery-item-2")).toMatchObject({
      kind: "group",
      rect: { x: 816, y: 0, w: 784, h: 827.2 },
      entrance: { type: "fade-up", delay: 300, duration: 600 },
    });
  });

  it("image-grid: expands with grid of images + captions", () => {
    const { slide, layout } = expandAndLayout("image-grid", {
      title: "Grid",
      columns: 2,
      images: [
        { src: "a.jpg", caption: "First" },
        { src: "b.jpg", caption: "Second" },
        { src: "c.jpg", caption: "Third" },
        { src: "d.jpg", caption: "Fourth" },
      ],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "image-grid-header-title", text: "Grid" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "image-grid-header-divider" });
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "image-grid-layout",
      layout: { type: "grid", columns: 2, columnGap: 32, rowGap: 32, rowHeight: 397.6 },
    });
    const grid = children[2] as unknown as { children: unknown[] };
    expect(grid.children).toHaveLength(4);

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "image-grid-header-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
    });
    expect(elements.find((element) => element.id === "image-grid-header-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
    });
    expect(elements.find((element) => element.id === "image-grid-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 827.2 },
    });
    expect(elements.find((element) => element.id === "image-grid-item-1")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 784, h: 397.6 },
      entrance: { type: "fade-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-grid-item-1-image")).toMatchObject({
      kind: "image",
      rect: { x: 0, y: 0, w: 784, h: 335.20000000000005 },
      src: "/img/a.jpg",
      borderRadius: 16,
      entrance: { type: "scale-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "image-grid-item-1-caption")).toMatchObject({
      kind: "text",
      rect: { x: 0, y: 359.20000000000005, w: 784, h: 38.400000000000006 },
      text: "First",
    });
    expect(elements.find((element) => element.id === "image-grid-item-4")).toMatchObject({
      kind: "group",
      rect: { x: 816, y: 429.6, w: 784, h: 397.6 },
      entrance: { type: "fade-up", delay: 500, duration: 600 },
    });
  });

  it("icon-grid: expands with grid of icon + label boxes", () => {
    const { slide, layout } = expandAndLayout("icon-grid", {
      title: "Icons",
      columns: 3,
      items: [
        { icon: "⚛️", label: "React" },
        { icon: "▲", label: "Next.js" },
        { icon: "📝", label: "TypeScript" },
      ],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "icon-grid-header-title", text: "Icons" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "icon-grid-header-divider" });
    expect(children[2]).toMatchObject({
      kind: "group",
      id: "icon-grid-layout",
      layout: { type: "grid", columns: 3, columnGap: 32, rowGap: 32, rowHeight: 827.2 },
    });
    const grid = children[2] as unknown as { children: unknown[] };
    expect(grid.children).toHaveLength(3);
    expect(grid.children[0]).toMatchObject({ kind: "group", id: "icon-grid-item-1", preset: "iconCard" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "icon-grid-header-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
    });
    expect(elements.find((element) => element.id === "icon-grid-header-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
      borderRadius: 2,
    });
    expect(elements.find((element) => element.id === "icon-grid-layout")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 827.2 },
    });
    expect(elements.find((element) => element.id === "icon-grid-item-1")).toMatchObject({
      kind: "group",
      rect: { x: 0, y: 0, w: 512, h: 827.2 },
      style: { fill: "#ffffff" },
      borderRadius: 12,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        blur: 24,
        spread: 0,
        color: "rgba(0, 0, 0, 0.06)",
      },
      border: {
        width: 1,
        color: "rgba(0, 0, 0, 0.06)",
      },
      entrance: { type: "scale-up", delay: 200, duration: 600 },
    });
    expect(elements.find((element) => element.id === "icon-grid-item-1-icon")).toMatchObject({
      kind: "text",
      rect: { x: 24, y: 346.40000000000003, w: 464, h: 76.80000000000001 },
      text: "⚛️",
    });
    expect(elements.find((element) => element.id === "icon-grid-item-1-label")).toMatchObject({
      kind: "text",
      rect: { x: 24, y: 439.20000000000005, w: 464, h: 41.6 },
      text: "React",
    });
    expect(elements.find((element) => element.id === "icon-grid-item-3")).toMatchObject({
      kind: "group",
      rect: { x: 1088, y: 0, w: 512, h: 827.2 },
      entrance: { type: "scale-up", delay: 400, duration: 600 },
    });
  });

  it("icon-grid: uses theme-derived card chrome for dark-tech", () => {
    const slide = expandDsl("icon-grid", {
      title: "十国一览",
      columns: 5,
      items: [
        { icon: "🐉", label: "前蜀" },
        { icon: "🐉", label: "后蜀" },
        { icon: "🌊", label: "南吴" },
        { icon: "🎭", label: "南唐" },
        { icon: "🌙", label: "吴越" },
      ],
    });
    const layout = layoutSlide(slide, "dark-tech", "/img");
    const elements = allLayoutElements(layout.elements);

    expect(elements.find((element) => element.id === "icon-grid-item-1")).toMatchObject({
      kind: "group",
      style: { fill: "#12121f" },
      borderRadius: 8,
      shadow: {
        offsetX: 0,
        offsetY: 4,
        blur: 24,
        spread: 0,
        color: "rgba(0, 255, 200, 0.08)",
      },
      border: {
        width: 1,
        color: "rgba(0, 255, 200, 0.1)",
      },
    });
  });

  it("timeline: raw elements with resolved theme tokens", () => {
    const { slide, layout } = expandAndLayout("timeline", {
      title: "Timeline",
      events: [
        { date: "Q1", label: "Start", description: "Begin work" },
        { date: "Q2", label: "End" },
      ],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "timeline-title", text: "Timeline" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "timeline-divider" });
    expect(children[2]).toMatchObject({
      kind: "ir",
      id: "timeline-body",
      element: { kind: "group", id: "tl-group" },
    });

    const allEls = allLayoutElements(layout.elements);
    expect(allEls.find((e) => e.id === "timeline-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      text: "Timeline",
    });
    expect(allEls.find((e) => e.id === "timeline-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
    });
    const body = allEls.find((e) => e.id === "tl-group");
    expect(body).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 300 },
    });
    const line = allEls.find((e) => e.id.includes("tl-line"));
    expect(line).toBeDefined();
    if (line?.kind === "shape") {
      expect((line as unknown as { style: { fill: string } }).style.fill).not.toContain("theme.");
    }
    const dates = allEls.filter((e) => e.id.includes("tl-date"));
    expect(dates).toHaveLength(2);
  });

  it("steps: raw elements with badges, connectors, cards", () => {
    const { slide, layout } = expandAndLayout("steps", {
      title: "Steps",
      steps: [
        { label: "First", description: "Do this" },
        { label: "Second" },
      ],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "steps-title", text: "Steps" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "steps-divider" });
    expect(children[2]).toMatchObject({
      kind: "ir",
      id: "steps-body",
      element: { kind: "group", id: "st-group" },
    });

    const allEls = allLayoutElements(layout.elements);
    expect(allEls.find((e) => e.id === "steps-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      text: "Steps",
    });
    expect(allEls.find((e) => e.id === "steps-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
    });
    expect(allEls.find((e) => e.id === "st-group")).toMatchObject({
      kind: "group",
      rect: { x: 160, y: 192.8, w: 1600, h: 264 },
    });
    const badges = allEls.filter((e) => e.id.includes("st-badge") && !e.id.includes("num"));
    expect(badges).toHaveLength(2);
    if (badges[0].kind === "group" && (badges[0] as { style?: { fill: string } }).style) {
      expect((badges[0] as { style: { fill: string } }).style.fill).not.toContain("theme.");
    }
    const cards = allEls.filter((e) => e.id.includes("st-card"));
    expect(cards).toHaveLength(2);
  });

  it("table: raw elements with header row and data cells", () => {
    const { slide, layout } = expandAndLayout("table", {
      title: "Table",
      headers: ["A", "B"],
      rows: [["1", "2"], ["3", "4"]],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "table-title", text: "Table" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "table-divider" });
    expect(children[2]).toMatchObject({
      kind: "ir",
      id: "table-body",
      element: { kind: "group", id: "tbl-group" },
    });

    const allEls = allLayoutElements(layout.elements);
    expect(allEls.find((e) => e.id === "table-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      text: "Table",
    });
    expect(allEls.find((e) => e.id === "table-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
    });
    const group = allEls.find((e) => e.id === "tbl-group");
    expect(group).toBeDefined();
    if (group?.kind === "group") {
      expect(group.rect).toMatchObject({ x: 160, y: 192.8, w: 1600, h: 208 });
      const groupChildren = (group as { children: { id: string; kind: string; borderRadius?: number; style?: { fill: string } }[] }).children;
      const accentBg = groupChildren.find((e) => e.id === "tbl-accent-bg");
      expect(accentBg).toBeDefined();
      if (accentBg?.kind === "shape") {
        expect(accentBg.borderRadius).toBe(12);
        expect(accentBg.style!.fill).not.toContain("theme.");
      }
      const dataBg = groupChildren.find((e) => e.id === "tbl-data-bg");
      expect(dataBg).toBeDefined();
      if (dataBg?.kind === "shape") {
        expect(dataBg.borderRadius).toBe(12);
      }
      const hdrs = groupChildren.filter((e) => e.id.includes("tbl-hdr"));
      expect(hdrs).toHaveLength(2);
      const cells = groupChildren.filter((e) => e.id.includes("tbl-cell"));
      expect(cells).toHaveLength(4);
    }
  });

  // --- Group 5 templates ---

  it("video: produces video element with title", () => {
    const { slide, layout } = expandAndLayout("video", {
      title: "Demo Video",
      src: "https://example.com/video.mp4",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "video-title", text: "Demo Video" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "video-divider" });
    expect(children[2]).toMatchObject({
      kind: "ir",
      id: "video-block",
      element: { kind: "video", id: "video-element" },
    });

    const allEls = allLayoutElements(layout.elements);
    expect(allEls.find((e) => e.id === "video-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      text: "Demo Video",
    });
    expect(allEls.find((e) => e.id === "video-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
    });
    const videoEl = allEls.find((e) => e.id === "video-element");
    expect(videoEl).toBeDefined();
    if (videoEl?.kind === "video") {
      expect(videoEl.rect).toMatchObject({ x: 160, y: 192.8, w: 1600, h: 827.2 });
      expect(videoEl.src).toBe("https://example.com/video.mp4");
      expect(videoEl.borderRadius).toBe(12);
    }
  });

  it("video: expands without title (flex fill)", () => {
    const { slide, layout } = expandAndLayout("video", {
      src: "https://example.com/clip.mp4",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      kind: "ir",
      id: "video-block",
      element: { kind: "video", id: "video-element" },
    });

    const allEls = allLayoutElements(layout.elements);
    const videoEl = allEls.find((e) => e.id === "video-element");
    expect(videoEl).toBeDefined();
    if (videoEl?.kind === "video") {
      expect(videoEl.rect).toMatchObject({ x: 160, y: 60, w: 1600, h: 960 });
      expect(videoEl.src).toBe("https://example.com/clip.mp4");
    }
  });

  it("iframe: produces iframe element with title", () => {
    const { slide, layout } = expandAndLayout("iframe", {
      title: "Live Demo",
      src: "https://example.com/app",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "iframe-title", text: "Live Demo" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "iframe-divider" });
    expect(children[2]).toMatchObject({
      kind: "ir",
      id: "iframe-block",
      element: { kind: "iframe", id: "iframe-element" },
    });

    const allEls = allLayoutElements(layout.elements);
    expect(allEls.find((e) => e.id === "iframe-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 72.8 },
      text: "Live Demo",
    });
    expect(allEls.find((e) => e.id === "iframe-divider")).toMatchObject({
      kind: "shape",
      rect: { x: 920, y: 148.8, w: 80, h: 4 },
    });
    const iframeEl = allEls.find((e) => e.id === "iframe-element");
    expect(iframeEl).toBeDefined();
    if (iframeEl?.kind === "iframe") {
      expect(iframeEl.rect).toMatchObject({ x: 160, y: 192.8, w: 1600, h: 827.2 });
      expect(iframeEl.src).toBe("https://example.com/app");
      expect(iframeEl.borderRadius).toBe(12);
    }
  });

  it("iframe: expands without title (flex fill)", () => {
    const { slide, layout } = expandAndLayout("iframe", {
      src: "https://example.com",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      kind: "ir",
      id: "iframe-block",
      element: { kind: "iframe", id: "iframe-element" },
    });

    const allEls = allLayoutElements(layout.elements);
    const iframeEl = allEls.find((e) => e.id === "iframe-element");
    expect(iframeEl).toBeDefined();
    if (iframeEl?.kind === "iframe") {
      expect(iframeEl.rect).toMatchObject({ x: 160, y: 60, w: 1600, h: 960 });
      expect(iframeEl.src).toBe("https://example.com");
    }
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

    const children = sceneChildren(slide);
    expect(children[0]).toMatchObject({
      kind: "text",
      id: "bullets-title",
      style: { fontSize: 72 },
    });

    const layout = layoutSlide(slide, "modern", "/img");
    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "bullets-title")).toMatchObject({
      kind: "text",
      rect: { x: 160, y: 60, w: 1600, h: 93.6 },
      style: { fontSize: 72 },
    });
  });

  it("scene templates expand and layout through the scene compiler path", () => {
    const def = makeInlineTemplate({
      params: { title: { type: "string", required: true } },
      rawBody: `
mode: scene
sourceSize: { w: 640, h: 360 }
fit: contain
align: center
background:
  type: solid
  color: "#0f1728"
children:
  - kind: shape
    id: panel
    frame: { x: 320, y: 0, w: 320, h: 360 }
    shape: rect
    style:
      fill: "#1f2a44"
  - kind: text
    id: title
    frame: { x: 40, y: 40, w: 240 }
    text: "{{ title }}"
    style:
      fontFamily: "heading"
      fontSize: 40
      fontWeight: 700
      color: "#ffffff"
      lineHeight: 1.1
`,
    });

    const slide = expandDslTemplate({ template: "inline-test", title: "Scene DSL" }, def);
    expect(slide).toMatchObject({ mode: "scene" });

    const layout = layoutSlide(slide, "modern", "/img");
    expect(layout.background).toBe("#0f1728");
    expect(layout.elements.some((element) => element.id === "panel")).toBe(true);
    expect(layout.elements.some((element) => element.id === "title")).toBe(true);
  });

  it("scene templates support Nunjucks macros and scene presets", () => {
    const def = makeInlineTemplate({
      params: { title: { type: "string", required: true } },
      rawBody: `
mode: scene
sourceSize: { w: 640, h: 360 }
fit: contain
align: center
background:
  type: solid
  color: "#0f1728"
presets:
  statCard:
    borderRadius: 18
    style:
      fill: "#1f2a44"
  statLabel:
    style:
      fontFamily: "heading"
      fontSize: 16
      fontWeight: 700
      color: "#ffffff"
      lineHeight: 1.1
children:
{% macro stat(id, x, label) %}
  - kind: shape
    id: "{{ id }}-card"
    preset: statCard
    frame: { x: {{ x }}, y: 140, w: 160, h: 88 }
    shape: rect
  - kind: text
    id: "{{ id }}-label"
    preset: statLabel
    frame: { x: {{ x + 20 }}, y: 172, w: 120 }
    text: "{{ label }}"
    style:
      fontSize: 18
{% endmacro %}
{{ stat("left", 48, title) }}
{{ stat("right", 248, "Second") }}
`,
    });

    const slide = expandDslTemplate({ template: "inline-test", title: "Scene Macro" }, def);
    expect(slide).toMatchObject({ mode: "scene" });

    const layout = layoutSlide(slide, "modern", "/img");
    const elements = allLayoutElements(layout.elements);
    const leftCard = elements.find((element) => element.id === "left-card");
    const leftLabel = elements.find((element) => element.id === "left-label");
    const rightCard = elements.find((element) => element.id === "right-card");

    expect(leftCard).toMatchObject({
      kind: "shape",
      borderRadius: 54,
      style: { fill: "#1f2a44" },
    });
    expect(rightCard).toMatchObject({
      kind: "shape",
      borderRadius: 54,
    });
    expect(leftLabel).toMatchObject({
      kind: "text",
      text: "Scene Macro",
    });
  });

  it("scene templates can import built-in macro libraries and lay them out", () => {
    const def = makeInlineTemplate({
      rawBody: `
{% import "scene/blocks.njk" as scene %}
mode: scene
background:
  type: solid
  color: "#0f1728"
presets:
  statCard:
    borderRadius: 18
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
{{ scene.stat_card("second", 300, 80, 220, 120, "2,000", "DRONES") }}
`,
    });

    const slide = expandDslTemplate({ template: "inline-test" }, def);
    const layout = layoutSlide(slide, "modern", "/img");
    const elements = allLayoutElements(layout.elements);

    expect(layout.background).toBe("#0f1728");
    expect(elements.find((element) => element.id === "first")).toMatchObject({
      kind: "group",
      borderRadius: 18,
    });
    expect(elements.find((element) => element.id === "first-value")).toMatchObject({
      kind: "text",
      text: "500",
    });
    expect(elements.find((element) => element.id === "second-label")).toMatchObject({
      kind: "text",
      text: "DRONES",
    });
  });
});
