# Inline Image Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Send uploaded images directly as base64 content blocks to the Agent SDK instead of saving to temp files and relying on the Read tool, which downscales images and reduces analysis quality.

**Architecture:** Replace the string `prompt` in `query()` with an `AsyncIterable<SDKUserMessage>` that includes the image as an inline base64 content block. Remove the temp file pipeline (write, serve, clean up) and the `/api/extract/image` endpoint. The frontend already holds the original image as an object URL (`card.previewUrl`), so `imagePath` in the analysis result is unnecessary.

**Tech Stack:** `@anthropic-ai/claude-agent-sdk` (AsyncIterable prompt mode), Next.js API route, Zustand store

---

### Task 1: Update `buildAnalysisPrompt` to drop file path dependency

The prompt currently embeds a file path for Claude to `Read`. With inline images, the prompt just needs the text instructions — the image arrives as a content block alongside it.

**Files:**
- Modify: `src/lib/extract/prompts.ts:63-73`

**Step 1: Update `buildAnalysisPrompt` signature and body**

Change the function to no longer accept or embed `imagePath`. The image will be sent as a separate content block.

```typescript
export function buildAnalysisPrompt(
  text: string | null,
  slug: string | null,
): string {
  let prompt = `Analyze this screenshot and propose reusable scene templates. Read .claude/skills/replicate-slides/reference.md first for the correct scene YAML syntax.`;
  prompt += `\n\nCRITICAL for source.dimensions: Report the pixel dimensions as you visually perceive the image. Do NOT round to standard resolutions (not 1366x768, not 1920x1080). Your coordinates and region boxes must be consistent with the dimensions you report.`;
  if (text) prompt += `\n\nAdditional context: ${text}`;
  if (slug) prompt += `\n\nTarget slug: ${slug}`;
  return prompt;
}
```

**Step 2: Update `ANALYSIS_SYSTEM_PROMPT` — remove "read the screenshot" instruction**

In the workflow section (line 14), change step 2 from "Analyze the screenshot image" to reflect that the image is already in the conversation. Also remove the instruction "Just analyze the screenshot, read the skill reference for scene syntax, and return JSON" since there's no file to read — the image is inline.

Update the workflow:
```
## Your workflow

1. Read the replicate-slides skill reference at .claude/skills/replicate-slides/reference.md to understand scene YAML syntax.
2. Analyze the screenshot image provided in the conversation.
3. Identify reusable template candidates (slide-scope for overall layout, block-scope for repeating sub-regions).
4. Output the JSON result.
```

And update the constraints:
```
IMPORTANT constraints:
- This is a Layer 1 (analysis-only) task. Do NOT write files, open workbenches, or run verification.
- Do NOT attempt to verify, render, or test the templates.
- The screenshot image is provided inline in the conversation. Analyze it directly and return JSON.
```

**Step 3: Verify build**

Run: `bun run build 2>&1 | head -30`
Expected: Build errors in `route.ts` (calling `buildAnalysisPrompt` with 3 args) — that's expected, we fix it in Task 2.

---

### Task 2: Rewrite the analyze route to use inline image content blocks

This is the core change. Replace the temp-file-and-Read-tool approach with an async generator that yields an `SDKUserMessage` containing the image as a base64 content block.

**Files:**
- Modify: `src/app/api/extract/analyze/route.ts`

**Step 1: Rewrite the route**

Replace the entire POST handler. Key changes:
- Remove `writeFileSync`, `mkdirSync`, `join`, `randomUUID` imports
- Remove temp file creation (lines 57-63)
- Remove `imagePath` from the result (lines 197-199)
- Change `allowedTools` from `["Read", "Glob"]` to `["Glob"]` (Read is no longer needed for the image; Glob is kept so Claude can still find the skill reference file)
- Replace string `prompt` with async generator yielding `SDKUserMessage`

