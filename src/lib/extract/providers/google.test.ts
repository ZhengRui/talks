import { describe, expect, it, vi, beforeEach } from "vitest";
import sharp from "sharp";
import {
  buildSystemPrompt,
  buildThinkingConfig,
  preparePartsForGoogle,
  __testHelpers,
} from "./google";
import type { ProviderContentPart } from "./types";

beforeEach(() => {
  vi.resetModules();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
});

// Hoisted mock of @google/genai. Vitest 4's vi.fn() cannot construct arrow-function
// implementations, so we use a regular function expression to keep `new GoogleGenAI()`
// working.
vi.mock("@google/genai", () => {
  const generateContentStream = vi.fn();
  return {
    GoogleGenAI: vi.fn(function () {
      return { models: { generateContentStream } };
    }),
    __streamFn: generateContentStream,
  };
});

vi.mock("./shared", async () => {
  const actual = await vi.importActual<typeof import("./shared")>("./shared");
  return { ...actual, installProxyDispatcherOnce: vi.fn() };
});

async function* yieldChunks(chunks: Array<{ text?: string; usageMetadata?: unknown }>) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function loadGoogleProviderWithKey() {
  process.env.GEMINI_API_KEY = "test-key";
  const mod = await import("./google");
  return mod.googleProvider;
}

async function makePngBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 255 } },
  })
    .png()
    .toBuffer();
}

describe("buildSystemPrompt", () => {
  it("returns systemInstruction for gemini models", () => {
    const result = buildSystemPrompt("gemini-2.5-flash", "You are helpful.");
    expect(result).toEqual({ kind: "systemInstruction", value: "You are helpful." });
  });

  it("returns prepend for gemma models", () => {
    const result = buildSystemPrompt("gemma-4-31b-it", "You are helpful.");
    expect(result).toEqual({
      kind: "prepend",
      value: "System instructions:\nYou are helpful.\n\n",
    });
  });

  it("returns systemInstruction for gemini 3.x preview models", () => {
    const result = buildSystemPrompt("gemini-3.1-pro-preview", "sys");
    expect(result.kind).toBe("systemInstruction");
  });
});

describe("buildThinkingConfig", () => {
  it("returns undefined for gemma (effort 'none')", () => {
    expect(buildThinkingConfig("gemma-4-31b-it", "none")).toBeUndefined();
  });

  it("returns thinkingBudget 0 for gemini with effort '0'", () => {
    expect(buildThinkingConfig("gemini-2.5-flash", "0")).toEqual({ thinkingBudget: 0 });
  });

  it("returns thinkingBudget 8000 for gemini with effort '8000'", () => {
    expect(buildThinkingConfig("gemini-2.5-flash", "8000")).toEqual({ thinkingBudget: 8000 });
  });

  it("returns thinkingBudget 32000 for gemini 2.5 pro with effort '32000'", () => {
    expect(buildThinkingConfig("gemini-2.5-pro", "32000")).toEqual({ thinkingBudget: 32000 });
  });

  it("returns thinkingBudget -1 (dynamic) for gemini 2.5 pro with effort '-1'", () => {
    expect(buildThinkingConfig("gemini-2.5-pro", "-1")).toEqual({ thinkingBudget: -1 });
  });

  it("returns thinkingLevel for gemini 3.x models", () => {
    expect(buildThinkingConfig("gemini-3.1-pro-preview", "LOW")).toEqual({ thinkingLevel: "LOW" });
    expect(buildThinkingConfig("gemini-3-flash-preview", "MEDIUM")).toEqual({ thinkingLevel: "MEDIUM" });
    expect(buildThinkingConfig("gemini-3.1-flash-lite-preview", "HIGH")).toEqual({ thinkingLevel: "HIGH" });
  });
});

describe("preparePartsForGoogle", () => {
  it("passes text parts through unchanged", async () => {
    const parts: ProviderContentPart[] = [{ type: "text", text: "hello" }];
    const out = await preparePartsForGoogle(parts);
    expect(out).toEqual([{ type: "text", text: "hello" }]);
  });

  it("resizes large images and updates mediaType", async () => {
    const buffer = await makePngBuffer(3840, 2160);
    const parts: ProviderContentPart[] = [
      { type: "image", buffer, mediaType: "image/png" },
    ];
    const out = await preparePartsForGoogle(parts);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("image");
    if (out[0].type !== "image") throw new Error("unreachable");
    expect(out[0].prepared.width).toBe(1920);
    expect(out[0].prepared.height).toBe(1080);
    expect(out[0].prepared.mediaType).toBe("image/png");
  });

  it("preserves small images and their mediaType", async () => {
    const buffer = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .jpeg()
      .toBuffer();
    const parts: ProviderContentPart[] = [
      { type: "image", buffer, mediaType: "image/jpeg" },
    ];
    const out = await preparePartsForGoogle(parts);
    if (out[0].type !== "image") throw new Error("unreachable");
    expect(out[0].prepared.buffer).toBe(buffer);
    expect(out[0].prepared.mediaType).toBe("image/jpeg");
  });
});

