/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import { buildRefineSystemPrompt, buildRefineUserPrompt } from "./refine-prompt";

describe("buildRefineSystemPrompt", () => {
  it("describes three images", () => {
    const prompt = buildRefineSystemPrompt();
    expect(prompt).toContain("Image 1");
    expect(prompt).toContain("Image 2");
    expect(prompt).toContain("Image 3");
    expect(prompt).toContain("original");
    expect(prompt).toContain("replica");
  });

  it("includes core analysis instructions", () => {
    const prompt = buildRefineSystemPrompt();
    expect(prompt).toContain("3 most visually impactful");
    expect(prompt).toContain("Do not oscillate");
    expect(prompt).toContain("return the proposals unchanged");
  });

  it("scopes unfixable to a narrow list", () => {
    const prompt = buildRefineSystemPrompt();
    expect(prompt).toContain("unfixable");
    expect(prompt).toContain("Emoji vs line-art");
    expect(prompt).toContain('"Hard to implement" is not unfixable');
  });

  it("includes surgical patch rules", () => {
    const prompt = buildRefineSystemPrompt();
    expect(prompt).toContain("surgically");
    expect(prompt).toContain("Do NOT rewrite");
    expect(prompt).toContain("top-left");
    expect(prompt).toContain("contentBounds");
  });
});

describe("buildRefineUserPrompt", () => {
  it("includes proposals and coordinate context", () => {
    const prompt = buildRefineUserPrompt({
      proposalsJson: '{"proposals":[]}',
      imageSize: { w: 1280, h: 720 },
      contentBounds: { x: 0, y: 0, w: 100, h: 50 },
    });

    expect(prompt).toContain('"proposals"');
    expect(prompt).toContain("contentBounds");
    expect(prompt).toContain("Image size: 1280x720");
    expect(prompt).toContain("Treat everything outside that rectangle as non-slide chrome");
  });
});
