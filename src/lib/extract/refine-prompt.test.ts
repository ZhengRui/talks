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
  repeatGroups: [
    {
      id: "evp-columns",
      description: "Five matching columns with an upper frame attached to a lower colored panel",
      count: 5,
      orientation: "row",
      itemSize: { w: 223, h: 510 },
      gapX: 11,
      gapY: 0,
      variationPoints: ["heading text", "icon glyph", "panel color"],
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
  it("requires a bucketed fidelity and design-quality response schema", () => {
    const prompt = buildVisionSystemPrompt();

    expect(prompt).toContain("JSON object");
    expect(prompt).toContain("\"fidelityIssues\"");
    expect(prompt).toContain("\"designQualityIssues\"");
    expect(prompt).toContain("up to 5 issues");
    expect(prompt).toContain("up to 3 issues");
    expect(prompt).toContain("Do not duplicate the same `issueId` in both buckets");
    expect(prompt).toContain("designQualityIssues` must not be empty");
    expect(prompt).toContain("Do not behave like a pure diff engine");
    expect(prompt).toContain("optical centering");
    expect(prompt).toContain("symbol appropriateness");
    expect(prompt).toContain("one continuous composite component versus disconnected boxes");
    expect(prompt).not.toContain("\"impactType\"");
    expect(prompt).not.toContain("proposals");
  });

  it("lists unfixable items", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).toContain("unfixable");
    expect(prompt).toContain("icon identity and placement already match");
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

  it("includes semantic anchors and the bucketed watchlist when provided", () => {
    const prompt = buildVisionUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
      semanticAnchors,
      watchlistIssuesJson: JSON.stringify({
        fidelityWatchlist: [
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
            salience: "critical",
          },
        ],
        designQualityWatchlist: [
          {
            priority: 1,
            issueId: "badges.optical-centering",
            category: "style",
            ref: "badges",
            area: "badge icons",
            issue: "icons feel optically low",
            fixType: "style_adjustment",
            observed: "Replica icons are visually bottom-heavy.",
            desired: "Original icons feel centered and calm.",
            confidence: 0.84,
            salience: "important",
          },
        ],
      }, null, 2),
    });

    expect(prompt).toContain("Signature visuals from extract");
    expect(prompt).toContain("Must-preserve content from extract");
    expect(prompt).toContain("Repeated structure anchors from extract");
    expect(prompt).toContain("Important extracted regions");
    expect(prompt).toContain("Tiny watchlist from the last iteration");
    expect(prompt).toContain("\"fidelityWatchlist\"");
    expect(prompt).toContain("\"designQualityWatchlist\"");
    expect(prompt).toContain("\"issueId\": \"connector-lines.graphic-structure\"");
    expect(prompt).toContain("\"issueId\": \"badges.optical-centering\"");
    expect(prompt).toContain("reuse the same issueId in the same bucket");
  });
});

describe("buildEditSystemPrompt", () => {
  it("instructs JSON patching with separate fidelity and design-quality buckets", () => {
    const prompt = buildEditSystemPrompt();

    expect(prompt).toContain("fidelity issue bucket");
    expect(prompt).toContain("design-quality issue bucket");
    expect(prompt).toContain("Always resolve critical fidelity issues");
    expect(prompt).toContain("also address at least one design-quality issue");
    expect(prompt).toContain("Do not let fidelity consume the entire pass");
    expect(prompt).toContain("Scene Authoring Reference");
    expect(prompt).toContain("ORIGINAL");
    expect(prompt).toContain("REPLICA");
    expect(prompt).toContain("issueId");
    expect(prompt).toContain("category");
    expect(prompt).toContain("ref");
    expect(prompt).toContain("salience");
    expect(prompt).toContain("salienceReason");
    expect(prompt).toContain("persistenceCount");
    expect(prompt).toContain("structural_change");
    expect(prompt).toContain("diagnosis, not a literal patch recipe");
    expect(prompt).not.toContain("impactType");
  });
});

describe("buildEditUserPrompt", () => {
  it("separates image context, fidelity issues, design-quality issues, and proposal context", () => {
    const prompt = buildEditUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      proposalSpace: { w: 1456, h: 818 },
      fidelityIssuesJson: JSON.stringify([
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
      designQualityIssuesJson: JSON.stringify([
        {
          priority: 1,
          issueId: "badges.optical-centering",
          category: "style",
          ref: "badges",
          area: "badge icons",
          issue: "icons feel low",
          fixType: "style_adjustment",
          observed: "Replica icons feel bottom-heavy.",
          desired: "Original icons feel balanced.",
          confidence: 0.84,
        },
      ], null, 2),
      proposalsJson: '[{"scope":"slide"}]',
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    });

    expect(prompt).toContain("Image context:");
    expect(prompt).toContain("Proposal context:");
    expect(prompt).toContain("Fidelity issues:");
    expect(prompt).toContain("Design quality issues:");
    expect(prompt).toContain("\"issueId\": \"title.scale\"");
    expect(prompt).toContain("\"issueId\": \"badges.optical-centering\"");
    expect(prompt).toContain('"scope":"slide"');
    expect(prompt).not.toContain("Structured issues:");
  });

  it("includes cropped image bounds when contentBounds is smaller than the full image", () => {
    const prompt = buildEditUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      proposalSpace: { w: 1456, h: 818 },
      fidelityIssuesJson: "[]",
      designQualityIssuesJson: "[]",
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
      fidelityIssuesJson: "[]",
      designQualityIssuesJson: "[]",
      proposalsJson: '[{"scope":"slide"}]',
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    });
    const withHints = buildEditUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      proposalSpace: { w: 1456, h: 818 },
      fidelityIssuesJson: "[]",
      designQualityIssuesJson: "[]",
      proposalsJson: '[{"scope":"slide"}]',
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
      geometryHints,
    });

    expect(withoutHints).not.toContain("Geometry ground truth");
    expect(withHints).toContain("Geometry ground truth");
    expect(withHints).toContain('"source": "layout"');
  });

  it("keeps the edit prompt focused on the current buckets only", () => {
    const prompt = buildEditUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      proposalSpace: { w: 1456, h: 818 },
      fidelityIssuesJson: JSON.stringify([
        {
          priority: 1,
          issueId: "cards.proportions",
          category: "signature_visual",
          issue: "cards are too squat",
          confidence: 0.92,
          salience: "critical",
          persistenceCount: 2,
        },
      ], null, 2),
      designQualityIssuesJson: "[]",
      proposalsJson: '[{"scope":"slide"}]',
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    });

    expect(prompt).not.toContain("Current mismatch before this edit");
    expect(prompt).not.toContain("Persistent unresolved salient issues from prior iterations");
    expect(prompt).toContain("\"issueId\": \"cards.proportions\"");
    expect(prompt).toContain("\"salience\": \"critical\"");
    expect(prompt).toContain("\"persistenceCount\": 2");
    expect(prompt).toContain("Fidelity issues:");
    expect(prompt).toContain("Design quality issues:");
  });
});
