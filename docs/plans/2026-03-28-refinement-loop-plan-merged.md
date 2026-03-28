# Refinement Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire an iterative refinement loop that renders extracted templates, diffs against the original, and feeds visual evidence back to Claude for patching — with Iter/Diff views in the extract UI.

**Architecture:** After extraction, `runRefinementLoop()` orchestrates the server-side loop: compile proposals → render via `renderSlideToImage()` → crop to `source.contentBounds` → diff via `compareImages()` → annotate with region bboxes → call Claude with three images + regions JSON → receive patched proposals → repeat. The loop is a testable function with an `onEvent` callback; the SSE route is a thin adapter. The client receives SSE events, fetches diff artifacts via blob URLs, and renders refined proposals locally in the Iter view.

**Tech Stack:** Next.js API routes (SSE), Zustand store, sharp, Playwright (via existing render lib), Claude API (via existing agent SDK pattern)

**Design doc:** `docs/plans/2026-03-28-refinement-loop-design.md`

## Locked Decisions

- Refine is a real third `AnalysisStage` alongside extract and critique.
- `Iter` view renders refined proposals locally via `LayoutSlideRenderer` (same as extract/critique).
- `Diff` view fetches annotated heatmap from artifact URL, displayed as `<img>`. Blob URL tracked in store and revoked on replace/reset/remove.
- Refine route calls `renderSlideToImage()` and `compareImages()` directly — no internal HTTP calls.
- Diff artifacts served via fetchable URL, not base64 in SSE.
- `source.contentBounds` is a new extracted field for chrome-free crop region (beside `dimensions`, not in `inventory`).
- `slideBounds` keeps its existing meaning (full screenshot bounds).
- Cancel uses real `AbortController` from client through `request.signal` on server.
- Refine request sends `baseAnalysis` so the server can reconstruct `refineAnalysis` deterministically.
- `resetAnalysis()` clears refine state. `removeCard()` revokes blob URLs.

## Scope

Explicitly out of scope:

- Block extraction / factoring
- Persistence of iteration history or artifacts to disk
- Replacing `slide-diff.mjs`
- Changing the existing render endpoint contract
- Streaming full-size base64 images in SSE

---

### Task 1: Type extensions

Add `"refine"` to `AnalysisStage`, add `source.contentBounds`, and add refine-specific types.

**Files:**
- Modify: `src/components/extract/types.ts`

**Step 1: Extend types**

```ts
// Widen AnalysisStage
export type AnalysisStage = "extract" | "critique" | "refine";

// Add contentBounds to AnalysisResult.source (beside dimensions)
export interface AnalysisResult {
  source: {
    image: string;
    dimensions: { w: number; h: number };
    reportedDimensions?: { w: number; h: number };
    contentBounds?: { x: number; y: number; w: number; h: number };
  };
  inventory?: Inventory;
  provenance?: {
    usedCritique: boolean;
    pass1: AnalysisProvenance | null;
    pass2: AnalysisProvenance | null;
  };
  proposals: Proposal[];
}

// Add refine iteration result type
export interface RefineIterationResult {
  iteration: number;
  mismatchRatio: number;
  proposals: Proposal[];
  regions: import("@/lib/render/compare").DiffRegion[];
  diffArtifactUrl: string;
}
```

**Step 2: Run existing tests**

Run: `bun run test -- src/components/extract/`
Expected: All pass (union widening is backward compatible)

**Step 3: Commit**

```
feat(extract): extend AnalysisStage with "refine", add source.contentBounds and refine types
```

---

### Task 2: Add `contentBounds` to extraction prompt and normalization

Update the prompt to ask Claude to output `source.contentBounds`, and normalize it alongside other regions.

**Files:**
- Modify: `src/lib/extract/prompts.ts`
- Modify: `src/lib/extract/normalize-analysis.ts`

**Step 1: Update the prompt**

In `ANALYSIS_SYSTEM_PROMPT`, within the source schema section (near `dimensions`), add:

