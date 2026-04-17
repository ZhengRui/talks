import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import type { ExtractModelProvider, ProviderContentPart, ProviderTurnInput, ProviderTurnResult } from "./types";
import { installProxyDispatcherOnce } from "./shared";
import { resizeForGoogle, type PreparedImage } from "@/lib/extract/google-image-prep";

const COST_RATES: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash":              { input: 0.30, output: 2.50 },
  "gemini-2.5-pro":                { input: 1.25, output: 10.00 },
  "gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.50 },
  "gemini-3-flash-preview":        { input: 0.50, output: 3.00 },
  "gemini-3.1-pro-preview":        { input: 2.00, output: 12.00 },
  "gemma-4-31b-it":                { input: 0,    output: 0 },
  "gemma-4-26b-a4b-it":            { input: 0,    output: 0 },
};

const TIERED_PRICING_MODELS = new Set<string>([
  "gemini-2.5-pro",
  "gemini-3.1-pro-preview",
]);

function isGemma(model: string): boolean {
  return model.startsWith("gemma-");
}

export type SystemPromptOutput =
  | { kind: "systemInstruction"; value: string }
  | { kind: "prepend"; value: string };

export function buildSystemPrompt(model: string, systemPrompt: string): SystemPromptOutput {
  if (isGemma(model)) {
    return { kind: "prepend", value: `System instructions:\n${systemPrompt}\n\n` };
  }
  return { kind: "systemInstruction", value: systemPrompt };
}

export function buildThinkingConfig(
  model: string,
  effort: string,
): { thinkingBudget: number } | { thinkingLevel: string } | undefined {
  if (isGemma(model)) return undefined;

  if (model.startsWith("gemini-3")) {
    // 3.x uses thinkingLevel (string). Empty/invalid → undefined.
    if (!effort) return undefined;
    return { thinkingLevel: effort };
  }

  // gemini-2.5-* uses thinkingBudget (number). -1 is dynamic/auto.
  const budget = Number.parseInt(effort, 10);
  if (!Number.isFinite(budget)) return undefined;
  return { thinkingBudget: budget };
}

export type PreparedPart =
  | { type: "text"; text: string }
  | { type: "image"; prepared: PreparedImage };

export async function preparePartsForGoogle(
  parts: ProviderContentPart[],
): Promise<PreparedPart[]> {
  const out: PreparedPart[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      out.push({ type: "text", text: part.text });
      continue;
    }
    const meta = await sharp(part.buffer).metadata();
    const prepared = await resizeForGoogle(
      part.buffer,
      meta.width ?? 0,
      meta.height ?? 0,
      part.mediaType,
    );
    out.push({ type: "image", prepared });
  }
  return out;
}

let singleton: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (singleton) return singleton;
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set");
  installProxyDispatcherOnce();
  singleton = new GoogleGenAI({ apiKey });
  return singleton;
}

function normalizeGoogleError(error: unknown, model: string): Error {
  if (!(error instanceof Error)) {
    return new Error(String(error));
  }
  const status = (error as { status?: number }).status;
  const cause = (error as { cause?: { code?: string } }).cause;
  const msg = error.message;

  // Transport / proxy — check first so a wrapped network error doesn't get
  // misclassified by downstream message regexes.
  if (cause?.code === "UND_ERR_CONNECT_TIMEOUT" || cause?.code === "UND_ERR_SOCKET") {
    return new Error(
      "Cannot reach Google API. If you need a proxy, set HTTPS_PROXY and restart.",
    );
  }

  // 429 or 400 RESOURCE_EXHAUSTED — both surface as quota/rate-limit UX.
  if (status === 429 || /rate.?limit/i.test(msg) || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return new Error(
      "Google free-tier rate limit hit. Wait or switch to a Gemini 2.5/3.x paid model.",
    );
  }

  // 400 token-limit — context exceeded.
  if (status === 400 && /token count|maximum.*tokens|context length/i.test(msg)) {
    return new Error(
      `Request exceeds Google context limit for model ${model}. Reduce input size or switch models.`,
    );
  }

  // 404 or NOT_FOUND — typical for a preview model that was renamed or deprecated.
  if (status === 404 || /not.?found/i.test(msg)) {
    return new Error(
      `Gemini preview model ${model} appears deprecated or replaced. Update the catalog model id.`,
    );
  }

  return error;
}

async function runGoogleTurn(input: ProviderTurnInput): Promise<ProviderTurnResult> {
  const { model } = input.selection;
  const client = getClient();
  const startedAt = Date.now();

  const systemOut = buildSystemPrompt(model, input.systemPrompt);
  const thinkingConfig = buildThinkingConfig(model, input.selection.effort);
  const prepared = await preparePartsForGoogle(input.content);

  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
  let didPrepend = false;
  for (const part of prepared) {
    if (part.type === "text") {
      let text = part.text;
      if (!didPrepend && systemOut.kind === "prepend") {
        text = systemOut.value + text;
        didPrepend = true;
      }
      parts.push({ text });
    } else {
      parts.push({
        inlineData: {
          data: part.prepared.buffer.toString("base64"),
          mimeType: part.prepared.mediaType,
        },
      });
    }
  }
  if (!didPrepend && systemOut.kind === "prepend") {
    parts.unshift({ text: systemOut.value });
  }

  const config: Record<string, unknown> = {};
  if (systemOut.kind === "systemInstruction") {
    config.systemInstruction = systemOut.value;
  }
  if (thinkingConfig) {
    config.thinkingConfig = thinkingConfig;
  }

  if (input.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  // Attach abort signal via config.abortSignal — @google/genai reads it from
  // there, not from a top-level field. Loop-level check below is a backstop.
  if (input.signal) {
    config.abortSignal = input.signal;
  }

  let stream;
  try {
    stream = await client.models.generateContentStream({
      model,
      contents: [{ role: "user", parts }],
      config: Object.keys(config).length > 0 ? config : undefined,
    });
  } catch (e) {
    throw normalizeGoogleError(e, model);
  }

  let text = "";
  let lastUsage: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  } | undefined;
  try {
    for await (const chunk of stream) {
      if (input.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      const delta = chunk.text ?? "";
      if (delta) {
        text += delta;
        await input.onEvent?.({ type: "text", text: delta });
      }
      if ((chunk as { usageMetadata?: typeof lastUsage }).usageMetadata) {
        lastUsage = (chunk as { usageMetadata?: typeof lastUsage }).usageMetadata;
      }
    }
  } catch (e) {
    // Let AbortError through untouched so callers can detect cancellation.
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw normalizeGoogleError(e, model);
  }

  const inputTokens = lastUsage?.promptTokenCount ?? 0;
  const outputTokens =
    (lastUsage?.candidatesTokenCount ?? 0) + (lastUsage?.thoughtsTokenCount ?? 0);
  const rate = COST_RATES[model] ?? { input: 0, output: 0 };
  const cost = (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;

  if (inputTokens > 200_000 && TIERED_PRICING_MODELS.has(model)) {
    console.warn(
      `[google-provider] ${model} request >200K context (${inputTokens} tokens). ` +
      `Cost under-reported at tier-1 rates.`,
    );
  }

  return {
    text,
    elapsed: Math.round((Date.now() - startedAt) / 1000),
    cost,
    usage: lastUsage
      ? { inputTokens, outputTokens }
      : null,
  };
}

export const googleProvider: ExtractModelProvider = {
  id: "google",
  run: runGoogleTurn,
};

export const __testHelpers = { isGemma };
