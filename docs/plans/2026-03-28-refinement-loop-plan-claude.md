# Refinement Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire an iterative refinement loop that renders extracted templates, diffs against the original, and feeds visual evidence back to Claude for patching — with Iter/Diff views in the extract UI.

**Architecture:** After extraction, the refine endpoint (`POST /api/extract/refine`) orchestrates a server-side loop: compile proposals → render via Playwright → crop to `contentBounds` → diff via sharp → annotate diff with region bboxes → call Claude with three images (original, replica, annotated diff) + regions JSON → receive patched proposals → repeat. The client receives SSE events per iteration, fetches diff artifacts via blob URLs, and renders the refined proposals locally in the Iter view.

**Tech Stack:** Next.js API routes (SSE), Zustand store, sharp, Playwright (via existing render lib), Claude API (via existing agent SDK pattern)

**Design doc:** `docs/plans/2026-03-28-refinement-loop-design.md`

## Locked Decisions

- Refine is a real third `AnalysisStage` alongside extract and critique.
- `Iter` view renders refined proposals locally via `LayoutSlideRenderer` (same as extract/critique).
- `Diff` view fetches annotated heatmap from artifact URL, displayed as `<img>`.
- Refine route calls `renderSlideToImage()` and `compareImages()` directly — no internal HTTP calls.
- Diff artifacts served via fetchable URL, not base64 in SSE.
- `contentBounds` is a new extracted field for chrome-free crop region.
- `slideBounds` keeps its existing meaning (full screenshot bounds).
- Cancel uses real `AbortController` from client through `request.signal` on server.

---

### Task 1: Type extensions

Add `"refine"` to `AnalysisStage`, extend `viewMode`, and add refine-specific types.

**Files:**
- Modify: `src/components/extract/types.ts`

**Step 1: Extend types**

```ts
// Change AnalysisStage to include refine
export type AnalysisStage = "extract" | "critique" | "refine";

// Add to Inventory interface:
contentBounds?: { x: number; y: number; w: number; h: number };

// Add new interfaces for refine artifacts
export interface RefineIterationResult {
  iteration: number;
  mismatchRatio: number;
  proposals: Proposal[];
  regions: DiffRegion[];
  diffArtifactUrl: string;
}

export interface DiffRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  mismatchRatio: number;
}
```

Note: `DiffRegion` is already exported from `src/lib/render/compare.ts`. Import from there instead of duplicating — or re-export from types.ts for convenience.

**Step 2: Run existing tests to ensure no breakage**

Run: `bun run test -- src/components/extract/`
Expected: All existing tests pass (the type widening from `"extract" | "critique"` to include `"refine"` is backward compatible)

**Step 3: Commit**

```
feat(extract): extend AnalysisStage with "refine" and add refine types
```

---

### Task 2: Add `contentBounds` to extraction prompt

Update the extraction prompt to ask Claude to output `contentBounds` — the actual slide-content rectangle excluding presentation chrome.

**Files:**
- Modify: `src/lib/extract/prompts.ts`
- Modify: `src/lib/extract/normalize-analysis.ts` (normalize the new field)

**Step 1: Update the prompt**

In `ANALYSIS_SYSTEM_PROMPT`, within the inventory schema section, add `contentBounds` to the inventory output:

```
contentBounds: { x, y, w, h }  // the actual visible slide-content rectangle — excludes presentation chrome like nav dots, control bars, progress bars. If the entire image is slide content with no chrome, set to { x: 0, y: 0, w: source.dimensions.w, h: source.dimensions.h }.
```

Place this right after the existing `slideBounds` field description so the relationship is clear.

**Step 2: Normalize contentBounds**

In `normalizeAnalysisRegions()`, apply the same ratio scaling to `inventory.contentBounds` as is done for other regions. Use the existing `normalizeRegion()` helper.

**Step 3: Run extraction tests**

Run: `bun run test -- src/lib/extract/`
Expected: Existing tests pass. The prompt change doesn't break any test since tests don't assert exact prompt text.

**Step 4: Manual verification**

Run the dev server and analyze a screenshot with visible chrome. Check that the analysis result includes `inventory.contentBounds` with a reasonable crop rectangle.

