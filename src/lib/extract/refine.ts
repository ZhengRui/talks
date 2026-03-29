import { query } from "@anthropic-ai/claude-agent-sdk";
import { compileProposalPreview } from "@/lib/extract/compile-preview";
import { buildRefineDiffArtifactImage } from "@/lib/extract/refine-display";
import {
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
} from "@/lib/extract/refine-prompt";
import {
  putRefineArtifact,
} from "@/lib/extract/refine-artifacts";
import type {
  AnalysisResult,
  Proposal,
} from "@/components/extract/types";
import { annotateDiffImage } from "@/lib/render/annotate";
import { compareImages, type DiffRegion } from "@/lib/render/compare";
import { cropToContentBounds, type CropBounds } from "@/lib/render/crop";
import { renderSlideToImage } from "@/lib/render/screenshot";

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
  signal?: AbortSignal;
  onEvent?: (event: RefineEvent) => Promise<void> | void;
}

export interface RefineLoopResult {
  finalIteration: number;
  mismatchRatio: number;
  converged: boolean;
  proposals: Proposal[];
}

interface RenderAndDiffResult {
  diff: Awaited<ReturnType<typeof compareImages>>;
  referenceCropped: Buffer;
  replicaCropped: Buffer;
  annotated: Buffer;
  referenceMediaType: string;
  diffArtifactUrl: string;
}

interface ClaudeRefineOptions {
  referenceImage: Buffer;
  referenceMediaType: string;
  replicaImage: Buffer;
  annotatedDiffImage: Buffer;
  mismatchRatio: number;
  regions: DiffRegion[];
  fullImageSize: { w: number; h: number };
  croppedImageSize: { w: number; h: number };
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

async function* makePrompt(
  referenceImage: Buffer,
  referenceMediaType: string,
  replicaImage: Buffer,
  annotatedDiffImage: Buffer,
  userPrompt: string,
) {
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
            media_type: referenceMediaType,
            data: referenceImage.toString("base64"),
          },
        },
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: "image/png" as const,
            data: replicaImage.toString("base64"),
          },
        },
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: "image/png" as const,
            data: annotatedDiffImage.toString("base64"),
          },
        },
        { type: "text" as const, text: userPrompt },
      ],
    },
    parent_tool_use_id: null,
  };
}

