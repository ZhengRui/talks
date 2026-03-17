import { NextRequest, NextResponse } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "@/lib/extract/prompts";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const text = formData.get("text") as string | null;
  const slug = formData.get("slug") as string | null;

  if (!image) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  // Save image to temp location
  const tmpDir = join(process.cwd(), ".tmp", "extract");
  mkdirSync(tmpDir, { recursive: true });
  const ext = image.name.split(".").pop() || "png";
  const imageName = `screenshot-${randomUUID().slice(0, 8)}.${ext}`;
  const imagePath = join(tmpDir, imageName);
  const imageBuffer = Buffer.from(await image.arrayBuffer());
  writeFileSync(imagePath, imageBuffer);

  const analysisPrompt = buildAnalysisPrompt(imagePath, text, slug);

  try {
    let resultText = "";
    for await (const message of query({
      prompt: analysisPrompt,
      options: {
        cwd: process.cwd(),
        settingSources: ["project"],
        allowedTools: ["Read", "Glob"],
        maxTurns: 5,
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      },
    })) {
      const msg = message as Record<string, unknown>;

      if (msg.type === "assistant" && msg.message) {
        const assistantMsg = msg.message as Record<string, unknown>;
        if (Array.isArray(assistantMsg.content)) {
          for (const block of assistantMsg.content) {
            const b = block as Record<string, unknown>;
            if (b.type === "text" && typeof b.text === "string") {
              resultText += b.text;
            }
          }
        }
      }

      if (msg.type === "result" && typeof msg.result === "string") {
        resultText = msg.result;
      }
    }

    const jsonMatch =
      resultText.match(/```json\s*([\s\S]*?)\s*```/) ??
      resultText.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse analysis response", raw: resultText || "(empty)" },
        { status: 500 },
      );
    }

    const analysis = JSON.parse(jsonMatch[1]);
    analysis.source = {
      ...analysis.source,
      imagePath: `/api/extract/image?path=${encodeURIComponent(imagePath)}`,
    };

    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json(
      { error: `Analysis failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
