import { NextRequest, NextResponse } from "next/server";
import { exportPptx } from "@/lib/export/pptx";
import type { LayoutPresentation } from "@/lib/layout/types";

export async function POST(request: NextRequest) {
  try {
    const layout = (await request.json()) as LayoutPresentation;

    if (!layout.slides || !Array.isArray(layout.slides)) {
      return NextResponse.json(
        { error: "Invalid layout: missing slides array" },
        { status: 400 },
      );
    }

    const buffer = await exportPptx(layout);
    const uint8 = new Uint8Array(buffer);

    const title = layout.title || "presentation";
    // RFC 5987: use filename* with UTF-8 encoding for non-ASCII characters
    const safeFilename = title.replace(/[^\w\s.-]/g, "_") + ".pptx";
    const utf8Filename = encodeURIComponent(title + ".pptx");

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${utf8Filename}`,
      },
    });
  } catch (err) {
    console.error("PPTX export error:", err);
    return NextResponse.json(
      { error: "Failed to generate PPTX" },
      { status: 500 },
    );
  }
}
