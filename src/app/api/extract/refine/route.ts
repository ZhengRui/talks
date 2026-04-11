import { NextRequest } from "next/server";
import { runRefinementLoop, type RefineEvent } from "@/lib/extract/refine";
import type { AnalysisResult, GeometryHints, Proposal } from "@/components/extract/types";
import type { CropBounds } from "@/lib/render/crop";
import { normalizeProviderSelection } from "@/lib/extract/providers/catalog";

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
  const geometryHintsJson = formData.get("geometryHints") as string | null;
  const watchlistIssuesJson = formData.get("watchlistIssuesJson") as string | null;
  const visionSelection = normalizeProviderSelection({
    provider: formData.get("visionProvider") as string | null,
    model: formData.get("visionModel") as string | null,
    effort: formData.get("visionEffort") as string | null,
  });
  const editSelection = normalizeProviderSelection({
    provider: formData.get("editProvider") as string | null,
    model: formData.get("editModel") as string | null,
    effort: formData.get("editEffort") as string | null,
  });
  const maxIterations = parseInt((formData.get("maxIterations") as string) || "4", 10) || 4;
  const iterationOffset =
    parseInt((formData.get("iterationOffset") as string) || "0", 10) || 0;
  const mismatchThreshold =
    parseFloat((formData.get("mismatchThreshold") as string) || "0.05") || 0.05;
  const forceIterations = formData.get("forceIterations") === "1";

  if (!image || !proposalsJson || !baseAnalysisJson) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let proposals: Proposal[];
  let baseAnalysis: AnalysisResult;
  let contentBounds: CropBounds | null = null;
  let geometryHints: GeometryHints | null = null;
  try {
    proposals = JSON.parse(proposalsJson) as Proposal[];
    baseAnalysis = JSON.parse(baseAnalysisJson) as AnalysisResult;
    if (contentBoundsJson) {
      const parsed = JSON.parse(contentBoundsJson);
      contentBounds = isBounds(parsed) ? parsed : null;
    }
    if (geometryHintsJson) {
      geometryHints = JSON.parse(geometryHintsJson) as GeometryHints;
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
          geometryHints,
          watchlistIssuesJson,
          visionSelection,
          editSelection,
          maxIterations,
          mismatchThreshold,
          iterationOffset,
          forceIterations,
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
