export type ExtractProviderId = "claude-code" | "openai-codex" | "mock";

export interface ProviderSelection {
  provider: ExtractProviderId;
  model: string;
  effort: string;
}

export interface ProviderSelectionInput {
  provider?: string | null;
  model?: string | null;
  effort?: string | null;
}
