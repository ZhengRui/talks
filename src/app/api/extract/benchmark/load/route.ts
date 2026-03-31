import { NextRequest, NextResponse } from "next/server";
import { loadBenchmarkSlide } from "@/lib/extract/benchmark";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request: malformed JSON body" },
      { status: 400 },
    );
  }

  const slug = typeof (body as { slug?: unknown }).slug === "string"
    ? (body as { slug: string }).slug
    : null;
  const slideIndex = (body as { slideIndex?: unknown }).slideIndex;

  if (!slug || typeof slideIndex !== "number") {
    return NextResponse.json(
      { error: "Invalid request: slug and slideIndex are required" },
      { status: 400 },
    );
  }

  try {
    const payload = await loadBenchmarkSlide(slug, slideIndex, {
      assetBaseUrl: `${request.nextUrl.origin}/`,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load benchmark slide" },
      { status: 400 },
    );
  }
}
