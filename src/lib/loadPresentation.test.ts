import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import {
  loadPresentation,
  discoverPresentations,
  getAllSlugs,
} from "./loadPresentation";

describe("loadPresentation", () => {
  it("parses valid YAML into PresentationData", () => {
    const data = loadPresentation("example-v9");

    expect(data.title).toBe("Template Gallery");
    expect(data.author).toBe("Template Preview");
    expect(data.slides.length).toBeGreaterThan(0);
  });

  it("expands DSL cover template into a scene slide", () => {
    const data = loadPresentation("example-v9");
    // Slide index 1 is cover (index 0 is section-divider)
    const cover = data.slides[1];

    expect(cover).toMatchObject({ mode: "scene" });
    expect(cover.children.some((child) => child.kind === "group" && child.id === "cover-stack")).toBe(true);
  });

  it("expands DSL bullets template into a scene slide", () => {
    const data = loadPresentation("example-v9");
    // Slide index 2 is bullets
    const slide = data.slides[2];

    expect(slide).toMatchObject({ mode: "scene" });
    expect(slide.children.some((child) => child.kind === "text" && child.id === "bullets-title")).toBe(true);
    expect(slide.children.some((child) => child.id === "bullets-list")).toBe(true);
  });

  it("parses theme field when present", () => {
    const data = loadPresentation("example-v9");

    expect(data.theme).toBe("modern");
  });

  it("supports entrance field on slides", () => {
    const data = loadPresentation("example-v9");
    const slide = data.slides[0];

    // entrance is not a field on SlideData — should be absent
    expect((slide as unknown as Record<string, unknown>).entrance).toBeUndefined();
  });

  it("parses per-slide theme override from YAML", () => {
    const data = loadPresentation("example-v9");
    const boldSlides = data.slides.filter((s) => s.theme === "bold");
    const elegantSlides = data.slides.filter((s) => s.theme === "elegant");
    const darkTechSlides = data.slides.filter((s) => s.theme === "dark-tech");

    expect(boldSlides.length).toBeGreaterThan(0);
    expect(elegantSlides.length).toBeGreaterThan(0);
    expect(darkTechSlides.length).toBeGreaterThan(0);
  });

  it("leaves theme undefined on slides without override", () => {
    const data = loadPresentation("example-v9");
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
    const example = presentations.find((p) => p.slug === "example-v9");

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

    expect(slugs).toContain("example-v9");
  });
});

describe("loadPresentation block expansion", () => {
  const slug = "__test-block-expand__";
  const contentDir = path.join(process.cwd(), "content", slug);
  const templatesDir = path.join(contentDir, "templates");

  beforeAll(() => {
    fs.mkdirSync(templatesDir, { recursive: true });

    fs.writeFileSync(
      path.join(templatesDir, "test-badge.template.yaml"),
      `name: test-badge
params:
  text: { type: string, required: true }

kind: group
children:
  - kind: text
    id: label
    frame: { x: 0, y: 0, w: 120 }
    text: "{{ text }}"
    style:
      fontSize: 18
      lineHeight: 1.1
`,
    );

    fs.writeFileSync(
      path.join(contentDir, "slides.yaml"),
      `title: Block Test
slides:
  - mode: scene
    children:
      - kind: text
        id: title
        frame: { x: 100, y: 50, w: 600 }
        text: "Slide Title"
        style:
          fontSize: 48
          lineHeight: 1.1
      - kind: block
        id: badge
        template: test-badge
        frame: { x: 100, y: 200, w: 200, h: 60 }
        params:
          text: "NEW"
`,
    );
  });

  afterAll(() => {
    fs.rmSync(contentDir, { recursive: true, force: true });
  });

  it("expands block nodes during presentation loading", () => {
    const pres = loadPresentation(slug);
    const slide = pres.slides[0];

    expect(slide.mode).toBe("scene");
    expect(slide.children).toHaveLength(2);
    expect(slide.children[0].kind).toBe("text");
    expect(slide.children[1].kind).toBe("group");
    expect(slide.children[1].id).toBe("badge");

    const group = slide.children[1] as { children: Array<{ id: string; text: string }> };
    expect(group.children[0].id).toBe("badge__label");
    expect(group.children[0].text).toBe("NEW");
  });
});