```
contentBounds: { x, y, w, h }  // the actual visible slide-content rectangle — excludes presentation chrome like nav dots, control bars, progress bars. If the entire image is slide content with no chrome, set equal to { x: 0, y: 0, w: dimensions.w, h: dimensions.h }.
```

Place this right after `dimensions` in the source output schema so the semantic grouping is clear.

**Step 2: Normalize contentBounds**

In `normalizeAnalysisRegions()`, if `analysis.source?.contentBounds` exists, apply the same ratio scaling using the existing `normalizeRegion()` helper:

```ts
if (analysis.source?.contentBounds) {
  analysis.source.contentBounds = normalizeRegion(
    analysis.source.contentBounds, ratioX, ratioY, bounds,
  );
}
```

Add a fallback: if `contentBounds` is absent or invalid (zero area, exceeds image bounds), default to full image bounds `{ x: 0, y: 0, w: actualSize.w, h: actualSize.h }`.

**Step 3: Run tests**

Run: `bun run test -- src/lib/extract/`
Expected: Pass

**Step 4: Commit**

```
feat(extract): add source.contentBounds to prompt and normalization
```

---

### Task 3: Diff image annotation

Overlay region bounding boxes with labels onto the diff heatmap.

**Files:**
- Create: `src/lib/render/annotate.ts`
- Test: `src/lib/render/annotate.test.ts`

**Step 1: Write failing tests**

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
    expect(result[0]).toBe(0x89);
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

**Step 2: Run tests — expect failure**

