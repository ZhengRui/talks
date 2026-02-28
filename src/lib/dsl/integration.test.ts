import { describe, it, expect, beforeEach } from "vitest";
import { findTemplate, clearTemplateCache } from "./loader";
import { expandDslTemplate } from "./engine";
import { layoutSlide } from "@/lib/layout";
import type { SlideData, FullComposeSlideData, SplitComposeSlideData } from "@/lib/types";

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

  // --- Group 2 templates ---

  it("dsl-two-column: expands to columns with box children", () => {
    const { slide, layout } = expandAndLayout("two-column", {
      title: "Two Sides",
      left: "Left content",
      right: "Right content",
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + columns = 3 children
    expect(fc.children).toHaveLength(3);
    expect(fc.children[0]).toMatchObject({ type: "heading", text: "Two Sides" });
    expect(fc.children[2]).toMatchObject({ type: "columns" });
    const cols = fc.children[2] as unknown as { children: unknown[] };
    expect(cols.children).toHaveLength(2);
    expect(cols.children[0]).toMatchObject({ type: "box", animationType: "slide-left" });
    expect(cols.children[1]).toMatchObject({ type: "box", animationType: "slide-right" });
    expect(cols.children[0]).not.toHaveProperty("height");
    expect(cols.children[1]).not.toHaveProperty("height");

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-two-column: expands without title", () => {
    const { slide } = expandAndLayout("two-column", {
      left: "A",
      right: "B",
    });

    const fc = slide as FullComposeSlideData;
    // columns only = 1 child
    expect(fc.children).toHaveLength(1);
    expect(fc.children[0]).toMatchObject({ type: "columns" });
  });

  it("dsl-two-column: verticalAlign param passes through", () => {
    const { slide } = expandAndLayout("two-column", {
      left: "A",
      right: "B",
      verticalAlign: "center",
    });

    const raw = slide as unknown as Record<string, unknown>;
    expect(raw.verticalAlign).toBe("center");
  });

  it("dsl-two-column: style.cardHeight overrides default", () => {
    const { slide } = expandAndLayout("two-column", {
      left: "A",
      right: "B",
      style: { cardHeight: 500 },
    });

    const fc = slide as FullComposeSlideData;
    const cols = fc.children[0] as unknown as { children: Array<{ height: number }> };
    expect(cols.children[0].height).toBe(500);
    expect(cols.children[1].height).toBe(500);
  });

  it("dsl-comparison: expands with heading + bullets per column", () => {
    const { slide, layout } = expandAndLayout("comparison", {
      title: "Before vs After",
      left: { heading: "Before", items: ["Slow", "Manual"] },
      right: { heading: "After", items: ["Fast", "Auto"] },
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + columns = 3
    expect(fc.children).toHaveLength(3);
    const cols = fc.children[2] as unknown as { children: unknown[] };
    expect(cols.children).toHaveLength(2);
    expect(cols.children[0]).toMatchObject({
      type: "box", accentTop: true, accentColor: "#22c55e", animationType: "slide-left",
    });
    expect(cols.children[1]).toMatchObject({
      type: "box", accentTop: true, accentColor: "#ef4444", animationType: "slide-right",
    });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-code-comparison: expands with labels and code", () => {
    const { slide, layout } = expandAndLayout("code-comparison", {
      title: "Refactored",
      before: { label: "Before", code: "x = 1", language: "python" },
      after: { label: "After", code: "x: int = 1", language: "python" },
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + columns = 3
    expect(fc.children).toHaveLength(3);
    expect(fc.children[2]).toMatchObject({ type: "columns" });
    const cols = fc.children[2] as unknown as { children: unknown[] };
    expect(cols.children).toHaveLength(2);

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-code-comparison: expands without labels", () => {
    const { slide } = expandAndLayout("code-comparison", {
      before: { code: "a" },
      after: { code: "b" },
    });

    const fc = slide as FullComposeSlideData;
    // columns only = 1
    expect(fc.children).toHaveLength(1);
    expect(fc.children[0]).toMatchObject({ type: "columns" });
  });

  it("dsl-sidebar: expands to full-compose with columns ratio 0.3", () => {
    const { slide, layout } = expandAndLayout("sidebar", {
      title: "Overview",
      sidebar: "Side notes",
      main: "Main content here",
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // single columns component
    expect(fc.children).toHaveLength(1);
    expect(fc.children[0]).toMatchObject({ type: "columns", ratio: 0.3 });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-sidebar: right position uses ratio 0.7", () => {
    const { slide } = expandAndLayout("sidebar", {
      sidebar: "Notes",
      main: "Content",
      sidebarPosition: "right",
    });

    const fc = slide as FullComposeSlideData;
    expect(fc.children[0]).toMatchObject({ type: "columns", ratio: 0.7 });
  });

  it("dsl-sidebar: yaml_string filter preserves multiline text", () => {
    const { slide } = expandAndLayout("sidebar", {
      title: "Test",
      sidebar: "Key concepts:\n\n• Components\n• Templates",
      main: "Main content",
    });

    const fc = slide as FullComposeSlideData;
    // Find the body component inside the sidebar box
    const cols = fc.children[0] as { type: string; children: unknown[] };
    expect(cols.type).toBe("columns");
    // Left column (sidebar) → flat box → box → body with multiline text
    const flatBox = cols.children[0] as { type: string; children: unknown[] };
    const innerBox = flatBox.children.find(
      (c: unknown) => (c as { type: string; variant?: string }).type === "box" && (c as { variant?: string }).variant === "panel",
    ) as { children: Array<{ type: string; text: string }> };
    expect(innerBox).toBeDefined();
    const body = innerBox.children.find((c) => c.type === "body");
    expect(body).toBeDefined();
    // The text should contain actual newlines (YAML \n expanded)
    expect(body!.text).toContain("\n");
    expect(body!.text).toContain("• Components");
  });

  it("dsl-image-caption: expands with centered layout", () => {
    const { slide, layout } = expandAndLayout("image-caption", {
      title: "Photo",
      image: "photo.jpg",
      caption: "A beautiful sunset",
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as unknown as Record<string, unknown>;
    expect(fc.verticalAlign).toBeUndefined(); // top-aligned like rigid TS

    const children = (slide as FullComposeSlideData).children;
    // heading + divider + image + text = 4
    expect(children).toHaveLength(4);
    expect(children[2]).toMatchObject({ type: "image", src: "photo.jpg", borderRadius: 16, animationType: "scale-up", animationDelay: 200 });
    expect(children[3]).toMatchObject({ type: "text", textAlign: "center", animationType: "fade-up", animationDelay: 400 });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-image-caption: expands without title", () => {
    const { slide } = expandAndLayout("image-caption", {
      image: "img.png",
      caption: "Caption text",
    });

    const fc = slide as FullComposeSlideData;
    // image + text = 2
    expect(fc.children).toHaveLength(2);
    expect(fc.children[0]).toMatchObject({ type: "image" });
    expect(fc.children[1]).toMatchObject({ type: "text" });
  });

  it("dsl-profile: expands with avatar, name, title, and bio", () => {
    const { slide, layout } = expandAndLayout("profile", {
      name: "Jane Doe",
      title: "Software Engineer",
      image: "avatar.jpg",
      bio: "A passionate developer.",
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    const raw = slide as unknown as Record<string, unknown>;
    expect(raw.verticalAlign).toBe("center");
    // image + heading + text(title) + divider + text(bio) = 5
    expect(fc.children).toHaveLength(5);
    expect(fc.children[0]).toMatchObject({ type: "image", clipCircle: true, animationType: "scale-up", animationDelay: 0 });
    expect(fc.children[1]).toMatchObject({ type: "heading", text: "Jane Doe", animationType: "fade-up", animationDelay: 200 });
    expect(fc.children[2]).toMatchObject({ type: "text", color: "theme.accent", lineHeight: 1.3, animationType: "fade-up", animationDelay: 300 });
    expect(fc.children[3]).toMatchObject({ type: "divider", variant: "gradient", animationType: "fade-up", animationDelay: 350 });
    expect(fc.children[4]).toMatchObject({ type: "text", color: "theme.textMuted", maxWidth: 700, animationType: "fade-up", animationDelay: 400 });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-profile: expands without optional fields", () => {
    const { slide } = expandAndLayout("profile", {
      name: "Solo Name",
    });

    const fc = slide as FullComposeSlideData;
    // heading + divider = 2
    expect(fc.children).toHaveLength(2);
    expect(fc.children[0]).toMatchObject({ type: "heading", text: "Solo Name" });
    expect(fc.children[1]).toMatchObject({ type: "divider" });
  });

  it("dsl-image-comparison: expands with images and labels", () => {
    const { slide, layout } = expandAndLayout("image-comparison", {
      title: "Before & After",
      before: { image: "old.jpg", label: "Before" },
      after: { image: "new.jpg", label: "After" },
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + columns = 3
    expect(fc.children).toHaveLength(3);
    expect(fc.children[2]).toMatchObject({ type: "columns", equalHeight: true });
    const cols = fc.children[2] as unknown as { children: unknown[] };
    expect(cols.children).toHaveLength(2);
    expect(cols.children[0]).toMatchObject({ type: "box", padding: 24, animationType: "slide-left", animationDelay: 200 });
    expect(cols.children[1]).toMatchObject({ type: "box", padding: 24, animationType: "slide-right", animationDelay: 200 });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-image-comparison: expands without labels", () => {
    const { slide } = expandAndLayout("image-comparison", {
      before: { image: "a.jpg" },
      after: { image: "b.jpg" },
    });

    const fc = slide as FullComposeSlideData;
    // columns only = 1
    expect(fc.children).toHaveLength(1);
  });

  it("dsl-image-text: expands with fill mode image panel", () => {
    const { slide, layout } = expandAndLayout("image-text", {
      title: "About Us",
      image: "hero.jpg",
      body: "We build great things.",
      bullets: ["Fast", "Reliable"],
    });

    expect(slide.template).toBe("split-compose");
    const sc = slide as unknown as SplitComposeSlideData;
    // Default: image on left with inset padding, text on right
    expect(sc.left.padding).toEqual([0, 20, 0, 160]);
    expect(sc.left.children).toHaveLength(1);
    expect(sc.left.children[0]).toMatchObject({ type: "image", objectFit: "cover", animationType: "slide-left", animationDelay: 200 });
    expect(sc.right.background).toBe("theme.bg");
    expect(sc.right.verticalAlign).toBeUndefined();
    expect(sc.right.gap).toBe(0);
    expect(sc.right.padding).toEqual([60, 160, 60, 20]);
    // spacer + heading + divider + body + bullets = 5 children
    expect(sc.right.children).toHaveLength(5);
    expect(sc.right.children[0]).toMatchObject({ type: "spacer", height: 210 });
    expect(sc.right.children[1]).toMatchObject({ type: "heading", text: "About Us", animationType: "fade-up", animationDelay: 0 });
    expect(sc.right.children[2]).toMatchObject({ type: "divider", animationType: "fade-up", animationDelay: 100 });
    expect(sc.right.children[3]).toMatchObject({ type: "body", lineHeight: 1.7, marginBottom: 44, animationType: "slide-right", animationDelay: 300 });
    expect(sc.right.children[4]).toMatchObject({ type: "bullets", variant: "list", animationType: "fade-up", animationDelay: 400 });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-image-text: right position swaps panels", () => {
    const { slide } = expandAndLayout("image-text", {
      title: "Reverse",
      image: "photo.jpg",
      imagePosition: "right",
    });

    const sc = slide as unknown as SplitComposeSlideData;
    // Image on right with inset padding
    expect(sc.right.padding).toEqual([0, 160, 0, 20]);
    expect(sc.right.children[0]).toMatchObject({ type: "image", animationType: "slide-right", animationDelay: 200 });
    // Text on left — spacer first, then heading with animation overrides
    expect(sc.left.gap).toBe(0);
    expect(sc.left.padding).toEqual([60, 20, 60, 160]);
    expect(sc.left.verticalAlign).toBeUndefined();
    expect(sc.left.children[0]).toMatchObject({ type: "spacer", height: 210 });
    expect(sc.left.children[1]).toMatchObject({ type: "heading", text: "Reverse", animationType: "fade-up", animationDelay: 0 });
    expect(sc.left.children[2]).toMatchObject({ type: "divider", animationType: "fade-up", animationDelay: 100 });
  });

  it("dsl-image-text: omits body and bullets when not provided", () => {
    const { slide } = expandAndLayout("image-text", {
      title: "Minimal",
      image: "bg.jpg",
    });

    const sc = slide as unknown as SplitComposeSlideData;
    // spacer + heading + divider = 3 (no body, no bullets)
    expect(sc.right.children).toHaveLength(3);
  });

  // --- Template aliases ---

  it("alias: dsl-chart-placeholder resolves to image-caption", () => {
    const def = findTemplate("dsl-chart-placeholder");
    expect(def).not.toBeNull();
    // Should resolve to image-caption template (has params: title, image, caption)
    expect(def!.params).toHaveProperty("image");
    expect(def!.params).toHaveProperty("caption");
  });

  it("alias: dsl-diagram resolves to image-caption", () => {
    const def = findTemplate("dsl-diagram");
    expect(def).not.toBeNull();
    expect(def!.params).toHaveProperty("image");
    expect(def!.params).toHaveProperty("caption");
  });

  it("dsl-image-gallery: expands with columns of images + captions", () => {
    const { slide, layout } = expandAndLayout("dsl-image-gallery", {
      title: "Gallery",
      images: [
        { src: "a.jpg", caption: "First" },
        { src: "b.jpg", caption: "Second" },
      ],
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + columns = 3
    expect(fc.children).toHaveLength(3);
    expect(fc.children[0]).toMatchObject({ type: "heading", text: "Gallery" });
    expect(fc.children[2]).toMatchObject({ type: "columns" });
    const cols = fc.children[2] as unknown as { children: unknown[] };
    expect(cols.children).toHaveLength(2);
    // Each box has image + text(caption)
    expect(cols.children[0]).toMatchObject({ type: "box", variant: "flat" });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-image-grid: expands with grid of images + captions", () => {
    const { slide, layout } = expandAndLayout("dsl-image-grid", {
      title: "Grid",
      columns: 2,
      images: [
        { src: "a.jpg", caption: "First" },
        { src: "b.jpg", caption: "Second" },
        { src: "c.jpg", caption: "Third" },
        { src: "d.jpg", caption: "Fourth" },
      ],
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + grid = 3
    expect(fc.children).toHaveLength(3);
    expect(fc.children[2]).toMatchObject({ type: "grid", columns: 2, equalHeight: true });
    const grid = fc.children[2] as unknown as { children: unknown[] };
    expect(grid.children).toHaveLength(4);

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("dsl-icon-grid: expands with grid of icon + label boxes", () => {
    const { slide, layout } = expandAndLayout("dsl-icon-grid", {
      title: "Icons",
      columns: 3,
      items: [
        { icon: "⚛️", label: "React" },
        { icon: "▲", label: "Next.js" },
        { icon: "📝", label: "TypeScript" },
      ],
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + spacer + grid + spacer = 5
    expect(fc.children).toHaveLength(5);
    expect(fc.children[2]).toMatchObject({ type: "spacer", flex: true });
    expect(fc.children[3]).toMatchObject({ type: "grid", columns: 3, equalHeight: true });
    const grid = fc.children[3] as unknown as { children: unknown[] };
    expect(grid.children).toHaveLength(3);
    expect(grid.children[0]).toMatchObject({ type: "box", padding: 24 });

    expect(layout.elements.length).toBeGreaterThan(0);
  });

  it("alias: dsl-chart-placeholder expands and lays out", () => {
    const { slide, layout } = expandAndLayout("dsl-chart-placeholder", {
      title: "Growth Chart",
      image: "chart.svg",
      caption: "Monthly metrics",
    });

    expect(slide.template).toBe("full-compose");
    const fc = slide as FullComposeSlideData;
    // heading + divider + image + text = 4 (same as image-caption)
    expect(fc.children).toHaveLength(4);
    expect(fc.children[2]).toMatchObject({ type: "image", src: "chart.svg" });
    expect(fc.children[3]).toMatchObject({ type: "text", text: "Monthly metrics" });

    expect(layout.elements.length).toBeGreaterThan(0);
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
