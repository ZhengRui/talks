// Requires GEMINI_API_KEY (or GOOGLE_API_KEY) in the process env.
// If HTTPS_PROXY / HTTP_PROXY is set, traffic is routed via that proxy
// (undici's global fetch ignores proxy env vars by default).
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { setGlobalDispatcher, ProxyAgent } from "undici";
import { box2dToPixelBbox, type BBox } from "@/lib/extract/gemma-bbox";

const proxyUrl =
  process.env.HTTPS_PROXY ??
  process.env.https_proxy ??
  process.env.HTTP_PROXY ??
  process.env.http_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_PROMPT = `Analyze this slide image. Return strict JSON with this exact shape:

{
  "overall_description": "one-paragraph summary of the slide",
  "elements": [
    {
      "box_2d": [y1, x1, y2, x2],
      "label": "short noun phrase",
      "description": "one sentence about this element"
    }
  ]
}

Coordinates are normalized to 1000x1000 relative to the input image.
Detect every distinct UI element: text blocks, headings, icons, shapes,
images, buttons, background panels.
Return ONLY the JSON, no prose, no code fences.`;

type GemmaElement = {
  box_2d: [number, number, number, number];
  label: string;
  description: string;
};

type GemmaResponse = {
  overall_description: string;
  elements: GemmaElement[];
};

type DetectElement = {
  label: string;
  description: string;
  bbox: BBox;
  raw_box_2d: [number, number, number, number];
};

export type DetectResponse = {
  overall: string;
  elements: DetectElement[];
  imageWidth: number;
  imageHeight: number;
  raw: unknown;
};

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  return trimmed;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY (or GOOGLE_API_KEY) is not set" },
      { status: 500 },
    );
  }

  const form = await req.formData();
  const file = form.get("image");
  const model = (form.get("model") as string) || "gemma-4-31b-it";
  const prompt = (form.get("prompt") as string) || DEFAULT_PROMPT;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "image file is required" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "image too large (>20MB)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(buffer).metadata();
  const imageWidth = meta.width ?? 0;
  const imageHeight = meta.height ?? 0;
  if (!imageWidth || !imageHeight) {
    return NextResponse.json({ error: "could not read image dimensions" }, { status: 400 });
  }

  // Downscale to max 1920px on the longer edge before sending.
  // Gemma's vision encoder doesn't benefit past ~1536px, and smaller payloads
  // dramatically reduce round-trip time through proxies.
  const MAX_EDGE = 1920;
  const longerEdge = Math.max(imageWidth, imageHeight);
  const sentBuffer =
    longerEdge > MAX_EDGE
      ? await sharp(buffer)
          .resize({
            width: imageWidth >= imageHeight ? MAX_EDGE : undefined,
            height: imageHeight > imageWidth ? MAX_EDGE : undefined,
            fit: "inside",
          })
          .png()
          .toBuffer()
      : buffer;

  const client = new GoogleGenAI({ apiKey });
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        const stream = await client.models.generateContentStream({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { data: sentBuffer.toString("base64"), mimeType: "image/png" } },
                { text: prompt },
              ],
            },
          ],
        });

        let text = "";
        for await (const chunk of stream) {
          const delta = chunk.text ?? "";
          if (!delta) continue;
          text += delta;
          send({ type: "partial", text });
        }

        let parsed: GemmaResponse;
        try {
          parsed = JSON.parse(stripCodeFence(text)) as GemmaResponse;
        } catch {
          send({ type: "error", error: "Gemma did not return parseable JSON", raw: text });
          controller.close();
          return;
        }

        const elements: DetectElement[] = (parsed.elements ?? []).map((el) => ({
          label: el.label,
          description: el.description,
          bbox: box2dToPixelBbox(el.box_2d, imageWidth, imageHeight),
          raw_box_2d: el.box_2d,
        }));

        const done: DetectResponse & { type: "done" } = {
          type: "done",
          overall: parsed.overall_description ?? "",
          elements,
          imageWidth,
          imageHeight,
          raw: parsed,
        };
        send(done);
        controller.close();
      } catch (e) {
        send({ type: "error", error: e instanceof Error ? e.message : String(e) });
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
