"use client";

import { useEffect, useRef, useState } from "react";

type BBox = { x: number; y: number; width: number; height: number };
type DetectElement = {
  label: string;
  description: string;
  bbox: BBox;
  raw_box_2d: [number, number, number, number];
};
type DetectResponse = {
  overall: string;
  elements: DetectElement[];
  imageWidth: number;
  imageHeight: number;
  raw: unknown;
};

type ModelId = "gemma-4-31b-it" | "gemma-4-26b-a4b-it";

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

export default function GemmaTestPage() {
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [model, setModel] = useState<ModelId>("gemma-4-31b-it");
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [result, setResult] = useState<DetectResponse | null>(null);
  const [streamingText, setStreamingText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            setImageBlob(file);
            setResult(null);
            setError(null);
          }
          break;
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, []);

  useEffect(() => {
    if (!imageBlob) {
      setImageBitmap(null);
      return;
    }
    let cancelled = false;
    createImageBitmap(imageBlob).then((bmp) => {
      if (!cancelled) setImageBitmap(bmp);
    });
    return () => {
      cancelled = true;
    };
  }, [imageBlob]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageBitmap) return;
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(imageBitmap, 0, 0);

    if (!result) return;
    const palette = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
    ctx.font = "16px sans-serif";
    ctx.textBaseline = "top";
    result.elements.forEach((el, i) => {
      const color = palette[i % palette.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(el.bbox.x, el.bbox.y, el.bbox.width, el.bbox.height);
      const tag = `${i + 1}`;
      const padding = 4;
      const metrics = ctx.measureText(tag);
      ctx.fillStyle = color;
      ctx.fillRect(el.bbox.x, el.bbox.y, metrics.width + padding * 2, 22);
      ctx.fillStyle = "#fff";
      ctx.fillText(tag, el.bbox.x + padding, el.bbox.y + 3);
    });
  }, [imageBitmap, result]);

  async function handleRun() {
    if (!imageBlob) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setStreamingText("");
    try {
      const fd = new FormData();
      fd.append("image", imageBlob, "slide.png");
      fd.append("model", model);
      fd.append("prompt", prompt);
      const res = await fetch("/api/gemma-detect", { method: "POST", body: fd });
      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line) as
            | { type: "partial"; text: string }
            | ({ type: "done" } & DetectResponse)
            | { type: "error"; error: string; raw?: string };
          if (msg.type === "partial") {
            setStreamingText(msg.text);
          } else if (msg.type === "done") {
            setResult(msg);
          } else if (msg.type === "error") {
            throw new Error(msg.error + (msg.raw ? `\n\nRaw: ${msg.raw}` : ""));
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Gemma 4 UI Detection Test</h1>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ModelId)}
          className="border border-zinc-700 bg-zinc-900 rounded px-2 py-1 text-sm"
        >
          <option value="gemma-4-31b-it">gemma-4-31b-it</option>
          <option value="gemma-4-26b-a4b-it">gemma-4-26b-a4b-it</option>
        </select>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageBlob(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          onClick={handleRun}
          disabled={!imageBlob || loading}
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50 disabled:hover:bg-blue-600"
        >
          {loading ? "Running…" : "Run"}
        </button>
        <span className="text-xs text-zinc-500">Tip: Cmd+V to paste an image</span>
      </header>

      {error && (
        <div className="text-red-400 text-sm whitespace-pre-wrap bg-red-950/30 border border-red-900 rounded p-2">
          {error}
        </div>
      )}

      <details className="border border-zinc-800 bg-zinc-900 rounded p-2 text-sm">
        <summary className="cursor-pointer font-medium">
          Prompt ({prompt.length} chars)
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setPrompt(DEFAULT_PROMPT);
            }}
            className="ml-3 text-xs text-blue-400 underline"
          >
            reset
          </button>
        </summary>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={12}
          className="w-full mt-2 p-2 border border-zinc-700 bg-zinc-950 text-zinc-100 rounded font-mono text-xs"
        />
      </details>

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="border border-zinc-800 rounded p-2 overflow-auto bg-zinc-900">
          <canvas ref={canvasRef} className="max-w-full h-auto block" />
        </div>
        <div className="border border-zinc-800 bg-zinc-900 rounded p-3 overflow-auto flex flex-col gap-4">
          {!result && !streamingText && (
            <div className="text-zinc-500 text-sm">Run detection to see results</div>
          )}

          {loading && streamingText && !result && (
            <section>
              <h2 className="font-semibold text-sm mb-1 text-zinc-300">
                Streaming… ({streamingText.length} chars)
              </h2>
              <pre className="text-xs bg-zinc-950 border border-zinc-800 text-zinc-300 p-2 rounded overflow-auto max-h-96 whitespace-pre-wrap">
                {streamingText}
              </pre>
            </section>
          )}

          {result && (
            <>
              <details className="group" open>
                <summary className="cursor-pointer font-semibold text-sm mb-1 text-zinc-300 list-none flex items-center gap-1">
                  <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                  Raw JSON
                </summary>
                <pre className="text-xs bg-zinc-950 border border-zinc-800 text-zinc-300 p-2 rounded overflow-auto max-h-64 mt-1">
                  {JSON.stringify(result.raw, null, 2)}
                </pre>
              </details>
              <section>
                <h2 className="font-semibold text-sm mb-1 text-zinc-300">Overall</h2>
                <p className="text-sm leading-relaxed text-zinc-100">{result.overall}</p>
              </section>
              <section>
                <h2 className="font-semibold text-sm mb-1 text-zinc-300">
                  Elements ({result.elements.length})
                </h2>
                <ol className="text-sm space-y-2">
                  {result.elements.map((el, i) => {
                    const palette = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
                    const color = palette[i % palette.length];
                    return (
                      <li key={i} className="flex gap-2">
                        <span
                          className="inline-flex w-7 h-7 rounded items-center justify-center flex-none text-white text-xs font-semibold leading-none"
                          style={{ backgroundColor: color }}
                        >
                          {i + 1}
                        </span>
                        <div>
                          <div className="font-medium text-zinc-100">{el.label}</div>
                          <div className="text-zinc-400">{el.description}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
