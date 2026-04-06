import { query } from "@anthropic-ai/claude-agent-sdk";
import { compileProposalPreview } from "@/lib/extract/compile-preview";
import {
  buildEditSystemPrompt,
  buildEditUserPrompt,
  buildVisionSystemPrompt,
  buildVisionUserPrompt,
} from "@/lib/extract/refine-prompt";
import {
  createMockRefineProposals,
  isMockClaudeModel,
} from "@/lib/extract/mock-claude";
import { putRefineArtifact } from "@/lib/extract/refine-artifacts";
import type {
  AnalysisResult,
  GeometryHints,
  Proposal,
} from "@/components/extract/types";
import { annotateDiffImage } from "@/lib/render/annotate";
import { compareImages } from "@/lib/render/compare";
import type { CropBounds } from "@/lib/render/crop";
import { renderSlideToImage } from "@/lib/render/screenshot";

export type RefineEventType =
  | "refine:start"
  | "refine:vision:start"
  | "refine:vision:prompt"
  | "refine:vision:thinking"
  | "refine:vision:text"
  | "refine:vision:done"
  | "refine:edit:start"
  | "refine:edit:prompt"
  | "refine:edit:thinking"
  | "refine:edit:text"
  | "refine:edit:done"
  | "refine:diff"
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
  geometryHints?: GeometryHints | null;
  visionModel: string;
  visionEffort: string;
  editModel: string;
  editEffort: string;
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

interface VisionOptions {
  iteration: number;
  referenceImage: Buffer;
  referenceMediaType: string;
  replicaImage: Buffer;
  imageSize: { w: number; h: number };
  contentBounds?: CropBounds | null;
  model: string;
  effort: string;
  signal?: AbortSignal;
  onEvent?: (event: RefineEvent) => Promise<void> | void;
}

interface VisionResult {
  differences: string;
  cost: number | null;
  elapsed: number;
}

interface EditOptions {
  iteration: number;
  referenceImage: Buffer;
  referenceMediaType: string;
  replicaImage: Buffer;
  imageSize: { w: number; h: number };
  differences: string;
  proposals: Proposal[];
  contentBounds?: CropBounds | null;
  geometryHints?: GeometryHints | null;
  model: string;
  effort: string;
  signal?: AbortSignal;
  onEvent?: (event: RefineEvent) => Promise<void> | void;
}

type ClaudeEditParseStatus =
  | "ok"
  | "no_json"
  | "invalid_json"
  | "not_array";

interface EditResult {
  proposals: Proposal[] | null;
  status: ClaudeEditParseStatus;
  cost: number | null;
  elapsed: number;
}

interface StreamClaudeTextOptions {
  prompt: Parameters<typeof query>[0]["prompt"];
  systemPrompt: string;
  model: string;
  effort: string;
  signal?: AbortSignal;
  onEvent?: (event: RefineEvent) => Promise<void> | void;
  thinkingEvent: RefineEventType;
  textEvent: RefineEventType;
}

const MIN_VISION_DIFFERENCE_LENGTH = 20;

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("REFINE_ABORTED");
  }
}

async function emit(
  onEvent: RefineLoopOptions["onEvent"] | VisionOptions["onEvent"] | EditOptions["onEvent"],
  event: RefineEvent,
): Promise<void> {
  if (onEvent) {
    await onEvent(event);
  }
}

async function emitDiffEvent(
  onEvent: RefineLoopOptions["onEvent"],
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

async function* makeVisionPrompt(
  referenceImage: Buffer,
  referenceMediaType: string,
  replicaImage: Buffer,
  userPrompt: string,
) {
  const content: Array<Record<string, unknown>> = [
    { type: "text" as const, text: "ORIGINAL slide:" },
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: referenceMediaType,
        data: referenceImage.toString("base64"),
      },
    },
    { type: "text" as const, text: "REPLICA slide:" },
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: replicaImage.toString("base64"),
      },
    },
    { type: "text" as const, text: userPrompt },
  ];

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

async function* makeComparisonEditPrompt(
  referenceImage: Buffer,
  referenceMediaType: string,
  replicaImage: Buffer,
  userPrompt: string,
) {
  const content: Array<Record<string, unknown>> = [
    { type: "text" as const, text: "ORIGINAL slide:" },
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: referenceMediaType,
        data: referenceImage.toString("base64"),
      },
    },
    { type: "text" as const, text: "REPLICA slide:" },
    {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: replicaImage.toString("base64"),
      },
    },
    { type: "text" as const, text: userPrompt },
  ];

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

