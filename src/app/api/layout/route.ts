import { NextRequest, NextResponse } from "next/server";
import { loadPresentation } from "@/lib/loadPresentation";
import { layoutPresentation } from "@/lib/layout";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  if (!slug) {
    return NextResponse.json(
      { error: "Missing 'slug' query parameter" },
      { status: 400 },
    );
  }

  try {
    const data = loadPresentation(slug);
    const imageBase = `/${slug}`;
    const layout = layoutPresentation(
      data.title,
      data.slides,
      data.theme,
      imageBase,
      data.author,
    );
    return NextResponse.json(layout);
  } catch {
    return NextResponse.json(
      { error: `Presentation '${slug}' not found` },
      { status: 404 },
    );
  }
}
