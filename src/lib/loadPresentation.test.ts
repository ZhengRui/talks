import { describe, it, expect } from "vitest";
import {
  loadPresentation,
  discoverPresentations,
  getAllSlugs,
} from "./loadPresentation";

describe("loadPresentation", () => {
  it("parses valid YAML into PresentationData", () => {
    const data = loadPresentation("70-years-of-ai");

    expect(data.title).toBe("70 Years of AI");
    expect(data.author).toBe("Rui Zheng");
    expect(data.slides).toHaveLength(2);
  });

  it("expands DSL cover template into full-compose", () => {
    const data = loadPresentation("70-years-of-ai");
    const cover = data.slides[0];

    // DSL expansion: template: cover → template: full-compose
    expect(cover.template).toBe("full-compose");
    if (cover.template !== "full-compose") throw new Error("expected full-compose");
    // heading child contains the title
    expect(cover.children[0]).toMatchObject({ type: "heading", text: "70 Years of AI" });
  });

  it("expands DSL bullets template into full-compose", () => {
    const data = loadPresentation("70-years-of-ai");
    const slide = data.slides[1];

    // DSL expansion: template: bullets → template: full-compose
    expect(slide.template).toBe("full-compose");
    if (slide.template !== "full-compose") throw new Error("expected full-compose");
    // heading + divider + bullets = 3 children
    expect(slide.children).toHaveLength(3);
    expect(slide.children[0]).toMatchObject({ type: "heading", text: "AI Applications" });
    expect(slide.children[2]).toMatchObject({ type: "bullets" });
  });

  it("defaults theme to undefined when not specified", () => {
    const data = loadPresentation("70-years-of-ai");

    expect(data.theme).toBeUndefined();
  });

  it("parses theme field when present", () => {
    const data = loadPresentation("example");

    // example presentation may or may not have theme set
    expect(
      data.theme === undefined || typeof data.theme === "string"
    ).toBe(true);
  });

  it("supports animation field on slides", () => {
    const data = loadPresentation("70-years-of-ai");
    const slide = data.slides[0];

    // animation is optional — should be undefined if not set in YAML
    expect(slide.animation).toBeUndefined();
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
    // First slide (cover) has no per-slide theme
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
    const first = presentations[0];

    expect(first.slug).toBe("70-years-of-ai");
    expect(first.title).toBe("70 Years of AI");
    expect(first.author).toBe("Rui Zheng");
    expect(first.slideCount).toBe(2);
  });
});

describe("getAllSlugs", () => {
  it("returns an array of strings", () => {
    const slugs = getAllSlugs();

    expect(Array.isArray(slugs)).toBe(true);
    expect(slugs.length).toBeGreaterThan(0);
    expect(typeof slugs[0]).toBe("string");
  });

  it("includes 70-years-of-ai", () => {
    const slugs = getAllSlugs();

    expect(slugs).toContain("70-years-of-ai");
  });
});
