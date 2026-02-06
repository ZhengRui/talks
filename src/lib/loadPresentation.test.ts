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
    expect(cover.title).toBe("70 Years of AI");
    expect("subtitle" in cover && cover.subtitle).toBe("crack the AI jargon");
    expect("image" in cover && cover.image).toBe("cover-bg.jpg");
  });

  it("parses bullets slide fields correctly", () => {
    const data = loadPresentation("70-years-of-ai");
    const bullets = data.slides[1];

    expect(bullets.template).toBe("bullets");
    expect(bullets.title).toBe("AI Applications");
    expect("bullets" in bullets && bullets.bullets).toHaveLength(5);
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
