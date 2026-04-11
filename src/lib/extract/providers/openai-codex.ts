import type { ExtractModelProvider, ProviderContentImage, ProviderTurnInput, ProviderTurnResult } from "./types";
import { withCodexTempImages } from "./codex-temp-images";
import { formatSelection } from "./catalog";

type CodexClient = InstanceType<(typeof import("@openai/codex-sdk"))["Codex"]>;

let codexSingleton: CodexClient | null = null;
const CODEX_CONFIG = {
  show_raw_agent_reasoning: true,
} as const;

function readCodexErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }
  if (record.error) {
    return readCodexErrorMessage(record.error);
  }
  return null;
}

function normalizeCodexError(error: unknown): Error {
  const rawMessage = error instanceof Error ? error.message : String(error);
  let message = rawMessage;

  try {
    const parsed = JSON.parse(rawMessage) as unknown;
    const parsedMessage = readCodexErrorMessage(parsed);
    if (parsedMessage) {
      message = parsedMessage;
    }
  } catch {
    const nestedMessage = readCodexErrorMessage(error);
    if (nestedMessage) {
      message = nestedMessage;
    }
  }

  if (message.includes("Cannot find package") || message.includes("Cannot find module")) {
    return new Error(
      "OpenAI Codex SDK is not installed. Run `bun add @openai/codex-sdk` and restart the dev server.",
    );
  }
  if (message.includes("codex") && message.includes("ENOENT")) {
    return new Error(
      "Codex CLI is not installed or not on PATH. Install it and run `codex login` before using the OpenAI Codex provider.",
    );
  }
  if (/login|auth|token|unauthorized|forbidden/i.test(message)) {
    return new Error(
      "OpenAI Codex authentication is unavailable or expired. Run `codex login` and restart the dev server if needed.",
    );
  }
  if (error instanceof Error && error.message === message) {
    return error;
  }
  return new Error(message);
}

async function getCodexClient(): Promise<CodexClient> {
  if (codexSingleton) return codexSingleton;

  try {
    const module = await import("@openai/codex-sdk");
    codexSingleton = new module.Codex({
      config: CODEX_CONFIG,
    });
    return codexSingleton;
  } catch (error) {
    throw normalizeCodexError(error);
  }
}

function renderCodexPrompt(input: ProviderTurnInput): { prompt: string; images: ProviderContentImage[] } {
  const lines = [`System instructions:\n${input.systemPrompt}`, "Ordered content:"];
  const images: ProviderContentImage[] = [];

  for (const part of input.content) {
    if (part.type === "text") {
      lines.push(part.text);
      continue;
    }

    images.push(part);
    lines.push(`[Attached image ${images.length}]`);
  }

  return {
    prompt: lines.join("\n\n"),
    images,
  };
}

function extractStreamingTextDelta(previous: string | undefined, next: string): string {
  if (!previous) return next;
  if (next === previous) return "";
  if (next.startsWith(previous)) {
    return next.slice(previous.length);
  }
  return next;
}

