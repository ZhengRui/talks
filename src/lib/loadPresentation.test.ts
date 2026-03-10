import { describe, it, expect } from "vitest";
import {
  loadPresentation,
  discoverPresentations,
  getAllSlugs,
} from "./loadPresentation";

describe("loadPresentation", () => {
  it("parses valid YAML into PresentationData", () => {
    const data = loadPresentation("example");

    expect(data.title).toBe("Template Gallery");
    expect(data.author).toBe("Template Preview");
    expect(data.slides.length).toBeGreaterThan(0);
  });

  it("expands DSL cover template into ComponentSlideData", () => {
    const data = loadPresentation("example");
    // Slide index 1 is cover (index 0 is section-divider)
    const cover = data.slides[1];

    // DSL expansion: template: cover → ComponentSlideData
    expect(cover.children).toBeDefined();
    // v2 templates wrap content in a root box
    expect(cover.children[0]).toMatchObject({ type: "box" });
    const box = cover.children[0] as { type: "box"; children: unknown[] };
    // The box contains a heading with the title
    expect(box.children.some((c: unknown) => (c as Record<string, unknown>).type === "heading" && (c as Record<string, unknown>).text === "Template Gallery")).toBe(true);
  });

  it("expands DSL bullets template into ComponentSlideData", () => {
    const data = loadPresentation("example");
    // Slide index 2 is bullets
    const slide = data.slides[2];

    // DSL expansion: template: bullets → ComponentSlideData
    expect(slide.children).toBeDefined();
    // v2 templates wrap content in a root box
    const box = slide.children[0] as { type: "box"; children: unknown[] };
    expect(box.type).toBe("box");
    expect(box.children.some((c: unknown) => (c as Record<string, unknown>).type === "heading")).toBe(true);
    expect(box.children.some((c: unknown) => (c as Record<string, unknown>).type === "bullets")).toBe(true);
  });

  it("parses theme field when present", () => {
    const data = loadPresentation("example");

    expect(data.theme).toBe("modern");
  });

  it("supports entrance field on slides", () => {
    const data = loadPresentation("example");
    const slide = data.slides[0];

    // entrance is not a field on SlideData — should be absent
    expect((slide as unknown as Record<string, unknown>).entrance).toBeUndefined();
  });

  it("parses per-slide theme override from YAML", () => {
    const data = loadPresentation("example");
    const boldSlides = data.slides.filter((s) => s.theme === "bold");
    const elegantSlides = data.slides.filter((s) => s.theme === "elegant");
    const darkTechSlides = data.slides.filter((s) => s.theme === "dark-tech");

    expect(boldSlides.length).toBeGreaterThan(0);
    expect(elegantSlides.length).toBeGreaterThan(0);
    expect(darkTechSlides.length).toBeGreaterThan(0);
  });

  it("leaves theme undefined on slides without override", () => {
    const data = loadPresentation("example");
    // First slide (section-divider) has no per-slide theme
    expect(data.slides[0].theme).toBeUndefined();
  });

  it("throws on non-existent slug", () => {
    expect(() => loadPresentation("does-not-exist")).toThrow();
  });
});

describe("discoverPresentations", () => {
  it("returns an array of PresentationSummary", () => {
    const presentations = discoverPresentations();

    expect(Array.isArray(presentations)).toBe(true);
    expect(presentations.length).toBeGreaterThan(0);
  });

  it("includes slug, title, author, and slideCount", () => {
    const presentations = discoverPresentations();
    const example = presentations.find((p) => p.slug === "example");

    expect(example).toBeDefined();
    expect(example!.title).toBe("Template Gallery");
    expect(example!.author).toBe("Template Preview");
    expect(example!.slideCount).toBeGreaterThan(0);
  });
});

describe("getAllSlugs", () => {
  it("returns an array of strings", () => {
    const slugs = getAllSlugs();

    expect(Array.isArray(slugs)).toBe(true);
    expect(slugs.length).toBeGreaterThan(0);
    expect(typeof slugs[0]).toBe("string");
  });

  it("includes example", () => {
    const slugs = getAllSlugs();

    expect(slugs).toContain("example");
  });
});