describe("internal helpers", () => {
  it("isGemma detects gemma- prefix only", () => {
    expect(__testHelpers.isGemma("gemma-4-31b-it")).toBe(true);
    expect(__testHelpers.isGemma("gemini-2.5-flash")).toBe(false);
  });
});

import type { ProviderTurnInput } from "./types";

function baseInput(overrides: Partial<ProviderTurnInput> = {}): ProviderTurnInput {
  return {
    phase: "extract",
    systemPrompt: "You are helpful.",
    userPrompt: "Describe this slide.",
    content: [{ type: "text", text: "Describe this slide." }],
    selection: { provider: "google", model: "gemini-2.5-flash", effort: "0" },
    ...overrides,
  };
}

describe("googleProvider.run — happy path", () => {
  it("streams text chunks and accumulates the final result", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      yieldChunks([
        { text: "Hello " },
        { text: "world." },
        { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } },
      ]),
    );

    const googleProvider = await loadGoogleProviderWithKey();
    const events: Array<{ type: string; text?: string }> = [];
    const result = await googleProvider.run(
      baseInput({ onEvent: (e) => { events.push({ type: e.type, text: e.text }); } }),
    );

    expect(result.text).toBe("Hello world.");
    expect(events).toContainEqual({ type: "text", text: "Hello " });
    expect(events).toContainEqual({ type: "text", text: "world." });
    expect(typeof result.elapsed).toBe("number");
  });

  it("passes systemInstruction for gemini models", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(baseInput());

    expect(streamFn).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.5-flash",
        config: expect.objectContaining({ systemInstruction: "You are helpful." }),
      }),
    );
  });

  it("prepends system prompt into first user text for gemma models", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemma-4-31b-it", effort: "none" } }),
    );

    const call = streamFn.mock.calls[0][0];
    expect(call.config?.systemInstruction).toBeUndefined();
    const firstPart = call.contents[0].parts[0];
    expect(firstPart.text).toBe("System instructions:\nYou are helpful.\n\nDescribe this slide.");
  });

  it("includes thinkingConfig.thinkingBudget from effort for gemini", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemini-2.5-flash", effort: "8000" } }),
    );

    expect(streamFn).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          thinkingConfig: { thinkingBudget: 8000 },
        }),
      }),
    );
  });

  it("uses thinkingLevel for gemini 3.x (not thinkingBudget)", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({
        selection: { provider: "google", model: "gemini-3.1-pro-preview", effort: "LOW" },
      }),
    );

    const call = streamFn.mock.calls[0][0];
    expect(call.config?.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    expect(call.config?.thinkingConfig?.thinkingBudget).toBeUndefined();
  });

  it("omits thinkingConfig for gemma", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemma-4-31b-it", effort: "none" } }),
    );

    const call = streamFn.mock.calls[0][0];
    expect(call.config?.thinkingConfig).toBeUndefined();
  });

  it("builds inlineData parts with the prepared mediaType", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const buffer = await sharp({
      create: { width: 3840, height: 2160, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({
        content: [
          { type: "text", text: "look at this" },
          { type: "image", buffer, mediaType: "image/jpeg" },
        ],
      }),
    );

    const call = streamFn.mock.calls[0][0];
    const imagePart = call.contents[0].parts.find((p: { inlineData?: unknown }) => p.inlineData);
    expect(imagePart.inlineData.mimeType).toBe("image/png"); // was jpeg, got re-encoded
  });

  it("attaches AbortSignal via config.abortSignal (not top-level)", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const controller = new AbortController();
    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(baseInput({ signal: controller.signal }));

    const call = streamFn.mock.calls[0][0];
    expect(call.config?.abortSignal).toBe(controller.signal);
    // Must not be attached at the top level.
    expect((call as { abortSignal?: unknown }).abortSignal).toBeUndefined();
  });

  it("throws AbortError when signal is aborted before first chunk", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "late" }]));

    const controller = new AbortController();
    controller.abort();
    const events: Array<{ type: string; text?: string }> = [];

    const googleProvider = await loadGoogleProviderWithKey();
    await expect(
      googleProvider.run(
        baseInput({
          signal: controller.signal,
          onEvent: (e) => { events.push({ type: e.type, text: e.text }); },
        }),
      ),
    ).rejects.toThrow(/abort/i);

    expect(events.filter((e) => e.type === "text")).toHaveLength(0);
  });

  it("throws AbortError mid-stream", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();

    const controller = new AbortController();
    async function* aborting() {
      yield { text: "part-1 " };
      controller.abort();
      yield { text: "part-2" };
    }
    streamFn.mockResolvedValue(aborting());

    const googleProvider = await loadGoogleProviderWithKey();
    await expect(
      googleProvider.run(baseInput({ signal: controller.signal })),
    ).rejects.toThrow(/abort/i);
  });
});

