import { NextRequest } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisPrompt,
} from "@/lib/extract/prompts";
import {
  createMockAnalysisResult,
  isMockClaudeModel,
} from "@/lib/extract/mock-claude";
import { normalizeAnalysisRegions } from "@/lib/extract/normalize-analysis";
import type { AnalysisStage, GeometryHints } from "@/components/extract/types";

/** Infer media type from file extension. */
function inferMediaType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

/** Read actual image dimensions from a PNG/JPEG/WebP buffer. */
function readImageSize(buffer: Buffer): { w: number; h: number } | null {
  // PNG: bytes 16-23 contain width (4 bytes) and height (4 bytes) in IHDR
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
  }
  // JPEG: scan for SOF0/SOF2 markers (0xFFC0/0xFFC2)
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
  // WebP RIFF: VP8 chunk at offset 12
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

export const maxDuration = 120;

function extractJsonPayload(resultText: string): string | null {
  const jsonMatch =
    resultText.match(/```json\s*([\s\S]*?)\s*```/) ??
    resultText.match(/(\{[\s\S]*\})/);
  return jsonMatch?.[1] ?? null;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const text = formData.get("text") as string | null;
  const slug = formData.get("slug") as string | null;
  const geometryHintsJson = formData.get("geometryHints") as string | null;
  const model = (formData.get("model") as string) || "claude-opus-4-6";
  const effort = (formData.get("effort") as string) || "low";

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

  async function* makePrompt(promptText: string) {
    yield {
      type: "user" as const,
      session_id: "",
      message: {
        role: "user" as const,
        content: [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: mediaType,
              data: imageBuffer.toString("base64"),
            },
          },
          { type: "text" as const, text: promptText },
        ],
      },
      parent_tool_use_id: null,
    };
  }

  // Stream SSE events to the client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const currentStage: AnalysisStage = "extract";

      function send(event: string, data: Record<string, unknown>, stage?: AnalysisStage | null) {
        const payload = stage ? { ...data, stage } : data;
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
          ),
        );
      }

      try {
        send("prompt", {
          phase: "extract",
          systemPrompt: ANALYSIS_SYSTEM_PROMPT,
          userPrompt: analysisPrompt,
          model,
          effort,
        }, "extract");

        if (isMockClaudeModel(model)) {
          const dimensions = actualSize ?? { w: 1280, h: 720 };
          const mockAnalysis = createMockAnalysisResult({
            description: text,
            slug,
            dimensions,
          });

          send("status", {
            message: "Session started (extract) — Mock Claude · local stub",
          }, "extract");
          send("thinking", {
            text: "Skipping Claude and returning a deterministic local extract result.",
          }, "extract");
          send("text", {
            text: "Mock Claude response ready.",
          }, "extract");
          send("result", {
            ...mockAnalysis,
            provenance: {
              pass1: {
                model,
                effort,
                elapsed: 0,
                cost: 0,
              },
            },
          }, "extract");
          controller.close();
          return;
        }

        function buildQueryOptions(
          systemPrompt: string,
          passModel: string = model,
          passEffort: string = effort,
        ): import("@anthropic-ai/claude-agent-sdk").Options {
          const isAdaptive = passModel === "claude-opus-4-6" || passModel === "claude-sonnet-4-6";
          const thinkingConfig = isAdaptive
            ? { type: "adaptive" as const }
            : { type: "enabled" as const, budget_tokens: parseInt(passEffort, 10) || 10000 };
          const effortConfig = isAdaptive
            ? (passEffort as "low" | "medium" | "high" | "max")
            : undefined;
          return {
            cwd: process.cwd(),
            settingSources: ["project"],
            allowedTools: [],
            maxTurns: 1,
            model: passModel,
            thinking: thinkingConfig,
            ...(effortConfig ? { effort: effortConfig } : {}),
            systemPrompt,
            includePartialMessages: true,
            persistSession: false,
            // Use Claude Code subscription auth, not API key
            pathToClaudeCodeExecutable: "/Users/zerry/.local/bin/claude",
            env: { ...process.env, ANTHROPIC_API_KEY: "" },
          };
        }

        async function runPass(
          passLabel: string,
          promptText: string,
          systemPrompt: string,
          stage: AnalysisStage,
          passModel: string = model,
          passEffort: string = effort,
        ): Promise<{ text: string; elapsed: number; cost: number | null }> {
          let resultText = "";
          let totalCost: number | null = null;
          let sawThinkingDeltaForAssistant = false;
          const startedAt = Date.now();
          const queryOptions = buildQueryOptions(systemPrompt, passModel, passEffort);

          for await (const message of query({
            prompt: makePrompt(promptText),
            options: queryOptions,
          })) {
            const msg = message as Record<string, unknown>;

            if (msg.type === "system" && msg.subtype === "init") {
              const sessionModel = msg.model as string | undefined;
              send("status", {
                message: `Session started (${passLabel}) — ${(sessionModel ?? "unknown").replace("claude-", "")} · ${queryOptions.thinking?.type ?? "default"} · ${queryOptions.effort ?? effort}`,
              }, stage);
              continue;
            }

            if (msg.type === "stream_event") {
              const event = msg.event as Record<string, unknown> | undefined;
              if (event?.type === "content_block_delta") {
                const delta = event.delta as Record<string, unknown> | undefined;
                if (
                  delta?.type === "text_delta" &&
                  typeof delta.text === "string"
                ) {
                  resultText += delta.text;
                  send("text", { text: delta.text }, stage);
                } else if (
                  delta?.type === "thinking_delta" &&
                  typeof delta.thinking === "string"
                ) {
                  sawThinkingDeltaForAssistant = true;
                  send("thinking", { text: delta.thinking }, stage);
                }
              }
              continue;
            }

            if (msg.type === "assistant" && msg.message) {
              const assistantMsg = msg.message as Record<string, unknown>;
              if (Array.isArray(assistantMsg.content)) {
                for (const block of assistantMsg.content) {
                  const b = block as Record<string, unknown>;
                  if (b.type === "tool_use") {
                    send("tool", { name: b.name, input: b.input }, stage);
                  } else if (
                    b.type === "thinking" &&
                    typeof b.thinking === "string"
                  ) {
                    if (!sawThinkingDeltaForAssistant) {
                      send("thinking", { text: b.thinking }, stage);
                    }
                  }
                }
              }
              sawThinkingDeltaForAssistant = false;
            }

            if (msg.type === "user") {
              const userMsg = msg.message as Record<string, unknown> | undefined;
              if (Array.isArray(userMsg?.content)) {
                for (const block of userMsg.content) {
                  const b = block as Record<string, unknown>;
                  if (b.type === "tool_result") {
                    const content = b.content as
                      | string
                      | Array<Record<string, unknown>>
                      | undefined;
                    let preview = "";
                    if (typeof content === "string") {
                      preview = content.slice(0, 200);
                    } else if (Array.isArray(content)) {
                      for (const c of content) {
                        if (c.type === "text" && typeof c.text === "string") {
                          preview = c.text.slice(0, 200);
                          break;
                        }
                      }
                    }
                    send("tool_result", { preview: preview || "(empty)" }, stage);
                  }
                }
              }
            }

            if (msg.type === "result") {
              if (typeof msg.result === "string") {
                resultText = msg.result;
              }
              const usage = msg.usage as Record<string, number> | undefined;
              totalCost =
                typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : null;
              send("status", {
                message: `Done (${passLabel} / ${msg.subtype})`,
                turns: msg.num_turns,
                cost: msg.total_cost_usd,
                inputTokens: usage?.input_tokens,
                outputTokens: usage?.output_tokens,
              }, stage);
            }
          }

          return {
            text: resultText,
            elapsed: Math.round((Date.now() - startedAt) / 1000),
            cost: totalCost,
          };
        }

        send("status", {
          message: "Starting analysis...",
        }, "extract");
        const pass1Result = await runPass(
          "extract",
          analysisPrompt,
          ANALYSIS_SYSTEM_PROMPT,
          "extract",
        );
        const pass1Text = pass1Result.text;
        const pass1Json = extractJsonPayload(pass1Text);
        if (!pass1Json) {
          send("error", {
            error: "Failed to parse analysis response",
            raw: pass1Text || "(empty)",
          }, "extract");
          controller.close();
          return;
        }

        const pass1Parsed = JSON.parse(pass1Json) as Record<string, unknown>;
        const analysis = normalizeAnalysisRegions(pass1Parsed, actualSize);

        send("result", {
          ...analysis,
          prompt: {
            phase: "extract",
            systemPrompt: ANALYSIS_SYSTEM_PROMPT,
            userPrompt: analysisPrompt,
            model,
            effort,
          },
          provenance: {
            pass1: {
              model,
              effort,
              elapsed: pass1Result.elapsed,
              cost: pass1Result.cost,
            },
          },
        }, "extract");
        controller.close();
      } catch (error) {
        send("error", {
          error: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
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
