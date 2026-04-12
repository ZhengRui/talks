import { compileProposalPreview } from "@/lib/extract/compile-preview";
import {
  buildEditSystemPrompt,
  buildEditUserPrompt,
  type VisionSemanticAnchors,
  buildVisionSystemPrompt,
  buildVisionUserPrompt,
  formatIterationHistory,
  formatPriorIssuesChecklist,
  type IterationRecord,
} from "@/lib/extract/refine-prompt";
import {
  createMockRefineProposals,
  isMockProviderSelection,
} from "@/lib/extract/mock-provider";
import { putRefineArtifact } from "@/lib/extract/refine-artifacts";
import type {
  AnalysisResult,
  GeometryHints,
  Proposal,
} from "@/components/extract/types";
import { normalizeProviderSelection } from "@/lib/extract/providers/catalog";
import { getExtractModelProvider } from "@/lib/extract/providers/registry";
import type { ProviderContentPart } from "@/lib/extract/providers/types";
import type { ExtractProviderId, ProviderSelection } from "@/lib/extract/providers/shared";
import { extractJsonPayload } from "@/lib/extract/json-payload";
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
  seedHistory?: IterationRecord[];
  seedLastIssues?: VisionIssue[];
  visionSelection?: ProviderSelection;
  editSelection?: ProviderSelection;
  visionProvider?: ExtractProviderId;
  visionModel?: string;
  visionEffort?: string;
  editProvider?: ExtractProviderId;
  editModel?: string;
  editEffort?: string;
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
  semanticAnchors?: VisionSemanticAnchors | null;
  priorIssues?: VisionIssue[] | null;
  iterationHistory?: string | null;
  priorChecklist?: string | null;
  everSignatureVisualIds?: Set<string>;
  selection: ProviderSelection;
  signal?: AbortSignal;
  onEvent?: (event: RefineEvent) => Promise<void> | void;
}

export type VisionIssueFixType =
  | "structural_change"
  | "layout_adjustment"
  | "style_adjustment"
  | "content_fix";

export type VisionIssueCategory =
  | "content"
  | "signature_visual"
  | "layout"
  | "style";

export interface VisionIssue {
  priority: number;
  issueId: string;
  category: VisionIssueCategory;
  ref?: string | null;
  area: string;
  issue: string;
  fixType: VisionIssueFixType;
  observed: string;
  desired: string;
  confidence: number;
}

interface VisionResult {
  resolved: string[];
  rawResolved: string[];
  rawIssueIds: Set<string>;
  issues: VisionIssue[];
  issuesJson: string;
  editIssuesJson: string;
  rawText: string;
  cost: number | null;
  elapsed: number;
}

