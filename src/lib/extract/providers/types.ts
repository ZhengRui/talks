import type { ProviderSelection } from "./shared";

export type ProviderPhase = "extract" | "vision" | "edit";

export interface ProviderContentText {
  type: "text";
  text: string;
}

export interface ProviderContentImage {
  type: "image";
  buffer: Buffer;
  mediaType: string;
  fileName?: string;
}

export type ProviderContentPart = ProviderContentText | ProviderContentImage;

export interface ProviderStreamEvent {
  type: "status" | "thinking" | "text" | "tool" | "tool_result";
  message?: string;
  text?: string;
  streamKey?: string;
  name?: string;
  input?: unknown;
  preview?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  cost?: number | null;
}

export interface ProviderTurnInput {
  phase: ProviderPhase;
  systemPrompt: string;
  // This remains available separately for UI/debugging; providers must not append it again.
  userPrompt: string;
  // Complete ordered model payload, including the final task text block when needed.
  content: ProviderContentPart[];
  selection: ProviderSelection;
  signal?: AbortSignal;
  onEvent?: (event: ProviderStreamEvent) => Promise<void> | void;
}

export interface ProviderTurnResult {
  text: string;
  elapsed: number;
  cost: number | null;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  } | null;
}

export interface ExtractModelProvider {
  id: ProviderSelection["provider"];
  run(input: ProviderTurnInput): Promise<ProviderTurnResult>;
}