```typescript
import { NextRequest } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from "@/lib/extract/prompts";
import { normalizeAnalysisRegions } from "@/lib/extract/normalize-analysis";

/** Read actual image dimensions from a PNG/JPEG/WebP buffer. */
function readImageSize(buffer: Buffer): { w: number; h: number } | null {
  // PNG: bytes 16-23 contain width (4 bytes) and height (4 bytes) in IHDR
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20) };
  }
  // JPEG: scan for SOF0/SOF2 markers (0xFFC0/0xFFC2)
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        return { w: buffer.readUInt16BE(offset + 7), h: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  // WebP RIFF: VP8 chunk at offset 12
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8 ") {
      return { w: buffer.readUInt16LE(26) & 0x3fff, h: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

function inferMediaType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const text = formData.get("text") as string | null;
  const slug = formData.get("slug") as string | null;

  if (!image) {
    return new Response(JSON.stringify({ error: "No image provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  const actualSize = readImageSize(imageBuffer);
  const mediaType = inferMediaType(image.name);
  const analysisPrompt = buildAnalysisPrompt(text, slug);

  // Build an async generator that yields a single SDKUserMessage
  // with the image as an inline base64 content block
  async function* makePrompt() {
    yield {
      type: "user" as const,
      session_id: "",
      message: {
        role: "user" as const,
        content: [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: mediaType,
              data: imageBuffer.toString("base64"),
            },
          },
          { type: "text" as const, text: analysisPrompt },
        ],
      },
      parent_tool_use_id: null,
    };
  }

  // Stream SSE events to the client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        let resultText = "";
        send("status", { message: "Starting analysis..." });

        const queryOptions: import("@anthropic-ai/claude-agent-sdk").Options = {
          cwd: process.cwd(),
          settingSources: ["project"],
          allowedTools: ["Glob"],
          maxTurns: 5,
          model: "claude-opus-4-6",
          thinking: { type: "adaptive" },
          effort: "high",
          systemPrompt: ANALYSIS_SYSTEM_PROMPT,
          includePartialMessages: true,
          pathToClaudeCodeExecutable: "/Users/zerry/.local/bin/claude",
          env: { ...process.env, ANTHROPIC_API_KEY: "" },
        };

        for await (const message of query({
          prompt: makePrompt(),
          options: queryOptions,
        })) {
          // ... (SSE streaming logic unchanged — same as current lines 101-181)
```

The SSE message handling loop (lines 101-181 in the current file) stays exactly the same. The only change in the result handling section is removing the `imagePath` injection:

```typescript
        // Parse JSON from collected text
        const jsonMatch =
          resultText.match(/```json\s*([\s\S]*?)\s*```/) ??
          resultText.match(/(\{[\s\S]*\})/);

        if (!jsonMatch) {
          send("error", { error: "Failed to parse analysis response", raw: resultText || "(empty)" });
          controller.close();
          return;
        }

        const parsedAnalysis = JSON.parse(jsonMatch[1]);
        const analysis = normalizeAnalysisRegions(parsedAnalysis, actualSize);

        send("result", analysis);
        controller.close();
```

Note: the `analysis.source = { ...analysis.source, imagePath: ... }` line is deleted entirely.

**Step 2: Verify build**

Run: `bun run build 2>&1 | head -30`
Expected: Build errors in files still referencing `imagePath` — fixed in Task 3.

---

### Task 3: Remove `imagePath` from the type system and frontend

**Files:**
- Modify: `src/components/extract/types.ts:26-33`
- Modify: `src/components/extract/SlideCard.tsx:30`
- Modify: `src/components/extract/store.test.ts:157`
- Modify: `src/components/extract/InspectorPanel.test.tsx:124`
- Modify: `src/components/extract/YamlModal.test.tsx:25`

**Step 1: Remove `imagePath` from `AnalysisResult`**

In `src/components/extract/types.ts`, change:
```typescript
export interface AnalysisResult {
  source: {
    image: string;
    dimensions: { w: number; h: number };
  };
  proposals: Proposal[];
}
```

**Step 2: Update `SlideCard.tsx` to always use `previewUrl`**

