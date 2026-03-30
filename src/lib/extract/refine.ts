import { query } from "@anthropic-ai/claude-agent-sdk";
import { compileProposalPreview } from "@/lib/extract/compile-preview";
import {
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
} from "@/lib/extract/refine-prompt";
import {
  createMockRefineProposals,
  isMockClaudeModel,
} from "@/lib/extract/mock-claude";
import {
  putRefineArtifact,
} from "@/lib/extract/refine-artifacts";
import type {
  AnalysisResult,
  Proposal,
} from "@/components/extract/types";
import { annotateDiffImage } from "@/lib/render/annotate";
import { compareImages } from "@/lib/render/compare";
import type { CropBounds } from "@/lib/render/crop";
import { renderSlideToImage } from "@/lib/render/screenshot";
import sharp from "sharp";

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
  contentBounds?: CropBounds | null;
  model: string;
  effort: string;
  maxIterations: number;
  mismatchThreshold: number;
  iterationOffset?: number;
  forceIterations?: boolean;
  signal?: AbortSignal;
  onEvent?: (event: RefineEvent) => Promise<void> | void;
}

export interface RefineLoopResult {
  finalIteration: number;
  mismatchRatio: number;
  converged: boolean;
  proposals: Proposal[];
  totalCost: number | null;
  totalElapsed: number;
}

interface RenderAndDiffResult {
  diff: Awaited<ReturnType<typeof compareImages>>;
  referenceImage: Buffer;
  replicaImage: Buffer;
  diffArtifactUrl: string;
}

interface ClaudeRefineOptions {
  iteration: number;
  referenceImage: Buffer;
  referenceMediaType: string;
  replicaImage: Buffer;
  imageSize: { w: number; h: number };
  contentBounds?: CropBounds | null;
  proposals: Proposal[];
  model: string;
  effort: string;
  signal?: AbortSignal;
  onEvent?: (event: RefineEvent) => Promise<void> | void;
}

type ClaudeRefineParseStatus =
  | "ok"
  | "no_json"
  | "invalid_json"
  | "not_array";

interface ClaudeRefineResult {
  proposals: Proposal[] | null;
  status: ClaudeRefineParseStatus;
  cost: number | null;
  elapsed: number;
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("REFINE_ABORTED");
  }
}

async function emit(
  onEvent: RefineLoopOptions["onEvent"] | ClaudeRefineOptions["onEvent"],
  event: RefineEvent,
): Promise<void> {
  if (onEvent) {
    await onEvent(event);
  }
}

async function emitDiffEvent(
  onEvent: RefineLoopOptions["onEvent"] | ClaudeRefineOptions["onEvent"],
  iteration: number,
  cycle: RenderAndDiffResult,
): Promise<void> {
  await emit(onEvent, {
    event: "refine:diff",
    data: {
      iteration,
      mismatchRatio: cycle.diff.mismatchRatio,
      diffArtifactUrl: cycle.diffArtifactUrl,
      regions: cycle.diff.regions,
    },
  });
}

function extractJsonPayload(resultText: string): string | null {
  const fenced = resultText.match(/```json\s*([\s\S]*?)\s*```/);
  if (fenced?.[1]) return fenced[1];

  const arrayMatch = resultText.match(/(\[[\s\S]*\])/);
  if (arrayMatch?.[1]) return arrayMatch[1];

  return null;
}

function buildQueryOptions(
  systemPrompt: string,
  model: string,
  effort: string,
): import("@anthropic-ai/claude-agent-sdk").Options {
  const isAdaptive = model === "claude-opus-4-6" || model === "claude-sonnet-4-6";
  const thinkingConfig = isAdaptive
    ? { type: "adaptive" as const }
    : { type: "enabled" as const, budget_tokens: parseInt(effort, 10) || 10000 };
  const effortConfig = isAdaptive
    ? (effort as "low" | "medium" | "high" | "max")
    : undefined;

  return {
    cwd: process.cwd(),
    settingSources: ["project"],
    allowedTools: [],
    maxTurns: 1,
    model,
    thinking: thinkingConfig,
    ...(effortConfig ? { effort: effortConfig } : {}),
    systemPrompt,
    includePartialMessages: true,
    persistSession: false,
    pathToClaudeCodeExecutable: "/Users/zerry/.local/bin/claude",
    env: { ...process.env, ANTHROPIC_API_KEY: "" },
  };
}

/** Concatenate two images side-by-side (left: original, right: replica). */
async function concatSideBySide(left: Buffer, right: Buffer): Promise<Buffer> {
  const [leftMeta, rightMeta] = await Promise.all([
    sharp(left).metadata(),
    sharp(right).metadata(),
  ]);
  const lw = leftMeta.width!;
  const lh = leftMeta.height!;
  const rw = rightMeta.width!;
  const rh = rightMeta.height!;
  const h = Math.max(lh, rh);

  return sharp({
    create: { width: lw + rw, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: lw, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function* makePrompt(
  referenceImage: Buffer,
  referenceMediaType: string,
  replicaImage: Buffer,
  userPrompt: string,
) {
  // Image 1: side-by-side for spatial comparison
  const sideBySide = await concatSideBySide(referenceImage, replicaImage);

  const content: Array<Record<string, unknown>> = [
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: sideBySide.toString("base64"),
      },
    },
    // Image 2: original at full resolution for detail inspection
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: referenceMediaType,
        data: referenceImage.toString("base64"),
      },
    },
    // Image 3: replica at full resolution for detail inspection
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: replicaImage.toString("base64"),
      },
    },
  ];

  content.push({ type: "text" as const, text: userPrompt });

  yield {
    type: "user" as const,
    session_id: "",
    message: {
      role: "user" as const,
      content,
    },
    parent_tool_use_id: null,
  };
}