Run: `bun run test -- src/lib/render/annotate.test.ts`

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

  const rects = regions.map((r, i) => {
    const label = `R${i + 1}: ${Math.round(r.mismatchRatio * 100)}%`;
    const x = Math.max(0, Math.min(r.x, width - 1));
    const y = Math.max(0, Math.min(r.y, height - 1));
    const w = Math.min(r.w, width - x);
    const h = Math.min(r.h, height - y);
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

**Step 4: Run tests — expect pass**

Run: `bun run test -- src/lib/render/annotate.test.ts`

**Step 5: Commit**

```
feat(render): add annotateDiffImage() for region bbox overlay
```

---

### Task 4: Refine prompt builder

Create the prompt that feeds Claude visual evidence and asks for surgical patches.

**Files:**
- Create: `src/lib/extract/refine-prompt.ts`
- Test: `src/lib/extract/refine-prompt.test.ts`

**Step 1: Write failing tests**

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

**Step 2: Run tests — expect failure**

Run: `bun run test -- src/lib/extract/refine-prompt.test.ts`

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

**Step 4: Run tests — expect pass**

Run: `bun run test -- src/lib/extract/refine-prompt.test.ts`

**Step 5: Commit**

```
feat(extract): add refine prompt builder for visual-evidence patching
```

---

### Task 5: Artifact store and GET route

In-memory store with TTL for diff images, plus a GET route to serve them.

**Files:**
- Create: `src/lib/extract/refine-artifacts.ts`
- Create: `src/app/api/extract/refine/artifacts/[artifactId]/route.ts`
- Test: `src/lib/extract/refine-artifacts.test.ts`

**Step 1: Write failing tests**

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { putRefineArtifact, getRefineArtifact, sweepRefineArtifacts } from "./refine-artifacts";

describe("refine artifact store", () => {
  beforeEach(() => {
    sweepRefineArtifacts(0); // clear all
  });

  it("stores and retrieves an artifact", () => {
    const buf = Buffer.from("test-png-data");
    const id = putRefineArtifact({ buffer: buf, contentType: "image/png", createdAt: Date.now() });
    const artifact = getRefineArtifact(id);
    expect(artifact).not.toBeNull();
    expect(artifact!.buffer.toString()).toBe("test-png-data");
  });

  it("returns null for unknown ID", () => {
    expect(getRefineArtifact("nonexistent")).toBeNull();
  });

  it("expires artifacts after TTL", () => {
    const buf = Buffer.from("old");
    const id = putRefineArtifact({ buffer: buf, contentType: "image/png", createdAt: Date.now() - 20 * 60 * 1000 });
    expect(getRefineArtifact(id)).toBeNull();
  });
});
```

**Step 2: Run tests — expect failure**

Run: `bun run test -- src/lib/extract/refine-artifacts.test.ts`

**Step 3: Implement artifact store**

```ts
import { randomUUID } from "crypto";

export interface RefineArtifact {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const artifacts = new Map<string, RefineArtifact>();

export function putRefineArtifact(artifact: RefineArtifact): string {
  sweepRefineArtifacts();
  const id = randomUUID();
  artifacts.set(id, artifact);
  return id;
}

export function getRefineArtifact(id: string): RefineArtifact | null {
  const artifact = artifacts.get(id);
  if (!artifact) return null;
  if (Date.now() - artifact.createdAt > TTL_MS) {
    artifacts.delete(id);
    return null;
  }
  return artifact;
}

/** Remove expired artifacts. Pass ttl=0 to clear all. */
export function sweepRefineArtifacts(ttl = TTL_MS): void {
  const cutoff = Date.now() - ttl;
  for (const [id, artifact] of artifacts) {
    if (artifact.createdAt <= cutoff) {
      artifacts.delete(id);
    }
  }
}
```

**Step 4: Implement GET route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getRefineArtifact } from "@/lib/extract/refine-artifacts";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  const { artifactId } = await params;
  const artifact = getRefineArtifact(artifactId);

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

**Step 5: Run tests — expect pass**

Run: `bun run test -- src/lib/extract/refine-artifacts.test.ts`

**Step 6: Commit**

```
feat(extract): add refine artifact store and GET route
```

---

### Task 6: Crop helper

A small utility for cropping images to `contentBounds` with validation and fallback.

**Files:**
- Create: `src/lib/render/crop.ts`
- Test: `src/lib/render/crop.test.ts`

**Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { cropToContentBounds } from "./crop";

async function solidPng(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } })
    .png().toBuffer();
}

describe("cropToContentBounds", () => {
  it("crops to the specified bounds", async () => {
    const img = await solidPng(200, 200);
    const cropped = await cropToContentBounds(img, { x: 10, y: 20, w: 100, h: 80 });
    const meta = await sharp(cropped).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(80);
  });

  it("returns the original when contentBounds is null", async () => {
    const img = await solidPng(200, 200);
    const result = await cropToContentBounds(img, null);
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
  });

  it("clamps bounds that exceed image dimensions", async () => {
    const img = await solidPng(100, 100);
    const cropped = await cropToContentBounds(img, { x: 50, y: 50, w: 200, h: 200 });
    const meta = await sharp(cropped).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(50);
  });

  it("returns original for zero-area bounds", async () => {
    const img = await solidPng(200, 200);
    const result = await cropToContentBounds(img, { x: 0, y: 0, w: 0, h: 0 });
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);
  });
});
```

**Step 2: Run tests — expect failure**

Run: `bun run test -- src/lib/render/crop.test.ts`

**Step 3: Implement**

```ts
import sharp from "sharp";

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Crop an image to contentBounds. Returns the original if bounds are
 * null, invalid, or zero-area.
 */
export async function cropToContentBounds(
  image: Buffer,
  contentBounds: Bounds | null | undefined,
): Promise<Buffer> {
  if (!contentBounds) return image;

  const meta = await sharp(image).metadata();
  const imgW = meta.width!;
  const imgH = meta.height!;

  const left = Math.max(0, Math.round(contentBounds.x));
  const top = Math.max(0, Math.round(contentBounds.y));
  const width = Math.min(Math.round(contentBounds.w), imgW - left);
  const height = Math.min(Math.round(contentBounds.h), imgH - top);

  if (width <= 0 || height <= 0) return image;

  return sharp(image)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
}
```

**Step 4: Run tests — expect pass**

Run: `bun run test -- src/lib/render/crop.test.ts`

**Step 5: Commit**

```
feat(render): add cropToContentBounds() with validation and fallback
```

---

### Task 7: Store extensions

Add refine state, actions, stage resolution, and cleanup to the Zustand store.

**Files:**
- Modify: `src/components/extract/store.ts`
- Modify: `src/components/extract/stage-utils.ts`

**Step 1: Extend SlideCard interface**

Add to `SlideCard`:

```ts
// viewMode extended
viewMode: "original" | "extract" | "critique" | "iter" | "diff";

// selectedTemplateIndex gains refine key (AnalysisStage already includes "refine")
selectedTemplateIndex: Record<AnalysisStage, number>;

// Refine stage
refineAnalysis: AnalysisResult | null;
refineStatus: "idle" | "running" | "done" | "error";
refineIteration: number;
refineResult: RefineIterationResult | null;
refineHistory: RefineIterationResult[];
refineError: string | null;
autoRefine: boolean;
normalizedImage: File | null;
diffObjectUrl: string | null;   // blob URL for current diff image, revoked on replace/reset
```

Update `createCard()` defaults:

```ts
refineAnalysis: null,
refineStatus: "idle",
refineIteration: 0,
refineResult: null,
refineHistory: [],
refineError: null,
autoRefine: true,
normalizedImage: null,
diffObjectUrl: null,
```

**Step 2: Add store actions**

```ts
setNormalizedImage: (id: string, file: File) => void;
setAutoRefine: (id: string, enabled: boolean) => void;
startRefinement: (id: string) => void;
updateRefinement: (id: string, result: RefineIterationResult) => void;
setDiffObjectUrl: (id: string, url: string | null) => void;
completeRefinement: (id: string) => void;
failRefinement: (id: string, error: string) => void;
abortRefinement: (id: string) => void;
```

Key behaviors:

- `startRefinement`: set refineStatus="running", refineIteration=0, clear history/error/result, revoke existing diffObjectUrl
- `updateRefinement`: increment refineIteration, set refineResult, push to refineHistory, build refineAnalysis by cloning the current final analysis and swapping proposals
- `setDiffObjectUrl`: revoke previous URL if set, store new one
- `completeRefinement`: set refineStatus="done"
- `failRefinement`: set refineStatus="error", store error
- `abortRefinement`: set refineStatus="done", keep best result

Cleanup integration:

- `resetAnalysis()`: also clear all refine state, revoke diffObjectUrl
- `removeCard()`: revoke diffObjectUrl before removing

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

**Step 4: Extend setViewMode**

Handle new view modes: `"iter"` and `"diff"` auto-set `activeStage: "refine"`.

**Step 5: Run existing tests**

Run: `bun run test -- src/components/extract/`
Expected: All pass

**Step 6: Commit**

```
feat(extract): add refine stage state, actions, and cleanup to store
```

---

### Task 8: Refinement loop orchestrator

The core testable loop: `runRefinementLoop()` with event callback and abort support.

**Files:**
- Create: `src/lib/extract/refine.ts`

**Step 1: Implement the orchestrator**

```ts
import sharp from "sharp";
import { renderSlideToImage } from "@/lib/render/screenshot";
import { compareImages, type DiffRegion } from "@/lib/render/compare";
import { annotateDiffImage } from "@/lib/render/annotate";
import { cropToContentBounds } from "@/lib/render/crop";
import { compileProposalPreview } from "@/lib/extract/compile-preview";
import { putRefineArtifact } from "@/lib/extract/refine-artifacts";
import { buildRefineSystemPrompt, buildRefineUserPrompt } from "@/lib/extract/refine-prompt";
import type { Proposal, AnalysisResult } from "@/components/extract/types";

export type RefineEventType =
  | "refine:start"
  | "refine:diff"
  | "refine:thinking"
  | "refine:text"
  | "refine:patch"
  | "refine:complete"
  | "refine:done"
  | "refine:error"
  | "refine:aborted";

export interface RefineEvent {
  event: RefineEventType;
  data: Record<string, unknown>;
}

export interface RefineLoopOptions {
  image: Buffer;
  imageMediaType: string;
  proposals: Proposal[];
  baseAnalysis: AnalysisResult;
  contentBounds?: { x: number; y: number; w: number; h: number } | null;
  model: string;
  effort: string;
  maxIterations: number;
  mismatchThreshold: number;
  signal?: AbortSignal;
  onEvent: (event: RefineEvent) => void;
}

export interface RefineLoopResult {
  finalIteration: number;
  mismatchRatio: number;
  converged: boolean;
  proposals: Proposal[];
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("REFINE_ABORTED");
}

export async function runRefinementLoop(
  options: RefineLoopOptions,
): Promise<RefineLoopResult> {
  const {
    image, imageMediaType, proposals: initialProposals, baseAnalysis,
    contentBounds, model, effort, maxIterations, mismatchThreshold,
    signal, onEvent,
  } = options;

  let currentProposals = initialProposals;
  let lastMismatchRatio = 1;

  onEvent({ event: "refine:start", data: { iteration: 1, maxIterations } });

  for (let i = 1; i <= maxIterations; i++) {
    checkAborted(signal);

    // 1. Find slide-scope proposal and compile
    const slideProposal = currentProposals.find((p) => p.scope === "slide");
    if (!slideProposal) throw new Error("No slide-scope proposal found");

    const canvasW = 1920;
    const canvasH = 1080;
    const layoutSlide = compileProposalPreview(slideProposal, currentProposals, canvasW, canvasH);

    // 2. Render to PNG
    const replicaFull = await renderSlideToImage(layoutSlide, { width: canvasW, height: canvasH });
    checkAborted(signal);

    // 3. Crop both images to contentBounds
    const referenceCropped = await cropToContentBounds(image, contentBounds);
    const replicaCropped = await cropToContentBounds(replicaFull, contentBounds);

    // 4. Diff
    const diff = await compareImages(referenceCropped, replicaCropped);
    lastMismatchRatio = diff.mismatchRatio;

    // 5. Annotate
    const annotated = await annotateDiffImage(diff.diffImage, diff.regions);
    const artifactId = putRefineArtifact({ buffer: annotated, contentType: "image/png", createdAt: Date.now() });
    const diffArtifactUrl = `/api/extract/refine/artifacts/${artifactId}`;

    onEvent({
      event: "refine:diff",
      data: {
        iteration: i,
        mismatchRatio: diff.mismatchRatio,
        diffArtifactUrl,
        regions: diff.regions,
      },
    });

    // 6. Check convergence
    if (diff.mismatchRatio < mismatchThreshold) {
      onEvent({
        event: "refine:done",
        data: {
          finalIteration: i,
          mismatchRatio: diff.mismatchRatio,
          converged: true,
          proposals: currentProposals,
        },
      });
      return { finalIteration: i, mismatchRatio: diff.mismatchRatio, converged: true, proposals: currentProposals };
    }

    // Last iteration — no Claude call
    if (i === maxIterations) {
      onEvent({
        event: "refine:done",
        data: {
          finalIteration: i,
          mismatchRatio: diff.mismatchRatio,
          converged: false,
          proposals: currentProposals,
        },
      });
      return { finalIteration: i, mismatchRatio: diff.mismatchRatio, converged: false, proposals: currentProposals };
    }

    checkAborted(signal);

    // 7. Call Claude for patching
    const patchedProposals = await callClaudeRefine({
      referenceImage: image,
      referenceMediaType: imageMediaType,
      replicaImage: replicaFull,
      annotatedDiffImage: annotated,
      mismatchRatio: diff.mismatchRatio,
      regions: diff.regions,
      proposals: currentProposals,
      model,
      effort,
      signal,
      onEvent: (event) => onEvent({ ...event, data: { iteration: i, ...event.data } }),
    });

    if (patchedProposals) {
      currentProposals = patchedProposals;
      onEvent({ event: "refine:patch", data: { iteration: i, proposals: currentProposals } });
    }

    onEvent({ event: "refine:complete", data: { iteration: i, mismatchRatio: diff.mismatchRatio } });
  }

  return { finalIteration: maxIterations, mismatchRatio: lastMismatchRatio, converged: false, proposals: currentProposals };
}
```

The `callClaudeRefine` function follows the same agent SDK pattern as `runPass` in the analyze route (`src/app/api/extract/analyze/route.ts`):

1. Build system prompt via `buildRefineSystemPrompt()`
2. Build three image content blocks as base64 (reference, replica, annotated diff)
3. Build user prompt via `buildRefineUserPrompt()`
4. Call Claude with `maxTurns: 1`, streaming thinking/text events via `onEvent`
5. Extract JSON from response using fenced-json fallback (look for ```json``` fences, fall back to raw parse)
6. Validate result is an array of proposals
7. Return parsed proposals or null on failure

Refer to `src/app/api/extract/analyze/route.ts` for the exact `buildQueryOptions` and `query.on()` patterns.

**Step 2: Commit**

```
feat(extract): add runRefinementLoop() orchestrator with abort support
```

---

### Task 9: Refine SSE API route

Thin SSE adapter that parses input and delegates to `runRefinementLoop()`.

**Files:**
- Create: `src/app/api/extract/refine/route.ts`

**Step 1: Implement**

```ts
import { NextRequest } from "next/server";
import { runRefinementLoop, type RefineEvent } from "@/lib/extract/refine";
import type { Proposal, AnalysisResult } from "@/components/extract/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<Response> {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const proposalsJson = formData.get("proposals") as string | null;
  const baseAnalysisJson = formData.get("baseAnalysis") as string | null;
  const contentBoundsJson = formData.get("contentBounds") as string | null;
  const model = (formData.get("model") as string) || "claude-opus-4-6";
  const effort = (formData.get("effort") as string) || "medium";
  const maxIterations = parseInt(formData.get("maxIterations") as string, 10) || 3;
  const mismatchThreshold = parseFloat(formData.get("mismatchThreshold") as string) || 0.05;

  if (!image || !proposalsJson || !baseAnalysisJson) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let proposals: Proposal[];
  let baseAnalysis: AnalysisResult;
  try {
    proposals = JSON.parse(proposalsJson);
    baseAnalysis = JSON.parse(baseAnalysisJson);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentBounds = contentBoundsJson ? JSON.parse(contentBoundsJson) : null;
  const imageBuffer = Buffer.from(await image.arrayBuffer());

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runRefinementLoop({
          image: imageBuffer,
          imageMediaType: image.type || "image/png",
          proposals,
          baseAnalysis,
          contentBounds,
          model,
          effort,
          maxIterations,
          mismatchThreshold,
          signal: request.signal,
          onEvent(event: RefineEvent) {
            controller.enqueue(
              encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`),
            );
          },
        });
      } catch (err) {
        const isAborted = err instanceof Error && err.message === "REFINE_ABORTED";
        const event = isAborted ? "refine:aborted" : "refine:error";
        const data = isAborted ? {} : { error: err instanceof Error ? err.message : "Refinement failed" };
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
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

**Step 2: Commit**

```
feat(extract): add POST /api/extract/refine SSE route
```

---

### Task 10: UI — AnalyzeForm auto-refine checkbox

**Files:**
- Modify: `src/components/extract/InspectorPanel.tsx`

**Step 1: Add checkbox**

After the existing critique checkbox, add an "Auto-refine" checkbox following the same pattern:

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

**Step 2: Commit**

```
feat(extract): add auto-refine checkbox to AnalyzeForm
```

---

### Task 11: UI — View mode toggles (Iter/Diff) and DiffImageView

**Files:**
- Modify: `src/components/extract/SlideCard.tsx`

**Step 1: Extend previewOptions**

After the critique option:

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

**Step 2: Render Iter view**

For `viewMode === "iter"`, render `ReplicaPreview` with refine-stage proposals (same pattern as extract/critique):

```tsx
const refineAnalysis = getStageAnalysis(card, "refine");
const refineSlideProposal = getSlideProposal(refineAnalysis?.proposals);
```

**Step 3: Render Diff view**

Create a `DiffImageView` component that:
1. Takes `card.diffObjectUrl` as prop
2. Renders `<img src={diffObjectUrl} />` with proper sizing
3. Shows a placeholder when URL is null

**Step 4: Commit**

```
feat(extract): add Iter and Diff view mode toggles to SlideCard
```

---

### Task 12: UI — InspectorPanel Refine tab and LogModal

**Files:**
- Modify: `src/components/extract/InspectorPanel.tsx` (or TemplateInspector component)
- Modify: `src/components/extract/LogModal.tsx`

**Step 1: Add Refine stage tab**

Follow the Extract/Critique tab pattern. Add a "Refine" button:
- Only appears when `card.refineStatus !== "idle"`
- Calls `setActiveStage(card.id, "refine")`
- Shows iteration count and mismatch ratio in the label

**Step 2: Show refine-specific info**

When `activeStage === "refine"`, display:
- Current iteration and convergence status
- Mismatch ratio per iteration (from `refineHistory`)
- Standard proposal YAML view (reusing InlineYaml)
- Cancel button when `refineStatus === "running"`
- Manual "Refine" button when `autoRefine` is off and `refineStatus === "idle"`

**Step 3: Update LogModal stage filter**

Add `"refine"` to the stage filter options so refine-stage logs appear in the log viewer.

**Step 4: Commit**

```
feat(extract): add Refine stage tab to InspectorPanel and LogModal
```

---

### Task 13: Client-side SSE consumption and triggers

Wire the refine endpoint into ExtractCanvas, handle events, manage abort.

**Files:**
- Modify: `src/components/extract/ExtractCanvas.tsx`

**Step 1: Capture normalized image during analysis**

In `handleAnalyze`, after `downscaleImage()` returns:

```ts
const normalizedFile = await downscaleImage(card.file);
setNormalizedImage(cardId, normalizedFile);
```

After `completeAnalysis`, extract contentBounds:

```ts
const contentBounds = result.source?.contentBounds ?? null;
// Store on card for later refine use
```

**Step 2: Add handleRefine callback**

Follow the same SSE consumption pattern as `handleAnalyze`:

```ts
const handleRefine = useCallback(async (cardId: string) => {
  const card = useExtractStore.getState().cards.get(cardId);
  if (!card?.analysis) return;

  startRefinement(cardId);

  const formData = new FormData();
  formData.append("image", card.normalizedImage ?? card.file);
  formData.append("proposals", JSON.stringify(card.analysis.proposals));
  formData.append("baseAnalysis", JSON.stringify(card.analysis));
  if (card.analysis.source?.contentBounds) {
    formData.append("contentBounds", JSON.stringify(card.analysis.source.contentBounds));
  }

  const abortController = new AbortController();
  // Store reference for cancel button

  const response = await fetch("/api/extract/refine", {
    method: "POST",
    body: formData,
    signal: abortController.signal,
  });

  // SSE parsing loop — same pattern as handleAnalyze
  // For each event:
  //   refine:diff    → fetch diffArtifactUrl, create blob URL, setDiffObjectUrl
  //   refine:patch   → updateRefinement with new proposals
  //   refine:done    → completeRefinement
  //   refine:error   → failRefinement
  //   refine:aborted → abortRefinement
  //   refine:thinking/text → appendLog with stage: "refine"
}, [startRefinement, updateRefinement, completeRefinement, failRefinement]);
```

**Step 3: Diff artifact blob URL lifecycle**

On `refine:diff` event:

```ts
const res = await fetch(data.diffArtifactUrl);
const blob = await res.blob();
const objectUrl = URL.createObjectURL(blob);
setDiffObjectUrl(cardId, objectUrl); // store action revokes previous URL
```

**Step 4: Auto-trigger after analysis**

In `handleAnalyze`, after `completeAnalysis`:

```ts
const updatedCard = useExtractStore.getState().cards.get(cardId);
if (updatedCard?.autoRefine) {
  handleRefine(cardId);
}
```

**Step 5: Commit**

```
feat(extract): wire refine SSE consumption, abort, and auto-trigger
```

---

### Task 14: Verification

**Files:** No changes

**Step 1: Run all related tests**

```bash
bun run test -- src/lib/extract src/lib/render src/components/extract
```

**Step 2: Run lint**

```bash
bun run lint
```

**Step 3: Confirm no out-of-scope changes**

Verify these files were NOT modified:
- `src/lib/render/screenshot.ts`
- `src/app/api/render/route.ts`
- `scripts/slide-diff.mjs`

**Step 4: Manual smoke test**

Start dev server, upload a screenshot, verify:
- Extract completes normally
- Auto-refine triggers and Iter/Diff toggles appear
- Diff view shows annotated heatmap
- Iter view shows refined replica
- Iteration badge updates
- Cancel button works

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Type extensions | `types.ts` |
| 2 | `source.contentBounds` in prompt + normalization | `prompts.ts`, `normalize-analysis.ts` |
| 3 | Diff annotation | `annotate.ts`, `annotate.test.ts` |
| 4 | Refine prompt builder | `refine-prompt.ts`, `refine-prompt.test.ts` |
| 5 | Artifact store + GET route | `refine-artifacts.ts`, `refine-artifacts.test.ts`, `artifacts/[artifactId]/route.ts` |
| 6 | Crop helper | `crop.ts`, `crop.test.ts` |
| 7 | Store extensions + stage resolution + cleanup | `store.ts`, `stage-utils.ts` |
| 8 | `runRefinementLoop()` orchestrator | `refine.ts` |
| 9 | Refine SSE route (thin adapter) | `refine/route.ts` |
| 10 | Auto-refine checkbox | `InspectorPanel.tsx` |
| 11 | Iter/Diff view toggles | `SlideCard.tsx` |
| 12 | Refine inspector tab + LogModal | `InspectorPanel.tsx`, `LogModal.tsx` |
| 13 | Client SSE consumption + abort + auto-trigger | `ExtractCanvas.tsx` |
| 14 | Verification | No file changes |

## Dependency Graph

```
Task 1 (types) ──────────────────────────────┐
Task 2 (contentBounds prompt) ──────────────┤
Task 3 (annotate) ──────────────────────────┤
Task 4 (refine prompt) ────────────────────┤
Task 5 (artifact store) ───────────────────┤
Task 6 (crop helper) ─────────────────────┤
                                            ├─→ Task 8 (loop orchestrator)
Task 7 (store) ────────────────────────────┤    ├─→ Task 9  (SSE route)
                                            │    └─→ Task 13 (client SSE)
                                            ├─→ Task 10 (checkbox)
                                            ├─→ Task 11 (toggles)
                                            ├─→ Task 12 (inspector + log)
                                            └─→ Task 14 (verification)
```

Tasks 1–7 are foundation (1–6 parallelizable, 7 depends on 1). Tasks 8–9 are backend integration. Tasks 10–13 are frontend. Task 14 is verification.

## Test Plan

### Unit tests (Tasks 3–6)
- `annotate.test.ts` — valid PNG, correct dimensions, no regions returns original
- `refine-prompt.test.ts` — system prompt includes surgical instruction, user prompt includes regions/ratio
- `refine-artifacts.test.ts` — put/get, unknown ID returns null, TTL expiry
- `crop.test.ts` — crops to bounds, null returns original, clamps oversize, zero-area returns original

### Store/component tests (Task 7)
- Refine stage initialization defaults
- `selectedTemplateIndex` includes refine
- `resetAnalysis()` clears refine state and revokes diffObjectUrl
- `removeCard()` revokes diffObjectUrl
- `getStageAnalysis("refine")` returns refineAnalysis

### Integration tests (Tasks 8–9)
- Prefer testing `runRefinementLoop()` directly with mocked render/compare/Claude
- One thin route test: missing fields returns 400

### Nice-to-have
- Loop stops on threshold convergence
- Loop respects max iterations
- Loop aborts cleanly on signal
- Malformed Claude response becomes refine error
- Iter/Diff toggles appear when refineIteration > 0
