import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderTurnInput } from "./types";

const {
  mockCodexConstructor,
  mockStartThread,
  mockRunStreamed,
  mockWithCodexTempImages,
} = vi.hoisted(() => ({
  mockCodexConstructor: vi.fn(function MockCodex() {
    return {
      startThread: mockStartThread,
    };
  }),
  mockStartThread: vi.fn(),
  mockRunStreamed: vi.fn(),
  mockWithCodexTempImages: vi.fn(),
}));

vi.mock("@openai/codex-sdk", () => ({
  Codex: mockCodexConstructor,
}));

vi.mock("./codex-temp-images", () => ({
  withCodexTempImages: mockWithCodexTempImages,
}));

function makeInput(overrides: Partial<ProviderTurnInput> = {}): ProviderTurnInput {
  return {
    phase: "vision",
    systemPrompt: "You are a vision critic.",
    userPrompt: "Compare the slides and return JSON.",
    content: [
      { type: "text", text: "ORIGINAL slide:" },
      {
        type: "image",
        buffer: Buffer.from("original"),
        mediaType: "image/jpeg",
        fileName: "original.jpg",
      },
      { type: "text", text: "REPLICA slide:" },
      {
        type: "image",
        buffer: Buffer.from("replica"),
        mediaType: "image/png",
        fileName: "replica.png",
      },
      { type: "text", text: "Compare the slides and return JSON." },
    ],
    selection: {
      provider: "openai-codex",
      model: "gpt-5.4",
      effort: "high",
    },
    ...overrides,
  };
}

async function importCodexModule() {
  return import("./openai-codex");
}

