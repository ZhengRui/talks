import { describe, it, expect } from "vitest";
import { compileProposalPreview } from "./compile-preview";
import type { Proposal } from "@/components/extract/types";

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    scope: "slide",
    name: "test-slide",
    description: "test",
    region: { x: 0, y: 0, w: 800, h: 600 },
    params: {},
    style: {},
    body: `
sourceSize: { w: 800, h: 600 }
background: { type: solid, color: "#111" }
children:
  - kind: shape
    id: bg
    frame: { x: 0, y: 0, w: 800, h: 600 }
    shape: rect
    style: { fill: "#222" }
`,
    ...overrides,
  };
}

describe("compileProposalPreview", () => {
  it("strips fit/align from proposal body and applies contain/center defaults", () => {
    const proposal = makeProposal({
      body: `
sourceSize: { w: 800, h: 600 }
fit: stretch
align: top-left
background: { type: solid, color: "#111" }
children:
  - kind: shape
    id: bg
    frame: { x: 0, y: 0, w: 800, h: 600 }
    shape: rect
    style: { fill: "#222" }
`,
    });

    const result = compileProposalPreview(proposal, [proposal], 1920, 1080);

    // Under contain/center with 800x600 -> 1920x1080:
    // scale = 1.8, scene width = 1440, x offset = 240
    // If stretch/top-left leaked through, rect.x would be 0 and rect.w would be 1920
    const bgElement = result.elements.find((e) => e.id === "bg");
    expect(bgElement).toBeDefined();
    expect(bgElement!.rect.x).toBeCloseTo(240, 0);
    expect(bgElement!.rect.w).toBeCloseTo(1440, 0);
    expect(bgElement!.rect.y).toBeCloseTo(0, 0);
    expect(bgElement!.rect.h).toBeCloseTo(1080, 0);
  });

  it("compiles a basic proposal with contain/center defaults", () => {
    const proposal = makeProposal();
    const result = compileProposalPreview(proposal, [proposal], 1920, 1080);

    const bgElement = result.elements.find((e) => e.id === "bg");
    expect(bgElement).toBeDefined();
    expect(bgElement!.rect.x).toBeCloseTo(240, 0);
    expect(bgElement!.rect.w).toBeCloseTo(1440, 0);
  });
});
