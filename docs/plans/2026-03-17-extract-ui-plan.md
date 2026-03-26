# Extract UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web UI at `/workbench/extract` where users upload a screenshot, Claude Code SDK analyzes it and proposes reusable templates, users configure params/styles via an interactive editor with live preview, and save results as deck-local templates.

**Architecture:** Next.js page with two phases (input → edit+preview). Analysis runs server-side via Claude Code SDK (`@anthropic-ai/claude-agent-sdk`). Preview uses server-side compilation (`/api/extract/preview`) + client-side `LayoutSlideRenderer`. File output writes to `content/<slug>/` via `/api/extract/save`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, `@anthropic-ai/claude-agent-sdk`, existing scene compiler + LayoutSlideRenderer

---

### Task 1: Install Claude Code SDK and create the analysis API route

**Files:**
- Create: `src/app/api/extract/analyze/route.ts`

**Step 1: Install the SDK**

Run: `bun add @anthropic-ai/claude-agent-sdk`

**Step 2: Create the API route**

```typescript
// src/app/api/extract/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

export const maxDuration = 120; // Allow 2 min for Claude analysis

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const text = formData.get("text") as string | null;
  const slug = formData.get("slug") as string | null;

  if (!image) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  // Save image to temp location
  const tmpDir = join(process.cwd(), ".tmp", "extract");
  mkdirSync(tmpDir, { recursive: true });
  const ext = image.name.split(".").pop() || "png";
  const imageName = `screenshot-${randomUUID().slice(0, 8)}.${ext}`;
  const imagePath = join(tmpDir, imageName);
  const imageBuffer = Buffer.from(await image.arrayBuffer());
  writeFileSync(imagePath, imageBuffer);

  // Build the analysis prompt
  const analysisPrompt = buildAnalysisPrompt(imagePath, text, slug);

  try {
    let resultText = "";
    for await (const message of query({
      prompt: analysisPrompt,
      options: {
        allowedTools: ["Read"],
        maxTurns: 1,
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
      },
    })) {
      if ("result" in message) {
        resultText = message.result;
      }
    }

    // Parse the JSON from Claude's response
    const jsonMatch = resultText.match(/```json\s*([\s\S]*?)\s*```/)
      ?? resultText.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse analysis response" },
        { status: 500 },
      );
    }

    const analysis = JSON.parse(jsonMatch[1]);

    // Inject the temp image path so the UI can display it
    analysis.source = {
      ...analysis.source,
      imagePath: `/api/extract/image?path=${encodeURIComponent(imagePath)}`,
    };

    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json(
      { error: `Analysis failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}

const ANALYSIS_SYSTEM_PROMPT = `You analyze screenshots of presentation slides and propose reusable templates.

Output a JSON object with this exact structure:
{
  "source": {
    "image": "<filename>",
    "dimensions": { "w": <number>, "h": <number> }
  },
  "proposals": [
    {
      "scope": "slide" | "block",
      "name": "<template-name>",
      "description": "<one line>",
      "region": { "x": <number>, "y": <number>, "w": <number>, "h": <number> },
      "params": {
        "<name>": { "type": "string"|"number"|"array", "expose": true|false, "value": <extracted value> }
      },
      "style": {
        "<name>": { "type": "string"|"number", "expose": true|false, "value": <extracted value> }
      },
      "body": "<Nunjucks template body — children + config, NO name/scope/params/style header>"
    }
  ]
}

Rules:
- Always propose at least one slide-scope template covering the whole slide.
- Propose block-scope templates for reusable sub-regions (stat cards, feature rows, etc.)
- params: content that varies (text, arrays, images). expose: true for content, false for structural text.
- style: design knobs (colors, sizes, gaps). expose: true for meaningful customization points.
- body: valid scene YAML with Nunjucks {{ param }} and {{ style.name }} references for exposed fields, literal values for non-exposed fields.
- Use sourceSize from the screenshot dimensions, with fit: contain and align: center.
- Use guides for repeated alignment lines.
- Wrap the JSON in a \`\`\`json code fence.`;

