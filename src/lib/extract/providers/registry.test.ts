import { describe, expect, it } from "vitest";
import { getExtractModelProvider } from "./registry";

describe("provider registry", () => {
  it("returns the provider for a valid selection", () => {
    expect(
      getExtractModelProvider({
        provider: "claude-code",
        model: "claude-opus-4-6",
        effort: "medium",
      }).id,
    ).toBe("claude-code");

    expect(
      getExtractModelProvider({
        provider: "openai-codex",
        model: "gpt-5.4",
        effort: "high",
      }).id,
    ).toBe("openai-codex");
  });

  it("throws when the model does not belong to the selected provider", () => {
    expect(() =>
      getExtractModelProvider({
        provider: "mock",
        model: "gpt-5.4",
        effort: "medium",
      }),
    ).toThrow("Model gpt-5.4 is not available for provider mock");
  });
});
