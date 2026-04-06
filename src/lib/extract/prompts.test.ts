import { describe, expect, it } from "vitest";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisPrompt,
} from "./prompts";
import type { GeometryHints } from "@/components/extract/types";

const geometryHints: GeometryHints = {
  source: "layout",
  canvas: { w: 1920, h: 1080 },
  elements: [
    {
      id: "title",
      kind: "text",
      depth: 0,
      rect: { x: 440, y: 255, w: 600, h: 60 },
      text: "KEY PLAYERS",
    },
  ],
};

describe("ANALYSIS_SYSTEM_PROMPT", () => {
  it("includes inventory as a required output field", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain('"inventory"');
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("The inventory must contain:");
  });

  it("requires signatureVisuals in the inventory schema", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain('"signatureVisuals"');
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("`signatureVisuals` rules:");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("background/atmosphere");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("dominant title/hero treatment");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain('Do not use `low`');
  });

  it("contains the two-phase contract", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("First produce an `inventory`");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Then produce `proposals`");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("If you discover a contradiction while writing proposals");
  });

  it("forbids block-scope proposals in v1", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Do NOT output block-scope proposals in v1");
  });

  it("allows loops for 3+ repeating items", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("use a `{% for %}` loop over an items array when there are 3+ items");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Do NOT create separate block-scope templates");
  });

  it("requires every mustPreserve item to appear in the proposal body", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Every item in `inventory.signatureVisuals` and `inventory.mustPreserve` must be faithfully represented in the proposal body");
  });

  it("distinguishes content preservation from visual identity", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("`mustPreserve` is for content");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("`signatureVisuals` is for the visual identity");
  });

  it("preserves the common mistakes section", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("## Common mistakes to avoid");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Text nodes and shape nodes MUST have a `style:` object");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Do NOT use filters like `| min`, `| max`, `| abs`, `| round`");
  });

  it("includes the scene authoring reference inline", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("<reference>");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("# Scene Authoring Reference");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("</reference>");
  });

  it("includes speed and decisiveness rules", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Pick dimensions, positions, and colors on first impression and commit");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Do NOT reverse-engineer viewport scaling");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("The system normalizes overlay metadata and preview canvas sizing automatically");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("one self-consistent source-pixel coordinate space");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Do NOT debate template-authoring mechanics");
  });
});

describe("buildAnalysisPrompt", () => {
  it("builds the user prompt with inventory-first framing", () => {
    const prompt = buildAnalysisPrompt("Focus on background atmosphere", "my-deck");
    expect(prompt).toContain("inventory-first reusable scene templates");
    expect(prompt).toContain("Additional context: Focus on background atmosphere");
    expect(prompt).toContain("Target slug: my-deck");
  });

  it("injects geometry ground truth only when hints are provided", () => {
    const withoutHints = buildAnalysisPrompt(null, "my-deck");
    const withHints = buildAnalysisPrompt(null, "my-deck", geometryHints);

    expect(withoutHints).not.toContain("Geometry ground truth");
    expect(withHints).toContain("Geometry ground truth");
    expect(withHints).toContain('"source": "layout"');
    expect(withHints).toContain('"id": "title"');
  });
});
