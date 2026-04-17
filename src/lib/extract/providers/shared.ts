import { setGlobalDispatcher, ProxyAgent } from "undici";

export type ExtractProviderId = "claude-code" | "openai-codex" | "google" | "mock";

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

let proxyInstalled = false;

export function installProxyDispatcherOnce(): void {
  if (proxyInstalled) return;
  proxyInstalled = true;
  const proxyUrl =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy;
  if (!proxyUrl) return;
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}