async function streamClaudeText(
  options: StreamClaudeTextOptions,
): Promise<{ resultText: string; totalCost: number | null; elapsed: number }> {
  const {
    prompt,
    systemPrompt,
    model,
    effort,
    signal,
    onEvent,
    thinkingEvent,
    textEvent,
  } = options;
  const queryOptions = buildQueryOptions(systemPrompt, model, effort);
  let resultText = "";
  let sawThinkingDeltaForAssistant = false;
  let sawTextDelta = false;
  let totalCost: number | null = null;
  const startedAt = Date.now();

  for await (const message of query({
    prompt,
    options: queryOptions,
  })) {
    checkAborted(signal);
    const msg = message as Record<string, unknown>;

    if (msg.type === "stream_event") {
      const event = msg.event as Record<string, unknown> | undefined;
      if (event?.type === "content_block_delta") {
        const delta = event.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          sawTextDelta = true;
          resultText += delta.text;
          await emit(onEvent, { event: textEvent, data: { text: delta.text } });
        } else if (
          delta?.type === "thinking_delta" &&
          typeof delta.thinking === "string"
        ) {
          sawThinkingDeltaForAssistant = true;
          await emit(onEvent, { event: thinkingEvent, data: { text: delta.thinking } });
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
              event: thinkingEvent,
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

  if (!sawTextDelta && resultText) {
    await emit(onEvent, { event: textEvent, data: { text: resultText } });
  }

  return {
    resultText,
    totalCost,
    elapsed: Math.round((Date.now() - startedAt) / 1000),
  };
}

async function callClaudeVision(
  options: VisionOptions,
): Promise<VisionResult> {
  const {
    iteration,
    referenceImage,
    referenceMediaType,
    replicaImage,
    imageSize,
    contentBounds,
    model,
    effort,
    signal,
    onEvent,
  } = options;
  const systemPrompt = buildVisionSystemPrompt();
  const userPrompt = buildVisionUserPrompt({
    imageSize,
    contentBounds,
  });

  await emit(onEvent, {
    event: "refine:vision:prompt",
    data: {
      iteration,
      phase: "vision",
      systemPrompt,
      userPrompt,
      model,
      effort,
    },
  });

  if (isMockClaudeModel(model)) {
    const differences = [
      "1. Mock difference: title font is too large compared to the original.",
      "2. Mock difference: background gradient is missing from the replica.",
    ].join(" ");
    await emit(onEvent, {
      event: "refine:vision:thinking",
      data: {
        text: "Mock Claude selected. Returning a deterministic local difference list.",
      },
    });
    await emit(onEvent, {
      event: "refine:vision:text",
      data: {
        text: differences,
      },
    });
    return {
      differences,
      cost: 0,
      elapsed: 0,
    };
  }

  const result = await streamClaudeText({
    prompt: makeVisionPrompt(
      referenceImage,
      referenceMediaType,
      replicaImage,
      userPrompt,
    ),
    systemPrompt,
    model,
    effort,
    signal,
    onEvent,
    thinkingEvent: "refine:vision:thinking",
    textEvent: "refine:vision:text",
  });

  return {
    differences: result.resultText,
    cost: result.totalCost,
    elapsed: result.elapsed,
  };
}

async function callClaudeEdit(
  options: EditOptions,
): Promise<EditResult> {
  const {
    iteration,
    referenceImage,
    referenceMediaType,
    replicaImage,
    imageSize,
    differences,
    proposals,
    contentBounds,
    geometryHints,
    model,
    effort,
    signal,
    onEvent,
  } = options;
  const slideProposal = proposals.find((proposal) => proposal.scope === "slide");
  const systemPrompt = buildEditSystemPrompt();
  const userPrompt = buildEditUserPrompt({
    imageSize,
    proposalSpace: slideProposal?.region
      ? { w: slideProposal.region.w, h: slideProposal.region.h }
      : null,
    differences,
    proposalsJson: JSON.stringify(proposals, null, 2),
    contentBounds,
    geometryHints,
  });

  await emit(onEvent, {
    event: "refine:edit:prompt",
    data: {
      iteration,
      phase: "edit",
      systemPrompt,
      userPrompt,
      model,
      effort,
    },
  });

  if (isMockClaudeModel(model)) {
    await emit(onEvent, {
      event: "refine:edit:thinking",
      data: {
        text: "Mock Claude selected. Returning a deterministic local refine patch.",
      },
    });
    await emit(onEvent, {
      event: "refine:edit:text",
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

  const result = await streamClaudeText({
    prompt: makeComparisonEditPrompt(
      referenceImage,
      referenceMediaType,
      replicaImage,
      userPrompt,
    ),
    systemPrompt,
    model,
    effort,
    signal,
    onEvent,
    thinkingEvent: "refine:edit:thinking",
    textEvent: "refine:edit:text",
  });

  const jsonPayload = extractJsonPayload(result.resultText);
  if (!jsonPayload) {
    return {
      proposals: null,
      status: "no_json",
      cost: result.totalCost,
      elapsed: result.elapsed,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload) as unknown;
  } catch {
    return {
      proposals: null,
      status: "invalid_json",
      cost: result.totalCost,
      elapsed: result.elapsed,
    };
  }
  if (!Array.isArray(parsed)) {
    return {
      proposals: null,
      status: "not_array",
      cost: result.totalCost,
      elapsed: result.elapsed,
    };
  }

  return {
    proposals: parsed as Proposal[],
    status: "ok",
    cost: result.totalCost,
    elapsed: result.elapsed,
  };
}

function accumulateCost(totalCost: number | null, increment: number | null): number | null {
  if (increment == null) return totalCost;
  return (totalCost ?? 0) + increment;
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
    geometryHints = null,
    visionModel,
    visionEffort,
    editModel,
    editEffort,
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
      visionModel,
      visionEffort,
      editModel,
      editEffort,
      mismatchThreshold,
    },
  });

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

  const initial = await renderAndDiff(currentProposals);
  lastCycle = initial;
  lastMismatchRatio = initial.diff.mismatchRatio;
  await emitDiffEvent(onEvent, baseIteration, initial);
  if (!forceIterations && initial.diff.mismatchRatio < mismatchThreshold) {
    const totalElapsed = Math.round((Date.now() - loopStartedAt) / 1000);
    await emit(onEvent, {
      event: "refine:done",
      data: {
        finalIteration: baseIteration,
        mismatchRatio: initial.diff.mismatchRatio,
        converged: true,
        proposals: currentProposals,
        totalCost,
        totalElapsed,
      },
    });
    return {
      finalIteration: baseIteration,
      mismatchRatio: initial.diff.mismatchRatio,
      converged: true,
      proposals: currentProposals,
      totalCost,
      totalElapsed,
    };
  }

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    checkAborted(signal);
    const prevDiff = lastCycle ?? initial;
    const absoluteIteration = baseIteration + iteration;

    await emit(onEvent, {
      event: "refine:vision:start",
      data: { iteration: absoluteIteration },
    });
    const visionResult = await callClaudeVision({
      iteration: absoluteIteration,
      referenceImage: prevDiff.referenceImage,
      referenceMediaType: imageMediaType,
      replicaImage: prevDiff.replicaImage,
      imageSize: { w: prevDiff.diff.width, h: prevDiff.diff.height },
      contentBounds,
      model: visionModel,
      effort: visionEffort,
      signal,
      onEvent,
    });
    totalCost = accumulateCost(totalCost, visionResult.cost);
    const visionEmpty =
      visionResult.differences.trim().length < MIN_VISION_DIFFERENCE_LENGTH;
    await emit(onEvent, {
      event: "refine:vision:done",
      data: {
        differences: visionResult.differences,
        cost: visionResult.cost,
        elapsed: visionResult.elapsed,
        ...(visionEmpty ? { visionEmpty: true } : {}),
      },
    });

    if (visionEmpty) {
      await emit(onEvent, {
        event: "refine:patch",
        data: { iteration: absoluteIteration, proposals: currentProposals },
      });
      await emit(onEvent, {
        event: "refine:complete",
        data: {
          iteration: absoluteIteration,
          mismatchRatio: prevDiff.diff.mismatchRatio,
          iterElapsed: visionResult.elapsed,
          iterCost: visionResult.cost,
          visionEmpty: true,
        },
      });
      lastMismatchRatio = prevDiff.diff.mismatchRatio;
      continue;
    }

    await emit(onEvent, {
      event: "refine:edit:start",
      data: { iteration: absoluteIteration },
    });
    const editResult = await callClaudeEdit({
      iteration: absoluteIteration,
      referenceImage: prevDiff.referenceImage,
      referenceMediaType: imageMediaType,
      replicaImage: prevDiff.replicaImage,
      imageSize: { w: prevDiff.diff.width, h: prevDiff.diff.height },
      differences: visionResult.differences,
      proposals: currentProposals,
      contentBounds,
      geometryHints,
      model: editModel,
      effort: editEffort,
      signal,
      onEvent,
    });
    totalCost = accumulateCost(totalCost, editResult.cost);
    await emit(onEvent, {
      event: "refine:edit:done",
      data: {
        cost: editResult.cost,
        elapsed: editResult.elapsed,
      },
    });

    if (editResult.status === "ok" && editResult.proposals) {
      currentProposals = editResult.proposals;
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
        iterElapsed: visionResult.elapsed + editResult.elapsed,
        iterCost:
          visionResult.cost != null || editResult.cost != null
            ? (visionResult.cost ?? 0) + (editResult.cost ?? 0)
            : null,
      },
    });

    if (candidateCycle.diff.mismatchRatio < mismatchThreshold) {
      const totalElapsed = Math.round((Date.now() - loopStartedAt) / 1000);
      await emit(onEvent, {
        event: "refine:done",
        data: {
          finalIteration: absoluteIteration,
          mismatchRatio: candidateCycle.diff.mismatchRatio,
          converged: true,
          proposals: currentProposals,
          totalCost,
          totalElapsed,
        },
      });
      return {
        finalIteration: absoluteIteration,
        mismatchRatio: candidateCycle.diff.mismatchRatio,
        converged: true,
        proposals: currentProposals,
        totalCost,
        totalElapsed,
      };
    }
  }

  const totalElapsed = Math.round((Date.now() - loopStartedAt) / 1000);
  await emit(onEvent, {
    event: "refine:done",
    data: {
      finalIteration: targetIteration,
      mismatchRatio: lastMismatchRatio,
      converged: false,
      proposals: currentProposals,
      totalCost,
      totalElapsed,
    },
  });
  return {
    finalIteration: targetIteration,
    mismatchRatio: lastMismatchRatio,
    converged: false,
    proposals: currentProposals,
    totalCost,
    totalElapsed,
  };
}
