/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  buildEditSystemPrompt,
  buildEditUserPrompt,
  type VisionSemanticAnchors,
  buildVisionSystemPrompt,
  buildVisionUserPrompt,
  formatIterationHistory,
  formatPriorIssuesChecklist,
  type IterationRecord,
} from "./refine-prompt";
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

const semanticAnchors: VisionSemanticAnchors = {
  signatureVisuals: [
    {
      text: "Orange hub circle with diagonal connector X",
      ref: "connector-lines",
      importance: "high",
    },
  ],
  mustPreserve: [
    {
      text: "Title text: THE AXIS OF RESISTANCE",
      ref: "title",
    },
  ],
  regions: [
    {
      id: "connector-lines",
      kind: "decorative-lines",
      description: "Diagonal connector X crossing through the center hub",
      importance: "high",
    },
  ],
};

describe("buildVisionSystemPrompt", () => {
  it("takes no arguments", () => {
    // Should be callable with zero args and return a string
    const prompt = buildVisionSystemPrompt();
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("always uses the object schema with resolved and issues", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).toContain('"resolved"');
    expect(prompt).toContain('"issues"');
  });

  it("contains 'How to evaluate prior issues' section", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).toContain("How to evaluate prior issues");
  });

  it("contains 'How to use iteration history' section", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).toContain("How to use iteration history");
  });

  it("does NOT contain v11 adjudication artifacts", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).not.toContain("priorIssueChecks");
    expect(prompt).not.toContain("still_wrong");
    expect(prompt).not.toContain("unclear");
  });

  it("lists unfixable items", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).toContain("unfixable");
    expect(prompt).toContain("Emoji");
  });

  it("instructs to return only a JSON object", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).toContain("Return ONLY the JSON object.");
    // "JSON array" may appear when describing the issues field, but the
    // top-level return instruction must say "JSON object"
    expect(prompt).toContain("Return ONLY a JSON object");
  });

  it("preserves existing analysis rules", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).toContain("structural_change");
    expect(prompt).toContain("less destructive diagnosis");
    expect(prompt).toContain("contentBounds");
    expect(prompt).toContain("distinguish a true\n  reversal from a visibility problem");
  });
});

describe("formatIterationHistory", () => {
  it("returns empty string for empty array", () => {
    expect(formatIterationHistory([])).toBe("");
  });

  it("formats a single iteration record", () => {
    const records: IterationRecord[] = [
      {
        iteration: 1,
        issuesFound: [
          { issueId: "title.scale", category: "layout", summary: "title too large" },
          { issueId: "bg.color", category: "style", summary: "wrong background" },
        ],
        issuesEdited: ["title.scale", "bg.color"],
        editApplied: true,
        issuesResolved: ["bg.color"],
        issuesUnresolved: ["title.scale"],
      },
    ];
    const result = formatIterationHistory(records);
    expect(result).toContain("Iteration history:");
    expect(result).toContain("Iter 1");
    expect(result).toContain("title.scale");
    expect(result).toContain("bg.color");
    expect(result).toContain("resolved:");
    expect(result).toContain("unresolved:");
  });

  it("shows 'all' when all found issues are edited", () => {
    const records: IterationRecord[] = [
      {
        iteration: 1,
        issuesFound: [
          { issueId: "a", category: "layout", summary: "issue a" },
        ],
        issuesEdited: ["a"],
        editApplied: true,
        issuesResolved: [],
        issuesUnresolved: ["a"],
      },
    ];
    const result = formatIterationHistory(records);
    expect(result).toContain("all");
  });

  it("shows (edit failed) when editApplied is false", () => {
    const records: IterationRecord[] = [
      {
        iteration: 2,
        issuesFound: [
          { issueId: "x", category: "style", summary: "issue x" },
        ],
        issuesEdited: ["x"],
        editApplied: false,
        issuesResolved: [],
        issuesUnresolved: ["x"],
      },
    ];
    const result = formatIterationHistory(records);
    expect(result).toContain("(edit failed)");
  });
});

describe("formatPriorIssuesChecklist", () => {
  it("returns empty string for empty array", () => {
    expect(formatPriorIssuesChecklist([])).toBe("");
  });

  it("formats issues as a checklist", () => {
    const result = formatPriorIssuesChecklist([
      { issueId: "title.scale", category: "layout", issue: "title too large" },
      { issueId: "bg.color", category: "style", issue: "wrong background color" },
    ]);
    expect(result).toContain("Issues from the previous iteration to evaluate:");
    expect(result).toContain("- title.scale (layout): title too large");
    expect(result).toContain("- bg.color (style): wrong background color");
  });
});