export async function runOpenAICodexTurn(input: ProviderTurnInput): Promise<ProviderTurnResult> {
  const codex = await getCodexClient();
  const { prompt, images } = renderCodexPrompt(input);
  const startedAt = Date.now();
  let finalResponse = "";
  let usage: ProviderTurnResult["usage"] = null;

  return withCodexTempImages(images, async (paths) => {
    const thread = codex.startThread({
      model: input.selection.model,
      workingDirectory: process.cwd(),
      sandboxMode: "read-only",
      approvalPolicy: "never",
      networkAccessEnabled: false,
      webSearchEnabled: false,
      webSearchMode: "disabled",
      modelReasoningEffort: input.selection.effort,
    });

    const streamed = await thread.runStreamed(
      [
        { type: "text", text: prompt },
        ...paths.map((path) => ({ type: "local_image", path })),
      ],
    );

    const agentMessageSnapshots = new Map<string, string>();
    const reasoningSnapshots = new Map<string, string>();
    let sawAgentMessage = false;
    let sawReasoning = false;

    const getItemKey = (payload: Record<string, unknown>, fallback: string) =>
      typeof payload.id === "string" && payload.id ? payload.id : fallback;

    const emitAgentText = async (payload: Record<string, unknown>) => {
      if (typeof payload.text !== "string") return;
      finalResponse = payload.text;

      const key = getItemKey(payload, "agent_message");
      const previous = agentMessageSnapshots.get(key);
      let delta = extractStreamingTextDelta(previous, payload.text);
      agentMessageSnapshots.set(key, payload.text);

      if (!delta) return;
      if (!previous && sawAgentMessage) {
        delta = `\n\n${delta}`;
      }
      sawAgentMessage = true;
      await input.onEvent?.({ type: "text", text: delta, streamKey: key });
    };

    const emitReasoningText = async (payload: Record<string, unknown>) => {
      if (typeof payload.text !== "string") return;

      const key = getItemKey(payload, "reasoning");
      const previous = reasoningSnapshots.get(key);
      let delta = extractStreamingTextDelta(previous, payload.text);
      reasoningSnapshots.set(key, payload.text);

      if (!delta) return;
      if (!previous && sawReasoning) {
        delta = `\n\n${delta}`;
      }
      sawReasoning = true;
      await input.onEvent?.({ type: "thinking", text: delta, streamKey: key });
    };

    for await (const event of streamed.events) {
      const item = event as Record<string, unknown>;
      if (item.type === "thread.started") {
        await input.onEvent?.({
          type: "status",
          message: `Session started (${input.phase}) — ${formatSelection(input.selection)}`,
        });
        continue;
      }

      if (item.type === "turn.completed") {
        const eventUsage = item.usage as Record<string, unknown> | undefined;
        if (
          typeof eventUsage?.input_tokens === "number" &&
          typeof eventUsage?.output_tokens === "number"
        ) {
          usage = {
            inputTokens: eventUsage.input_tokens,
            outputTokens: eventUsage.output_tokens,
            ...(typeof eventUsage.cached_input_tokens === "number"
              ? { cachedInputTokens: eventUsage.cached_input_tokens }
              : {}),
          };
        }
        continue;
      }

      if (item.type === "turn.failed" || item.type === "error") {
        throw normalizeCodexError(
          item.type === "turn.failed"
            ? (item.error as Record<string, unknown> | undefined)?.message ?? "Codex turn failed"
            : item.message ?? "Codex stream failed",
        );
      }

      if (
        item.type !== "item.started" &&
        item.type !== "item.completed" &&
        item.type !== "item.updated"
      ) {
        continue;
      }

      const payload = item.item as Record<string, unknown> | undefined;
      if (!payload || typeof payload.type !== "string") continue;

      if (item.type === "item.started") {
        if (payload.type === "reasoning") {
          await input.onEvent?.({ type: "status", message: "Model is reasoning..." });
          continue;
        }
        if (payload.type === "agent_message") {
          await input.onEvent?.({ type: "status", message: "Drafting response..." });
          continue;
        }
        if (payload.type === "command_execution") {
          await input.onEvent?.({
            type: "tool",
            name: "command_execution",
            input: payload.command,
          });
          continue;
        }
        if (payload.type === "mcp_tool_call") {
          await input.onEvent?.({
            type: "tool",
            name: `${String(payload.server ?? "mcp")}:${String(payload.tool ?? "tool")}`,
            input: payload.arguments,
          });
          continue;
        }
        if (payload.type === "web_search") {
          await input.onEvent?.({
            type: "tool",
            name: "web_search",
            input: payload.query,
          });
          continue;
        }
        if (payload.type === "file_change") {
          await input.onEvent?.({ type: "status", message: "Applying file changes..." });
          continue;
        }
        if (payload.type === "todo_list" && Array.isArray(payload.items)) {
          await input.onEvent?.({
            type: "status",
            message: `Plan updated — ${payload.items.length} item${payload.items.length === 1 ? "" : "s"}`,
          });
          continue;
        }
      }

      if (payload.type === "reasoning") {
        await emitReasoningText(payload);
        continue;
      }

      if (payload.type === "agent_message") {
        await emitAgentText(payload);
        continue;
      }

      if (payload.type === "command_execution") {
        if (typeof payload.aggregated_output === "string" && payload.aggregated_output) {
          await input.onEvent?.({
            type: "tool_result",
            preview: payload.aggregated_output.slice(0, 200),
          });
        }
      }
    }

    return {
      text: finalResponse,
      elapsed: Math.round((Date.now() - startedAt) / 1000),
      cost: null,
      usage,
    };
  });
}

export const openAICodexProvider: ExtractModelProvider = {
  id: "openai-codex",
  async run(input) {
    try {
      return await runOpenAICodexTurn(input);
    } catch (error) {
      throw normalizeCodexError(error);
    }
  },
};