**Step 5: Commit**

```
feat(extract): add contentBounds to inventory for chrome-free diffing
```

---

### Task 3: Diff image annotation

Create `annotate.ts` — overlays region bounding boxes with labels onto the diff heatmap image.

**Files:**
- Create: `src/lib/render/annotate.ts`
- Test: `src/lib/render/annotate.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { annotateDiffImage } from "./annotate";
import type { DiffRegion } from "./compare";

describe("annotateDiffImage", () => {
  it("returns a valid PNG with same dimensions", async () => {
    const base = await sharp({
      create: { width: 200, height: 200, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } },
    }).png().toBuffer();

    const regions: DiffRegion[] = [
      { x: 10, y: 10, w: 50, h: 50, mismatchRatio: 0.47 },
    ];

    const result = await annotateDiffImage(base, regions);
    expect(result[0]).toBe(0x89); // PNG magic
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
  });

  it("returns the image unchanged when no regions", async () => {
    const base = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } },
    }).png().toBuffer();

    const result = await annotateDiffImage(base, []);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/render/annotate.test.ts`
Expected: FAIL — module not found

**Step 3: Implement**

```ts
import sharp from "sharp";
import type { DiffRegion } from "./compare";

/**
 * Overlay region bounding boxes with labels onto a diff heatmap image.
 * Draws cyan outlines and "R1: 47%" labels at each region's top-left.
 */
export async function annotateDiffImage(
  diffImage: Buffer,
  regions: DiffRegion[],
): Promise<Buffer> {
  if (regions.length === 0) return diffImage;

  const meta = await sharp(diffImage).metadata();
  const width = meta.width!;
  const height = meta.height!;

  // Build SVG overlay with region boxes and labels
  const rects = regions.map((r, i) => {
    const label = `R${i + 1}: ${Math.round(r.mismatchRatio * 100)}%`;
    const x = Math.max(0, r.x);
    const y = Math.max(0, r.y);
    const w = Math.min(r.w, width - x);
    const h = Math.min(r.h, height - y);
    // Label positioned inside the top-left of the bbox
    const labelY = y + 14;
    return `
      <rect x="${x}" y="${y}" width="${w}" height="${h}"
            fill="none" stroke="cyan" stroke-width="2" />
      <rect x="${x}" y="${y}" width="${label.length * 8 + 8}" height="18"
            fill="rgba(0,0,0,0.7)" />
      <text x="${x + 4}" y="${labelY}"
            font-family="monospace" font-size="12" fill="cyan">${label}</text>
    `;
  }).join("");

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects}</svg>`,
  );

  return sharp(diffImage)
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toBuffer();
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/render/annotate.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(render): add annotateDiffImage() for region bbox overlay
```

---

### Task 4: Refine prompt builder

Create the prompt that feeds Claude the visual evidence and asks for surgical patches.

**Files:**
- Create: `src/lib/extract/refine-prompt.ts`
- Test: `src/lib/extract/refine-prompt.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildRefineSystemPrompt, buildRefineUserPrompt } from "./refine-prompt";

describe("buildRefineSystemPrompt", () => {
  it("includes surgical patch instruction", () => {
    const prompt = buildRefineSystemPrompt();
    expect(prompt).toContain("surgical");
    expect(prompt).toContain("Do NOT rewrite");
  });
});

