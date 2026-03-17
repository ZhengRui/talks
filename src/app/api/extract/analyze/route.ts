import { NextRequest } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "@/lib/extract/prompts";
import { normalizeAnalysisRegions } from "@/lib/extract/normalize-analysis";

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
        return { w: buffer.readUInt16BE(offset + 7), h: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  // WebP RIFF: VP8 chunk at offset 12
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8 ") {
      return { w: buffer.readUInt16LE(26) & 0x3fff, h: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const text = formData.get("text") as string | null;
  const slug = formData.get("slug") as string | null;

  if (!image) {
    return new Response(JSON.stringify({ error: "No image provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Save image to temp location
  const tmpDir = join(process.cwd(), ".tmp", "extract");
  mkdirSync(tmpDir, { recursive: true });
  const ext = image.name.split(".").pop() || "png";
  const imageName = `screenshot-${randomUUID().slice(0, 8)}.${ext}`;
  const imagePath = join(tmpDir, imageName);
  const imageBuffer = Buffer.from(await image.arrayBuffer());
  writeFileSync(imagePath, imageBuffer);

  const actualSize = readImageSize(imageBuffer);
  // Don't tell Claude the actual dimensions — let it report what it perceives.
  // The normalization step will rescale from Claude's perceived space to actual pixels.
  const analysisPrompt = buildAnalysisPrompt(imagePath, text, slug);

  // Stream SSE events to the client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        let resultText = "";
        send("status", { message: "Starting analysis..." });

        for await (const message of query({
          prompt: analysisPrompt,
          options: {
            cwd: process.cwd(),
            settingSources: ["project"],
            allowedTools: ["Read", "Glob"],
            maxTurns: 5,
            systemPrompt: ANALYSIS_SYSTEM_PROMPT,
            includePartialMessages: true,
            // Use Claude Code subscription auth, not API key
            pathToClaudeCodeExecutable: "/Users/zerry/.local/bin/claude",
            env: { ...process.env, ANTHROPIC_API_KEY: "" },
          },
        })) {
          const msg = message as Record<string, unknown>;

          // Token-by-token streaming deltas
          if (msg.type === "stream_event") {
            const event = msg.event as Record<string, unknown> | undefined;
            if (event?.type === "content_block_delta") {
              const delta = event.delta as Record<string, unknown> | undefined;
              if (delta?.type === "text_delta" && typeof delta.text === "string") {
                resultText += delta.text;
                send("text", { text: delta.text });
              } else if (delta?.type === "thinking_delta" && typeof delta.thinking === "string") {
                send("thinking", { text: delta.thinking });
              }
            }
            continue;
          }

          // Complete assistant messages (tool calls + thinking blocks)
          if (msg.type === "assistant" && msg.message) {
            const assistantMsg = msg.message as Record<string, unknown>;
            if (Array.isArray(assistantMsg.content)) {
              for (const block of assistantMsg.content) {
                const b = block as Record<string, unknown>;
                if (b.type === "tool_use") {
                  send("tool", { name: b.name, input: b.input });
                } else if (b.type === "thinking" && typeof b.thinking === "string") {
                  // Fallback: complete thinking block if not streamed
                  send("thinking", { text: b.thinking });
                }
              }
            }
          }

          // Tool results — extract the actual content
          if (msg.type === "user") {
            const userMsg = msg.message as Record<string, unknown> | undefined;
            if (Array.isArray(userMsg?.content)) {
              for (const block of userMsg.content) {
                const b = block as Record<string, unknown>;
                if (b.type === "tool_result") {
                  const content = b.content as string | Array<Record<string, unknown>> | undefined;
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
                  send("tool_result", { preview: preview || "(empty)" });
                }
              }
            }
          }

          // Final result
          if (msg.type === "result") {
            if (typeof msg.result === "string") {
              resultText = msg.result;
            }
            const usage = msg.usage as Record<string, number> | undefined;
            send("status", {
              message: `Done (${msg.subtype})`,
              turns: msg.num_turns,
              cost: msg.total_cost_usd,
              inputTokens: usage?.input_tokens,
              outputTokens: usage?.output_tokens,
            });
          }
        }

        // Parse JSON from collected text
        const jsonMatch =
          resultText.match(/```json\s*([\s\S]*?)\s*```/) ??
          resultText.match(/(\{[\s\S]*\})/);

        if (!jsonMatch) {
          send("error", { error: "Failed to parse analysis response", raw: resultText || "(empty)" });
          controller.close();
          return;
        }

        const parsedAnalysis = JSON.parse(jsonMatch[1]);
        const analysis = normalizeAnalysisRegions(parsedAnalysis, actualSize);
        analysis.source = {
          ...analysis.source,
          imagePath: `/api/extract/image?path=${encodeURIComponent(imagePath)}`,
        };

        send("result", analysis);
        controller.close();
      } catch (error) {
        send("error", {
          error: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        });
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
