import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVIDER,
  getCatalogEntriesForProvider,
  getDefaultProviderSelection,
  getModelCatalogEntry,
  getProviderOptions,
  normalizeProviderSelection,
} from "./catalog";

describe("provider catalog", () => {
  it("lists the configured providers", () => {
    expect(getProviderOptions()).toEqual([
      { value: "claude-code", label: "Claude Code (subscription)" },
      { value: "openai-codex", label: "OpenAI Codex (ChatGPT login)" },
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
      model: "claude-opus-4-6",
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
});