describe("buildRefineUserPrompt", () => {
  it("includes mismatch ratio and regions", () => {
    const prompt = buildRefineUserPrompt({
      mismatchRatio: 0.23,
      regions: [{ x: 10, y: 20, w: 100, h: 50, mismatchRatio: 0.47 }],
      proposalsJson: '{"proposals":[]}',
    });
    expect(prompt).toContain("23");
    expect(prompt).toContain("R1");
    expect(prompt).toContain("47%");
    expect(prompt).toContain('"proposals"');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/extract/refine-prompt.test.ts`
Expected: FAIL — module not found

**Step 3: Implement**

```ts
import type { DiffRegion } from "@/lib/render/compare";

export function buildRefineSystemPrompt(): string {
  return `You are refining a slide replica template by comparing a rendered replica against the original screenshot.

You will receive three images:
1. The original reference screenshot
2. The rendered replica from the current template
3. An annotated diff heatmap showing mismatched regions

Plus structured data: mismatch regions with coordinates and severity, and the current proposals JSON.

## Rules

- Compare the original and replica images visually to understand what is wrong.
- Use the annotated diff and region data to prioritize the largest mismatches.
- Patch the proposals JSON surgically. Fix only the specific values causing visible mismatches.
- Do NOT rewrite proposals from scratch. Do NOT restructure, rename, or reorganize.
- Do NOT change template mechanics (Nunjucks syntax, parameter structure).
- Focus on visual fidelity: colors, font sizes, positions, gradients, spacing, opacity.
- If a region mismatch is caused by a missing element, add only the minimal node needed.
- If no clear fix is possible for a region, leave it unchanged.
- Return the complete proposals JSON array with your modifications applied.

## Output

Return ONLY a JSON array of proposals (same structure as input). Wrap in \`\`\`json fences.`;
}

export interface RefinePromptContext {
  mismatchRatio: number;
  regions: DiffRegion[];
  proposalsJson: string;
}

export function buildRefineUserPrompt(ctx: RefinePromptContext): string {
  const pct = Math.round(ctx.mismatchRatio * 100);
  const regionList = ctx.regions
    .map((r, i) =>
      `R${i + 1}: (${r.x}, ${r.y}, ${r.w}×${r.h}) — ${Math.round(r.mismatchRatio * 100)}% mismatch`,
    )
    .join("\n");

  return `Overall mismatch: ${pct}%

Mismatch regions (largest first):
${regionList || "No significant mismatch regions detected."}

Current proposals:
\`\`\`json
${ctx.proposalsJson}
\`\`\`

Compare the original screenshot (image 1) with the rendered replica (image 2). The annotated diff (image 3) highlights mismatched areas in red with labeled region boxes.

Patch the proposals to reduce the visual mismatch. Return the full proposals JSON array.`;
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/extract/refine-prompt.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(extract): add refine prompt builder for visual-evidence patching
```

---

### Task 5: Artifact storage and GET route

Create an in-memory artifact store and a GET route to serve diff PNGs by ID.

**Files:**
- Create: `src/lib/extract/artifact-store.ts`
- Create: `src/app/api/extract/refine/artifacts/[artifactId]/route.ts`

**Step 1: Implement artifact store**

```ts
import { randomUUID } from "crypto";

interface Artifact {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
}

const artifacts = new Map<string, Artifact>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Store a buffer and return a fetchable artifact ID. */
export function storeArtifact(buffer: Buffer, contentType = "image/png"): string {
  cleanup();
  const id = randomUUID();
  artifacts.set(id, { buffer, contentType, createdAt: Date.now() });
  return id;
}

/** Retrieve an artifact by ID. Returns null if expired or not found. */
export function getArtifact(id: string): Artifact | null {
  const artifact = artifacts.get(id);
  if (!artifact) return null;
  if (Date.now() - artifact.createdAt > TTL_MS) {
    artifacts.delete(id);
    return null;
  }
  return artifact;
}

function cleanup(): void {
  const now = Date.now();
  for (const [id, artifact] of artifacts) {
    if (now - artifact.createdAt > TTL_MS) {
      artifacts.delete(id);
    }
  }
}
```

**Step 2: Implement the GET route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getArtifact } from "@/lib/extract/artifact-store";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  const { artifactId } = await params;
  const artifact = getArtifact(artifactId);

  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  return new NextResponse(artifact.buffer, {
    headers: {
      "Content-Type": artifact.contentType,
      "Cache-Control": "private, max-age=600",
    },
  });
}
```

**Step 3: Commit**

```
feat(extract): add artifact store and GET route for diff images
```

---

### Task 6: Store extensions

Add refine state, actions, and stage resolution to the Zustand store.

**Files:**
- Modify: `src/components/extract/store.ts`
- Modify: `src/components/extract/stage-utils.ts`

**Step 1: Extend SlideCard with refine fields**

Add to the `SlideCard` interface:

```ts
// View mode now includes iter and diff
viewMode: "original" | "extract" | "critique" | "iter" | "diff";

// selectedTemplateIndex now includes refine
selectedTemplateIndex: Record<AnalysisStage, number>;  // AnalysisStage already includes "refine"

// Refine state
refineAnalysis: AnalysisResult | null;
refineStatus: "idle" | "running" | "done" | "error";
refineIteration: number;
refineResult: RefineIterationResult | null;
refineHistory: RefineIterationResult[];
refineError: string | null;
autoRefine: boolean;
normalizedImage: File | null;
contentBounds: { x: number; y: number; w: number; h: number } | null;
```

Update `createCard()` to initialize the new fields with defaults:

```ts
refineAnalysis: null,
refineStatus: "idle",
refineIteration: 0,
refineResult: null,
refineHistory: [],
refineError: null,
autoRefine: true,
normalizedImage: null,
contentBounds: null,
```

**Step 2: Add store actions**

```ts
startRefinement: (id: string) => void;
updateRefinement: (id: string, result: RefineIterationResult) => void;
completeRefinement: (id: string) => void;
failRefinement: (id: string, error: string) => void;
cancelRefinement: (id: string) => void;
setAutoRefine: (id: string, value: boolean) => void;
setNormalizedImage: (id: string, file: File) => void;
setContentBounds: (id: string, bounds: { x: number; y: number; w: number; h: number } | null) => void;
```

Implement each action following the existing pattern (use `set()` with immer-style update on `cards` map).

Key behavior:
- `startRefinement`: set refineStatus="running", refineIteration=0, clear history/error
- `updateRefinement`: increment refineIteration, set refineResult, push to refineHistory, update refineAnalysis with new proposals (wrapping in AnalysisResult shape from the card's existing source)
- `completeRefinement`: set refineStatus="done"
- `failRefinement`: set refineStatus="error", store error message
- `cancelRefinement`: set refineStatus="done" (keep best result)

**Step 3: Extend stage resolution**

In `stage-utils.ts`, update `getStageAnalysis`:

```ts
export function getStageAnalysis(
  card: SlideCard,
  stage: AnalysisStage,
): AnalysisResult | null {
  if (stage === "extract") {
    return card.pass1Analysis ?? card.analysis;
  }
  if (stage === "critique") {
    if (!card.pass2) return null;
    return card.analysis;
  }
  if (stage === "refine") {
    return card.refineAnalysis;
  }
  return null;
}
```

**Step 4: Update setViewMode**

Extend `setViewMode` to handle `"iter"` → auto-set `activeStage: "refine"` and `"diff"` → auto-set `activeStage: "refine"`.

**Step 5: Run existing tests**

Run: `bun run test -- src/components/extract/`
Expected: All pass. Existing tests use `"extract" | "critique"` which are still valid members of the widened union.

**Step 6: Commit**

```
feat(extract): add refine stage state and actions to store
```

---

### Task 7: Refine SSE API route

The core: orchestrate the render → diff → annotate → Claude loop, streaming events.

**Files:**
- Create: `src/app/api/extract/refine/route.ts`
- Create: `src/lib/extract/refine.ts`

**Step 1: Implement the refine orchestration logic**

Create `src/lib/extract/refine.ts`:

```ts
import sharp from "sharp";
import { renderSlideToImage } from "@/lib/render/screenshot";
import { compareImages, type DiffResult } from "@/lib/render/compare";
import { annotateDiffImage } from "@/lib/render/annotate";
import { compileProposalPreview } from "@/lib/extract/compile-preview";
import { storeArtifact } from "@/lib/extract/artifact-store";
import type { Proposal } from "@/components/extract/types";

export interface RefineIterationOutput {
  iteration: number;
  mismatchRatio: number;
  regions: DiffResult["regions"];
  diffArtifactUrl: string;
  replicaBuffer: Buffer;       // for sending to Claude
  annotatedDiffBuffer: Buffer; // for sending to Claude
}

/**
 * Run one render → diff → annotate cycle.
 * Returns iteration output with artifact URL and buffers for the Claude call.
 */
export async function runRenderDiffCycle(
  proposals: Proposal[],
  referenceImage: Buffer,
  contentBounds: { x: number; y: number; w: number; h: number } | null,
  iteration: number,
): Promise<RefineIterationOutput> {
  // 1. Find the slide-scope proposal and compile it
  const slideProposal = proposals.find((p) => p.scope === "slide");
  if (!slideProposal) throw new Error("No slide-scope proposal found");

  const canvasW = 1920;
  const canvasH = 1080;
  const layoutSlide = compileProposalPreview(slideProposal, proposals, canvasW, canvasH);

  // 2. Render to PNG
  const replicaFull = await renderSlideToImage(layoutSlide, {
    width: canvasW,
    height: canvasH,
  });

  // 3. Crop both images to contentBounds if available
  let replicaCropped = replicaFull;
  let referenceCropped = referenceImage;

  if (contentBounds) {
    const { x, y, w, h } = contentBounds;
    referenceCropped = await sharp(referenceImage)
      .extract({ left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(h) })
      .png()
      .toBuffer();
    // Render is already 1920x1080 slide content, but crop to match if needed
    const replicaMeta = await sharp(replicaFull).metadata();
    if (replicaMeta.width !== Math.round(w) || replicaMeta.height !== Math.round(h)) {
      replicaCropped = await sharp(replicaFull)
        .resize(Math.round(w), Math.round(h), { fit: "fill" })
        .png()
        .toBuffer();
    }
  }

  // 4. Compare
  const diff = await compareImages(referenceCropped, replicaCropped);

  // 5. Annotate
  const annotated = await annotateDiffImage(diff.diffImage, diff.regions);

  // 6. Store annotated diff as fetchable artifact
  const artifactId = storeArtifact(annotated);
  const diffArtifactUrl = `/api/extract/refine/artifacts/${artifactId}`;

  return {
    iteration,
    mismatchRatio: diff.mismatchRatio,
    regions: diff.regions,
    diffArtifactUrl,
    replicaBuffer: replicaFull,
    annotatedDiffBuffer: annotated,
  };
}
```

**Step 2: Implement the SSE route**

Create `src/app/api/extract/refine/route.ts`:

```ts
import { NextRequest } from "next/server";
import { runRenderDiffCycle } from "@/lib/extract/refine";
import { buildRefineSystemPrompt, buildRefineUserPrompt } from "@/lib/extract/refine-prompt";
import { readImageSize } from "@/lib/extract/normalize-analysis";
import type { Proposal } from "@/components/extract/types";

export const runtime = "nodejs";

const DEFAULT_MAX_ITERATIONS = 3;
const DEFAULT_MISMATCH_THRESHOLD = 0.05;

export async function POST(request: NextRequest): Promise<Response> {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const proposalsJson = formData.get("proposals") as string | null;
  const model = (formData.get("model") as string) || "claude-opus-4-6";
  const effort = (formData.get("effort") as string) || "medium";
  const maxIterations = parseInt(formData.get("maxIterations") as string, 10) || DEFAULT_MAX_ITERATIONS;
  const mismatchThreshold = parseFloat(formData.get("mismatchThreshold") as string) || DEFAULT_MISMATCH_THRESHOLD;
  const contentBoundsJson = formData.get("contentBounds") as string | null;

  if (!image || !proposalsJson) {
    return new Response(JSON.stringify({ error: "Missing image or proposals" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const imageBuffer = Buffer.from(await image.arrayBuffer());
  let proposals: Proposal[];
  try {
    proposals = JSON.parse(proposalsJson);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid proposals JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentBounds = contentBoundsJson ? JSON.parse(contentBoundsJson) : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        send("refine:start", { iteration: 1, maxIterations });

        let currentProposals = proposals;

        for (let i = 1; i <= maxIterations; i++) {
          if (request.signal.aborted) {
            send("refine:aborted", { iteration: i });
            break;
          }

          // Render + diff
          const cycle = await runRenderDiffCycle(
            currentProposals, imageBuffer, contentBounds, i,
          );

          send("refine:diff", {
            iteration: i,
            mismatchRatio: cycle.mismatchRatio,
            diffArtifactUrl: cycle.diffArtifactUrl,
            regions: cycle.regions,
          });

          // Check convergence
          if (cycle.mismatchRatio < mismatchThreshold) {
            send("refine:done", {
              finalIteration: i,
              mismatchRatio: cycle.mismatchRatio,
              converged: true,
              proposals: currentProposals,
            });
            break;
          }

          // Last iteration — no more Claude calls
          if (i === maxIterations) {
            send("refine:done", {
              finalIteration: i,
              mismatchRatio: cycle.mismatchRatio,
              converged: false,
              proposals: currentProposals,
            });
            break;
          }

          if (request.signal.aborted) {
            send("refine:aborted", { iteration: i });
            break;
          }

          // Call Claude for patching
          // Use the same agent SDK pattern as analyze route
          send("refine:thinking", { iteration: i, text: "Analyzing visual differences..." });

          const patchedProposals = await callClaudeRefine(
            imageBuffer,
            cycle.replicaBuffer,
            cycle.annotatedDiffBuffer,
            cycle.mismatchRatio,
            cycle.regions,
            currentProposals,
            model,
            effort,
            image.type || "image/png",
            (event, data) => send(event, { iteration: i, ...data }),
            request.signal,
          );

          if (patchedProposals) {
            currentProposals = patchedProposals;
            send("refine:patch", { iteration: i, proposals: currentProposals });
          }

          send("refine:complete", { iteration: i, mismatchRatio: cycle.mismatchRatio });
        }
      } catch (err) {
        send("refine:error", {
          error: err instanceof Error ? err.message : "Refinement failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

The `callClaudeRefine` function follows the same pattern as `runPass` in the analyze route — use the agent SDK with the refine system prompt, three images as content blocks, and the refine user prompt. Parse the response for a JSON proposals array.

This function is the largest piece of new logic. It should:
1. Build the system prompt via `buildRefineSystemPrompt()`
2. Build image content blocks (original, replica, annotated diff) as base64
3. Build the user prompt via `buildRefineUserPrompt()`
4. Call Claude via the agent SDK with `maxTurns: 1`
5. Stream thinking/text events back via the send callback
6. Parse the JSON proposals array from the response
7. Return the parsed proposals or null on failure

Refer to `src/app/api/extract/analyze/route.ts` lines 95-170 for the exact agent SDK query pattern (`buildQueryOptions`, `query.on("text")`, `query.result`).

**Step 3: Commit**

```
feat(extract): add refine SSE route with render-diff-patch loop
```

---

### Task 8: UI — AnalyzeForm auto-refine checkbox

Add the checkbox to the analyze form, following the existing critique checkbox pattern.

**Files:**
- Modify: `src/components/extract/InspectorPanel.tsx`
- Modify: `src/components/extract/ExtractCanvas.tsx` (pass autoRefine to analyze handler)

**Step 1: Add checkbox to AnalyzeForm**

In the AnalyzeForm section of InspectorPanel.tsx, after the critique checkbox, add:

```tsx
<label>
  <input
    type="checkbox"
    checked={card.autoRefine}
    onChange={(e) => setAutoRefine(card.id, e.target.checked)}
  />
  Auto-refine
</label>
```

Follow the exact same pattern as the critique checkbox.

**Step 2: Commit**

```
feat(extract): add auto-refine checkbox to AnalyzeForm
```

---

### Task 9: UI — View mode toggles (Iter/Diff)

Add Iter and Diff to the toggle bar in SlideCard, with iteration badge.

**Files:**
- Modify: `src/components/extract/SlideCard.tsx`

**Step 1: Extend previewOptions**

After the existing critique option, add:

```tsx
...(card.refineIteration > 0
  ? [
      {
        value: "iter" as const,
        label: `Iter ${card.refineIteration}/${card.refineMaxIterations ?? 3}${
          card.refineResult ? ` · ${Math.round(card.refineResult.mismatchRatio * 100)}%` : ""
        }`,
      },
      { value: "diff" as const, label: "Diff" },
    ]
  : []),
```

**Step 2: Handle Iter view rendering**

In the view mode switch, add a case for `"iter"` that renders `ReplicaPreview` using the refine-stage proposals:

```tsx
{card.viewMode === "iter" && refineSlideProposal && (
  <ReplicaPreview
    proposal={refineSlideProposal}
    allProposals={card.refineAnalysis?.proposals ?? []}
    canvasW={canvasW}
    canvasH={canvasH}
    displayW={displayW}
    displayH={displayH}
  />
)}
```

Where `refineSlideProposal` is derived from `getStageAnalysis(card, "refine")?.proposals`.

**Step 3: Handle Diff view rendering**

For `"diff"`, fetch the artifact URL and display as an image:

```tsx
{card.viewMode === "diff" && card.refineResult?.diffArtifactUrl && (
  <DiffImageView url={card.refineResult.diffArtifactUrl} />
)}
```

`DiffImageView` is a small component that:
1. Fetches the URL on mount (or when URL changes)
2. Creates a blob URL via `URL.createObjectURL()`
3. Renders as `<img src={blobUrl} />`
4. Revokes the blob URL on cleanup

**Step 4: Commit**

```
feat(extract): add Iter and Diff view mode toggles
```

---

### Task 10: UI — InspectorPanel Refine tab

Add a "Refine" tab to the inspector alongside Extract and Critique.

**Files:**
- Modify: `src/components/extract/InspectorPanel.tsx` (or TemplateInspector component)

**Step 1: Add Refine stage tab**

Follow the existing Extract/Critique tab pattern. Add a "Refine" button that:
- Only appears when `card.refineStatus !== "idle"`
- Calls `setActiveStage(card.id, "refine")` on click
- Shows iteration count and mismatch ratio in the tab label

**Step 2: Show refine-specific info**

When `activeStage === "refine"`, display:
- Current iteration number
- Mismatch ratio (as percentage)
- Convergence status
- Links to diff artifacts per iteration (from `refineHistory`)
- Standard proposal YAML view (reusing existing InlineYaml component)

**Step 3: Commit**

```
feat(extract): add Refine stage tab to InspectorPanel
```

---

### Task 11: Client-side SSE consumption for refine events

Wire the refine endpoint into ExtractCanvas so the UI updates live during refinement.

**Files:**
- Modify: `src/components/extract/ExtractCanvas.tsx`

**Step 1: Add handleRefine callback**

Follow the exact same pattern as `handleAnalyze` but for the refine endpoint:

```ts
const handleRefine = useCallback(async (cardId: string) => {
  const card = useExtractStore.getState().cards.get(cardId);
  if (!card || !card.analysis) return;

  startRefinement(cardId);

  const formData = new FormData();
  formData.append("image", card.normalizedImage ?? card.file);
  formData.append("proposals", JSON.stringify(card.analysis.proposals));
  formData.append("contentBounds", JSON.stringify(card.contentBounds));
  // ... model, effort, maxIterations, mismatchThreshold

  const abortController = new AbortController();
  // Store abort controller reference for cancel button

  const response = await fetch("/api/extract/refine", {
    method: "POST",
    body: formData,
    signal: abortController.signal,
  });

  // Read SSE stream — same parsing pattern as handleAnalyze
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    let currentEvent = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7);
      } else if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        handleRefineEvent(cardId, currentEvent, data);
      }
    }
  }
}, [startRefinement, updateRefinement, completeRefinement, failRefinement]);
```

**Step 2: Implement event handler**

```ts
function handleRefineEvent(cardId: string, event: string, data: unknown) {
  switch (event) {
    case "refine:diff":
      // Update store with diff result (mismatchRatio, regions, artifactUrl)
      break;
    case "refine:patch":
      // Call updateRefinement with new proposals
      break;
    case "refine:complete":
      // Iteration complete
      break;
    case "refine:done":
      completeRefinement(cardId);
      break;
    case "refine:error":
      failRefinement(cardId, data.error);
      break;
    case "refine:aborted":
      // Keep best result
      break;
    case "refine:thinking":
    case "refine:text":
      appendLog(cardId, { type: "thinking", content: data.text, timestamp: Date.now(), stage: "refine" });
      break;
  }
}
```

**Step 3: Auto-trigger after analysis**

In `handleAnalyze`, after `completeAnalysis` is called, check if `card.autoRefine` is true and trigger `handleRefine(cardId)`.

**Step 4: Add manual trigger**

When `autoRefine` is false and analysis is complete, show a "Refine" button that calls `handleRefine(cardId)`.

**Step 5: Commit**

```
feat(extract): wire refine SSE consumption and auto-trigger
```

---

### Task 12: Capture normalized image during analysis

Ensure the downscaled image from extraction is preserved for refinement.

**Files:**
- Modify: `src/components/extract/ExtractCanvas.tsx`

**Step 1: Store normalized image after downscale**

In `handleAnalyze`, after `downscaleImage()` returns, call:

```ts
const normalizedFile = await downscaleImage(card.file);
setNormalizedImage(cardId, normalizedFile);
```

**Step 2: Extract contentBounds from analysis result**

When `completeAnalysis` fires with the result, extract `contentBounds` from the inventory:

```ts
const contentBounds = result.inventory?.contentBounds ?? null;
setContentBounds(cardId, contentBounds);
```

**Step 3: Commit**

```
feat(extract): capture normalized image and contentBounds for refinement
```

---

### Task 13: Integration test

End-to-end test of the refine flow.

**Files:**
- Create: `e2e/refine.spec.ts`

**Step 1: Write E2E test**

Test the refine API endpoint directly (not through the UI):

```ts
import { test, expect } from "@playwright/test";

test("POST /api/extract/refine returns SSE events", async ({ request }) => {
  // This test requires a running dev server and a valid analysis result.
  // Use a minimal synthetic scenario:
  // 1. Create a simple slide proposal
  // 2. Post to refine with a red solid image as reference
  // 3. Assert we get refine:start, refine:diff, and refine:done events

  // Note: Full integration requires a Claude API key.
  // For CI, this test may need to be marked as manual/skipped.
  test.skip(!process.env.ANTHROPIC_API_KEY, "Requires API key");

  // ... construct formData with image + proposals
  // ... assert SSE event sequence
});
```

**Step 2: Commit**

```
test(extract): add E2E smoke test for refine endpoint
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Type extensions (AnalysisStage, refine types) | `types.ts` |
| 2 | `contentBounds` in extraction prompt + normalization | `prompts.ts`, `normalize-analysis.ts` |
| 3 | Diff image annotation (`annotateDiffImage`) | `annotate.ts`, `annotate.test.ts` |
| 4 | Refine prompt builder | `refine-prompt.ts`, `refine-prompt.test.ts` |
| 5 | Artifact store + GET route | `artifact-store.ts`, `artifacts/[artifactId]/route.ts` |
| 6 | Store extensions (refine state + actions + stage resolution) | `store.ts`, `stage-utils.ts` |
| 7 | Refine SSE route (render → diff → Claude loop) | `refine/route.ts`, `refine.ts` |
| 8 | UI: Auto-refine checkbox | `InspectorPanel.tsx`, `ExtractCanvas.tsx` |
| 9 | UI: Iter/Diff view toggles | `SlideCard.tsx` |
| 10 | UI: Refine inspector tab | `InspectorPanel.tsx` |
| 11 | Client SSE consumption + auto-trigger | `ExtractCanvas.tsx` |
| 12 | Capture normalized image + contentBounds | `ExtractCanvas.tsx` |
| 13 | Integration test | `e2e/refine.spec.ts` |

## Dependency Order

```
Task 1 (types) ─────────────────────────────┐
Task 2 (contentBounds prompt) ──────────────┤
Task 3 (annotate) ──────────────────────────┤
Task 4 (refine prompt) ────────────────────┤
Task 5 (artifact store) ───────────────────┤
                                            ├─→ Task 7 (refine route)
Task 6 (store) ────────────────────────────┤
                                            ├─→ Task 8  (checkbox)
                                            ├─→ Task 9  (toggles)
                                            ├─→ Task 10 (inspector tab)
                                            ├─→ Task 11 (SSE consumption)
                                            ├─→ Task 12 (capture normalized)
                                            └─→ Task 13 (E2E test)
```

Tasks 1–6 can be done in parallel (no interdependencies). Tasks 7–13 depend on the foundation.
