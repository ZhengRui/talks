import { NextRequest } from "next/server";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisPrompt,
} from "@/lib/extract/prompts";
import {
  createMockAnalysisResult,
  isMockProviderSelection,
} from "@/lib/extract/mock-provider";
import { normalizeAnalysisRegions } from "@/lib/extract/normalize-analysis";
import {
  getExtractModelProvider,
} from "@/lib/extract/providers/registry";
import {
  normalizeProviderSelection,
} from "@/lib/extract/providers/catalog";
import type { AnalysisStage, GeometryHints } from "@/components/extract/types";
import type { ProviderSelection } from "@/lib/extract/providers/shared";
import { extractJsonPayload } from "@/lib/extract/json-payload";

/** Infer media type from file extension. */
function inferMediaType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

/** Read actual image dimensions from a PNG/JPEG/WebP buffer. */
function readImageSize(buffer: Buffer): { w: number; h: number } | null {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          w: buffer.readUInt16BE(offset + 7),
          h: buffer.readUInt16BE(offset + 5),
        };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8 ") {
      return {
        w: buffer.readUInt16LE(26) & 0x3fff,
        h: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

export const runtime = "nodejs";
export const maxDuration = 120;

function logAnalyzeError(
  message: string,
  selection: { provider: string; model: string; effort: string },
  extra?: Record<string, unknown>,
): void {
  console.error("[extract/analyze]", {
    message,
    provider: selection.provider,
    model: selection.model,
    effort: selection.effort,
    ...extra,
  });
}

function formatAnalysisJsonError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Unexpected non-whitespace character after JSON")) {
    return "Model returned JSON followed by extra text.";
  }
  return "Model returned invalid JSON.";
}

function extractJsonErrorContext(payload: string, error: unknown, radius: number = 220): string {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/position (\d+)/);
  const position = match ? Number.parseInt(match[1] ?? "", 10) : Number.NaN;
  if (!Number.isFinite(position)) {
    return payload.slice(0, Math.min(payload.length, radius * 2));
  }

  const start = Math.max(0, position - radius);
  const end = Math.min(payload.length, position + radius);
  return payload.slice(start, end);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const text = formData.get("text") as string | null;
  const slug = formData.get("slug") as string | null;
  const geometryHintsJson = formData.get("geometryHints") as string | null;
  const selection = normalizeProviderSelection({
    provider: formData.get("provider") as string | null,
    model: formData.get("model") as string | null,
    effort: formData.get("effort") as string | null,
  });

  if (!image) {
    return new Response(JSON.stringify({ error: "No image provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const actualSize = readImageSize(imageBuffer);
  const mediaType = image.type || inferMediaType(image.name);
  let geometryHints: GeometryHints | null = null;
  if (geometryHintsJson) {
    try {
      geometryHints = JSON.parse(geometryHintsJson) as GeometryHints;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid geometryHints payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
  const analysisPrompt = buildAnalysisPrompt(text, slug, geometryHints);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const currentStage: AnalysisStage = "extract";

      function send(event: string, data: Record<string, unknown>, stage?: AnalysisStage | null) {
        const payload = stage ? { ...data, stage } : data;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
        );
      }

      try {
        send("prompt", {
          phase: "extract",
          systemPrompt: ANALYSIS_SYSTEM_PROMPT,
          userPrompt: analysisPrompt,
          provider: selection.provider,
          model: selection.model,
          effort: selection.effort,
        }, "extract");

        if (isMockProviderSelection(selection)) {
          const dimensions = actualSize ?? { w: 1280, h: 720 };
          const mockAnalysis = createMockAnalysisResult({
            description: text,
            slug,
            dimensions,
          });

          send("status", {
            message: "Session started (extract) — Mock · local stub",
          }, "extract");
          send("thinking", {
            text: "Skipping model execution and returning a deterministic local extract result.",
          }, "extract");
          send("text", {
            text: "Mock provider response ready.",
          }, "extract");
          send("result", {
            ...mockAnalysis,
            prompt: {
              phase: "extract",
              systemPrompt: ANALYSIS_SYSTEM_PROMPT,
              userPrompt: analysisPrompt,
              provider: selection.provider,
              model: selection.model,
              effort: selection.effort,
            },
            provenance: {
              pass1: {
                provider: selection.provider,
                model: selection.model,
                effort: selection.effort,
                elapsed: 0,
                cost: 0,
                usage: null,
              },
            },
          }, "extract");
          controller.close();
          return;
        }

        send("status", { message: "Starting analysis..." }, "extract");
        const provider = getExtractModelProvider(selection);
        const pass1Result = await provider.run({
          phase: "extract",
          systemPrompt: ANALYSIS_SYSTEM_PROMPT,
          userPrompt: analysisPrompt,
          content: [
            {
              type: "image",
              buffer: imageBuffer,
              mediaType,
              fileName: image.name,
            },
            {
              type: "text",
              text: analysisPrompt,
            },
          ],
          selection,
          signal: request.signal,
          async onEvent(event) {
            switch (event.type) {
              case "status":
                send("status", { message: event.message ?? "" }, "extract");
                break;
              case "thinking":
                send("thinking", { text: event.text ?? "", streamKey: event.streamKey }, "extract");
                break;
              case "text":
                send("text", { text: event.text ?? "", streamKey: event.streamKey }, "extract");
                break;
              case "tool":
                send("tool", { name: event.name, input: event.input }, "extract");
                break;
              case "tool_result":
                send("tool_result", { preview: event.preview ?? "(empty)" }, "extract");
                break;
            }
          },
        });

        send("status", {
          message: "Done (extract)",
          cost: pass1Result.cost,
          inputTokens: pass1Result.usage?.inputTokens,
          outputTokens: pass1Result.usage?.outputTokens,
        }, "extract");

        const rawResultText = pass1Result.text || "(empty)";
        const pass1Json = extractJsonPayload(rawResultText);
        if (!pass1Json) {
          const rawPreview = rawResultText.slice(0, 4000);
          logAnalyzeError("Model did not return a JSON payload", selection, {
            rawPreview,
          });
          send("error", {
            error: "Model did not return a JSON payload.",
            raw: rawPreview,
          }, "extract");
          controller.close();
          return;
        }

        let pass1Parsed: Record<string, unknown>;
        try {
          pass1Parsed = JSON.parse(pass1Json) as Record<string, unknown>;
        } catch (error) {
          const rawPreview = extractJsonErrorContext(pass1Json, error);
          logAnalyzeError("Model returned invalid JSON payload", selection, {
            parseError: error instanceof Error ? error.message : String(error),
            rawPreview,
          });
          send("error", {
            error: formatAnalysisJsonError(error),
            raw: rawPreview,
          }, "extract");
          controller.close();
          return;
        }

        const analysis = normalizeAnalysisRegions(pass1Parsed, actualSize);

        send("result", {
          ...pass1Parsed,
          normalizedAnalysis: analysis,
          prompt: {
            phase: "extract",
            systemPrompt: ANALYSIS_SYSTEM_PROMPT,
            userPrompt: analysisPrompt,
            provider: selection.provider,
            model: selection.model,
            effort: selection.effort,
          },
          provenance: {
            pass1: {
              provider: selection.provider,
              model: selection.model,
              effort: selection.effort,
              elapsed: pass1Result.elapsed,
              cost: pass1Result.cost,
              usage: pass1Result.usage,
            },
          },
        }, "extract");
        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logAnalyzeError(errorMessage, selection);
        send("error", {
          error: `Analysis failed: ${errorMessage}`,
        }, currentStage);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
