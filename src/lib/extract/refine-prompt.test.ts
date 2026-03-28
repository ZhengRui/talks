/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import { buildRefineSystemPrompt, buildRefineUserPrompt } from "./refine-prompt";

describe("buildRefineSystemPrompt", () => {
  it("includes surgical patch instruction", () => {
    const prompt = buildRefineSystemPrompt();
    expect(prompt).toContain("surgically");
    expect(prompt).toContain("Do NOT rewrite");
  });
});

describe("buildRefineUserPrompt", () => {
  it("includes mismatch ratio and regions", () => {
    const prompt = buildRefineUserPrompt({
      mismatchRatio: 0.23,
      regions: [{ x: 10, y: 20, w: 100, h: 50, mismatchRatio: 0.47 }],
      proposalsJson: '{"proposals":[]}',
      contentBounds: { x: 0, y: 0, w: 100, h: 50 },
    });

    expect(prompt).toContain("23");
    expect(prompt).toContain("R1");
    expect(prompt).toContain("47%");
    expect(prompt).toContain('"proposals"');
    expect(prompt).toContain("contentBounds");
  });
});
