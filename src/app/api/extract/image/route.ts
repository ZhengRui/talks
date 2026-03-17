import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath || !existsSync(filePath)) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // Security: only serve files from our .tmp directory
  const cwd = process.cwd();
  if (!filePath.startsWith(cwd + "/.tmp/")) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const buffer = readFileSync(filePath);
  const ext = filePath.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "webp"
        ? "image/webp"
        : "image/png";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