interface EditOptions {
  iteration: number;
  referenceImage: Buffer;
  referenceMediaType: string;
  replicaImage: Buffer;
  imageSize: { w: number; h: number };
  issuesJson: string;
  proposals: Proposal[];
  contentBounds?: CropBounds | null;
  geometryHints?: GeometryHints | null;
  selection: ProviderSelection;
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

const MIN_VISION_DIFFERENCE_LENGTH = 20;
const VALID_VISION_FIX_TYPES = new Set<VisionIssueFixType>([
  "structural_change",
  "layout_adjustment",
  "style_adjustment",
  "content_fix",
]);
const VALID_VISION_CATEGORIES = new Set<VisionIssueCategory>([
  "content",
  "signature_visual",
  "layout",
  "style",
]);
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

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeFixType(value: unknown): VisionIssueFixType {
  if (typeof value === "string" && VALID_VISION_FIX_TYPES.has(value as VisionIssueFixType)) {
    return value as VisionIssueFixType;
  }
  return "layout_adjustment";
}

function normalizeRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeCategory(
  value: unknown,
  fixType: VisionIssueFixType,
  ref: string | null,
  signatureRefs: Set<string>,
  fallbackText: string,
): VisionIssueCategory {
  if (ref && signatureRefs.has(ref)) {
    return "signature_visual";
  }

  if (
    typeof value === "string" &&
    VALID_VISION_CATEGORIES.has(value as VisionIssueCategory)
  ) {
    return value as VisionIssueCategory;
  }
  if (fixType === "content_fix") {
    return "content";
  }
  if (fixType === "layout_adjustment") {
    return "layout";
  }

  const normalized = fallbackText.toLowerCase();
  if (
    /(truncate|truncated|missing|clipped|spelling|capitalization|copy|text content|word|words)/.test(
      normalized,
    )
  ) {
    return "content";
  }
  if (
    /(position|spacing|margin|padding|aligned|alignment|centered|left-aligned|right-aligned|too high|too low|shifted|offset|cluster|breathing room|gap|layout)/.test(
      normalized,
    )
  ) {
    return "layout";
  }
  if (
    /(connector|diagram|graphic|pattern|topology|structure|arrangement|attachment|line count|shape|spoke|hub|hero|illustration|chart|cross)/.test(
      normalized,
    )
  ) {
    return "signature_visual";
  }

  return "style";
}

function normalizeWhitespace(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function slugifyIdentifier(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function inferIssueKind(
  text: string,
  fixType: VisionIssueFixType,
): string {
  const normalized = normalizeWhitespace(text);
  const mentionsLayeredVisual =
    /(tricolor|stripe|stripes|band|bands|gradient|gradients|layer|layers|clip|clipping|fill order|color stop|color stops|color band|color bands)/.test(
      normalized,
    );
  const mentionsDirectionalProblem =
    /(direction|orientation|order|ordered|inverted|reversed|swapped|top-to-bottom|bottom-to-top|left-to-right|right-to-left|\b[a-z0-9#]+ on top\b|\b[a-z0-9#]+ on bottom\b|\b[a-z0-9#]+ at top\b|\b[a-z0-9#]+ at bottom\b)/.test(
      normalized,
    );

  if (mentionsLayeredVisual && mentionsDirectionalProblem) {
    return "band-direction";
  }
  if (/(missing|truncated|clipped|cut off|spelling|capitalization|copy|text content)/.test(normalized)) {
    return "content";
  }
  if (/(border|fill|opacity|pill|badge)/.test(normalized)) {
    return "border-style";
  }
  if (/(background|glow|ambient|atmospheric|gradient)/.test(normalized)) {
    return "background-style";
  }
  if (/(connector|line|pattern|topology|structure|attachment|cross|spoke|diagram)/.test(normalized)) {
    return "graphic-structure";
  }
  if (/(size|scale|width|height|too large|too small|span|narrow|wide)/.test(normalized)) {
    return "scale";
  }
  if (/(position|spacing|margin|padding|aligned|alignment|centered|shifted|offset|breathing room|cluster|top margin|vertical)/.test(normalized)) {
    return "position";
  }
  if (fixType === "content_fix") {
    return "content";
  }
  if (fixType === "layout_adjustment") {
    return "position";
  }
  if (fixType === "structural_change") {
    return "structure";
  }

  const fallback = slugifyIdentifier(normalized)
    .split("-")
    .slice(0, 4)
    .join("-");
  return fallback || "issue";
}

function normalizeIssueId(
  value: unknown,
  ref: string | null,
  area: string,
  issue: string,
  observed: string,
  desired: string,
  fixType: VisionIssueFixType,
): string {
  if (typeof value === "string" && value.trim()) {
    const normalized = canonicalizeIssueId(value);
    if (normalized) {
      return normalized;
    }
  }

  const anchor = slugifyIdentifier(ref ?? area) || "slide";
  const kind = inferIssueKind(`${area} ${issue} ${observed} ${desired}`, fixType);
  return `${anchor}.${kind}`;
}

function issueKey(issue: Pick<VisionIssue, "issueId" | "ref" | "area" | "issue">): string {
  if (issue.issueId) {
    return `id:${normalizeWhitespace(issue.issueId)}`;
  }
  if (issue.ref) {
    return `ref:${normalizeWhitespace(issue.ref)}`;
  }
  return `text:${normalizeWhitespace(issue.area)}|${normalizeWhitespace(issue.issue)}`;
}

function reindexIssues(issues: VisionIssue[]): VisionIssue[] {
  return issues.map((issue, index) => ({ ...issue, priority: index + 1 }));
}

function sortAndReindexIssues(issues: VisionIssue[]): VisionIssue[] {
  return reindexIssues(
    issues
      .slice()
      .sort((a, b) => a.priority - b.priority),
  );
}

function dedupeIssues(issues: VisionIssue[]): VisionIssue[] {
  const deduped = new Map<string, VisionIssue>();
  for (const issue of sortAndReindexIssues(issues)) {
    const key = issueKey(issue);
    if (!deduped.has(key)) {
      deduped.set(key, issue);
    }
  }
  return sortAndReindexIssues([...deduped.values()]);
}

function serializeIssues(issues: VisionIssue[]): string {
  return JSON.stringify(reindexIssues(issues), null, 2);
}

function makeFallbackIssue(text: string, priority: number): VisionIssue {
  const fixType = normalizeFixType(undefined);
  const issueId = normalizeIssueId(undefined, null, "slide", text, text, "", fixType);
  return {
    priority,
    issueId,
    category: normalizeCategory(undefined, fixType, null, new Set<string>(), text),
    ref: null,
    area: "slide",
    issue: text,
    fixType,
    observed: text,
    desired: "",
    confidence: 0.5,
  };
}

function fallbackIssuesFromText(resultText: string): VisionIssue[] {
  const trimmed = resultText.trim();
  if (trimmed.length < MIN_VISION_DIFFERENCE_LENGTH) {
    return [];
  }

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[\.)]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [makeFallbackIssue(trimmed, 1)];
  }

  return lines.slice(0, 5).map((line, index) => makeFallbackIssue(line, index + 1));
}

function normalizeVisionIssue(
  entry: unknown,
  index: number,
  signatureRefs: Set<string>,
): VisionIssue | null {
  const priority = index + 1;

  if (typeof entry === "string") {
    const text = entry.trim();
    return text ? makeFallbackIssue(text, priority) : null;
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  const raw = entry as Record<string, unknown>;
  const issueText = typeof raw.issue === "string" ? raw.issue.trim() : "";
  const observed = typeof raw.observed === "string" ? raw.observed.trim() : "";
  const desired = typeof raw.desired === "string" ? raw.desired.trim() : "";
  const area = typeof raw.area === "string" && raw.area.trim()
    ? raw.area.trim()
    : "slide";
  const ref = normalizeRef(raw.ref);
  const fixType = normalizeFixType(raw.fixType);

  const priorityValue = typeof raw.priority === "number" && Number.isFinite(raw.priority)
    ? Math.max(1, Math.round(raw.priority))
    : priority;

  if (!issueText && !observed && !desired) {
    return null;
  }

  const normalizedIssue = issueText || observed || desired;

  return {
    priority: priorityValue,
    issueId: normalizeIssueId(
      raw.issueId,
      ref,
      area,
      normalizedIssue,
      observed,
      desired,
      fixType,
    ),
    category: normalizeCategory(
      raw.category,
      fixType,
      ref,
      signatureRefs,
      `${area} ${issueText} ${observed} ${desired}`,
    ),
    ref,
    area,
    issue: normalizedIssue,
    fixType,
    observed,
    desired,
    confidence: clampConfidence(raw.confidence),
  };
}

function buildSignatureRefSet(
  semanticAnchors?: VisionSemanticAnchors | null,
): Set<string> {
  const refs = new Set<string>();

  for (const item of semanticAnchors?.signatureVisuals ?? []) {
    if (item.ref) {
      refs.add(item.ref);
    }
  }
  for (const region of semanticAnchors?.regions ?? []) {
    refs.add(region.id);
  }

  return refs;
}

/** Canonicalize an issue id: lowercase, keep [a-z0-9._-], collapse separators. */
function canonicalizeIssueId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeResolved(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string =>
      typeof entry === "string" && entry.trim().length > 0,
    )
    .map((entry) => canonicalizeIssueId(entry))
    .filter((id) => id.length > 0);
}

/** @internal exported for testing */
export function parseVisionCritique(
  resultText: string,
  signatureRefs: Set<string>,
): {
  resolved: string[];
  issues: VisionIssue[];
} {
  const jsonPayload = extractJsonPayload(resultText);
  if (!jsonPayload) {
    const issues = fallbackIssuesFromText(resultText);
    return { resolved: [], issues };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonPayload) as unknown;
  } catch {
    const issues = fallbackIssuesFromText(resultText);
    return { resolved: [], issues };
  }

  if (Array.isArray(parsed)) {
    const issues = parsed
      .map((entry, index) => normalizeVisionIssue(entry, index, signatureRefs))
      .filter((issue): issue is VisionIssue => Boolean(issue));
    return { resolved: [], issues: sortAndReindexIssues(issues) };
  }

  if (parsed && typeof parsed === "object") {
    const object = parsed as Record<string, unknown>;
    const issueEntries = Array.isArray(object.issues) ? object.issues : null;
    if (!issueEntries) {
      const issues = fallbackIssuesFromText(resultText);
      return { resolved: normalizeResolved(object.resolved), issues };
    }
    const issues = issueEntries
      .map((entry, index) => normalizeVisionIssue(entry, index, signatureRefs))
      .filter((issue): issue is VisionIssue => Boolean(issue));
    return {
      resolved: normalizeResolved(object.resolved),
      issues: sortAndReindexIssues(issues),
    };
  }

  const issues = fallbackIssuesFromText(resultText);
  return { resolved: [], issues };
}

/** @internal exported for testing */
export function postProcessVision(
  resolved: string[],
  issues: VisionIssue[],
  priorIssues: VisionIssue[],
): { resolved: string[]; issues: VisionIssue[] } {
  const currentIds = new Set(issues.map(i => i.issueId));

  // Rule 2: conflict -> unresolved wins
  const cleanResolved = resolved.filter(id => !currentIds.has(id));
  const cleanResolvedSet = new Set(cleanResolved);

  // Rule 1: missing priors -> add back to issues
  const augmentedIssues = [...issues];
  for (const prior of priorIssues) {
    if (!cleanResolvedSet.has(prior.issueId) && !currentIds.has(prior.issueId)) {
      augmentedIssues.push(prior);
    }
  }

  return {
    resolved: cleanResolved,
    issues: sortAndReindexIssues(dedupeIssues(augmentedIssues)),
  };
}

/** @internal exported for testing */
export function selectIssuesForEdit(
  issues: VisionIssue[],
  everSignatureVisualIds: Set<string>,
): VisionIssue[] {
  const sorted = sortAndReindexIssues(issues);
  const selected: VisionIssue[] = [];
  const seenKeys = new Set<string>();

  const take = (issue: VisionIssue | undefined): void => {
    if (!issue) return;
    const key = issueKey(issue);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    selected.push(issue);
  };

  // Top 5 by priority
  sorted.slice(0, 5).forEach(take);

  // Signature visual swap-in
  const isProtected = (issue: VisionIssue): boolean =>
    issue.category === "signature_visual" || everSignatureVisualIds.has(issue.issueId);

  const signatureBelow = sorted
    .slice(5)
    .filter((issue) => isProtected(issue));
  for (const sigIssue of signatureBelow) {
    const swapIndex = [...selected]
      .reverse()
      .findIndex((s) => !isProtected(s));
    if (swapIndex >= 0) {
      const actualIndex = selected.length - 1 - swapIndex;
      selected[actualIndex] = sigIssue;
    }
  }

  return reindexIssues(selected);
}

function buildVisionSemanticAnchors(
  analysis: AnalysisResult,
): VisionSemanticAnchors | null {
  const inventory = analysis.inventory;
  if (!inventory) return null;

  const signatureVisuals = inventory.signatureVisuals?.slice(0, 3) ?? [];
  const mustPreserve = inventory.mustPreserve?.slice(0, 5) ?? [];
  const regions = (inventory.regions ?? [])
    .filter((region) => region.importance === "high" || region.importance === "medium")
    .slice(0, 5)
    .map((region) => ({
      id: region.id,
      kind: region.kind,
      description: region.description,
      importance: region.importance,
    }));

  if (
    signatureVisuals.length === 0 &&
    mustPreserve.length === 0 &&
    regions.length === 0
  ) {
    return null;
  }

  return {
    ...(signatureVisuals.length ? { signatureVisuals } : {}),
    ...(mustPreserve.length ? { mustPreserve } : {}),
    ...(regions.length ? { regions } : {}),
  };
}

function buildVisionContent(
  referenceImage: Buffer,
  referenceMediaType: string,
  replicaImage: Buffer,
  userPrompt: string,
): ProviderContentPart[] {
  return [
    { type: "text", text: "ORIGINAL slide:" },
    {
      type: "image",
      buffer: referenceImage,
      mediaType: referenceMediaType,
      fileName: "original.png",
    },
    { type: "text", text: "REPLICA slide:" },
    {
      type: "image",
      buffer: replicaImage,
      mediaType: "image/png",
      fileName: "replica.png",
    },
    { type: "text", text: userPrompt },
  ];
}

function buildEditContent(
  referenceImage: Buffer,
  referenceMediaType: string,
  replicaImage: Buffer,
  userPrompt: string,
): ProviderContentPart[] {
  return buildVisionContent(
    referenceImage,
    referenceMediaType,
    replicaImage,
    userPrompt,
  );
}

function normalizeInterpolatedTextBlocks(body: string): string {
  return body.replace(
    /^([ \t]*)text:\s*\|[-+]?\s*\n([ \t]*)\{\{\s*([^}]+?)\s*\}\}[ \t]*$/gm,
    (_match, indent: string, _contentIndent: string, expression: string) => {
      const trimmedExpression = expression.trim();
      const normalizedExpression = /\|\s*yaml_string\b/.test(trimmedExpression)
        ? trimmedExpression
        : `${trimmedExpression} | yaml_string`;
      return `${indent}text: "{{ ${normalizedExpression} }}"`;
    },
  );
}

