import { describe, expect, it } from "vitest";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts";

describe("ANALYSIS_SYSTEM_PROMPT", () => {
  it("includes inventory as a required output field", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain('"inventory"');
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("The inventory must contain:");
  });

  it("contains the two-phase contract", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("First produce an `inventory`");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Then produce `proposals`");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("If you discover a contradiction while writing proposals");
  });

  it("forbids block-scope proposals in v1", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Do NOT output block-scope proposals in v1");
  });

  it("biases toward explicit repeated nodes over loops", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Write repeated elements as literal explicit nodes");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("A 4-card hero row should be 4 explicit card groups");
  });

  it("requires every mustPreserve item to appear in the proposal body", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Every item in `inventory.mustPreserve` must be represented in the proposal body");
  });

  it("preserves the common mistakes section", () => {
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("## Common mistakes to avoid");
    expect(ANALYSIS_SYSTEM_PROMPT).toContain("Text nodes and shape nodes MUST have a `style:` object");
  });
});

describe("buildAnalysisPrompt", () => {
  it("builds the user prompt with inventory-first framing", () => {
    const prompt = buildAnalysisPrompt("Focus on background atmosphere", "my-deck");
    expect(prompt).toContain("inventory-first reusable scene templates");
    expect(prompt).toContain("Additional context: Focus on background atmosphere");
    expect(prompt).toContain("Target slug: my-deck");
  });
});
