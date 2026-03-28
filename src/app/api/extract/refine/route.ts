import { NextRequest } from "next/server";
import { runRefinementLoop, type RefineEvent } from "@/lib/extract/refine";
import type { AnalysisResult, Proposal } from "@/components/extract/types";
import type { CropBounds } from "@/lib/render/crop";

export const runtime = "nodejs";

function isBounds(value: unknown): value is CropBounds {
  if (!value || typeof value !== "object") return false;
  const bounds = value as Partial<CropBounds>;
  return (
    typeof bounds.x === "number" &&
    typeof bounds.y === "number" &&
    typeof bounds.w === "number" &&
    typeof bounds.h === "number"
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const proposalsJson = formData.get("proposals") as string | null;
  const baseAnalysisJson = formData.get("baseAnalysis") as string | null;
  const contentBoundsJson = formData.get("contentBounds") as string | null;
  const model = (formData.get("model") as string) || "claude-opus-4-6";
  const effort = (formData.get("effort") as string) || "medium";
  const maxIterations = parseInt((formData.get("maxIterations") as string) || "10", 10) || 10;
  const mismatchThreshold =
    parseFloat((formData.get("mismatchThreshold") as string) || "0.05") || 0.05;

  if (!image || !proposalsJson || !baseAnalysisJson) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let proposals: Proposal[];
  let baseAnalysis: AnalysisResult;
  let contentBounds: CropBounds | null = null;
  try {
    proposals = JSON.parse(proposalsJson) as Proposal[];
    baseAnalysis = JSON.parse(baseAnalysisJson) as AnalysisResult;
    if (contentBoundsJson) {
      const parsed = JSON.parse(contentBoundsJson);
      contentBounds = isBounds(parsed) ? parsed : null;
    }
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runRefinementLoop({
          image: imageBuffer,
          imageMediaType: image.type || "image/png",
          proposals,
          baseAnalysis,
          contentBounds,
          model,
          effort,
          maxIterations,
          mismatchThreshold,
          signal: request.signal,
          onEvent(event: RefineEvent) {
            controller.enqueue(
              encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`),
            );
          },
        });
      } catch (error) {
        const isAborted = error instanceof Error && error.message === "REFINE_ABORTED";
        const event = isAborted ? "refine:aborted" : "refine:error";
        const data = isAborted
          ? {}
          : { error: error instanceof Error ? error.message : "Refinement failed" };
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      } finally {
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