function normalizeProposalBodies(proposals: Proposal[]): Proposal[] {
  return proposals.map((proposal) => {
    const normalizedBody = normalizeInterpolatedTextBlocks(proposal.body);
    if (normalizedBody === proposal.body) {
      return proposal;
    }
    return {
      ...proposal,
      body: normalizedBody,
    };
  });
}

async function runProviderTurn(options: {
  selection: ProviderSelection;
  systemPrompt: string;
  userPrompt: string;
  content: ProviderContentPart[];
  phase: "vision" | "edit";
  signal?: AbortSignal;
  onEvent?: (event: RefineEvent) => Promise<void> | void;
  thinkingEvent: RefineEventType;
  textEvent: RefineEventType;
}): Promise<{ resultText: string; totalCost: number | null; elapsed: number }> {
  const provider = getExtractModelProvider(options.selection);
  const result = await provider.run({
    phase: options.phase,
    systemPrompt: options.systemPrompt,
    userPrompt: options.userPrompt,
    content: options.content,
    selection: options.selection,
    signal: options.signal,
    async onEvent(event) {
      checkAborted(options.signal);
      if (event.type === "thinking" && typeof event.text === "string") {
        await emit(options.onEvent, {
          event: options.thinkingEvent,
          data: { text: event.text },
        });
      } else if (event.type === "text" && typeof event.text === "string") {
        await emit(options.onEvent, {
          event: options.textEvent,
          data: { text: event.text },
        });
      }
    },
  });

  return {
    resultText: result.text,
    totalCost: result.cost,
    elapsed: result.elapsed,
  };
}