async function callClaudeRefine(
  options: ClaudeRefineOptions,
): Promise<ClaudeRefineResult> {
  const {
    iteration,
    referenceImage,
    referenceMediaType,
    replicaImage,
    imageSize,
    contentBounds,
    proposals,
    model,
    effort,
    signal,
    onEvent,
  } = options;
  if (isMockClaudeModel(model)) {
    await emit(onEvent, {
      event: "refine:thinking",
      data: {
        text: "Mock Claude selected. Returning a deterministic local refine patch.",
      },
    });
    await emit(onEvent, {
      event: "refine:text",
      data: {
        text: "Mock Claude response ready.",
      },
    });
    return {
      proposals: createMockRefineProposals(proposals, iteration),
      status: "ok",
      cost: 0,
      elapsed: 0,
    };
  }
  const userPrompt = buildRefineUserPrompt({
    proposalsJson: JSON.stringify(proposals, null, 2),
    imageSize,
    contentBounds,
  });

  const queryOptions = buildQueryOptions(buildRefineSystemPrompt(), model, effort);
  let resultText = "";
  let sawThinkingDeltaForAssistant = false;
  let totalCost: number | null = null;
  const startedAt = Date.now();

  for await (const message of query({
    prompt: makePrompt(
      referenceImage,
      referenceMediaType,
      replicaImage,
      userPrompt,
    ),
    options: queryOptions,
  })) {
    checkAborted(signal);
    const msg = message as Record<string, unknown>;

    if (msg.type === "stream_event") {
      const event = msg.event as Record<string, unknown> | undefined;
      if (event?.type === "content_block_delta") {
        const delta = event.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          resultText += delta.text;
          await emit(onEvent, { event: "refine:text", data: { text: delta.text } });
        } else if (
          delta?.type === "thinking_delta" &&
          typeof delta.thinking === "string"
        ) {
          sawThinkingDeltaForAssistant = true;
          await emit(onEvent, { event: "refine:thinking", data: { text: delta.thinking } });
        }
      }
      continue;
    }

    if (msg.type === "assistant" && msg.message) {
      const assistantMsg = msg.message as Record<string, unknown>;
      if (Array.isArray(assistantMsg.content)) {
        for (const block of assistantMsg.content) {
          const contentBlock = block as Record<string, unknown>;
          if (
            contentBlock.type === "thinking" &&
            typeof contentBlock.thinking === "string" &&
            !sawThinkingDeltaForAssistant
          ) {
            await emit(onEvent, {
              event: "refine:thinking",
              data: { text: contentBlock.thinking },
            });
          }
        }
      }
      sawThinkingDeltaForAssistant = false;
      continue;
    }

    if (msg.type === "result") {
      if (typeof msg.result === "string") {
        resultText = msg.result;
      }
      if (typeof msg.total_cost_usd === "number") {
        totalCost = msg.total_cost_usd;
      }
    }
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000);

  const jsonPayload = extractJsonPayload(resultText);
  if (!jsonPayload) {
    return { proposals: null, status: "no_json", cost: totalCost, elapsed };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload) as unknown;
  } catch {
    return { proposals: null, status: "invalid_json", cost: totalCost, elapsed };
  }
  if (!Array.isArray(parsed)) {
    return { proposals: null, status: "not_array", cost: totalCost, elapsed };
  }

  return { proposals: parsed as Proposal[], status: "ok", cost: totalCost, elapsed };
}

