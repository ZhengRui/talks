export interface ExtractDimensions {
  w: number;
  h: number;
}

export interface ExtractRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExtractProposalLike {
  region: ExtractRegion;
}

export interface ExtractAnalysisLike {
  source?: {
    dimensions?: ExtractDimensions;
  } & Record<string, unknown>;
  proposals?: ExtractProposalLike[];
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeRegion(
  region: ExtractRegion,
  ratioX: number,
  ratioY: number,
  bounds: ExtractDimensions,
): ExtractRegion {
  const left = clamp(region.x * ratioX, 0, bounds.w);
  const top = clamp(region.y * ratioY, 0, bounds.h);
  const right = clamp((region.x + region.w) * ratioX, 0, bounds.w);
  const bottom = clamp((region.y + region.h) * ratioY, 0, bounds.h);

  return {
    x: left,
    y: top,
    w: Math.max(0, right - left),
    h: Math.max(0, bottom - top),
  };
}

export function normalizeAnalysisRegions<T extends ExtractAnalysisLike>(
  analysis: T,
  actualSize: ExtractDimensions | null,
): T {
  if (!actualSize || !isFinitePositive(actualSize.w) || !isFinitePositive(actualSize.h)) {
    return analysis;
  }

  const reported = analysis.source?.dimensions;
  const proposals = Array.isArray(analysis.proposals) ? analysis.proposals : [];

  if (!reported || !isFinitePositive(reported.w) || !isFinitePositive(reported.h)) {
    return {
      ...analysis,
      source: {
        ...(analysis.source ?? {}),
        dimensions: actualSize,
      },
    };
  }

  const ratioX = actualSize.w / reported.w;
  const ratioY = actualSize.h / reported.h;
  const needsRescale = Math.abs(ratioX - 1) > 0.001 || Math.abs(ratioY - 1) > 0.001;

  return {
    ...analysis,
    source: {
      ...(analysis.source ?? {}),
      dimensions: actualSize,
    },
    proposals: needsRescale
      ? proposals.map((proposal) => ({
          ...proposal,
          region: normalizeRegion(proposal.region, ratioX, ratioY, actualSize),
        }))
      : proposals,
  };
}
