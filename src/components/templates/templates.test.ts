import { describe, it, expect } from "vitest";
import { getTemplate } from "./index";

const ALL_TEMPLATE_NAMES = [
  "cover",
  "bullets",
  "image-text",
  "full-image",
  "section-divider",
  "quote",
  "statement",
  "numbered-list",
  "definition",
  "agenda",
  "code",
  "code-comparison",
  "table",
  "timeline",
  "stats",
  "chart-placeholder",
  "diagram",
  "comparison",
  "steps",
  "profile",
  "icon-grid",
  "highlight-box",
  "qa",
  "video",
  "iframe",
  "blank",
  "end",
  "image-grid",
  "image-comparison",
  "image-caption",
  "image-gallery",
  "two-column",
  "three-column",
  "top-bottom",
  "sidebar",
];

describe("template registry", () => {
  it("registers all 35 templates", () => {
    for (const name of ALL_TEMPLATE_NAMES) {
      const template = getTemplate(name);
      expect(template, `template "${name}" should be registered`).not.toBeNull();
      expect(typeof template).toBe("function");
    }
  });

  it("has exactly 35 templates", () => {
    expect(ALL_TEMPLATE_NAMES).toHaveLength(35);
  });

  it("returns null for unknown template", () => {
    expect(getTemplate("nonexistent")).toBeNull();
  });
});