export async function runRefinementLoop(
  options: RefineLoopOptions,
): Promise<RefineLoopResult> {
  const {
    image,
    imageMediaType,
    proposals: initialProposals,
    baseAnalysis,
    contentBounds = baseAnalysis.source.contentBounds ?? null,
    model,
    effort,
    maxIterations,
    mismatchThreshold,
    iterationOffset = 0,
    forceIterations = false,
    signal,
    onEvent,
  } = options;
  const dimensions = baseAnalysis.source.dimensions;
  const baseIteration = Math.max(0, Math.floor(iterationOffset));
  const targetIteration = baseIteration + maxIterations;
  let currentProposals = initialProposals;
  let lastMismatchRatio = 1;
  let lastCycle: RenderAndDiffResult | undefined;
  let totalCost: number | null = null;
  const loopStartedAt = Date.now();

  await emit(onEvent, {
    event: "refine:start",
    data: {
      iteration: baseIteration,
      maxIterations: targetIteration,
      model,
      effort,
      mismatchThreshold,
    },
  });

  // Helper: render current proposals, diff, annotate, emit, return diff result
  async function renderAndDiff(proposals: Proposal[]): Promise<RenderAndDiffResult> {
    checkAborted(signal);
    const slideProposal = proposals.find((proposal) => proposal.scope === "slide");
    if (!slideProposal) throw new Error("No slide-scope proposal found");

    const layoutSlide = compileProposalPreview(
      slideProposal, proposals, dimensions.w, dimensions.h,
    );
    const replicaFull = await renderSlideToImage(layoutSlide, {
      width: dimensions.w, height: dimensions.h,
    });
    checkAborted(signal);

    const diff = await compareImages(image, replicaFull, {
      ...(contentBounds ? { maskBounds: contentBounds } : {}),
    });

    const annotated = await annotateDiffImage(diff.diffImage, diff.regions);
    const artifactId = putRefineArtifact({
      buffer: annotated, contentType: "image/png", createdAt: Date.now(),
    });
    const diffArtifactUrl = `/api/extract/refine/artifacts/${artifactId}`;

    return {
      diff,
      referenceImage: image,
      replicaImage: replicaFull,
      diffArtifactUrl,
    };
  }

  // Initial render-diff before any Claude call
  const initial = await renderAndDiff(currentProposals);
  lastCycle = initial;
  lastMismatchRatio = initial.diff.mismatchRatio;
  await emitDiffEvent(onEvent, baseIteration, initial);
  if (!forceIterations && initial.diff.mismatchRatio < mismatchThreshold) {
    await emit(onEvent, {
      event: "refine:done",
      data: {
        finalIteration: baseIteration,
        mismatchRatio: initial.diff.mismatchRatio,
        converged: true,
        proposals: currentProposals,
        totalCost,
        totalElapsed: Math.round((Date.now() - loopStartedAt) / 1000),
      },
    });
    return {
      finalIteration: baseIteration,
      mismatchRatio: initial.diff.mismatchRatio,
      converged: true,
      proposals: currentProposals,
      totalCost,
      totalElapsed: Math.round((Date.now() - loopStartedAt) / 1000),
    };
  }

  // Each iteration: Claude call → accept parsed patch → render-diff
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    checkAborted(signal);
    const prevDiff = lastCycle ?? initial;
    const absoluteIteration = baseIteration + iteration;

    const refineResult = await callClaudeRefine({
      iteration: absoluteIteration,
      referenceImage: prevDiff.referenceImage,
      referenceMediaType: imageMediaType,
      replicaImage: prevDiff.replicaImage,
      imageSize: { w: prevDiff.diff.width, h: prevDiff.diff.height },
      contentBounds,
      proposals: currentProposals,
      model,
      effort,
      signal,
      onEvent: async (event) => {
        await emit(onEvent, {
          event: event.event,
          data: { iteration: absoluteIteration, ...event.data },
        });
      },
    });

    if (refineResult.cost != null) {
      totalCost = (totalCost ?? 0) + refineResult.cost;
    }

    if (refineResult.status === "ok" && refineResult.proposals) {
      currentProposals = refineResult.proposals;
    }

    const candidateCycle = await renderAndDiff(currentProposals);
    lastCycle = candidateCycle;
    lastMismatchRatio = candidateCycle.diff.mismatchRatio;
    await emitDiffEvent(onEvent, absoluteIteration, candidateCycle);

    await emit(onEvent, {
      event: "refine:patch",
      data: { iteration: absoluteIteration, proposals: currentProposals },
    });
    await emit(onEvent, {
      event: "refine:complete",
      data: {
        iteration: absoluteIteration,
        mismatchRatio: candidateCycle.diff.mismatchRatio,
        iterElapsed: refineResult.elapsed,
        iterCost: refineResult.cost,
      },
    });

    if (candidateCycle.diff.mismatchRatio < mismatchThreshold) {
      await emit(onEvent, {
        event: "refine:done",
        data: {
          finalIteration: absoluteIteration,
          mismatchRatio: candidateCycle.diff.mismatchRatio,
          converged: true,
          proposals: currentProposals,
          totalCost,
          totalElapsed: Math.round((Date.now() - loopStartedAt) / 1000),
        },
      });
      return {
        finalIteration: absoluteIteration,
        mismatchRatio: candidateCycle.diff.mismatchRatio,
        converged: true,
        proposals: currentProposals,
        totalCost,
        totalElapsed: Math.round((Date.now() - loopStartedAt) / 1000),
      };
    }
  }

  await emit(onEvent, {
    event: "refine:done",
    data: {
      finalIteration: targetIteration,
      mismatchRatio: lastMismatchRatio,
      converged: false,
      proposals: currentProposals,
      totalCost,
      totalElapsed: Math.round((Date.now() - loopStartedAt) / 1000),
    },
  });
  return {
    finalIteration: targetIteration,
    mismatchRatio: lastMismatchRatio,
    converged: false,
    proposals: currentProposals,
    totalCost,
    totalElapsed: Math.round((Date.now() - loopStartedAt) / 1000),
  };
}