describe("googleProvider.run — cost calculation", () => {
  function mockStreamWithUsage(usage: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  }) {
    return async function* () {
      yield { text: "answer" };
      yield { usageMetadata: usage };
    };
  }

  it("computes cost for gemini 2.5 flash with thinking tokens", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      mockStreamWithUsage({ promptTokenCount: 1_000_000, candidatesTokenCount: 500_000, thoughtsTokenCount: 200_000 })(),
    );
    const googleProvider = await loadGoogleProviderWithKey();
    const result = await googleProvider.run(baseInput());
    // input: 1M * 0.30 = 0.30; output: (0.5M + 0.2M) * 2.50 = 1.75 → total 2.05
    expect(result.cost).toBeCloseTo(2.05, 2);
    expect(result.usage).toEqual({ inputTokens: 1_000_000, outputTokens: 700_000 });
  });

  it("returns zero cost for gemma regardless of usage", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      mockStreamWithUsage({ promptTokenCount: 1_000, candidatesTokenCount: 500, thoughtsTokenCount: 0 })(),
    );
    const googleProvider = await loadGoogleProviderWithKey();
    const result = await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemma-4-31b-it", effort: "none" } }),
    );
    expect(result.cost).toBe(0);
  });

  it("computes cost for gemini 3.1 pro preview", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      mockStreamWithUsage({ promptTokenCount: 100_000, candidatesTokenCount: 50_000, thoughtsTokenCount: 20_000 })(),
    );
    const googleProvider = await loadGoogleProviderWithKey();
    const result = await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemini-3.1-pro-preview", effort: "0" } }),
    );
    // input: 0.1M * 2.00 = 0.20; output: (0.05M + 0.02M) * 12.00 = 0.84 → total 1.04
    expect(result.cost).toBeCloseTo(1.04, 2);
  });

  it("warns when gemini 2.5 pro exceeds 200K tokens", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      mockStreamWithUsage({ promptTokenCount: 250_000, candidatesTokenCount: 100 })(),
    );
    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemini-2.5-pro", effort: "0" } }),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("gemini-2.5-pro"));
    warn.mockRestore();
  });

  it("warns when gemini 3.1 pro preview exceeds 200K tokens", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      mockStreamWithUsage({ promptTokenCount: 250_000, candidatesTokenCount: 100 })(),
    );
    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemini-3.1-pro-preview", effort: "0" } }),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("gemini-3.1-pro-preview"));
    warn.mockRestore();
  });

  it("does not warn for gemini 2.5 flash over 200K tokens (not tiered)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      mockStreamWithUsage({ promptTokenCount: 250_000, candidatesTokenCount: 100 })(),
    );
    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(baseInput());
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("googleProvider.run — error mapping", () => {
  it("surfaces missing API key clearly without calling SDK", async () => {
    // Env deleted by top-level beforeEach; singleton reset by resetModules.
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    const { googleProvider: freshProvider } = await import("./google");
    await expect(freshProvider.run(baseInput())).rejects.toThrow(
      /GEMINI_API_KEY/,
    );
    expect(streamFn).not.toHaveBeenCalled();
  });

  it("maps 429 rate-limit errors to a helpful message", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockRejectedValue(Object.assign(new Error("rate limit"), { status: 429 }));
    const { googleProvider: freshProvider } = await import("./google");
    await expect(freshProvider.run(baseInput())).rejects.toThrow(
      /rate limit|free-tier|paid model/i,
    );
  });

  it("maps RESOURCE_EXHAUSTED 400 to rate-limit message", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockRejectedValue(
      Object.assign(new Error("status 400: RESOURCE_EXHAUSTED: quota exceeded for model"), { status: 400 }),
    );
    const { googleProvider: freshProvider } = await import("./google");
    await expect(freshProvider.run(baseInput())).rejects.toThrow(
      /rate limit|free-tier|paid model/i,
    );
  });

  it("maps token-limit 400 errors to a context-limit message", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockRejectedValue(
      Object.assign(new Error("The input token count (2000000) exceeds the maximum number of tokens allowed"), { status: 400 }),
    );
    const { googleProvider: freshProvider } = await import("./google");
    await expect(freshProvider.run(baseInput())).rejects.toThrow(
      /context limit|token|too large/i,
    );
  });

  it("maps 404 / preview-model-not-found to a deprecation hint", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockRejectedValue(
      Object.assign(new Error("models/gemini-3-flash-preview is not found for API version v1beta"), { status: 404 }),
    );
    const { googleProvider: freshProvider } = await import("./google");
    await expect(
      freshProvider.run(
        baseInput({ selection: { provider: "google", model: "gemini-3-flash-preview", effort: "0" } }),
      ),
    ).rejects.toThrow(/deprecated|replaced|update the catalog/i);
  });

  it("maps connect-timeout errors to a proxy hint", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), {
        cause: Object.assign(new Error("Connect Timeout Error"), { code: "UND_ERR_CONNECT_TIMEOUT" }),
      }),
    );
    const { googleProvider: freshProvider } = await import("./google");
    await expect(freshProvider.run(baseInput())).rejects.toThrow(
      /proxy|HTTPS_PROXY/i,
    );
  });
});
