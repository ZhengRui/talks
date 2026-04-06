/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  buildEditSystemPrompt,
  buildEditUserPrompt,
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

describe("buildVisionSystemPrompt", () => {
  it("instructs visual comparison without mentioning JSON or proposals", () => {
    const prompt = buildVisionSystemPrompt();
    expect(prompt).toContain("visible difference");
    expect(prompt).toContain("original");
    expect(prompt).toContain("replica");
    expect(prompt).not.toContain("JSON");
    expect(prompt).not.toContain("proposals");
    expect(prompt).not.toContain("patch");
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
});

describe("buildEditSystemPrompt", () => {
  it("instructs JSON patching with scene reference and labeled comparison images", () => {
    const prompt = buildEditSystemPrompt();
    expect(prompt).toContain("proposals");
    expect(prompt).toContain("surgically");
    expect(prompt).toContain("Scene Authoring Reference");
    expect(prompt).toContain("ORIGINAL");
    expect(prompt).toContain("REPLICA");
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
      differences: "1. Title too large\n2. Wrong border color",
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
    expect(prompt).toContain("Title too large");
    expect(prompt).toContain('"scope":"slide"');
  });

  it("includes cropped image bounds when contentBounds is smaller than the full image", () => {
    const prompt = buildEditUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      proposalSpace: { w: 1456, h: 818 },
      differences: "1. Title too large",
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
      differences: "1. Title too large",
      proposalsJson: '[{"scope":"slide"}]',
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    });
    const withHints = buildEditUserPrompt({
      imageSize: { w: 1920, h: 1080 },
      proposalSpace: { w: 1456, h: 818 },
      differences: "1. Title too large",
      proposalsJson: '[{"scope":"slide"}]',
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
      geometryHints,
    });

    expect(withoutHints).not.toContain("Geometry ground truth");
    expect(withHints).toContain("Geometry ground truth");
    expect(withHints).toContain('"source": "layout"');
  });
});
