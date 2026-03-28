import { NextRequest, NextResponse } from "next/server";
import type { LayoutSlide } from "@/lib/layout/types";
import { renderSlideToImage } from "@/lib/render/screenshot";
import type { RenderFit } from "@/lib/render/html";

export const runtime = "nodejs";

const RENDER_FITS = new Set<RenderFit>(["contain", "cover", "stretch"]);
const IMAGE_FORMATS = new Set(["png", "jpeg"] as const);

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isReasonableDeviceScaleFactor(value: unknown): value is number {
  return isPositiveFiniteNumber(value) && value <= 4;
}

function isSafeCssValue(value: string): boolean {
  return !value.includes("<");
}

function isLayoutSlide(value: unknown): value is LayoutSlide {
  if (!value || typeof value !== "object") return false;
  const slide = value as Partial<LayoutSlide>;
  return (
    isPositiveFiniteNumber(slide.width) &&
    isPositiveFiniteNumber(slide.height) &&
    typeof slide.background === "string" &&
    Array.isArray(slide.elements)
  );
}

function parseAssetBaseUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("assetBaseUrl must be a string");

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("assetBaseUrl must be a valid absolute URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("assetBaseUrl must use http or https");
  }

  return parsed.toString();
}

async function parseJsonBody(request: NextRequest): Promise<
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse }
> {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid request: failed to read request body" },
        { status: 400 },
      ),
    };
  }

  try {
    return {
      ok: true,
      body: JSON.parse(rawBody),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid request: malformed JSON body" },
          { status: 400 },
        ),
      };
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) {
      return parsed.response;
    }

    const body = parsed.body;
    const {
      slide,
      width,
      height,
      fit,
      background,
      format,
      deviceScaleFactor,
      assetBaseUrl,
    } = body as {
      slide?: LayoutSlide;
      width?: number;
      height?: number;
      fit?: RenderFit;
      background?: string;
      format?: "png" | "jpeg";
      deviceScaleFactor?: number;
      assetBaseUrl?: string;
    };

    if (!isLayoutSlide(slide)) {
      return NextResponse.json(
        { error: "Invalid request: missing or malformed slide" },
        { status: 400 },
      );
    }

    if (width !== undefined && !isPositiveFiniteNumber(width)) {
      return NextResponse.json(
        { error: "Invalid request: width must be a positive finite number" },
        { status: 400 },
      );
    }

    if (height !== undefined && !isPositiveFiniteNumber(height)) {
      return NextResponse.json(
        { error: "Invalid request: height must be a positive finite number" },
        { status: 400 },
      );
    }

    if (fit !== undefined && !RENDER_FITS.has(fit)) {
      return NextResponse.json(
        { error: "Invalid request: fit must be contain, cover, or stretch" },
        { status: 400 },
      );
    }

    if (background !== undefined && typeof background !== "string") {
      return NextResponse.json(
        { error: "Invalid request: background must be a string" },
        { status: 400 },
      );
    }

    if (background !== undefined && !isSafeCssValue(background)) {
      return NextResponse.json(
        { error: "Invalid request: background contains unsafe characters" },
        { status: 400 },
      );
    }

    if (!isSafeCssValue(slide.background)) {
      return NextResponse.json(
        { error: "Invalid request: slide background contains unsafe characters" },
        { status: 400 },
      );
    }

    if (format !== undefined && !IMAGE_FORMATS.has(format)) {
      return NextResponse.json(
        { error: "Invalid request: format must be png or jpeg" },
        { status: 400 },
      );
    }

    if (
      deviceScaleFactor !== undefined &&
      !isReasonableDeviceScaleFactor(deviceScaleFactor)
    ) {
      return NextResponse.json(
        { error: "Invalid request: deviceScaleFactor must be a positive finite number <= 4" },
        { status: 400 },
      );
    }

    let normalizedAssetBaseUrl: string | null;
    try {
      normalizedAssetBaseUrl = parseAssetBaseUrl(assetBaseUrl);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid assetBaseUrl" },
        { status: 400 },
      );
    }

    const buf = await renderSlideToImage(slide, {
      width,
      height,
      fit,
      background,
      format,
      deviceScaleFactor,
      assetBaseUrl: normalizedAssetBaseUrl ?? undefined,
    });

    const contentType = format === "jpeg" ? "image/jpeg" : "image/png";

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[render] route failure:", error);
    return NextResponse.json(
      { error: "Failed to render slide" },
      { status: 500 },
    );
  }
}
