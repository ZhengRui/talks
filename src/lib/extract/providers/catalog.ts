import type { ExtractProviderId, ProviderSelection, ProviderSelectionInput } from "./shared";

export interface EffortOption {
  value: string;
  label: string;
}

export interface ModelCatalogEntry {
  provider: ExtractProviderId;
  model: string;
  label: string;
  auth: "subscription" | "api-key" | "none";
  effortMode: "adaptive" | "budget" | "none";
  effortOptions: EffortOption[];
  defaultEffort: string;
  supportsImages: boolean;
}

const ADAPTIVE_EFFORT_OPTIONS: EffortOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "max", label: "Max" },
];

const CODEX_EFFORT_OPTIONS: EffortOption[] = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "XHigh" },
];

const BUDGET_EFFORT_OPTIONS: EffortOption[] = [
  { value: "10000", label: "10k tokens" },
  { value: "30000", label: "30k tokens" },
  { value: "60000", label: "60k tokens" },
];

const MOCK_EFFORT_OPTIONS: EffortOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const DEFAULT_PROVIDER: ExtractProviderId = "claude-code";

const PROVIDER_LABELS: Record<ExtractProviderId, string> = {
  "claude-code": "Claude Code (subscription)",
  "openai-codex": "OpenAI Codex (ChatGPT login)",
  mock: "Mock",
};

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    provider: "claude-code",
    model: "claude-opus-4-6",
    label: "Opus 4.6",
    auth: "subscription",
    effortMode: "adaptive",
    effortOptions: ADAPTIVE_EFFORT_OPTIONS,
    defaultEffort: "medium",
    supportsImages: true,
  },
  {
    provider: "claude-code",
    model: "claude-sonnet-4-6",
    label: "Sonnet 4.6",
    auth: "subscription",
    effortMode: "adaptive",
    effortOptions: ADAPTIVE_EFFORT_OPTIONS,
    defaultEffort: "medium",
    supportsImages: true,
  },
  {
    provider: "claude-code",
    model: "claude-haiku-4-5-20251001",
    label: "Haiku 4.5",
    auth: "subscription",
    effortMode: "budget",
    effortOptions: BUDGET_EFFORT_OPTIONS,
    defaultEffort: "10000",
    supportsImages: true,
  },
  {
    // These Codex model ids should be validated against the installed Codex SDK/CLI.
    provider: "openai-codex",
    model: "gpt-5.4",
    label: "GPT-5.4",
    auth: "subscription",
    effortMode: "adaptive",
    effortOptions: CODEX_EFFORT_OPTIONS,
    defaultEffort: "medium",
    supportsImages: true,
  },
  {
    provider: "openai-codex",
    model: "gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    auth: "subscription",
    effortMode: "adaptive",
    effortOptions: CODEX_EFFORT_OPTIONS,
    defaultEffort: "medium",
    supportsImages: true,
  },
  {
    provider: "openai-codex",
    model: "gpt-5.3-codex",
    label: "GPT-5.3 Codex",
    auth: "subscription",
    effortMode: "adaptive",
    effortOptions: CODEX_EFFORT_OPTIONS,
    defaultEffort: "medium",
    supportsImages: true,
  },
  {
    provider: "mock",
    model: "mock",
    label: "Mock",
    auth: "none",
    effortMode: "none",
    effortOptions: MOCK_EFFORT_OPTIONS,
    defaultEffort: "medium",
    supportsImages: true,
  },
];

export function getProviderLabel(provider: ExtractProviderId): string {
  return PROVIDER_LABELS[provider];
}

export function getProviderOptions(): Array<{ value: ExtractProviderId; label: string }> {
  return (Object.keys(PROVIDER_LABELS) as ExtractProviderId[]).map((provider) => ({
    value: provider,
    label: PROVIDER_LABELS[provider],
  }));
}

export function getCatalogEntriesForProvider(provider: ExtractProviderId): ModelCatalogEntry[] {
  return MODEL_CATALOG.filter((entry) => entry.provider === provider);
}

export function getModelCatalogEntry(
  provider: ExtractProviderId,
  model: string,
): ModelCatalogEntry | null {
  return MODEL_CATALOG.find((entry) => entry.provider === provider && entry.model === model) ?? null;
}

export function findCatalogEntryByModel(model: string): ModelCatalogEntry | null {
  return MODEL_CATALOG.find((entry) => entry.model === model) ?? null;
}

export function getDefaultCatalogEntry(provider: ExtractProviderId = DEFAULT_PROVIDER): ModelCatalogEntry {
  const entry = MODEL_CATALOG.find((candidate) => candidate.provider === provider);
  if (!entry) {
    throw new Error(`No default model configured for provider ${provider}`);
  }
  return entry;
}

export function getDefaultProviderSelection(
  provider: ExtractProviderId = DEFAULT_PROVIDER,
): ProviderSelection {
  const entry = getDefaultCatalogEntry(provider);
  return {
    provider: entry.provider,
    model: entry.model,
    effort: entry.defaultEffort,
  };
}

export function normalizeProviderSelection(
  input: ProviderSelectionInput,
  fallbackProvider: ExtractProviderId = DEFAULT_PROVIDER,
): ProviderSelection {
  const inferredByModel = input.model ? findCatalogEntryByModel(input.model) : null;
  const provider = (
    input.provider &&
    (Object.keys(PROVIDER_LABELS) as string[]).includes(input.provider)
      ? input.provider
      : inferredByModel?.provider ??
        fallbackProvider
  ) as ExtractProviderId;

  const entry = (
    input.model ? getModelCatalogEntry(provider, input.model) : null
  ) ?? (
    provider !== (inferredByModel?.provider ?? provider) ? inferredByModel : null
  ) ?? getDefaultCatalogEntry(provider);

  const validEfforts = new Set(entry.effortOptions.map((option) => option.value));
  const effort = input.effort && validEfforts.has(input.effort)
    ? input.effort
    : entry.defaultEffort;

  return {
    provider: entry.provider,
    model: entry.model,
    effort,
  };
}

export function formatModelLabel(provider: ExtractProviderId, model: string): string {
  return getModelCatalogEntry(provider, model)?.label ?? model;
}

export function formatSelection(selection: ProviderSelection): string {
  return `${selection.provider} / ${selection.model} · ${selection.effort}`;
}
