import { describe, it, expect, beforeEach } from "vitest";
import { findTemplate, clearTemplateCache } from "./loader";
import { expandDslTemplate } from "./engine";
import { layoutSlide } from "@/lib/layout";
import type { SlideData, ComponentSlideData, SceneSlideData } from "@/lib/types";
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
) {
  const slide = expandDsl(templateName, params);
  const layout = layoutSlide(slide, "modern", "/img");
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

    const children = innerChildren(slide);
    // heading + divider + bullets = 3 children
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ type: "heading", text: "Test Bullets" });
    expect(children[1]).toMatchObject({ type: "divider", variant: "gradient" });
    expect(children[2]).toMatchObject({ type: "bullets" });

    expect(layout.elements.length).toBeGreaterThan(0);
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
    expect(elements.find((element) => element.id === "stat-1-value")).toMatchObject({
      kind: "text",
      text: "42",
    });
    expect(elements.find((element) => element.id === "stat-2-value")).toMatchObject({
      kind: "text",
      text: "7",
    });
  });

  it("stats: expands without title", () => {
    const { slide } = expandAndLayout("stats", {
      stats: [{ value: "1", label: "One" }],
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      kind: "group",
      id: "stats-grid",
      layout: { type: "grid", columns: 1, columnGap: 32 },
    });
  });

  it("statement: expands with subtitle", () => {
    const { slide, layout } = expandAndLayout("statement", {
      statement: "Big Idea",
      subtitle: "Supporting text",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "statement-title", text: "Big Idea" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "statement-divider" });
    expect(children[2]).toMatchObject({ kind: "text", id: "statement-subtitle", text: "Supporting text" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "statement-title")).toMatchObject({
      kind: "text",
      text: "Big Idea",
    });
  });

  it("statement: expands without subtitle", () => {
    const { slide } = expandAndLayout("statement", {
      statement: "Solo Statement",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ kind: "text", id: "statement-title", text: "Solo Statement" });
  });

  it("quote: expands with attribution", () => {
    const { slide, layout } = expandAndLayout("quote", {
      quote: "To be or not to be.",
      attribution: "Shakespeare",
    });

    const children = innerChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      type: "quote",
      text: "To be or not to be.",
      attribution: "Shakespeare",
      decorative: true,
    });
    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("quote: expands without attribution", () => {
    const { slide } = expandAndLayout("quote", {
      quote: "Just a quote.",
    });

    const children = innerChildren(slide);
    expect(children[0]).not.toHaveProperty("attribution");
  });

  it("code: expands with title and language", () => {
    const code = 'function greet() {\n  return "hello";\n}';
    const { slide, layout } = expandAndLayout("code", {
      title: "Code Example",
      language: "typescript",
      code,
    });

    const children = innerChildren(slide);
    // heading + divider + code = 3 children
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ type: "heading", text: "Code Example" });
    expect(children[2]).toMatchObject({
      type: "code",
      code,
      language: "typescript",
    });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("code: expands without title", () => {
    const { slide } = expandAndLayout("code", {
      code: "x = 1",
    });

    const children = innerChildren(slide);
    // code only = 1 child
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ type: "code" });
  });

  it("numbered-list: expands and lays out", () => {
    const { slide, layout } = expandAndLayout("numbered-list", {
      title: "Steps",
      items: ["First", "Second", "Third"],
    });

    const children = innerChildren(slide);
    // heading + divider + bullets = 3 children
    expect(children).toHaveLength(3);
    expect(children[2]).toMatchObject({
      type: "bullets",
      ordered: true,
      variant: "plain",
    });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("definition: expands with multiple definitions", () => {
    const { slide, layout } = expandAndLayout("definition", {
      title: "Terms",
      definitions: [
        { term: "TDD", description: "Test-Driven Development" },
        { term: "SDD", description: "Spec-Driven Development" },
      ],
    });

    const children = innerChildren(slide);
    // heading + divider + (term + desc + border-divider) × 2 = 8 children
    expect(children).toHaveLength(8);
    expect(children[0]).toMatchObject({ type: "heading", text: "Terms" });
    expect(children[2]).toMatchObject({
      type: "text",
      text: "TDD",
      fontWeight: "bold",
    });
    expect(children[3]).toMatchObject({
      type: "text",
      text: "Test-Driven Development",
    });
    expect(children[4]).toMatchObject({ type: "divider", variant: "border" });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("blank: expands to empty compose slide", () => {
    const { slide, layout } = expandAndLayout("blank", {});

    const children = innerChildren(slide);
    expect(children).toHaveLength(0);

    // Blank slide should still produce a valid layout
    expect(layout).toBeDefined();
    expect(layout.background).toBeDefined();
  });

  it("end: expands with title and subtitle", () => {
    const { slide, layout } = expandAndLayout("end", {
      title: "Goodbye",
      subtitle: "Any questions?",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ kind: "text", id: "end-title", text: "Goodbye" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "end-divider" });
    expect(children[2]).toMatchObject({ kind: "text", id: "end-subtitle", text: "Any questions?" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "end-title")).toMatchObject({
      kind: "text",
      text: "Goodbye",
    });
  });

  it("end: uses default title when none provided", () => {
    const { slide } = expandAndLayout("end", {});

    const children = sceneChildren(slide);
    expect(children[0]).toMatchObject({ kind: "text", id: "end-title", text: "Thank You" });
    expect(children).toHaveLength(1);
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
      layout: { type: "row", gap: 32, tracks: ["50%", "50%"], align: "stretch" },
    });
    const cols = children[2] as unknown as { children: unknown[] };
    expect(cols.children).toHaveLength(2);
    expect(cols.children[0]).toMatchObject({ kind: "group", id: "left-card" });
    expect(cols.children[1]).toMatchObject({ kind: "group", id: "right-card" });
    expect(cols.children[0]).not.toHaveProperty("frame");
    expect(cols.children[1]).not.toHaveProperty("frame");

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "left-card-body")).toMatchObject({
      kind: "text",
      text: "Left content",
    });
    expect(elements.find((element) => element.id === "right-card-body")).toMatchObject({
      kind: "text",
      text: "Right content",
    });
  });

  it("two-column: expands without title", () => {
    const { slide } = expandAndLayout("two-column", {
      left: "A",
      right: "B",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ kind: "group", id: "two-column-layout" });
  });

  it("two-column: style.cardHeight overrides default", () => {
    const { slide } = expandAndLayout("two-column", {
      left: "A",
      right: "B",
      style: { cardHeight: 500 },
    });

    const children = sceneChildren(slide);
    const cols = children[0] as unknown as { children: Array<{ frame?: { h?: number } }> };
    expect(cols.children[0].frame?.h).toBe(500);
    expect(cols.children[1].frame?.h).toBe(500);
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
      layout: { type: "row", gap: 32, tracks: ["50%", "50%"], align: "stretch" },
    });
    const cols = children[2] as unknown as { children: unknown[] };
    expect(cols.children).toHaveLength(2);
    expect(cols.children[0]).toMatchObject({ kind: "group", id: "comparison-left-card" });
    expect(cols.children[1]).toMatchObject({ kind: "group", id: "comparison-right-card" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "comparison-left-list")).toMatchObject({
      kind: "list",
      ordered: false,
      items: ["Slow", "Manual"],
      bulletColor: "#22c55e",
    });
    expect(elements.find((element) => element.id === "comparison-right-list")).toMatchObject({
      kind: "list",
      ordered: false,
      items: ["Fast", "Auto"],
      bulletColor: "#ef4444",
    });
  });

  it("code-comparison: expands with labels and code", () => {
    const { slide, layout } = expandAndLayout("code-comparison", {
      title: "Refactored",
      before: { label: "Before", code: "x = 1", language: "python" },
      after: { label: "After", code: "x: int = 1", language: "python" },
    });

    const children = innerChildren(slide);
    // heading + divider + columns = 3
    expect(children).toHaveLength(3);
    expect(children[2]).toMatchObject({ type: "columns" });
    const cols = children[2] as unknown as { children: unknown[] };
    expect(cols.children).toHaveLength(2);

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("code-comparison: expands without labels", () => {
    const { slide } = expandAndLayout("code-comparison", {
      before: { code: "a" },
      after: { code: "b" },
    });

    const children = innerChildren(slide);
    // columns only = 1
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ type: "columns" });
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
      layout: { type: "row", gap: 40, tracks: ["30%", "70%"], align: "stretch" },
    });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "sidebar-title")).toMatchObject({
      kind: "text",
      text: "Overview",
    });
    expect(elements.find((element) => element.id === "sidebar-panel-body")).toMatchObject({
      kind: "text",
      text: "Side notes",
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
      layout: { type: "row", gap: 40, tracks: ["70%", "30%"], align: "stretch" },
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
    expect(elements.find((element) => element.id === "image-caption-image")).toMatchObject({
      kind: "image",
      src: "/img/photo.jpg",
    });
  });

  it("image-caption: expands without title", () => {
    const { slide } = expandAndLayout("image-caption", {
      image: "img.png",
      caption: "Caption text",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({ kind: "image", id: "image-caption-image" });
    expect(children[1]).toMatchObject({ kind: "text", id: "image-caption-caption", text: "Caption text" });
  });

  it("profile: expands with avatar, name, title, and bio", () => {
    const { slide, layout } = expandAndLayout("profile", {
      name: "Jane Doe",
      title: "Software Engineer",
      image: "avatar.jpg",
      bio: "A passionate developer.",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(5);
    expect(children[0]).toMatchObject({ kind: "image", id: "profile-avatar", clipCircle: true, src: "avatar.jpg" });
    expect(children[1]).toMatchObject({ kind: "text", id: "profile-name", text: "Jane Doe" });
    expect(children[2]).toMatchObject({ kind: "text", id: "profile-title", text: "Software Engineer" });
    expect(children[3]).toMatchObject({ kind: "shape", id: "profile-divider" });
    expect(children[4]).toMatchObject({ kind: "text", id: "profile-bio", text: "A passionate developer." });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "profile-avatar")).toMatchObject({
      kind: "image",
      src: "/img/avatar.jpg",
    });
    expect(elements.find((element) => element.id === "profile-name")).toMatchObject({
      kind: "text",
      text: "Jane Doe",
    });
  });

  it("profile: expands without optional fields", () => {
    const { slide } = expandAndLayout("profile", {
      name: "Solo Name",
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({ kind: "text", id: "profile-name", text: "Solo Name" });
    expect(children[1]).toMatchObject({ kind: "shape", id: "profile-divider" });
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
      layout: { type: "row", gap: 32, tracks: ["50%", "50%"], align: "stretch" },
    });
    const cols = children[2] as unknown as { children: unknown[] };
    expect(cols.children).toHaveLength(2);
    expect(cols.children[0]).toMatchObject({ kind: "group", id: "image-comparison-before-card" });
    expect(cols.children[1]).toMatchObject({ kind: "group", id: "image-comparison-after-card" });

    const elements = allLayoutElements(layout.elements);
    expect(elements.find((element) => element.id === "image-comparison-before-image")).toMatchObject({
      kind: "image",
      src: "/img/old.jpg",
    });
    expect(elements.find((element) => element.id === "image-comparison-after-label")).toMatchObject({
      kind: "text",
      text: "After",
    });
  });

  it("image-comparison: expands without labels", () => {
    const { slide } = expandAndLayout("image-comparison", {
      before: { image: "a.jpg" },
      after: { image: "b.jpg" },
    });

    const children = sceneChildren(slide);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ kind: "group", id: "image-comparison-layout" });
  });

  it("image-text: expands with fill mode image panel", () => {
    const { slide, layout } = expandAndLayout("image-text", {
      title: "About Us",
      image: "hero.jpg",
      body: "We build great things.",
      bullets: ["Fast", "Reliable"],
    });

    const children = innerChildren(slide);
    // ComponentSlideData with children array
    expect(children).toBeDefined();
    expect(children.length).toBeGreaterThan(0);

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("image-text: right position swaps panels", () => {
    const { slide } = expandAndLayout("image-text", {
      title: "Reverse",
      image: "photo.jpg",
      imagePosition: "right",
    });

    const children = innerChildren(slide);
    expect(children).toBeDefined();
    expect(children.length).toBeGreaterThan(0);
  });

  it("image-text: omits body and bullets when not provided", () => {
    const { slide } = expandAndLayout("image-text", {
      title: "Minimal",
      image: "bg.jpg",
    });

    const children = innerChildren(slide);
    expect(children).toBeDefined();
    expect(children.length).toBeGreaterThan(0);
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

    const children = innerChildren(slide);
    // heading + divider + box(fill with columns) = 3
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ type: "heading", text: "Gallery" });
    const fillBox = children[2] as { type: string; children: unknown[] };
    expect(fillBox.type).toBe("box");
    const cols = fillBox.children[0] as { type: string; children: unknown[] };
    expect(cols.type).toBe("columns");
    expect(cols.children).toHaveLength(2);
    // Each box has image + text(caption)
    expect(cols.children[0]).toMatchObject({ type: "box", variant: "flat" });

    expect(layout.elements.length).toBeGreaterThan(0);
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

    const children = innerChildren(slide);
    // heading + divider + box(fill with grid) = 3
    expect(children).toHaveLength(3);
    const fillBox = children[2] as { type: string; children: unknown[] };
    expect(fillBox.type).toBe("box");
    const grid = fillBox.children[0] as { type: string; children: unknown[] };
    expect(grid).toMatchObject({ type: "grid", columns: 2, equalHeight: true });
    expect(grid.children).toHaveLength(4);

    expect(layout.elements.length).toBeGreaterThan(0);
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

    const children = innerChildren(slide);
    // heading + divider + box(fill with grid) = 3
    expect(children).toHaveLength(3);
    const fillBox = children[2] as { type: string; children: unknown[] };
    expect(fillBox.type).toBe("box");
    const grid = fillBox.children[0] as { type: string; children: unknown[] };
    expect(grid).toMatchObject({ type: "grid", columns: 3, equalHeight: true });
    expect(grid.children).toHaveLength(3);
    expect(grid.children[0]).toMatchObject({ type: "box", padding: 24 });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("timeline: raw elements with resolved theme tokens", () => {
    const { slide, layout } = expandAndLayout("timeline", {
      title: "Timeline",
      events: [
        { date: "Q1", label: "Start", description: "Begin work" },
        { date: "Q2", label: "End" },
      ],
    });

    const children = innerChildren(slide);
    // heading + divider + raw = 3
    expect(children).toHaveLength(3);
    expect(children[2]).toMatchObject({ type: "raw", height: 300 });

    // raw elements should contain line + dots + text (nested inside root box)
    const allEls = allLayoutElements(layout.elements);
    const line = allEls.find((e) => e.id.includes("tl-line"));
    expect(line).toBeDefined();
    // Theme tokens should be resolved (not "theme.border.color")
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

    const children = innerChildren(slide);
    // heading + divider + raw = 3
    expect(children).toHaveLength(3);
    expect(children[2]).toMatchObject({ type: "raw" });

    // badges + connectors + cards in layout (nested inside root box)
    const allEls = allLayoutElements(layout.elements);
    const badges = allEls.filter((e) => e.id.includes("st-badge") && !e.id.includes("num"));
    expect(badges).toHaveLength(2);
    // Theme tokens resolved on badge group
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

    const children = innerChildren(slide);
    // heading + divider + raw = 3
    expect(children).toHaveLength(3);
    expect(children[2]).toMatchObject({ type: "raw" });

    // Table uses layered approach: group for animation, rounded rects for corners (nested inside root box)
    const allEls = allLayoutElements(layout.elements);
    const group = allEls.find((e) => e.id === "tbl-group");
    expect(group).toBeDefined();
    if (group?.kind === "group") {
      const groupChildren = (group as { children: { id: string; kind: string; borderRadius?: number; style?: { fill: string } }[] }).children;
      // Layer 1: accent bg with rounded corners (theme tokens resolved)
      const accentBg = groupChildren.find((e) => e.id === "tbl-accent-bg");
      expect(accentBg).toBeDefined();
      if (accentBg?.kind === "shape") {
        expect(accentBg.borderRadius).toBe(12);
        expect(accentBg.style!.fill).not.toContain("theme.");
      }
      // Layer 2: data area bg with rounded corners
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

    const children = innerChildren(slide);
    // heading + divider + box(fill with video) = 3
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ type: "heading", text: "Demo Video" });
    const videoBox = children[2] as { type: string; children: unknown[] };
    expect(videoBox.type).toBe("box");
    expect(videoBox.children[0]).toMatchObject({ type: "video", src: "https://example.com/video.mp4" });

    const allEls = allLayoutElements(layout.elements);
    const videoEl = allEls.find((e) => e.kind === "video");
    expect(videoEl).toBeDefined();
    if (videoEl?.kind === "video") {
      expect((videoEl as { src: string }).src).toBe("https://example.com/video.mp4");
    }
  });

  it("video: expands without title (flex fill)", () => {
    const { slide, layout } = expandAndLayout("video", {
      src: "https://example.com/clip.mp4",
    });

    const children = innerChildren(slide);
    // box(fill with video) = 1
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ type: "box" });

    const allEls = allLayoutElements(layout.elements);
    const videoEl = allEls.find((e) => e.kind === "video");
    expect(videoEl).toBeDefined();
    // flex fill: element should have non-zero height from stacker
    if (videoEl) {
      expect((videoEl as { rect: { h: number } }).rect.h).toBeGreaterThan(0);
    }
  });

  it("iframe: produces iframe element with title", () => {
    const { slide, layout } = expandAndLayout("iframe", {
      title: "Live Demo",
      src: "https://example.com/app",
    });

    const children = innerChildren(slide);
    // heading + divider + box(fill with iframe) = 3
    expect(children).toHaveLength(3);
    expect(children[0]).toMatchObject({ type: "heading", text: "Live Demo" });
    const iframeBox = children[2] as { type: string; children: unknown[] };
    expect(iframeBox.type).toBe("box");
    expect(iframeBox.children[0]).toMatchObject({ type: "iframe", src: "https://example.com/app" });

    const allEls = allLayoutElements(layout.elements);
    const iframeEl = allEls.find((e) => e.kind === "iframe");
    expect(iframeEl).toBeDefined();
    if (iframeEl?.kind === "iframe") {
      expect((iframeEl as { src: string }).src).toBe("https://example.com/app");
    }
  });

  it("iframe: expands without title (flex fill)", () => {
    const { slide, layout } = expandAndLayout("iframe", {
      src: "https://example.com",
    });

    const children = innerChildren(slide);
    // box(fill with iframe) = 1
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ type: "box" });

    const allEls = allLayoutElements(layout.elements);
    const iframeEl = allEls.find((e) => e.kind === "iframe");
    expect(iframeEl).toBeDefined();
    if (iframeEl) {
      expect((iframeEl as { rect: { h: number } }).rect.h).toBeGreaterThan(0);
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

    const children = innerChildren(slide);
    expect(children[0]).toMatchObject({ type: "heading", fontSize: 72 });

    const layout = layoutSlide(slide, "modern", "/img");
    expect(layout.elements.length).toBeGreaterThan(0);
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