async function callClaudeRefine(
  options: ClaudeRefineOptions,
): Promise<ClaudeRefineResult> {
  const {
    referenceImage,
    referenceMediaType,
    replicaImage,
    annotatedDiffImage,
    mismatchRatio,
    regions,
    fullImageSize,
    croppedImageSize,
    contentBounds,
    proposals,
    model,
    effort,
    signal,
    onEvent,
  } = options;
  const userPrompt = buildRefineUserPrompt({
    mismatchRatio,
    regions,
    proposalsJson: JSON.stringify(proposals, null, 2),
    fullImageSize,
    croppedImageSize,
    contentBounds,
  });

  const queryOptions = buildQueryOptions(buildRefineSystemPrompt(), model, effort);
  let resultText = "";
  let sawThinkingDeltaForAssistant = false;

  for await (const message of query({
    prompt: makePrompt(
      referenceImage,
      referenceMediaType,
      replicaImage,
      annotatedDiffImage,
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

    if (msg.type === "result" && typeof msg.result === "string") {
      resultText = msg.result;
    }
  }

  const jsonPayload = extractJsonPayload(resultText);
  if (!jsonPayload) {
    return { proposals: null, status: "no_json" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload) as unknown;
  } catch {
    return { proposals: null, status: "invalid_json" };
  }
  if (!Array.isArray(parsed)) {
    return { proposals: null, status: "not_array" };
  }

  return { proposals: parsed as Proposal[], status: "ok" };
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
    signal,
    onEvent,
  } = options;
  const dimensions = baseAnalysis.source.dimensions;
  let currentProposals = initialProposals;
  let lastMismatchRatio = 1;
  let lastCycle: RenderAndDiffResult | undefined;

  await emit(onEvent, {
    event: "refine:start",
    data: { iteration: 1, maxIterations },
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

    const referenceCropped = await cropToContentBounds(image, contentBounds);
    const replicaCropped = await cropToContentBounds(replicaFull, contentBounds);
    const diff = await compareImages(referenceCropped, replicaCropped);

    const annotated = await annotateDiffImage(diff.diffImage, diff.regions);
    const displayDiff = await buildRefineDiffArtifactImage(
      image,
      annotated,
      dimensions,
      contentBounds,
    );
    const artifactId = putRefineArtifact({
      buffer: displayDiff, contentType: "image/png", createdAt: Date.now(),
    });
    const diffArtifactUrl = `/api/extract/refine/artifacts/${artifactId}`;

    return {
      diff, referenceCropped, replicaCropped, annotated,
      referenceMediaType: contentBounds ? "image/png" : imageMediaType,
      diffArtifactUrl,
    };
  }

  // Initial render-diff before any Claude call
  const initial = await renderAndDiff(currentProposals);
  lastCycle = initial;
  lastMismatchRatio = initial.diff.mismatchRatio;
  await emitDiffEvent(onEvent, 0, initial);
  if (initial.diff.mismatchRatio < mismatchThreshold) {
    await emit(onEvent, {
      event: "refine:done",
      data: { finalIteration: 0, mismatchRatio: initial.diff.mismatchRatio, converged: true, proposals: currentProposals },
    });
    return { finalIteration: 0, mismatchRatio: initial.diff.mismatchRatio, converged: true, proposals: currentProposals };
  }

  // Each iteration: Claude call → accept parsed patch → render-diff
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    checkAborted(signal);
    const prevDiff = lastCycle ?? initial;

    const refineResult = await callClaudeRefine({
      referenceImage: prevDiff.referenceCropped,
      referenceMediaType: prevDiff.referenceMediaType,
      replicaImage: prevDiff.replicaCropped,
      annotatedDiffImage: prevDiff.annotated,
      mismatchRatio: prevDiff.diff.mismatchRatio,
      regions: prevDiff.diff.regions,
      fullImageSize: dimensions,
      croppedImageSize: { w: prevDiff.diff.width, h: prevDiff.diff.height },
      contentBounds,
      proposals: currentProposals,
      model,
      effort,
      signal,
      onEvent: async (event) => {
        await emit(onEvent, { event: event.event, data: { iteration, ...event.data } });
      },
    });

    if (refineResult.status === "ok" && refineResult.proposals) {
      currentProposals = refineResult.proposals;
    }

    const candidateCycle = await renderAndDiff(currentProposals);
    lastCycle = candidateCycle;
    lastMismatchRatio = candidateCycle.diff.mismatchRatio;
    await emitDiffEvent(onEvent, iteration, candidateCycle);

    await emit(onEvent, {
      event: "refine:patch",
      data: { iteration, proposals: currentProposals },
    });
    await emit(onEvent, {
      event: "refine:complete",
      data: { iteration, mismatchRatio: candidateCycle.diff.mismatchRatio },
    });

    if (candidateCycle.diff.mismatchRatio < mismatchThreshold) {
      await emit(onEvent, {
        event: "refine:done",
        data: {
          finalIteration: iteration,
          mismatchRatio: candidateCycle.diff.mismatchRatio,
          converged: true,
          proposals: currentProposals,
        },
      });
      return {
        finalIteration: iteration,
        mismatchRatio: candidateCycle.diff.mismatchRatio,
        converged: true,
        proposals: currentProposals,
      };
    }
  }

  await emit(onEvent, {
    event: "refine:done",
    data: { finalIteration: maxIterations, mismatchRatio: lastMismatchRatio, converged: false, proposals: currentProposals },
  });
  return { finalIteration: maxIterations, mismatchRatio: lastMismatchRatio, converged: false, proposals: currentProposals };
}
