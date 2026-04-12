import { chmod, mkdtemp, mkdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderTurnInput } from "./types";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: mockQuery,
}));

async function createExecutable(directory: string, name: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  const executablePath = join(directory, name);
  await writeFile(executablePath, "#!/bin/sh\nexit 0\n");
  await chmod(executablePath, 0o755);
  return executablePath;
}

async function importClaudeModule() {
  return import("./claude-code");
}

function makeInput(overrides: Partial<ProviderTurnInput> = {}): ProviderTurnInput {
  return {
    phase: "extract",
    systemPrompt: "System prompt",
    userPrompt: "User prompt",
    content: [
      { type: "text", text: "ORIGINAL slide:" },
      {
        type: "image",
        buffer: Buffer.from("image"),
        mediaType: "image/png",
        fileName: "slide.png",
      },
      { type: "text", text: "User prompt" },
    ],
    selection: {
      provider: "claude-code",
      model: "claude-opus-4-6",
      effort: "medium",
    },
    ...overrides,
  };
}

describe("ClaudeCode provider", () => {
  const originalClaudeExecutable = process.env.CLAUDE_CODE_EXECUTABLE;

  beforeEach(() => {
    vi.resetModules();
    mockQuery.mockReset();
    process.env.CLAUDE_CODE_EXECUTABLE = process.execPath;
  });

  afterEach(() => {
    process.env.CLAUDE_CODE_EXECUTABLE = originalClaudeExecutable;
    vi.doUnmock("os");
  });

  it("prefers an explicit Claude executable path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claude-explicit-"));
    try {
      const executablePath = await createExecutable(dir, "custom-claude");
      const { resolveClaudeCodeExecutable } = await importClaudeModule();

      expect(
        resolveClaudeCodeExecutable({
          CLAUDE_CODE_EXECUTABLE: executablePath,
          PATH: "",
        } as unknown as NodeJS.ProcessEnv),
      ).toBe(executablePath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("resolves Claude from PATH when no explicit executable is configured", async () => {
    const dir = await mkdtemp(join(tmpdir(), "claude-path-"));
    try {
      const executablePath = await createExecutable(dir, "claude");
      const { resolveClaudeCodeExecutable } = await importClaudeModule();

      expect(
        resolveClaudeCodeExecutable({
          PATH: dir,
        } as unknown as NodeJS.ProcessEnv),
      ).toBe(executablePath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("falls back to ~/.local/bin/claude when PATH lookup fails", async () => {
    const homeDirectory = await mkdtemp(join(tmpdir(), "claude-home-"));
    try {
      const executablePath = await createExecutable(join(homeDirectory, ".local/bin"), "claude");
      vi.resetModules();
      vi.doMock("os", () => {
        return {
          default: {
            homedir: () => homeDirectory,
          },
          homedir: () => homeDirectory,
        };
      });

      const { resolveClaudeCodeExecutable } = await importClaudeModule();
      expect(resolveClaudeCodeExecutable({ PATH: "" } as unknown as NodeJS.ProcessEnv)).toBe(executablePath);
    } finally {
      await rm(homeDirectory, { recursive: true, force: true });
    }
  });

  it("builds adaptive and budget Claude query options from the model catalog", async () => {
    const { buildClaudeQueryOptions } = await importClaudeModule();

    const adaptive = buildClaudeQueryOptions(
      {
        provider: "claude-code",
        model: "claude-sonnet-4-6",
        effort: "high",
      },
      "Adaptive system prompt",
    );
    expect(adaptive.model).toBe("claude-sonnet-4-6");
    expect(adaptive.systemPrompt).toBe("Adaptive system prompt");
    expect(adaptive.thinking).toEqual({ type: "adaptive" });
    expect(adaptive.effort).toBe("high");
    expect(adaptive.pathToClaudeCodeExecutable).toBe(process.execPath);

    const budget = buildClaudeQueryOptions(
      {
        provider: "claude-code",
        model: "claude-haiku-4-5-20251001",
        effort: "30000",
      },
      "Budget system prompt",
    );
    expect(budget.thinking).toEqual({ type: "enabled", budget_tokens: 30000 });
    expect("effort" in budget ? budget.effort : undefined).toBeUndefined();
  });

  it("maps Claude SDK events into provider stream events", async () => {
    mockQuery.mockImplementationOnce(async function* () {
      yield { type: "system", subtype: "init" };
      yield {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "Inspecting slide" },
        },
      };
      yield {
        type: "stream_event",
        event: {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Final answer" },
        },
      };
      yield {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name: "read_file", input: { path: "slide.png" } },
          ],
        },
      };
      yield {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              content: [{ type: "text", text: "tool output preview" }],
            },
          ],
        },
      };
      yield {
        type: "result",
        result: "Final answer",
        total_cost_usd: 0.12,
        usage: {
          input_tokens: 12,
          output_tokens: 7,
          cache_read_input_tokens: 3,
        },
      };
    });

    const { runClaudeCodeTurn } = await importClaudeModule();
    const events: Array<Record<string, unknown>> = [];
    const result = await runClaudeCodeTurn({
      ...makeInput(),
      async onEvent(event) {
        events.push(event as unknown as Record<string, unknown>);
      },
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const queryInput = mockQuery.mock.calls[0]?.[0] as {
      prompt: AsyncGenerator<{
        message: {
          content: Array<Record<string, unknown>>;
        };
      }>;
    };
    const prompt = await queryInput.prompt.next();
    expect(prompt.value?.message.content).toEqual([
      { type: "text", text: "ORIGINAL slide:" },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: Buffer.from("image").toString("base64"),
        },
      },
      { type: "text", text: "User prompt" },
    ]);

    expect(events).toEqual([
      {
        type: "status",
        message: "Session started (extract) — claude-code / claude-opus-4-6 · medium",
      },
      { type: "thinking", text: "Inspecting slide" },
      { type: "text", text: "Final answer" },
      { type: "tool", name: "read_file", input: { path: "slide.png" } },
      { type: "tool_result", preview: "tool output preview" },
    ]);
    expect(result).toEqual({
      text: "Final answer",
      elapsed: expect.any(Number),
      cost: 0.12,
      usage: {
        inputTokens: 12,
        outputTokens: 7,
        cachedInputTokens: 3,
      },
    });
  });
});
