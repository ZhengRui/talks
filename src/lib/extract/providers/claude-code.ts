import { accessSync, constants } from "fs";
import { homedir } from "os";
import { delimiter, join } from "path";
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { formatSelection, getModelCatalogEntry } from "./catalog";
import type { ProviderSelection } from "./shared";
import type { ExtractModelProvider, ProviderContentPart, ProviderTurnInput, ProviderTurnResult } from "./types";

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolvePathExecutable(binaryName: string, pathValue: string | undefined): string | null {
  if (!pathValue) return null;
  for (const directory of pathValue.split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, binaryName);
    if (isExecutable(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function resolveClaudeCodeExecutable(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.CLAUDE_CODE_EXECUTABLE;
  if (explicit) {
    if (isExecutable(explicit)) return explicit;
    throw new Error(
      `Claude Code executable not found at ${explicit}. Fix CLAUDE_CODE_EXECUTABLE or install \`claude\` on PATH.`,
    );
  }

  const onPath = resolvePathExecutable("claude", env.PATH);
  if (onPath) return onPath;

  const fallback = join(homedir(), ".local/bin/claude");
  if (isExecutable(fallback)) return fallback;

  throw new Error(
    "Claude Code executable not found. Install `claude`, add it to PATH, or set CLAUDE_CODE_EXECUTABLE.",
  );
}

function buildClaudePrompt(content: ProviderContentPart[]) {
  async function* promptGenerator() {
    yield {
      type: "user" as const,
      session_id: "",
      message: {
        role: "user" as const,
        content: content.map((part) =>
          part.type === "text"
            ? {
                type: "text" as const,
                text: part.text,
              }
            : {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: part.mediaType,
                  data: part.buffer.toString("base64"),
                },
              }),
      },
      parent_tool_use_id: null,
    };
  }

  return promptGenerator();
}

export function buildClaudeQueryOptions(
  selection: ProviderSelection,
  systemPrompt: string,
): Options {
  const entry = getModelCatalogEntry("claude-code", selection.model);
  if (!entry) {
    throw new Error(`Unsupported Claude model: ${selection.model}`);
  }

  const thinkingConfig = entry.effortMode === "adaptive"
    ? { type: "adaptive" as const }
    : { type: "enabled" as const, budget_tokens: parseInt(selection.effort, 10) || 10000 };
  const effortConfig = entry.effortMode === "adaptive"
    ? (selection.effort as "low" | "medium" | "high" | "max")
    : undefined;

  return {
    cwd: process.cwd(),
    settingSources: ["project"],
    allowedTools: [],
    maxTurns: 1,
    model: selection.model,
    thinking: thinkingConfig,
    ...(effortConfig ? { effort: effortConfig } : {}),
    systemPrompt,
    includePartialMessages: true,
    persistSession: false,
    pathToClaudeCodeExecutable: resolveClaudeCodeExecutable(),
    env: { ...process.env, ANTHROPIC_API_KEY: "" },
  };
}

function usageFromRecord(record: Record<string, unknown> | undefined): ProviderTurnResult["usage"] {
  if (!record) return null;
  const inputTokens = typeof record.input_tokens === "number" ? record.input_tokens : null;
  const outputTokens = typeof record.output_tokens === "number" ? record.output_tokens : null;
  const cachedInputTokens = typeof record.cache_read_input_tokens === "number"
    ? record.cache_read_input_tokens
    : typeof record.cached_input_tokens === "number"
      ? record.cached_input_tokens
      : undefined;

  if (inputTokens == null || outputTokens == null) return null;
  return {
    inputTokens,
    outputTokens,
    ...(cachedInputTokens != null ? { cachedInputTokens } : {}),
  };
}

export async function runClaudeCodeTurn(input: ProviderTurnInput): Promise<ProviderTurnResult> {
  const startedAt = Date.now();
  const options = buildClaudeQueryOptions(input.selection, input.systemPrompt);
  let resultText = "";
  let totalCost: number | null = null;
  let usage: ProviderTurnResult["usage"] = null;
  let sawThinkingDeltaForAssistant = false;
  let sawTextDelta = false;

  for await (const message of query({
    prompt: buildClaudePrompt(input.content),
    options,
  })) {
    const msg = message as Record<string, unknown>;

    if (msg.type === "system" && msg.subtype === "init") {
      await input.onEvent?.({
        type: "status",
        message: `Session started (${input.phase}) — ${formatSelection(input.selection)}`,
      });
      continue;
    }

    if (msg.type === "stream_event") {
      const event = msg.event as Record<string, unknown> | undefined;
      if (event?.type === "content_block_delta") {
        const delta = event.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          sawTextDelta = true;
          resultText += delta.text;
          await input.onEvent?.({ type: "text", text: delta.text });
        } else if (
          delta?.type === "thinking_delta" &&
          typeof delta.thinking === "string"
        ) {
          sawThinkingDeltaForAssistant = true;
          await input.onEvent?.({ type: "thinking", text: delta.thinking });
        }
      }
      continue;
    }

    if (msg.type === "assistant" && msg.message) {
      const assistantMsg = msg.message as Record<string, unknown>;
      if (Array.isArray(assistantMsg.content)) {
        for (const block of assistantMsg.content) {
          const contentBlock = block as Record<string, unknown>;
          if (contentBlock.type === "tool_use") {
            await input.onEvent?.({
              type: "tool",
              name: typeof contentBlock.name === "string" ? contentBlock.name : "tool",
              input: contentBlock.input,
            });
          } else if (
            contentBlock.type === "thinking" &&
            typeof contentBlock.thinking === "string" &&
            !sawThinkingDeltaForAssistant
          ) {
            await input.onEvent?.({ type: "thinking", text: contentBlock.thinking });
          }
        }
      }
      sawThinkingDeltaForAssistant = false;
      continue;
    }

    if (msg.type === "user") {
      const userMsg = msg.message as Record<string, unknown> | undefined;
      if (Array.isArray(userMsg?.content)) {
        for (const block of userMsg.content) {
          const contentBlock = block as Record<string, unknown>;
          if (contentBlock.type !== "tool_result") continue;
          const content = contentBlock.content as string | Array<Record<string, unknown>> | undefined;
          let preview = "";
          if (typeof content === "string") {
            preview = content.slice(0, 200);
          } else if (Array.isArray(content)) {
            for (const item of content) {
              if (item.type === "text" && typeof item.text === "string") {
                preview = item.text.slice(0, 200);
                break;
              }
            }
          }
          await input.onEvent?.({
            type: "tool_result",
            preview: preview || "(empty)",
          });
        }
      }
      continue;
    }

    if (msg.type === "result") {
      if (typeof msg.result === "string") {
        resultText = msg.result;
      }
      totalCost = typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : null;
      usage = usageFromRecord(msg.usage as Record<string, unknown> | undefined);
    }
  }

  if (!sawTextDelta && resultText) {
    await input.onEvent?.({ type: "text", text: resultText });
  }

  return {
    text: resultText,
    elapsed: Math.round((Date.now() - startedAt) / 1000),
    cost: totalCost,
    usage,
  };
}

export const claudeCodeProvider: ExtractModelProvider = {
  id: "claude-code",
  run: runClaudeCodeTurn,
};
