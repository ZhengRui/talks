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

  it("expands DSL cover template into full-compose", () => {
    const data = loadPresentation("example");
    // Slide index 1 is cover (index 0 is section-divider)
    const cover = data.slides[1];

    // DSL expansion: template: cover → template: full-compose
    expect(cover.template).toBe("full-compose");
    if (cover.template !== "full-compose") throw new Error("expected full-compose");
    // heading child contains the title
    expect(cover.children[0]).toMatchObject({ type: "heading", text: "Template Gallery" });
  });

  it("expands DSL bullets template into full-compose", () => {
    const data = loadPresentation("example");
    // Slide index 2 is bullets
    const slide = data.slides[2];

    // DSL expansion: template: bullets → template: full-compose
    expect(slide.template).toBe("full-compose");
    if (slide.template !== "full-compose") throw new Error("expected full-compose");
    // heading + divider + bullets = 3 children
    expect(slide.children).toHaveLength(3);
    expect(slide.children[0]).toMatchObject({ type: "heading", text: "Bullets Template" });
    expect(slide.children[2]).toMatchObject({ type: "bullets" });
  });

  it("parses theme field when present", () => {
    const data = loadPresentation("example");

    expect(data.theme).toBe("modern");
  });

  it("supports entrance field on slides", () => {
    const data = loadPresentation("example");
    const slide = data.slides[0];

    // entrance is optional — should be undefined if not set in YAML
    expect(slide.entrance).toBeUndefined();
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
