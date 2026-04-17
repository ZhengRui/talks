import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVIDER,
  MODEL_CATALOG,
  findCatalogEntryByModel,
  getCatalogEntriesForProvider,
  getDefaultCatalogEntry,
  getDefaultProviderSelection,
  getModelCatalogEntry,
  getProviderOptions,
  normalizeProviderSelection,
} from "./catalog";

describe("provider catalog", () => {
  it("lists the configured providers", () => {
    expect(getProviderOptions()).toEqual([
      { value: "claude-code", label: "Claude Code" },
      { value: "openai-codex", label: "OpenAI Codex" },
      { value: "google", label: "Google" },
      { value: "mock", label: "Mock" },
    ]);
  });

  it("returns the default selection for a provider", () => {
    expect(getDefaultProviderSelection()).toEqual({
      provider: DEFAULT_PROVIDER,
      model: "gpt-5.4",
      effort: "low",
    });
    expect(getDefaultProviderSelection("openai-codex")).toEqual({
      provider: "openai-codex",
      model: "gpt-5.4",
      effort: "low",
    });
    expect(getDefaultProviderSelection("claude-code")).toEqual({
      provider: "claude-code",
      model: "claude-opus-4-7",
      effort: "low",
    });
  });

  it("infers the provider from the model when provider is omitted", () => {
    expect(
      normalizeProviderSelection({
        model: "gpt-5.4-mini",
        effort: "high",
      }),
    ).toEqual({
      provider: "openai-codex",
      model: "gpt-5.4-mini",
      effort: "high",
    });
  });

  it("prefers the model-compatible provider when provider and model disagree", () => {
    expect(
      normalizeProviderSelection({
        provider: "claude-code",
        model: "gpt-5.4",
        effort: "xhigh",
      }),
    ).toEqual({
      provider: "openai-codex",
      model: "gpt-5.4",
      effort: "xhigh",
    });
  });

  it("falls back to the model default effort when the effort is invalid", () => {
    expect(
      normalizeProviderSelection({
        provider: "claude-code",
        model: "claude-haiku-4-5-20251001",
        effort: "high",
      }),
    ).toEqual({
      provider: "claude-code",
      model: "claude-haiku-4-5-20251001",
      effort: "10000",
    });
  });

  it("exposes effort mode and options for adaptive and budget models", () => {
    expect(getModelCatalogEntry("claude-code", "claude-sonnet-4-6")).toMatchObject({
      effortMode: "adaptive",
      defaultEffort: "low",
      effortOptions: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "max", label: "Max" },
      ],
    });
    expect(getModelCatalogEntry("claude-code", "claude-haiku-4-5-20251001")).toMatchObject({
      effortMode: "budget",
      defaultEffort: "10000",
      effortOptions: [
        { value: "10000", label: "10k tokens" },
        { value: "30000", label: "30k tokens" },
        { value: "60000", label: "60k tokens" },
      ],
    });
    expect(getCatalogEntriesForProvider("mock")).toHaveLength(1);
    expect(getModelCatalogEntry("openai-codex", "gpt-5.4")).toMatchObject({
      effortMode: "adaptive",
      defaultEffort: "low",
      effortOptions: [
        { value: "none", label: "None" },
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "xhigh", label: "XHigh" },
      ],
    });
  });

  it("exposes Opus 4.7 with xhigh effort option and ga status", () => {
    const entry = getModelCatalogEntry("claude-code", "claude-opus-4-7");
    expect(entry).not.toBeNull();
    expect(entry?.label).toBe("Opus 4.7");
    expect(entry?.status).toBe("ga");
    expect(entry?.defaultEffort).toBe("low");
    const values = entry?.effortOptions.map((o) => o.value);
    expect(values).toEqual(["low", "medium", "high", "xhigh", "max"]);
  });

  it("keeps Opus 4.6 available as a fallback option", () => {
    const entry = getModelCatalogEntry("claude-code", "claude-opus-4-6");
    expect(entry).not.toBeNull();
    const values = entry?.effortOptions.map((o) => o.value);
    // 4.6's options stay low/medium/high/max (no xhigh).
    expect(values).toEqual(["low", "medium", "high", "max"]);
  });
});

