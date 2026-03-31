import type { DiffRegion } from "@/lib/render/compare";

// Shared types and utilities for extract workbench components.

const REGION_COLORS = [
  "#22d3ee", "#a78bfa", "#f472b6", "#facc15", "#34d399", "#fb923c",
];

export function regionColor(index: number): string {
  return REGION_COLORS[index % REGION_COLORS.length];
}

export type AnalysisStage = "extract" | "refine";
export type PromptPhase = "extract" | "vision" | "edit";

export interface PromptRecord {
  stage: AnalysisStage;
  phase: PromptPhase;
  iteration: number | null;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  effort?: string;
  timestamp: number;
}

export interface GeometryHintRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GeometryHintElement {
  id: string;
  kind: string;
  parentId?: string;
  depth: number;
  rect: GeometryHintRect;
  text?: string;
}

export interface GeometryHints {
  source: "layout";
  canvas: { w: number; h: number };
  elements: GeometryHintElement[];
}

export type BenchmarkVariant = "control" | "coords";

export interface ProposalField {
  type: string;
  value: unknown;
}

export interface Proposal {
  scope: "slide" | "block";
  name: string;
  description: string;
  region: { x: number; y: number; w: number; h: number };
  params: Record<string, ProposalField>;
  style: Record<string, ProposalField>;
  body: string;
}

export interface InventoryBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface InventoryBackgroundLayer {
  kind: string;
  bbox?: InventoryBbox;
  description: string;
  importance: "high" | "medium" | "low";
}

export interface InventoryBackground {
  summary: string;
  base: string;
  palette: string[];
  layers: InventoryBackgroundLayer[];
}

export interface InventoryTypographyStyle {
  color: string;
  fontSize: number;
  fontWeight: number;
  textAlign?: "left" | "center" | "right";
  textTransform?: "uppercase" | "lowercase" | "none";
  letterSpacing?: number;
  fontFamilyHint?: "heading" | "body" | "mono" | string;
  fontStyle?: "normal" | "italic";
  lineHeight?: number;
}

export interface InventoryTypography {
  id: string;
  text: string;
  bbox: InventoryBbox;
  importance: "high" | "medium" | "low";
  style: InventoryTypographyStyle;
}

export interface InventoryRegion {
  id: string;
  kind: string;
  bbox: InventoryBbox;
  importance: "high" | "medium" | "low";
  description: string;
}

export interface InventoryRepeatGroup {
  id: string;
  bbox: InventoryBbox;
  count: number;
  orientation: "row" | "column" | "grid";
  itemSize?: { w: number; h: number };
  gap?: number;
  gapX?: number;
  gapY?: number;
  description: string;
  variationPoints?: string[];
}

export interface InventoryBlockCandidate {
  name: string;
  sourceRepeatGroupId: string;
  reason: string;
  defer: boolean;
}

export interface SignatureVisual {
  text: string;
  ref?: string | null;
  importance: "high" | "medium";
}

export interface Inventory {
  slideBounds: InventoryBbox;
  background: InventoryBackground;
  typography: InventoryTypography[];
  regions: InventoryRegion[];
  repeatGroups: InventoryRepeatGroup[];
  signatureVisuals: SignatureVisual[];
  mustPreserve: Array<{ text: string; ref?: string | null }>;
  uncertainties: string[];
  blockCandidates: InventoryBlockCandidate[];
}

export interface AnalysisProvenance {
  model: string;
  effort: string;
}

export interface StageAnalysisProvenance extends AnalysisProvenance {
  elapsed?: number;
  cost?: number | null;
}

export interface RefineProvenance {
  visionModel: string;
  visionEffort: string;
  editModel: string;
  editEffort: string;
}

export interface AnalysisResult {
  source: {
    image: string;
    dimensions: { w: number; h: number };
    reportedDimensions?: { w: number; h: number };
    contentBounds?: { x: number; y: number; w: number; h: number };
  };
  inventory?: Inventory;
  provenance?: {
    pass1: AnalysisProvenance | null;
  };
  proposals: Proposal[];
}

export interface AnalysisResultPayload extends Omit<AnalysisResult, "provenance"> {
  provenance?: {
    pass1: StageAnalysisProvenance | null;
  };
}

export interface RefineIterationResult {
  iteration: number;
  mismatchRatio: number;
  proposals: Proposal[];
  regions: DiffRegion[];
  diffArtifactUrl: string;
}