async function runVisionCritique(
  options: VisionOptions,
): Promise<VisionResult> {
  const {
    iteration,
    referenceImage,
    referenceMediaType,
    replicaImage,
    imageSize,
    contentBounds,
    semanticAnchors,
    priorIssues,
    iterationHistory,
    priorChecklist,
    selection,
    signal,
    onEvent,
  } = options;
  const signatureRefs = buildSignatureRefSet(semanticAnchors);
  const systemPrompt = buildVisionSystemPrompt();
  const userPrompt = buildVisionUserPrompt({
    imageSize,
    contentBounds,
    semanticAnchors,
    iterationHistory,
    priorChecklist,
  });

  await emit(onEvent, {
    event: "refine:vision:prompt",
    data: {
      iteration,
      phase: "vision",
      systemPrompt,
      userPrompt,
      provider: selection.provider,
      model: selection.model,
      effort: selection.effort,
    },
  });

  if (isMockProviderSelection(selection)) {
    const issues = [
      {
        priority: 1,
        issueId: "title.scale",
        category: "content",
        ref: "title",
        area: "title",
        issue: "title font is too large",
        fixType: "style_adjustment",
        observed: "Replica title appears larger than the original.",
        desired: "Original title should feel slightly smaller.",
        confidence: 0.9,
      },
      {
        priority: 2,
        issueId: "background-glow.background-style",
        category: "signature_visual",
        ref: "background-glow",
        area: "background glow",
        issue: "warm glow is missing",
        fixType: "style_adjustment",
        observed: "Replica background is flatter and darker.",
        desired: "Original includes a visible warm glow.",
        confidence: 0.84,
      },
    ] satisfies VisionIssue[];
    const editIssues = selectIssuesForEdit(issues, options.everSignatureVisualIds ?? new Set());
    const issuesJson = serializeIssues(issues);
    const editIssuesJson = serializeIssues(editIssues);
    await emit(onEvent, {
      event: "refine:vision:thinking",
      data: {
        text: "Mock model selected. Returning a deterministic local structured issue list.",
      },
    });
    await emit(onEvent, {
      event: "refine:vision:text",
      data: {
        text: issuesJson,
      },
    });
    return {
      resolved: [],
      rawResolved: [],
      rawIssueIds: new Set(issues.map(i => i.issueId)),
      issues,
      issuesJson,
      editIssuesJson,
      rawText: issuesJson,
      cost: 0,
      elapsed: 0,
    };
  }

  const result = await runProviderTurn({
    content: buildVisionContent(
      referenceImage,
      referenceMediaType,
      replicaImage,
      userPrompt,
    ),
    systemPrompt,
    userPrompt,
    selection,
    phase: "vision",
    signal,
    onEvent,
    thinkingEvent: "refine:vision:thinking",
    textEvent: "refine:vision:text",
  });

  const parsed = parseVisionCritique(result.resultText, signatureRefs);
  const postProcessed = postProcessVision(parsed.resolved, parsed.issues, priorIssues ?? []);
  const editIssues = selectIssuesForEdit(postProcessed.issues, options.everSignatureVisualIds ?? new Set());

  return {
    resolved: postProcessed.resolved,
    rawResolved: parsed.resolved,
    rawIssueIds: new Set(parsed.issues.map(i => i.issueId)),
    issues: postProcessed.issues,
    issuesJson: serializeIssues(postProcessed.issues),
    editIssuesJson: serializeIssues(editIssues),
    rawText: result.resultText,
    cost: result.totalCost,
    elapsed: result.elapsed,
  };
}