function buildAnalysisPrompt(imagePath: string, text: string | null, slug: string | null): string {
  let prompt = `Analyze this screenshot of a presentation slide and propose reusable templates.\n\nImage: ${imagePath}`;
  if (text) prompt += `\n\nAdditional context: ${text}`;
  if (slug) prompt += `\n\nTarget slug: ${slug}`;
  return prompt;
}
```

**Step 3: Create the image serving route**

```typescript
// src/app/api/extract/image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path");
  if (!filePath || !existsSync(filePath)) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const buffer = readFileSync(filePath);
  const ext = filePath.split(".").pop()?.toLowerCase();
  const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
    : ext === "webp" ? "image/webp"
    : "image/png";

  return new NextResponse(buffer, {
    headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" },
  });
}
```

**Step 4: Verify the SDK installs and route compiles**

Run: `bun run build 2>&1 | head -20`
Expected: No TypeScript errors for the new routes

---

### Task 2: Create the preview API route

Server-side compilation of template YAML → LayoutSlide JSON. Same pattern as `/api/layout` but takes raw YAML instead of a slug.

**Files:**
- Create: `src/app/api/extract/preview/route.ts`

**Step 1: Create the route**

```typescript
// src/app/api/extract/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { parse } from "yaml";
import { expandDslTemplate } from "@/lib/dsl/engine";
import { expandBlockNodes } from "@/lib/dsl/block-expand";
import { layoutSlide } from "@/lib/layout";
import type { SceneSlideData } from "@/lib/scene/types";
import type { DslTemplateDef } from "@/lib/dsl/types";

export async function POST(request: NextRequest) {
  try {
    const { templateYaml, instanceYaml, theme } = await request.json() as {
      templateYaml: string;
      instanceYaml: string;
      theme?: string;
    };

    // Parse the template YAML to extract header and body
    const templateDef = parseTemplateDef(templateYaml);

    // Parse the instance YAML
    const instance = parse(instanceYaml) as Record<string, unknown>;

    // Expand the template
    const slideData = expandDslTemplate(instance, templateDef);

    // Expand any block nodes
    const expanded = expandBlockNodes(slideData as unknown as SceneSlideData);

    // Compile to LayoutSlide
    const layoutResult = layoutSlide(
      expanded as any,
      (theme as any) ?? undefined,
      "",
    );

    return NextResponse.json(layoutResult);
  } catch (error) {
    return NextResponse.json(
      { error: `Preview failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}

/**
 * Parse a template YAML string into a DslTemplateDef.
 * Extracts the header (name, scope, params, style) and keeps the full body for Nunjucks rendering.
 */
function parseTemplateDef(yaml: string): DslTemplateDef {
  // Strip Nunjucks syntax to parse header safely
  const stripped = yaml
    .replace(/\{%.*?%\}/g, "")
    .replace(/"(\{\{.*?\}\})"/g, '"x"')
    .replace(/\{\{.*?\}\}/g, "0");

  const parsed = parse(stripped, { uniqueKeys: false }) as Record<string, unknown>;

  return {
    name: (parsed.name as string) ?? "preview",
    scope: parsed.scope as "slide" | "block" | undefined,
    params: (parsed.params ?? {}) as DslTemplateDef["params"],
    style: parsed.style as DslTemplateDef["style"],
    rawBody: yaml,
  };
}
```

**Step 2: Verify the route compiles**

Run: `bun run build 2>&1 | grep -i error | head -10`
Expected: No errors

---

### Task 3: Create the save API route

Writes template files and slides.yaml to `content/<slug>/`.

**Files:**
- Create: `src/app/api/extract/save/route.ts`

**Step 1: Create the route**

```typescript
// src/app/api/extract/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from "fs";
import { join } from "path";

const CONTENT_DIR = join(process.cwd(), "content");

export async function POST(request: NextRequest) {
  try {
    const { slug, templates, slidesYaml, sourceImagePath } = await request.json() as {
      slug: string;
      templates: Array<{ name: string; yaml: string }>;
      slidesYaml: string;
      sourceImagePath?: string;
    };

    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const deckDir = join(CONTENT_DIR, slug);
    const templatesDir = join(deckDir, "templates");
    const imagesDir = join(deckDir, "images");

    // Create directories
    mkdirSync(templatesDir, { recursive: true });
    mkdirSync(imagesDir, { recursive: true });

    const filesWritten: string[] = [];

    // Write template files
    for (const tmpl of templates) {
      const filePath = join(templatesDir, `${tmpl.name}.template.yaml`);
      writeFileSync(filePath, tmpl.yaml, "utf-8");
      filesWritten.push(filePath);
    }

    // Write slides.yaml
    const slidesPath = join(deckDir, "slides.yaml");
    writeFileSync(slidesPath, slidesYaml, "utf-8");
    filesWritten.push(slidesPath);

    // Copy source image if provided
    if (sourceImagePath && existsSync(sourceImagePath)) {
      const ext = sourceImagePath.split(".").pop() || "png";
      const destPath = join(imagesDir, `reference.${ext}`);
      copyFileSync(sourceImagePath, destPath);
      filesWritten.push(destPath);
    }

    return NextResponse.json({ slug, files: filesWritten });
  } catch (error) {
    return NextResponse.json(
      { error: `Save failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    );
  }
}
```

---

### Task 4: Create the ExtractWorkbench component — Phase 1 (Input)

**Files:**
- Create: `src/app/workbench/extract/page.tsx`
- Create: `src/components/extract/ExtractWorkbench.tsx`
- Create: `src/components/extract/ImageUpload.tsx`

**Step 1: Create the page route**

```typescript
// src/app/workbench/extract/page.tsx
import ExtractWorkbench from "@/components/extract/ExtractWorkbench";

export const metadata = { title: "Extract Templates" };

export default function ExtractPage() {
  return <ExtractWorkbench />;
}
```

**Step 2: Create ImageUpload component**

Supports paste (cmd+v) and file picker. Dark theme matching existing workbench aesthetic.

```typescript
// src/components/extract/ImageUpload.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ImageUploadProps {
  onImageSelected: (file: File, previewUrl: string) => void;
  previewUrl?: string;
}

