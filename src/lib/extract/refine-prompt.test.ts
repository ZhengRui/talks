/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import {
  buildEditSystemPrompt,
  buildEditUserPrompt,
  buildVisionSystemPrompt,
  buildVisionUserPrompt,
} from "./refine-prompt";

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
  it("instructs JSON patching with scene reference and no image analysis", () => {
    const prompt = buildEditSystemPrompt();
    expect(prompt).toContain("proposals");
    expect(prompt).toContain("surgically");
    expect(prompt).toContain("Scene Authoring Reference");
    expect(prompt).not.toContain("ORIGINAL slide");
    expect(prompt).not.toContain("REPLICA slide");
    expect(prompt).not.toContain("Image 1");
    expect(prompt).not.toContain("Image 2");
  });
});

describe("buildEditUserPrompt", () => {
  it("includes difference list and proposals JSON", () => {
    const prompt = buildEditUserPrompt({
      differences: "1. Title too large\n2. Wrong border color",
      proposalsJson: '[{"scope":"slide"}]',
      contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
    });
    expect(prompt).toContain("Title too large");
    expect(prompt).toContain('"scope":"slide"');
    expect(prompt).toContain("contentBounds");
  });
});