async function runProposalEdit(
  options: EditOptions,
): Promise<EditResult> {
  const {
    iteration,
    referenceImage,
    referenceMediaType,
    replicaImage,
    imageSize,
    issuesJson,
    proposals,
    contentBounds,
    geometryHints,
    selection,
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
    issuesJson,
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
      provider: selection.provider,
      model: selection.model,
      effort: selection.effort,
    },
  });

  if (isMockProviderSelection(selection)) {
    await emit(onEvent, {
      event: "refine:edit:thinking",
      data: {
        text: "Mock model selected. Returning a deterministic local refine patch.",
      },
    });
    await emit(onEvent, {
      event: "refine:edit:text",
      data: {
        text: "Mock model response ready.",
      },
    });
    return {
      proposals: createMockRefineProposals(proposals, iteration),
      status: "ok",
      cost: 0,
      elapsed: 0,
    };
  }

  const result = await runProviderTurn({
    content: buildEditContent(
      referenceImage,
      referenceMediaType,
      replicaImage,
      userPrompt,
    ),
    systemPrompt,
    userPrompt,
    selection,
    phase: "edit",
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
    proposals: normalizeProposalBodies(parsed as Proposal[]),
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
    maxIterations,
    mismatchThreshold,
    iterationOffset = 0,
    forceIterations = false,
    signal,
    onEvent,
  } = options;
  const visionSelection = options.visionSelection ?? normalizeProviderSelection({
    provider: options.visionProvider,
    model: options.visionModel,
    effort: options.visionEffort,
  });
  const editSelection = options.editSelection ?? normalizeProviderSelection({
    provider: options.editProvider,
    model: options.editModel,
    effort: options.editEffort,
  });
  const dimensions = baseAnalysis.source.dimensions;
  const baseIteration = Math.max(0, Math.floor(iterationOffset));
  const targetIteration = baseIteration + maxIterations;
  const semanticAnchors = buildVisionSemanticAnchors(baseAnalysis);
  let currentProposals = initialProposals;
  let lastMismatchRatio = 1;
  let lastCycle: RenderAndDiffResult | undefined;
  const records: IterationRecord[] = options.seedHistory ? [...options.seedHistory] : [];
  let lastPostProcessedIssues: VisionIssue[] = options.seedLastIssues ?? [];
  let totalCost: number | null = null;
  const loopStartedAt = Date.now();

  await emit(onEvent, {
    event: "refine:start",
    data: {
      iteration: baseIteration,
      maxIterations: targetIteration,
      visionProvider: visionSelection.provider,
      visionModel: visionSelection.model,
      visionEffort: visionSelection.effort,
      editProvider: editSelection.provider,
      editModel: editSelection.model,
      editEffort: editSelection.effort,
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
        iterationHistory: records,
        lastIssues: lastPostProcessedIssues,
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

    // Build everSignatureVisualIds from all records + lastPostProcessedIssues
    const everSignatureVisualIds = new Set([
      ...records.flatMap(r => r.issuesFound
        .filter(i => i.category === "signature_visual")
        .map(i => i.issueId)),
      ...lastPostProcessedIssues
        .filter(i => i.category === "signature_visual")
        .map(i => i.issueId),
    ]);

    // Format history and checklist for vision prompt
    const historyText = formatIterationHistory(records);
    const checklistText = formatPriorIssuesChecklist(
      lastPostProcessedIssues.map(i => ({ issueId: i.issueId, category: i.category, issue: i.issue }))
    );

    await emit(onEvent, {
      event: "refine:vision:start",
      data: { iteration: absoluteIteration },
    });
    const visionResult = await runVisionCritique({
      iteration: absoluteIteration,
      referenceImage: prevDiff.referenceImage,
      referenceMediaType: imageMediaType,
      replicaImage: prevDiff.replicaImage,
      imageSize: { w: prevDiff.diff.width, h: prevDiff.diff.height },
      contentBounds,
      semanticAnchors,
      priorIssues: lastPostProcessedIssues,
      iterationHistory: historyText,
      priorChecklist: checklistText,
      everSignatureVisualIds,
      selection: visionSelection,
      signal,
      onEvent,
    });

    // Backfill previous record. Use raw issue ids (before Rule 1 carry-forward)
    // to detect which priors the model actually skipped. But use post-Rule-2
    // resolved (conflicts removed) so history never says "resolved" for an
    // issue that is still active.
    if (records.length > 0) {
      const prevRecord = records[records.length - 1];
      const prevIds = new Set(prevRecord.issuesFound.map(i => i.issueId));
      const cleanResolvedIds = new Set(visionResult.resolved);
      const rawCurrentIds = visionResult.rawIssueIds;
      prevRecord.issuesResolved = [...prevIds].filter(id => cleanResolvedIds.has(id));
      prevRecord.issuesUnresolved = [...prevIds].filter(id =>
        !cleanResolvedIds.has(id) && !rawCurrentIds.has(id)
      );
    }

    totalCost = accumulateCost(totalCost, visionResult.cost);
    const visionEmpty = visionResult.issues.length === 0;
    await emit(onEvent, {
      event: "refine:vision:done",
      data: {
        differences: visionResult.rawText,
        resolved: visionResult.resolved,
        issuesJson: visionResult.issuesJson,
        editIssuesJson: visionResult.editIssuesJson,
        issueCount: visionResult.issues.length,
        cost: visionResult.cost,
        elapsed: visionResult.elapsed,
        ...(visionEmpty ? { visionEmpty: true } : {}),
      },
    });

    if (visionEmpty) {
      lastPostProcessedIssues = [];
      records.push({
        iteration: absoluteIteration,
        issuesFound: [],
        issuesEdited: [],
        editApplied: false,
        issuesResolved: [],
        issuesUnresolved: [],
      });
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
          iterationHistory: records,
          lastIssues: lastPostProcessedIssues,
        },
      });
      lastMismatchRatio = prevDiff.diff.mismatchRatio;
      continue;
    }

    await emit(onEvent, {
      event: "refine:edit:start",
      data: { iteration: absoluteIteration },
    });
    const editResult = await runProposalEdit({
      iteration: absoluteIteration,
      referenceImage: prevDiff.referenceImage,
      referenceMediaType: imageMediaType,
      replicaImage: prevDiff.replicaImage,
      imageSize: { w: prevDiff.diff.width, h: prevDiff.diff.height },
      issuesJson: visionResult.editIssuesJson,
      proposals: currentProposals,
      contentBounds,
      geometryHints,
      selection: editSelection,
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

    // Push record and update lastPostProcessedIssues
    const editIssueIds = JSON.parse(visionResult.editIssuesJson).map((i: VisionIssue) => i.issueId);
    records.push({
      iteration: absoluteIteration,
      issuesFound: visionResult.issues.map(i => ({
        issueId: i.issueId, category: i.category, summary: i.issue,
      })),
      issuesEdited: editIssueIds,
      editApplied: editResult.status === "ok" && editResult.proposals !== null,
      issuesResolved: [],
      issuesUnresolved: [],
    });
    lastPostProcessedIssues = visionResult.issues;

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
        iterationHistory: records,
        lastIssues: lastPostProcessedIssues,
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
          iterationHistory: records,
          lastIssues: lastPostProcessedIssues,
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
      iterationHistory: records,
      lastIssues: lastPostProcessedIssues,
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
