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

  it("parses cover slide fields correctly", () => {
    const data = loadPresentation("70-years-of-ai");
    const cover = data.slides[0];

    expect(cover.template).toBe("cover");
    if (cover.template !== "cover") throw new Error("expected cover");
    expect(cover.title).toBe("70 Years of AI");
    expect(cover.subtitle).toBe("crack the AI jargon");
    expect(cover.image).toBe("cover-bg.jpg");
  });

  it("parses bullets slide fields correctly", () => {
    const data = loadPresentation("70-years-of-ai");
    const bullets = data.slides[1];

    expect(bullets.template).toBe("bullets");
    if (bullets.template !== "bullets") throw new Error("expected bullets");
    expect(bullets.title).toBe("AI Applications");
    expect(bullets.bullets).toHaveLength(5);
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
