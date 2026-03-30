import { describe, expect, it } from "vitest";
import { parse as yamlParse } from "yaml";
import {
  MOCK_CLAUDE_MODEL,
  createMockAnalysisResult,
  createMockRefineProposals,
  isMockClaudeModel,
} from "./mock-claude";

describe("mock-claude helpers", () => {
  it("identifies the mock Claude model", () => {
    expect(isMockClaudeModel(MOCK_CLAUDE_MODEL)).toBe(true);
    expect(isMockClaudeModel("claude-opus-4-6")).toBe(false);
  });

  it("builds a deterministic mock analysis result", () => {
    const result = createMockAnalysisResult({
      description: "Test slide",
      slug: "demo",
      dimensions: { w: 1280, h: 720 },
    });

    expect(result.source.dimensions).toEqual({ w: 1280, h: 720 });
    expect(result.source.image).toBe("mock://claude/extract");
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.name).toBe("mock-slide");
    expect(result.inventory?.uncertainties).toContain(
      "This is a deterministic local stub, not a model extract.",
    );
  });

  it("injects a visible refine badge into the slide proposal", () => {
    const proposals = [
      {
        scope: "slide" as const,
        name: "base-slide",
        description: "base",
        region: { x: 0, y: 0, w: 1280, h: 720 },
        params: {},
        style: {},
        body: [
          "mode: scene",
          "children:",
          "  - kind: text",
          "    id: title",
          "    frame: { x: 100, y: 100, w: 400, h: 60 }",
          "    text: Hello",
          "    style:",
          "      fontSize: 32",
        ].join("\n"),
      },
    ];

    const refined = createMockRefineProposals(proposals, 2);
    const parsed = yamlParse(refined[0]!.body) as { children?: Array<{ id?: string; text?: string }> };

    expect(refined[0]?.description).toBe("Mock refine iteration 2");
    expect(parsed.children?.some((child) => child.id === "mock-refine-badge")).toBe(true);
    expect(parsed.children?.find((child) => child.id === "mock-refine-badge")?.text).toBe(
      "Mock refine iter 2",
    );
  });
});