describe("buildVisionUserPrompt", () => {
  it("includes image size and contentBounds but no proposals", () => {
    const prompt = buildVisionUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    });

    expect(prompt).toContain("1920");
    expect(prompt).toContain("contentBounds");
    expect(prompt).not.toContain("proposals");
  });

  it("includes iterationHistory and priorChecklist when provided", () => {
    const prompt = buildVisionUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
      iterationHistory: "\nIteration history:\n- Iter 1: found title.scale (layout)\n",
      priorChecklist: "\nIssues from the previous iteration to evaluate:\n- title.scale (layout): title too large\n",
    });

    expect(prompt).toContain("Iteration history:");
    expect(prompt).toContain("Iter 1");
    expect(prompt).toContain("Issues from the previous iteration to evaluate:");
    expect(prompt).toContain("title.scale (layout): title too large");
  });

  it("includes semantic anchors when provided", () => {
    const prompt = buildVisionUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
      semanticAnchors,
    });

    expect(prompt).toContain("Signature visuals from extract");
    expect(prompt).toContain("Orange hub circle with diagonal connector X");
    expect(prompt).toContain("Must-preserve content from extract");
    expect(prompt).toContain("Important extracted regions");
  });

  it("uses the updated closing line", () => {
    const prompt = buildVisionUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    });

    expect(prompt).toContain("Evaluate any prior issues, then list every visible difference.");
  });
});

describe("buildEditSystemPrompt", () => {
  it("instructs JSON patching with structured issues, scene reference, and labeled comparison images", () => {
    const prompt = buildEditSystemPrompt();
    expect(prompt).toContain("proposals");
    expect(prompt).toContain("surgically");
    expect(prompt).toContain("Scene Authoring Reference");
    expect(prompt).toContain("ORIGINAL");
    expect(prompt).toContain("REPLICA");
    expect(prompt).toContain("structured issue list");
    expect(prompt).toContain("fixType");
    expect(prompt).toContain("issueId");
    expect(prompt).toContain("category");
    expect(prompt).toContain("ref");
    expect(prompt).toContain("structural_change");
    expect(prompt).toContain("diagnosis, not a literal patch recipe");
    expect(prompt).toContain("If it already does, do not blindly reverse it again");
    expect(prompt).toContain("proportions, clip bounds, band heights, opacity, contrast, color strength, spacing, or scale");
    expect(prompt).toContain("contentBounds is in the pixel space of the ORIGINAL/REPLICA images");
    expect(prompt).toContain("Treat image-space context and proposal-space context as separate");
    expect(prompt).toContain("Preserve that proposal-space coordinate system");
    expect(prompt).not.toContain("Image 1");
    expect(prompt).not.toContain("Image 2");
  });

  it("instructs to fix listed issues by priority rank", () => {
    const prompt = buildEditSystemPrompt();
    expect(prompt).toContain("Fix the listed issues, prioritizing by priority rank.");
  });

  it("does NOT contain sticky references", () => {
    const prompt = buildEditSystemPrompt();
    expect(prompt).not.toContain("sticky");
  });

  it("does NOT contain 'Fix the 3 highest'", () => {
    const prompt = buildEditSystemPrompt();
    expect(prompt).not.toContain("Fix the 3 highest");
  });
});

describe("buildEditUserPrompt", () => {
  it("separates image context and proposal context for full-image content bounds", () => {
    const prompt = buildEditUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      proposalSpace: { w: 1456, h: 818 },
      issuesJson: JSON.stringify([
        {
          priority: 1,
          issueId: "title.scale",
          category: "layout",
          ref: "title",
          area: "title",
          issue: "title too large",
          fixType: "style_adjustment",
          observed: "Replica title dominates the slide.",
          desired: "Original title feels smaller.",
          confidence: 0.9,
        },
      ], null, 2),
      proposalsJson: '[{"scope":"slide"}]',
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    });
    expect(prompt).toContain("Image context:");
    expect(prompt).toContain("Image size: 1920x1080");
    expect(prompt).toContain("Visible slide area in those images: full image");
    expect(prompt).not.toContain("(0, 0, 1920x1080)");
    expect(prompt).toContain("Proposal context:");
    expect(prompt).toContain("Current proposals are authored in approximately 1456x818 space.");
    expect(prompt).toContain("Do not rescale or rewrite the whole proposal");
    expect(prompt).toContain("Structured issues:");
    expect(prompt).toContain("\"issueId\": \"title.scale\"");
    expect(prompt).toContain("\"issue\": \"title too large\"");
    expect(prompt).toContain("\"category\": \"layout\"");
    expect(prompt).toContain("\"ref\": \"title\"");
    expect(prompt).toContain('"scope":"slide"');
  });

  it("includes cropped image bounds when contentBounds is smaller than the full image", () => {
    const prompt = buildEditUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      proposalSpace: { w: 1456, h: 818 },
      issuesJson: "[]",
      proposalsJson: '[{"scope":"slide"}]',
      contentBounds: { x: 100, y: 80, w: 1720, h: 900 },
    });

    expect(prompt).toContain("Visible slide area in those images (imageContentBounds): (100, 80, 1720x900)");
    expect(prompt).toContain("Treat everything outside that rectangle as non-slide chrome and ignore it.");
  });

  it("injects geometry hints only when provided", () => {
    const withoutHints = buildEditUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      proposalSpace: { w: 1456, h: 818 },
      issuesJson: "[]",
      proposalsJson: '[{"scope":"slide"}]',
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    });
    const withHints = buildEditUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      proposalSpace: { w: 1456, h: 818 },
      issuesJson: "[]",
      proposalsJson: '[{"scope":"slide"}]',
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
      geometryHints,
    });

    expect(withoutHints).not.toContain("Geometry ground truth");
    expect(withHints).toContain("Geometry ground truth");
    expect(withHints).toContain('"source": "layout"');
  });
});
