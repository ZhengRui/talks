# Gemma 4 UI Detection Test Workbench — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a throwaway Next.js workbench page at `/workbench/gemma-test` where the user can paste or upload a slide image, run Gemma 4 vision detection, and see numbered bounding boxes overlaid on the image alongside an overall description, per-element descriptions, and raw JSON.

**Architecture:** Client-only React page (no state library) that POSTs `multipart/form-data` to an internal API route. The route proxies to Google AI via `@google/genai`, uses `sharp` to read original image dimensions, and converts Gemma's `[y1,x1,y2,x2]` coordinates on a 1000×1000 grid to original-pixel `{x,y,width,height}` rectangles.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `@google/genai` (new), `sharp` (existing), Tailwind, Vitest for coord conversion only.

**Design Doc:** `docs/2026-04-16-design-gemma4-ui-test.md`

**Scope note:** This is a throwaway scratch UI. Tests cover only the pure coordinate conversion function (it's the highest-risk piece and easy to unit-test). The UI itself is verified manually via `bun run dev` + browser.

---

### Task 1: Install `@google/genai` and document env var

**Files:**
- Modify: `package.json`
- Modify: `.env.local` (user-editable, not committed)

**Step 1: Install the dep**

Run: `bun add @google/genai`

**Step 2: Verify install**

Run: `grep "@google/genai" package.json`
Expected: one line showing the package + version.

**Step 3: Document env var**

Tell the user they need to add `GOOGLE_API_KEY=<key>` to `.env.local`. Do NOT write `.env.local` directly — it holds secrets and should remain user-managed.

**Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "$(cat <<'EOF'
chore: add @google/genai for gemma test workbench

- Install @google/genai SDK for Gemma 4 vision calls
- Used by the /workbench/gemma-test scratch UI

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Write failing test for coordinate conversion

**Files:**
- Create: `src/lib/extract/gemma-bbox.ts` (empty export at first)
- Create: `src/lib/extract/gemma-bbox.test.ts`

**Step 1: Create the empty module**

Create `src/lib/extract/gemma-bbox.ts`:

```ts
export type BBox = { x: number; y: number; width: number; height: number };

export function box2dToPixelBbox(
  box2d: [number, number, number, number],
  imageWidth: number,
  imageHeight: number,
): BBox {
  throw new Error("not implemented");
}
```

**Step 2: Write the test**

Create `src/lib/extract/gemma-bbox.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { box2dToPixelBbox } from "./gemma-bbox";

describe("box2dToPixelBbox", () => {
  it("converts [y1,x1,y2,x2] on 1000x1000 to pixel {x,y,w,h}", () => {
    // box_2d covers the top-left quarter of a 2000x1000 image
    const result = box2dToPixelBbox([0, 0, 500, 500], 2000, 1000);
    expect(result).toEqual({ x: 0, y: 0, width: 1000, height: 500 });
  });

  it("handles a centered box on a non-square image", () => {
    // box_2d spans the middle 40% of a 1920x1080 image
    const result = box2dToPixelBbox([300, 300, 700, 700], 1920, 1080);
    expect(result.x).toBeCloseTo(576); // 300/1000 * 1920
    expect(result.y).toBeCloseTo(324); // 300/1000 * 1080
    expect(result.width).toBeCloseTo(768);  // 400/1000 * 1920
    expect(result.height).toBeCloseTo(432); // 400/1000 * 1080
  });

  it("handles full-image box", () => {
    const result = box2dToPixelBbox([0, 0, 1000, 1000], 1920, 1080);
    expect(result).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });
});
```

**Step 3: Run the test — expect failure**

Run: `bun run test -- src/lib/extract/gemma-bbox.test.ts`
Expected: FAIL with "not implemented" thrown from each test.

---

### Task 3: Implement coordinate conversion to pass tests

**Files:**
- Modify: `src/lib/extract/gemma-bbox.ts`

**Step 1: Replace the stub with the real implementation**

```ts
export type BBox = { x: number; y: number; width: number; height: number };

export function box2dToPixelBbox(
  box2d: [number, number, number, number],
  imageWidth: number,
  imageHeight: number,
): BBox {
  const [y1, x1, y2, x2] = box2d;
  const x = (x1 / 1000) * imageWidth;
  const y = (y1 / 1000) * imageHeight;
  const width = ((x2 - x1) / 1000) * imageWidth;
  const height = ((y2 - y1) / 1000) * imageHeight;
  return { x, y, width, height };
}
```

**Step 2: Run the test — expect pass**

Run: `bun run test -- src/lib/extract/gemma-bbox.test.ts`
Expected: PASS, 3/3 tests green.

**Step 3: Commit**

```bash
git add src/lib/extract/gemma-bbox.ts src/lib/extract/gemma-bbox.test.ts
git commit -m "$(cat <<'EOF'
feat(extract): add gemma bbox coordinate conversion utility

- box2dToPixelBbox converts Gemma 4's [y1,x1,y2,x2]/1000 format to pixel rects
- Handles non-square images and full-image boxes
- Unit tested

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Create the API route skeleton

**Files:**
- Create: `src/app/api/gemma-detect/route.ts`

**Step 1: Write the route**

```ts
// Requires GOOGLE_API_KEY in .env.local
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { box2dToPixelBbox, type BBox } from "@/lib/extract/gemma-bbox";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROMPT = `Analyze this slide image. Return strict JSON with this exact shape:

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
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_API_KEY is not set in .env.local" },
      { status: 500 },
    );
  }

  const form = await req.formData();
  const file = form.get("image");
  const model = (form.get("model") as string) || "gemma-4-31b-it";

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

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: buffer.toString("base64"), mimeType: file.type || "image/png" } },
          { text: PROMPT },
        ],
      },
    ],
  });

  const text = response.text ?? "";
  let parsed: GemmaResponse;
  try {
    parsed = JSON.parse(stripCodeFence(text)) as GemmaResponse;
  } catch {
    return NextResponse.json(
      { error: "Gemma did not return parseable JSON", raw: text },
      { status: 502 },
    );
  }

  const elements: DetectElement[] = (parsed.elements ?? []).map((el) => ({
    label: el.label,
    description: el.description,
    bbox: box2dToPixelBbox(el.box_2d, imageWidth, imageHeight),
    raw_box_2d: el.box_2d,
  }));

  const body: DetectResponse = {
    overall: parsed.overall_description ?? "",
    elements,
    imageWidth,
    imageHeight,
    raw: parsed,
  };

  return NextResponse.json(body);
}
```

**Step 2: Typecheck**

Run: `bun run lint` (ESLint will catch TS errors via the project's config)
Expected: no errors in `src/app/api/gemma-detect/route.ts`.

**Step 3: Commit**

```bash
git add src/app/api/gemma-detect/route.ts
git commit -m "$(cat <<'EOF'
feat(gemma-test): add API route for Gemma 4 UI detection

- POST /api/gemma-detect: multipart image + model → structured bbox JSON
- Uses @google/genai, reads image dims via sharp
- Converts Gemma box_2d to original pixel coords

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Create the client page — static scaffold

**Files:**
- Create: `src/app/workbench/gemma-test/page.tsx`

**Step 1: Write the scaffold (no interactivity yet)**

```tsx
"use client";

import { useState } from "react";

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

export default function GemmaTestPage() {
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [model, setModel] = useState<ModelId>("gemma-4-31b-it");
  const [result, setResult] = useState<DetectResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="p-6 flex flex-col gap-4 h-screen">
      <header className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Gemma 4 UI Detection Test</h1>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ModelId)}
          className="border rounded px-2 py-1 text-sm"
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
          disabled={!imageBlob || loading}
          className="px-3 py-1 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
        >
          {loading ? "Running…" : "Run"}
        </button>
        <span className="text-xs text-gray-500">Tip: Cmd+V to paste an image</span>
      </header>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="border rounded p-2 overflow-auto">
          <div className="text-gray-400 text-sm">Canvas goes here</div>
        </div>
        <div className="border rounded p-2 overflow-auto">
          <div className="text-gray-400 text-sm">Results go here</div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Start the dev server (background)**

Run: `bun run dev` in background.

**Step 3: Verify the page loads**

Visit `http://localhost:3000/workbench/gemma-test` in a browser. Expected: header with model select, upload input, Run button. No console errors.

**Step 4: Commit**

```bash
git add src/app/workbench/gemma-test/page.tsx
git commit -m "$(cat <<'EOF'
feat(gemma-test): scaffold /workbench/gemma-test page

- Static layout with model select, upload input, Run button
- Two-column grid for canvas and results

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Add paste-from-clipboard handler

**Files:**
- Modify: `src/app/workbench/gemma-test/page.tsx`

**Step 1: Add a `useEffect` that listens for paste**

Insert after the existing `useState` declarations:

```tsx
import { useEffect, useState } from "react";

// ...inside component, after state:
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
```

**Step 2: Manual verify**

In the browser, take a screenshot (Cmd+Shift+4 region → clipboard), Cmd+V on the page. Expected: the image should be stored (we'll render it in the next task — for now open the Network tab and confirm no errors).

**Step 3: Commit**

```bash
git add src/app/workbench/gemma-test/page.tsx
git commit -m "$(cat <<'EOF'
feat(gemma-test): add Cmd+V paste handler

- Listens for paste events on document
- Reads first image ClipboardItem into state

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Render the image on canvas with bbox overlays

**Files:**
- Modify: `src/app/workbench/gemma-test/page.tsx`

**Step 1: Add a canvas ref and drawing effect**

Add imports:
```tsx
import { useEffect, useRef, useState } from "react";
```

Add to state/refs:
```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);
const [imageBitmap, setImageBitmap] = useState<ImageBitmap | null>(null);
```

Add an effect that decodes the blob into an `ImageBitmap`:
```tsx
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
```

Add an effect that draws the image + bboxes onto the canvas:
```tsx
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
```

Replace the left panel's placeholder with:
```tsx
<div className="border rounded p-2 overflow-auto">
  <canvas ref={canvasRef} className="max-w-full h-auto block" />
</div>
```

**Step 2: Manual verify**

Paste or upload any image. Expected: image renders on the canvas at natural size, scaled to fit column width. No bboxes yet (no result).

**Step 3: Commit**

```bash
git add src/app/workbench/gemma-test/page.tsx
git commit -m "$(cat <<'EOF'
feat(gemma-test): render image and bbox overlays on canvas

- Decode blob via createImageBitmap
- Draw image + numbered, color-cycled bbox rects
- Bboxes only drawn once result is available

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Wire the Run button to the API

**Files:**
- Modify: `src/app/workbench/gemma-test/page.tsx`

**Step 1: Add the submit handler**

```tsx
async function handleRun() {
  if (!imageBlob) return;
  setLoading(true);
  setError(null);
  setResult(null);
  try {
    const fd = new FormData();
    fd.append("image", imageBlob, "slide.png");
    fd.append("model", model);
    const res = await fetch("/api/gemma-detect", { method: "POST", body: fd });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as DetectResponse;
    setResult(data);
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setLoading(false);
  }
}
```

Bind it to the button: `<button onClick={handleRun} ...>`.

**Step 2: Manual verify**

With `GOOGLE_API_KEY` set in `.env.local`, paste an image, click Run. Expected: loading state appears, then bboxes are drawn on the canvas. If the API key is missing, the red error message appears.

**Step 3: Commit**

```bash
git add src/app/workbench/gemma-test/page.tsx
git commit -m "$(cat <<'EOF'
feat(gemma-test): wire Run button to gemma-detect API

- POST multipart image + model, parse DetectResponse
- Show loading/error states

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Render results panel (overall + element list + raw JSON)

**Files:**
- Modify: `src/app/workbench/gemma-test/page.tsx`

**Step 1: Replace the right panel placeholder**

```tsx
<div className="border rounded p-3 overflow-auto flex flex-col gap-4">
  {!result && <div className="text-gray-400 text-sm">Run detection to see results</div>}
  {result && (
    <>
      <section>
        <h2 className="font-semibold text-sm mb-1">Overall</h2>
        <p className="text-sm leading-relaxed">{result.overall}</p>
      </section>
      <section>
        <h2 className="font-semibold text-sm mb-1">
          Elements ({result.elements.length})
        </h2>
        <ol className="text-sm space-y-2">
          {result.elements.map((el, i) => {
            const palette = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
            const color = palette[i % palette.length];
            return (
              <li key={i} className="flex gap-2">
                <span
                  className="inline-block w-6 h-6 rounded text-white text-xs flex items-center justify-center flex-none"
                  style={{ backgroundColor: color }}
                >
                  {i + 1}
                </span>
                <div>
                  <div className="font-medium">{el.label}</div>
                  <div className="text-gray-600">{el.description}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      <section>
        <h2 className="font-semibold text-sm mb-1">Raw JSON</h2>
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-64">
          {JSON.stringify(result.raw, null, 2)}
        </pre>
      </section>
    </>
  )}
</div>
```

**Step 2: Manual verify**

Run a detection. Expected: overall paragraph, numbered list with matching colors to the canvas bboxes, raw JSON block scrolls.

**Step 3: Commit**

```bash
git add src/app/workbench/gemma-test/page.tsx
git commit -m "$(cat <<'EOF'
feat(gemma-test): render overall description, element list, raw JSON

- Numbered list mirrors canvas bbox numbering and colors
- Raw JSON panel for copy/inspect

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: End-to-end visual smoke test

**Step 1: Ensure dev server is running**

Run: `bun run dev` (if not already).

**Step 2: Ensure API key is set**

Tell the user to verify `GOOGLE_API_KEY=...` is in `.env.local`. Restart the dev server after editing `.env.local` so Next.js re-reads it.

**Step 3: Run the full flow**

- Visit `http://localhost:3000/workbench/gemma-test`.
- Take a screenshot of a real slide, Cmd+V onto the page.
- Click Run.
- Confirm:
  - Image appears on the left.
  - After ~5–20s, bboxes appear in multiple colors with numbered tags.
  - Right panel shows overall paragraph + numbered element list + raw JSON.
  - Bboxes align reasonably with visible slide elements.

**Step 4: If bboxes look systematically offset**

Likely causes + fixes:
- Bboxes flipped horizontally → Gemma returned `[x1,y1,x2,y2]` instead of `[y1,x1,y2,x2]`: adjust the parser to auto-detect or flip.
- Bboxes tiny and clustered at origin → Gemma returned normalized 0..1 instead of 0..1000: divide by 1 instead of 1000 (detect via max coord).
- Bboxes slightly off but correctly shaped → within model noise, acceptable for a test UI.

**Step 5: Optional final commit**

If you made any bbox-format adjustments, commit with:

```bash
git add src/app/api/gemma-detect/route.ts src/lib/extract/gemma-bbox.ts
git commit -m "$(cat <<'EOF'
fix(gemma-test): handle bbox format variant observed from Gemma 4

- [describe what you adjusted]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Done when

- `/workbench/gemma-test` loads and accepts Cmd+V paste and file upload.
- Running with a real slide image returns bboxes that visually align with slide elements.
- The overall description and numbered element list render correctly.
- Unit tests for `box2dToPixelBbox` pass.
- All commits from tasks 1–9 (and 10 if applicable) are present on the current branch.
