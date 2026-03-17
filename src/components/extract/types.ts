// Shared types and utilities for extract workbench components.

const REGION_COLORS = [
  "#22d3ee", "#a78bfa", "#f472b6", "#facc15", "#34d399", "#fb923c",
];

export function regionColor(index: number): string {
  return REGION_COLORS[index % REGION_COLORS.length];
}

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

export interface AnalysisResult {
  source: {
    image: string;
    dimensions: { w: number; h: number };
    imagePath: string;
  };
  proposals: Proposal[];
}