describe("OpenAI Codex provider", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCodexConstructor.mockReset();
    mockStartThread.mockReset();
    mockRunStreamed.mockReset();
    mockWithCodexTempImages.mockReset();

    mockWithCodexTempImages.mockImplementation(async (images, fn) =>
      fn(images.map((_, index) => `/tmp/talks-codex-${index + 1}.png`)),
    );
    mockStartThread.mockReturnValue({
      runStreamed: mockRunStreamed,
    });
    mockCodexConstructor.mockImplementation(function MockCodex() {
      return {
        startThread: mockStartThread,
      };
    });
  });

  it("renders ordered content into a Codex turn and maps stream events", async () => {
    mockRunStreamed.mockResolvedValue({
      events: (async function* () {
        yield { type: "thread.started" };
        yield { type: "item.started", item: { id: "reason-1", type: "reasoning", text: "" } };
        yield { type: "item.completed", item: { id: "reason-1", type: "reasoning", text: "Comparing layout" } };
        yield {
          type: "item.started",
          item: {
            id: "cmd-1",
            type: "command_execution",
            command: "ls",
            aggregated_output: "",
          },
        };
        yield {
          type: "item.completed",
          item: {
            id: "cmd-1",
            type: "command_execution",
            command: "ls",
            aggregated_output: "slide.png\nreplica.png\n",
          },
        };
        yield {
          type: "turn.completed",
          usage: {
            input_tokens: 22,
            output_tokens: 11,
            cached_input_tokens: 4,
          },
        };
        yield {
          type: "item.completed",
          item: { id: "msg-1", type: "agent_message", text: "Final Codex answer" },
        };
      })(),
    });

    const { runOpenAICodexTurn } = await importCodexModule();
    const events: Array<Record<string, unknown>> = [];
    const result = await runOpenAICodexTurn({
      ...makeInput(),
      async onEvent(event) {
        events.push(event as Record<string, unknown>);
      },
    });

    expect(mockWithCodexTempImages).toHaveBeenCalledTimes(1);
    expect(mockCodexConstructor).toHaveBeenCalledWith({
      config: {
        show_raw_agent_reasoning: true,
      },
    });
    expect(mockWithCodexTempImages.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ fileName: "original.jpg", mediaType: "image/jpeg" }),
      expect.objectContaining({ fileName: "replica.png", mediaType: "image/png" }),
    ]);

    expect(mockStartThread).toHaveBeenCalledWith({
      model: "gpt-5.4",
      workingDirectory: process.cwd(),
      sandboxMode: "read-only",
      approvalPolicy: "never",
      networkAccessEnabled: false,
      webSearchEnabled: false,
      webSearchMode: "disabled",
      modelReasoningEffort: "high",
    });

    const runInput = mockRunStreamed.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(runInput).toEqual([
      {
        type: "text",
        text: [
          "System instructions:\nYou are a vision critic.",
          "Ordered content:",
          "ORIGINAL slide:",
          "[Attached image 1]",
          "REPLICA slide:",
          "[Attached image 2]",
          "Compare the slides and return JSON.",
        ].join("\n\n"),
      },
      { type: "local_image", path: "/tmp/talks-codex-1.png" },
      { type: "local_image", path: "/tmp/talks-codex-2.png" },
    ]);

    expect(events).toEqual([
      {
        type: "status",
        message: "Session started (vision) — openai-codex / gpt-5.4 · high",
      },
      { type: "status", message: "Model is reasoning..." },
      { type: "thinking", text: "Comparing layout", streamKey: "reason-1" },
      { type: "tool", name: "command_execution", input: "ls" },
      { type: "tool_result", preview: "slide.png\nreplica.png\n" },
      { type: "text", text: "Final Codex answer", streamKey: "msg-1" },
    ]);
    expect(result).toEqual({
      text: "Final Codex answer",
      elapsed: expect.any(Number),
      cost: null,
      usage: {
        inputTokens: 22,
        outputTokens: 11,
        cachedInputTokens: 4,
      },
    });
  });

  it("normalizes Codex auth errors", async () => {
    mockCodexConstructor.mockImplementation(function MockCodex() {
      throw new Error("Unauthorized");
    });

    const { openAICodexProvider } = await importCodexModule();

    await expect(openAICodexProvider.run(makeInput())).rejects.toThrow(
      "OpenAI Codex authentication is unavailable or expired. Run `codex login` and restart the dev server if needed.",
    );
  });

  it("extracts a readable message from structured Codex API errors", async () => {
    mockCodexConstructor.mockImplementation(function MockCodex() {
      throw new Error(
        JSON.stringify({
          type: "error",
          error: {
            type: "invalid_request_error",
            code: "unsupported_value",
            message:
              "Unsupported value: 'minimal' is not supported with the 'gpt-5.4-codex-1p-codexswic-ev3' model.",
            param: "reasoning.effort",
          },
          status: 400,
        }),
      );
    });

    const { openAICodexProvider } = await importCodexModule();

    await expect(openAICodexProvider.run(makeInput())).rejects.toMatchObject({
      message:
        "Unsupported value: 'minimal' is not supported with the 'gpt-5.4-codex-1p-codexswic-ev3' model.",
    });
  });

  it("emits novel text across item updates and keeps the last message as the final response", async () => {
    mockRunStreamed.mockResolvedValue({
      events: (async function* () {
        yield { type: "thread.started" };
        yield { type: "item.started", item: { id: "msg-1", type: "agent_message", text: "" } };
        yield { type: "item.updated", item: { id: "msg-1", type: "agent_message", text: "Hello" } };
        yield { type: "item.updated", item: { id: "msg-1", type: "agent_message", text: "Hello world" } };
        yield { type: "item.completed", item: { id: "msg-1", type: "agent_message", text: "Hello world!" } };
        yield {
          type: "item.completed",
          item: { id: "msg-2", type: "agent_message", text: "Final answer" },
        };
        yield {
          type: "turn.completed",
          usage: {
            input_tokens: 7,
            output_tokens: 5,
            cached_input_tokens: 0,
          },
        };
      })(),
    });

    const { runOpenAICodexTurn } = await importCodexModule();
    const events: Array<Record<string, unknown>> = [];
    const result = await runOpenAICodexTurn({
      ...makeInput(),
      async onEvent(event) {
        events.push(event as Record<string, unknown>);
      },
    });

    expect(events).toEqual([
      {
        type: "status",
        message: "Session started (vision) — openai-codex / gpt-5.4 · high",
      },
      { type: "status", message: "Drafting response..." },
      { type: "text", text: "Hello", streamKey: "msg-1" },
      { type: "text", text: " world", streamKey: "msg-1" },
      { type: "text", text: "!", streamKey: "msg-1" },
      { type: "text", text: "\n\nFinal answer", streamKey: "msg-2" },
    ]);
    expect(result).toEqual({
      text: "Final answer",
      elapsed: expect.any(Number),
      cost: null,
      usage: {
        inputTokens: 7,
        outputTokens: 5,
        cachedInputTokens: 0,
      },
    });
  });
});
