import { getCatalogEntriesForProvider } from "./catalog";
import type { ProviderSelection } from "./shared";
import type { ExtractModelProvider } from "./types";
import { claudeCodeProvider } from "./claude-code";
import { openAICodexProvider } from "./openai-codex";
import { mockProvider } from "@/lib/extract/mock-provider";

const PROVIDERS: Record<ProviderSelection["provider"], ExtractModelProvider> = {
  "claude-code": claudeCodeProvider,
  "openai-codex": openAICodexProvider,
  mock: mockProvider,
};

export function getExtractModelProvider(selection: ProviderSelection): ExtractModelProvider {
  const provider = PROVIDERS[selection.provider];
  if (!provider) {
    throw new Error(`Unknown extract provider: ${selection.provider}`);
  }
  const models = new Set(getCatalogEntriesForProvider(selection.provider).map((entry) => entry.model));
  if (!models.has(selection.model)) {
    throw new Error(`Model ${selection.model} is not available for provider ${selection.provider}`);
  }
  return provider;
}
