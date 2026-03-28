import { NextRequest, NextResponse } from "next/server";
import { getRefineArtifact } from "@/lib/extract/refine-artifacts";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  const { artifactId } = await params;
  const artifact = getRefineArtifact(artifactId);

  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(artifact.buffer), {
    headers: {
      "Content-Type": artifact.contentType,
      "Cache-Control": "private, max-age=600",
    },
  });
}
