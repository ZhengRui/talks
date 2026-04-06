/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  buildEditSystemPrompt,
  buildEditUserPrompt,
  type VisionSemanticAnchors,
  buildVisionSystemPrompt,
  buildVisionUserPrompt,
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
  it("returns a structured issue schema for visual comparison", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).toContain("visually impactful differences");
    expect(prompt).toContain("original");
    expect(prompt).toContain("replica");
    expect(prompt).toContain("JSON object");
    expect(prompt).toContain("\"issues\"");
    expect(prompt).toContain("\"resolvedIssueIds\"");
    expect(prompt).toContain("\"issueId\"");
    expect(prompt).toContain("\"category\"");
    expect(prompt).toContain("\"ref\"");
    expect(prompt).toContain("\"fixType\"");
    expect(prompt).toContain("structural_change");
    expect(prompt).toContain("diversify the top 3");
    expect(prompt).not.toContain("proposals");
  });

  it("lists unfixable items", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).toContain("unfixable");
    expect(prompt).toContain("Emoji");
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

  it("includes semantic anchors and prior unresolved issues when provided", () => {
    const prompt = buildVisionUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
      semanticAnchors,
      priorIssuesJson: JSON.stringify([
        {
          priority: 1,
          issueId: "connector-lines.graphic-structure",
          category: "signature_visual",
          ref: "connector-lines",
          area: "connector lines",
          issue: "line topology is wrong",
          fixType: "structural_change",
          observed: "Replica uses short spokes.",
          desired: "Original uses a diagonal X.",
          confidence: 0.9,
          sticky: true,
        },
      ], null, 2),
    });

    expect(prompt).toContain("Signature visuals from extract");
    expect(prompt).toContain("Orange hub circle with diagonal connector X");
    expect(prompt).toContain("Must-preserve content from extract");
    expect(prompt).toContain("Important extracted regions");
    expect(prompt).toContain("Previous issues to re-check from the prior iteration");
    expect(prompt).toContain("\"issueId\": \"connector-lines.graphic-structure\"");
    expect(prompt).toContain("\"ref\": \"connector-lines\"");
    expect(prompt).toContain("\"fixType\": \"structural_change\"");
    expect(prompt).toContain("resolvedIssueIds");
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
    expect(prompt).toContain("sticky");
    expect(prompt).toContain("structural_change");
    expect(prompt).toContain("unresolved sticky `signature_visual` issues");
    expect(prompt).toContain("contentBounds is in the pixel space of the ORIGINAL/REPLICA images");
    expect(prompt).toContain("Treat image-space context and proposal-space context as separate");
    expect(prompt).toContain("Preserve that proposal-space coordinate system");
    expect(prompt).not.toContain("Image 1");
    expect(prompt).not.toContain("Image 2");
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