describe("google provider catalog", () => {
  it("has all 7 Google entries", () => {
    const googleEntries = MODEL_CATALOG.filter((e) => e.provider === "google");
    expect(googleEntries).toHaveLength(7);
    const ids = googleEntries.map((e) => e.model);
    expect(ids).toEqual([
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "gemini-3.1-pro-preview",
      "gemma-4-31b-it",
      "gemma-4-26b-a4b-it",
    ]);
  });

  it("uses gemini-2.5-flash as the default google model", () => {
    const entry = getDefaultCatalogEntry("google");
    expect(entry.model).toBe("gemini-2.5-flash");
  });

  it("assigns status to each google entry", () => {
    expect(getModelCatalogEntry("google", "gemini-2.5-flash")?.status).toBe("ga");
    expect(getModelCatalogEntry("google", "gemini-2.5-pro")?.status).toBe("ga");
    expect(getModelCatalogEntry("google", "gemini-3.1-pro-preview")?.status).toBe("preview");
    expect(getModelCatalogEntry("google", "gemini-3-flash-preview")?.status).toBe("preview");
    expect(getModelCatalogEntry("google", "gemini-3.1-flash-lite-preview")?.status).toBe("preview");
    expect(getModelCatalogEntry("google", "gemma-4-31b-it")?.status).toBe("free-only");
    expect(getModelCatalogEntry("google", "gemma-4-26b-a4b-it")?.status).toBe("free-only");
  });

  it("marks google entries as api-key auth and image-capable", () => {
    const googleEntries = MODEL_CATALOG.filter((e) => e.provider === "google");
    for (const entry of googleEntries) {
      expect(entry.auth).toBe("api-key");
      expect(entry.supportsImages).toBe(true);
    }
  });

  it("uses budget effort for gemini and none for gemma", () => {
    expect(getModelCatalogEntry("google", "gemini-2.5-flash")?.effortMode).toBe("budget");
    expect(getModelCatalogEntry("google", "gemini-2.5-pro")?.effortMode).toBe("budget");
    expect(getModelCatalogEntry("google", "gemini-3.1-pro-preview")?.effortMode).toBe("budget");
    expect(getModelCatalogEntry("google", "gemma-4-31b-it")?.effortMode).toBe("none");
  });

  it("lists Google as a selectable provider", () => {
    const options = getProviderOptions();
    expect(options).toContainEqual({ value: "google", label: "Google" });
  });

  it("can find new Google models by id", () => {
    expect(findCatalogEntryByModel("gemini-3.1-pro-preview")?.provider).toBe("google");
  });

  it("gives gemini-2.5-pro a 32k thinking budget option", () => {
    const entry = getModelCatalogEntry("google", "gemini-2.5-pro");
    expect(entry?.effortOptions.map((o) => o.value)).toContain("32000");
  });

  it("does not give gemini-2.5-flash a 32k thinking budget option", () => {
    const entry = getModelCatalogEntry("google", "gemini-2.5-flash");
    expect(entry?.effortOptions.map((o) => o.value)).not.toContain("32000");
  });

  it("does not give gemini-2.5-pro a 0 thinking budget option", () => {
    const entry = getModelCatalogEntry("google", "gemini-2.5-pro");
    const values = entry?.effortOptions.map((o) => o.value) ?? [];
    expect(values).not.toContain("0");
    expect(values).toContain("-1");
  });

  it("gives gemini-3.1-pro-preview LOW/MEDIUM/HIGH thinking levels", () => {
    const entry = getModelCatalogEntry("google", "gemini-3.1-pro-preview");
    expect(entry?.effortOptions.map((o) => o.value)).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });

  it("gives gemini-3-flash-preview LOW/MEDIUM/HIGH thinking levels", () => {
    const entry = getModelCatalogEntry("google", "gemini-3-flash-preview");
    expect(entry?.effortOptions.map((o) => o.value)).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });

  it("uses -1 as the default effort for gemini-2.5-pro", () => {
    expect(getModelCatalogEntry("google", "gemini-2.5-pro")?.defaultEffort).toBe("-1");
  });

  it("uses LOW as the default effort for gemini-3.1-pro-preview", () => {
    expect(getModelCatalogEntry("google", "gemini-3.1-pro-preview")?.defaultEffort).toBe("LOW");
  });
});