export default function ImageUpload({ onImageSelected, previewUrl }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    onImageSelected(file, url);
  }, [onImageSelected]);

  // Handle paste
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
        }
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleFile]);

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-[18px] border-2 border-dashed p-8 transition-colors ${
        dragOver
          ? "border-cyan-400 bg-cyan-400/5"
          : "border-[#364152] bg-[#0d1421] hover:border-[#4a5568]"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {previewUrl ? (
        <img src={previewUrl} alt="Uploaded" className="max-h-[300px] rounded-xl object-contain" />
      ) : (
        <div className="text-center">
          <p className="text-lg text-[#8899b0]">Paste an image (Cmd+V) or click to upload</p>
          <p className="mt-2 text-sm text-[#5a6a80]">PNG, JPEG, or WebP</p>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create the main ExtractWorkbench component (Phase 1 only)**

```typescript
// src/components/extract/ExtractWorkbench.tsx
"use client";

import { useState } from "react";
import ImageUpload from "./ImageUpload";

interface AnalysisResult {
  source: { image: string; dimensions: { w: number; h: number }; imagePath: string };
  proposals: Proposal[];
}

interface ProposalField {
  type: string;
  expose: boolean;
  value: unknown;
}

interface Proposal {
  scope: "slide" | "block";
  name: string;
  description: string;
  region: { x: number; y: number; w: number; h: number };
  params: Record<string, ProposalField>;
  style: Record<string, ProposalField>;
  body: string;
}

export default function ExtractWorkbench() {
  const [imageFile, setImageFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [text, setText] = useState("");
  const [slug, setSlug] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleAnalyze() {
    if (!imageFile) return;
    setLoading(true);
    setError(undefined);

    const formData = new FormData();
    formData.append("image", imageFile);
    if (text) formData.append("text", text);
    if (slug) formData.append("slug", slug);

    try {
      const res = await fetch("/api/extract/analyze", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }
      const result = await res.json();
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (analysis) {
    // Phase 2 — will be implemented in Task 5
    return (
      <div className="min-h-screen bg-[#0a0f18] p-6 text-[#e6edf7]">
        <p>Analysis complete — {analysis.proposals.length} proposals. (Editor coming in next task)</p>
        <pre className="mt-4 overflow-auto rounded-xl bg-[#0b111c] p-4 text-sm">
          {JSON.stringify(analysis, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f18] p-6">
      <div className="w-full max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold text-[#e6edf7]">Extract Templates</h1>

        <ImageUpload
          onImageSelected={(file, url) => { setImageFile(file); setPreviewUrl(url); }}
          previewUrl={previewUrl}
        />

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8899b0]">
            Description (optional)
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe what you see or want to extract..."
            rows={3}
            className="w-full rounded-xl border border-[#2b3648] bg-[#0d1421] px-4 py-3 text-[#e6edf7] placeholder-[#5a6a80] focus:border-cyan-400/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8899b0]">
            Slug (optional — auto-generated if empty)
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-deck"
            className="w-full rounded-xl border border-[#2b3648] bg-[#0d1421] px-4 py-3 text-[#e6edf7] placeholder-[#5a6a80] focus:border-cyan-400/50 focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={!imageFile || loading}
          className="w-full rounded-xl bg-[#2e5fbf] px-6 py-3 font-medium text-white transition-colors hover:bg-[#3a6fd4] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Analyzing..." : "Analyze Screenshot"}
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Verify the page renders**

Run: `bun run dev`
Visit: `http://localhost:3000/workbench/extract`
Expected: Input form with image upload, text area, slug input, and Analyze button

---

### Task 5: Create the Phase 2 UI — Proposal Editor + Overlay Preview

**Files:**
- Create: `src/components/extract/ProposalEditor.tsx`
- Create: `src/components/extract/ProposalCard.tsx`
- Create: `src/components/extract/FieldTable.tsx`
- Create: `src/components/extract/OverlayPreview.tsx`
- Create: `src/components/extract/YamlPreview.tsx`
- Modify: `src/components/extract/ExtractWorkbench.tsx`

**Step 1: Create FieldTable — the param/style editor rows**

```typescript
// src/components/extract/FieldTable.tsx
"use client";

interface Field {
  type: string;
  expose: boolean;
  value: unknown;
}

interface FieldTableProps {
  fields: Record<string, Field>;
  label: string;
  onChange: (name: string, updates: Partial<Field>) => void;
}

export default function FieldTable({ fields, label, onChange }: FieldTableProps) {
  const entries = Object.entries(fields);
  if (entries.length === 0) return null;

  return (
    <div>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8899b0]">
        {label}
      </h4>
      <div className="space-y-1.5">
        {entries.map(([name, field]) => (
          <div
            key={name}
            className="flex items-center gap-3 rounded-lg bg-[#0b111c] px-3 py-2"
          >
            <button
              onClick={() => onChange(name, { expose: !field.expose })}
              className={`h-5 w-5 shrink-0 rounded border text-xs font-bold transition-colors ${
                field.expose
                  ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                  : "border-[#364152] bg-transparent text-transparent"
              }`}
            >
              {field.expose ? "✓" : ""}
            </button>
            <span className="w-28 shrink-0 truncate text-sm font-medium text-[#c8d4e2]">{name}</span>
            <span className="w-14 shrink-0 text-xs text-[#5a6a80]">{field.type}</span>
            <input
              type="text"
              value={typeof field.value === "string" ? field.value : JSON.stringify(field.value)}
              onChange={(e) => {
                let val: unknown = e.target.value;
                if (field.type === "number") val = Number(e.target.value) || 0;
                else if (field.type === "array") {
                  try { val = JSON.parse(e.target.value); } catch { val = e.target.value; }
                }
                onChange(name, { value: val });
              }}
              className="min-w-0 flex-1 rounded border border-[#2b3648] bg-[#0d1421] px-2 py-1 text-sm text-[#e6edf7] focus:border-cyan-400/50 focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Create ProposalCard**

```typescript
// src/components/extract/ProposalCard.tsx
"use client";

import FieldTable from "./FieldTable";

interface ProposalField {
  type: string;
  expose: boolean;
  value: unknown;
}

interface Proposal {
  scope: "slide" | "block";
  name: string;
  description: string;
  region: { x: number; y: number; w: number; h: number };
  params: Record<string, ProposalField>;
  style: Record<string, ProposalField>;
  body: string;
}

interface ProposalCardProps {
  proposal: Proposal;
  selected: boolean;
  onSelect: () => void;
  onChange: (updated: Proposal) => void;
}

export default function ProposalCard({ proposal, selected, onSelect, onChange }: ProposalCardProps) {
  return (
    <div
      className={`rounded-[16px] border p-4 transition-colors cursor-pointer ${
        selected
          ? "border-cyan-400/50 bg-[#121a28]"
          : "border-[#253044] bg-[#0d1421] hover:border-[#364152]"
      }`}
      onClick={onSelect}
    >
      <div className="mb-3 flex items-center gap-2">
        <input
          type="text"
          value={proposal.name}
          onChange={(e) => onChange({ ...proposal, name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-lg font-semibold text-[#e6edf7] focus:border-[#2b3648] focus:bg-[#0b111c] focus:outline-none"
        />
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          proposal.scope === "slide"
            ? "bg-blue-500/20 text-blue-300"
            : "bg-emerald-500/20 text-emerald-300"
        }`}>
          {proposal.scope}
        </span>
      </div>

      <p className="mb-4 text-sm text-[#8899b0]">{proposal.description}</p>

      <div className="space-y-4">
        <FieldTable
          label="Params"
          fields={proposal.params}
          onChange={(name, updates) => {
            onChange({
              ...proposal,
              params: {
                ...proposal.params,
                [name]: { ...proposal.params[name], ...updates },
              },
            });
          }}
        />
        <FieldTable
          label="Styles"
          fields={proposal.style}
          onChange={(name, updates) => {
            onChange({
              ...proposal,
              style: {
                ...proposal.style,
                [name]: { ...proposal.style[name], ...updates },
              },
            });
          }}
        />
      </div>
    </div>
  );
}
```

**Step 3: Create YamlPreview**

```typescript
// src/components/extract/YamlPreview.tsx
"use client";

import { useState } from "react";

interface YamlPreviewProps {
  templateYaml: string;
  instanceYaml: string;
}

export default function YamlPreview({ templateYaml, instanceYaml }: YamlPreviewProps) {
  const [copied, setCopied] = useState<"template" | "instance" | null>(null);

  function copyToClipboard(text: string, which: "template" | "instance") {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8899b0]">Template</span>
          <button
            onClick={() => copyToClipboard(templateYaml, "template")}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            {copied === "template" ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="max-h-64 overflow-auto rounded-xl bg-[#0b111c] border border-[#2b3648] p-3 text-xs text-[#c8d4e2]">
          {templateYaml}
        </pre>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8899b0]">Instance</span>
          <button
            onClick={() => copyToClipboard(instanceYaml, "instance")}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            {copied === "instance" ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="max-h-40 overflow-auto rounded-xl bg-[#0b111c] border border-[#2b3648] p-3 text-xs text-[#c8d4e2]">
          {instanceYaml}
        </pre>
      </div>
    </div>
  );
}
```

**Step 4: Create OverlayPreview**

Uses the same `SlideCanvas` pattern from the existing workbench — scaled 1920x1080 canvas with `LayoutSlideRenderer` and image overlay.

```typescript
// src/components/extract/OverlayPreview.tsx
"use client";

import { LayoutSlideRenderer } from "@/components/LayoutRenderer";
import type { LayoutSlide } from "@/lib/layout/types";
import { useLayoutEffect, useRef, useState } from "react";

interface OverlayPreviewProps {
  screenshotUrl: string;
  layoutSlide?: LayoutSlide;
  overlayOpacity: number;
  regions?: Array<{
    region: { x: number; y: number; w: number; h: number };
    selected: boolean;
    color: string;
    onClick: () => void;
  }>;
  sourceDimensions?: { w: number; h: number };
}

export default function OverlayPreview({
  screenshotUrl,
  layoutSlide,
  overlayOpacity,
  regions,
  sourceDimensions,
}: OverlayPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    function updateScale() {
      const el = containerRef.current;
      if (!el) return;
      setScale(Math.min(el.clientWidth / 1920, el.clientHeight / 1080));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-[20px] border border-[#253044] bg-[#090e17]"
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: 1920,
          height: 1080,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {/* Layer 1: Rendered slide */}
        <div className="slide active">
          {layoutSlide ? <LayoutSlideRenderer slide={layoutSlide} /> : null}
        </div>

        {/* Layer 2: Screenshot overlay */}
        <img
          src={screenshotUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
          style={{ opacity: overlayOpacity }}
        />

        {/* Layer 3: Region outlines */}
        {regions && sourceDimensions && regions.map((r, i) => {
          const sx = 1920 / sourceDimensions.w;
          const sy = 1080 / sourceDimensions.h;
          return (
            <div
              key={i}
              className={`absolute cursor-pointer border-2 transition-colors ${
                r.selected ? "border-cyan-400" : "border-cyan-400/30 hover:border-cyan-400/60"
              }`}
              style={{
                left: r.region.x * sx,
                top: r.region.y * sy,
                width: r.region.w * sx,
                height: r.region.h * sy,
              }}
              onClick={r.onClick}
            />
          );
        })}
      </div>
    </div>
  );
}
```

**Step 5: Create ProposalEditor**

```typescript
// src/components/extract/ProposalEditor.tsx
"use client";

import ProposalCard from "./ProposalCard";
import YamlPreview from "./YamlPreview";
import { generateTemplateYaml, generateInstanceYaml } from "./yaml-gen";

interface ProposalField {
  type: string;
  expose: boolean;
  value: unknown;
}

interface Proposal {
  scope: "slide" | "block";
  name: string;
  description: string;
  region: { x: number; y: number; w: number; h: number };
  params: Record<string, ProposalField>;
  style: Record<string, ProposalField>;
  body: string;
}

interface ProposalEditorProps {
  proposals: Proposal[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onChange: (index: number, updated: Proposal) => void;
  onSave: () => void;
  saving: boolean;
}

export default function ProposalEditor({
  proposals,
  selectedIndex,
  onSelect,
  onChange,
  onSave,
  saving,
}: ProposalEditorProps) {
  const selected = proposals[selectedIndex];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {proposals.map((proposal, i) => (
        <ProposalCard
          key={i}
          proposal={proposal}
          selected={i === selectedIndex}
          onSelect={() => onSelect(i)}
          onChange={(updated) => onChange(i, updated)}
        />
      ))}

      {selected && (
        <YamlPreview
          templateYaml={generateTemplateYaml(selected)}
          instanceYaml={generateInstanceYaml(selected)}
        />
      )}

      <button
        onClick={onSave}
        disabled={saving}
        className="rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
      >
        {saving ? "Saving..." : "Save to Deck"}
      </button>
    </div>
  );
}
```

**Step 6: Create yaml-gen — client-side YAML generation from proposal state**

```typescript
// src/components/extract/yaml-gen.ts

interface ProposalField {
  type: string;
  expose: boolean;
  value: unknown;
}

interface Proposal {
  scope: "slide" | "block";
  name: string;
  description: string;
  region: { x: number; y: number; w: number; h: number };
  params: Record<string, ProposalField>;
  style: Record<string, ProposalField>;
  body: string;
}

export function generateTemplateYaml(proposal: Proposal): string {
  const lines: string[] = [];

  lines.push(`name: ${proposal.name}`);
  lines.push(`scope: ${proposal.scope}`);

  // Params header
  const exposedParams = Object.entries(proposal.params).filter(([, f]) => f.expose);
  if (exposedParams.length > 0) {
    lines.push("params:");
    for (const [name, field] of exposedParams) {
      lines.push(`  ${name}: { type: ${field.type}, required: true }`);
    }
  }

  // Style header
  const exposedStyles = Object.entries(proposal.style).filter(([, f]) => f.expose);
  if (exposedStyles.length > 0) {
    lines.push("style:");
    for (const [name, field] of exposedStyles) {
      const defaultVal = typeof field.value === "string" ? `"${field.value}"` : field.value;
      lines.push(`  ${name}: { type: ${field.type}, default: ${defaultVal} }`);
    }
  }

  // Body
  lines.push("");
  lines.push(proposal.body);

  return lines.join("\n");
}

export function generateInstanceYaml(proposal: Proposal): string {
  const lines: string[] = [];

  lines.push(`- template: ${proposal.name}`);

  const exposedParams = Object.entries(proposal.params).filter(([, f]) => f.expose);
  if (exposedParams.length > 0) {
    lines.push("  params:");
    for (const [name, field] of exposedParams) {
      const val = typeof field.value === "string"
        ? `"${field.value}"`
        : JSON.stringify(field.value);
      lines.push(`    ${name}: ${val}`);
    }
  }

  return lines.join("\n");
}
```

**Step 7: Update ExtractWorkbench with Phase 2 layout**

Replace the placeholder Phase 2 in `ExtractWorkbench.tsx` with the full two-column layout using OverlayPreview and ProposalEditor. Add state for selected proposal, live preview fetch, opacity slider, and save action.

The key additions:
- `proposals` state (from analysis, mutable)
- `selectedIndex` state
- `overlayOpacity` state with slider
- `layoutSlide` state — fetched from `/api/extract/preview` whenever proposals change
- `handleSave` — POST to `/api/extract/save`
- Two-column layout: left = OverlayPreview, right = ProposalEditor

**Step 8: Verify the full flow**

Run: `bun run dev`
Visit: `http://localhost:3000/workbench/extract`
1. Upload an image
2. Click Analyze (requires Claude Code SDK to be available)
3. See proposals in the editor
4. Toggle expose flags, edit values
5. See YAML update in real-time
6. Click Save to Deck

---

### Task 6: Wire up live preview fetching

When proposals change (expose toggle, value edit), fetch the preview from `/api/extract/preview`.

**Files:**
- Modify: `src/components/extract/ExtractWorkbench.tsx`

**Step 1: Add debounced preview fetching**

Use a `useEffect` that watches the selected proposal's state and fetches the compiled LayoutSlide from the preview API. Debounce by 300ms to avoid hammering the server on every keystroke.

```typescript
// Inside ExtractWorkbench, after analysis is loaded:
const [layoutSlide, setLayoutSlide] = useState<LayoutSlide>();
const [previewLoading, setPreviewLoading] = useState(false);

useEffect(() => {
  if (!proposals.length) return;
  const selected = proposals[selectedIndex];
  if (!selected) return;

  const timer = setTimeout(async () => {
    setPreviewLoading(true);
    try {
      const templateYaml = generateTemplateYaml(selected);
      const instanceYaml = generateInstanceYaml(selected);
      const res = await fetch("/api/extract/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateYaml, instanceYaml }),
      });
      if (res.ok) {
        const slide = await res.json();
        setLayoutSlide(slide);
      }
    } catch {
      // Preview failed — non-critical
    } finally {
      setPreviewLoading(false);
    }
  }, 300);

  return () => clearTimeout(timer);
}, [proposals, selectedIndex]);
```

**Step 2: Pass layoutSlide to OverlayPreview**

The OverlayPreview component already accepts `layoutSlide` as a prop.

**Step 3: Verify**

Edit a proposal field → after 300ms, the preview should update in the overlay container.

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Analysis API route (Claude Code SDK) | `api/extract/analyze/route.ts`, `api/extract/image/route.ts` |
| 2 | Preview API route (compile YAML → LayoutSlide) | `api/extract/preview/route.ts` |
| 3 | Save API route (write to content/) | `api/extract/save/route.ts` |
| 4 | Phase 1 UI (upload, input, analyze button) | `ExtractWorkbench.tsx`, `ImageUpload.tsx`, `page.tsx` |
| 5 | Phase 2 UI (proposal editor, overlay, YAML) | `ProposalEditor.tsx`, `ProposalCard.tsx`, `FieldTable.tsx`, `OverlayPreview.tsx`, `YamlPreview.tsx`, `yaml-gen.ts` |
| 6 | Live preview fetching | `ExtractWorkbench.tsx` |