In `src/components/extract/SlideCard.tsx:30`, change:
```typescript
  const imgSrc = card.previewUrl;
```

The `previewUrl` is the object URL created from the original uploaded file — it's always available and is the same image at full resolution.

**Step 3: Remove `imagePath` from test fixtures**

In `src/components/extract/store.test.ts:157`, remove the `imagePath` property from the analysis fixture.

In `src/components/extract/InspectorPanel.test.tsx:124`, remove the `imagePath` property.

In `src/components/extract/YamlModal.test.tsx:25`, remove the `imagePath` property.

**Step 4: Verify build and tests**

Run: `bun run build`
Expected: Clean build, no errors.

Run: `bun run test`
Expected: All tests pass.

---

### Task 4: Delete the `/api/extract/image` endpoint

This endpoint only existed to serve temp files. No longer needed.

**Files:**
- Delete: `src/app/api/extract/image/route.ts`

**Step 1: Delete the file**

```bash
rm src/app/api/extract/image/route.ts
```

If the directory is now empty, remove it too:
```bash
rmdir src/app/api/extract/image
```

**Step 2: Verify no remaining references**

Run: `grep -r "api/extract/image" src/`
Expected: No results.

**Step 3: Verify build**

Run: `bun run build`
Expected: Clean build.

---

### Task 5: Clean up `.tmp/extract` references

The `.tmp/extract` directory and its contents are no longer created. Clean up any references.

**Step 1: Check for `.tmp` references**

Run: `grep -r "\.tmp" src/ scripts/`
Expected: No remaining references to `.tmp/extract`.

**Step 2: Manually delete leftover temp files (if any)**

```bash
rm -rf .tmp/extract
```

If `.tmp` is now empty:
```bash
rmdir .tmp 2>/dev/null || true
```

**Step 3: Check `.gitignore` for `.tmp`**

Run: `grep "\.tmp" .gitignore`
The `.tmp` entry can stay (harmless) or be removed if nothing else uses it.

---

### Task 6: Update the system prompt dimension guidance

With inline images at higher resolution, Claude will perceive larger dimensions (closer to actual). The "typically around 800-1100px wide" hint in the prompt is now misleading.

**Files:**
- Modify: `src/lib/extract/prompts.ts`

**Step 1: Update dimension guidance in `ANALYSIS_SYSTEM_PROMPT`**

Change line 57 from:
```
- CRITICAL: For source.dimensions, report ONLY what you visually perceive as the image size. Do NOT guess standard resolutions like 1920x1080, 1366x768, etc. If the image appears to be about 840 pixels wide, report 840, not 1366.
```
To:
```
- CRITICAL: For source.dimensions, report ONLY what you visually perceive as the image size. Do NOT guess standard resolutions like 1920x1080, 1366x768, etc. Report the dimensions as they appear to you.
```

**Step 2: Update `buildAnalysisPrompt` dimension hint**

Remove the "typically around 800-1100px wide" hint since it no longer applies:
```typescript
  prompt += `\n\nCRITICAL for source.dimensions: Report the pixel dimensions as you visually perceive the image. Do NOT round to standard resolutions (not 1366x768, not 1920x1080). Your coordinates and region boxes must be consistent with the dimensions you report.`;
```

(This is already done in Task 1 — verify it matches.)

**Step 3: Final verification**

Run: `bun run build`
Expected: Clean build.

Run: `bun run test`
Expected: All tests pass.

Run: `bun run lint`
Expected: No lint errors.

---

### Task 7: Commit

```bash
git add -A
git commit -m "feat(extract): send images as inline base64 content blocks for higher resolution analysis

- Replace temp file + Read tool pipeline with AsyncIterable<SDKUserMessage> prompt
- Image sent as inline base64 content block, bypassing Read tool downscaling
- Remove /api/extract/image endpoint (no longer needed)
- Remove imagePath from AnalysisResult type, use previewUrl everywhere
- Update dimension guidance prompts for higher-resolution perception

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
