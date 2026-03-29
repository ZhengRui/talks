/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import { buildRefineSystemPrompt, buildRefineUserPrompt } from "./refine-prompt";

describe("buildRefineSystemPrompt", () => {
  it("includes surgical patch and coordinate-space instructions", () => {
    const prompt = buildRefineSystemPrompt();
    expect(prompt).toContain("surgically");
    expect(prompt).toContain("Do NOT rewrite");
    expect(prompt).toContain("top-left");
    expect(prompt).toContain("cropped to contentBounds");
  });
});

describe("buildRefineUserPrompt", () => {
  it("includes mismatch ratio, regions, and coordinate context", () => {
    const prompt = buildRefineUserPrompt({
      mismatchRatio: 0.23,
      regions: [{ x: 10, y: 20, w: 100, h: 50, mismatchRatio: 0.47 }],
      proposalsJson: '{"proposals":[]}',
      fullImageSize: { w: 1280, h: 720 },
      croppedImageSize: { w: 100, h: 50 },
      contentBounds: { x: 0, y: 0, w: 100, h: 50 },
    });

    expect(prompt).toContain("23");
    expect(prompt).toContain("R1");
    expect(prompt).toContain("47%");
    expect(prompt).toContain('"proposals"');
    expect(prompt).toContain("contentBounds");
    expect(prompt).toContain("Full image size: 1280x720");
    expect(prompt).toContain("Attached image size: 100x50");
    expect(prompt).toContain("cropped to contentBounds");
  });
});
