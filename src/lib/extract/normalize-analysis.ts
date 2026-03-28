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

export interface ExtractInventoryBackgroundLayerLike {
  bbox?: ExtractRegion;
}

export interface ExtractInventoryTypographyStyleLike {
  fontSize?: number;
  letterSpacing?: number;
  lineHeight?: number;
}

export interface ExtractInventoryTypographyLike {
  bbox: ExtractRegion;
  style?: ExtractInventoryTypographyStyleLike;
}

export interface ExtractInventoryRegionLike {
  bbox: ExtractRegion;
}

export interface ExtractInventoryRepeatGroupLike {
  bbox: ExtractRegion;
  orientation?: "row" | "column" | "grid";
  itemSize?: { w: number; h: number };
  gap?: number;
  gapX?: number;
  gapY?: number;
}

export interface ExtractInventoryLike {
  slideBounds?: ExtractRegion;
  background?: {
    layers?: ExtractInventoryBackgroundLayerLike[];
  };
  typography?: ExtractInventoryTypographyLike[];
  regions?: ExtractInventoryRegionLike[];
  repeatGroups?: ExtractInventoryRepeatGroupLike[];
}

// Keep these loose structural types in sync with the extract inventory
// schema in src/components/extract/types.ts. This layer accepts partially
// parsed model output and should remain tolerant of missing fields.
export interface ExtractAnalysisLike {
  source?: {
    dimensions?: ExtractDimensions;
    reportedDimensions?: ExtractDimensions;
    contentBounds?: ExtractRegion;
  } & Record<string, unknown>;
  inventory?: ExtractInventoryLike;
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

function scaleSize(
  size: { w: number; h: number },
  ratioX: number,
  ratioY: number,
): { w: number; h: number } {
  return {
    w: Math.max(0, size.w * ratioX),
    h: Math.max(0, size.h * ratioY),
  };
}

function normalizeInventory(
  inventory: ExtractInventoryLike | undefined,
  ratioX: number,
  ratioY: number,
  bounds: ExtractDimensions,
): ExtractInventoryLike | undefined {
  if (!inventory) return inventory;

  return {
    ...inventory,
    ...(inventory.slideBounds
      ? { slideBounds: normalizeRegion(inventory.slideBounds, ratioX, ratioY, bounds) }
      : {}),
    ...(inventory.background
      ? {
          background: {
            ...inventory.background,
            ...(Array.isArray(inventory.background.layers)
              ? {
                  layers: inventory.background.layers.map((layer) => ({
                    ...layer,
                    ...(layer.bbox
                      ? { bbox: normalizeRegion(layer.bbox, ratioX, ratioY, bounds) }
                      : {}),
                  })),
                }
              : {}),
          },
        }
      : {}),
    ...(Array.isArray(inventory.typography)
      ? {
          typography: inventory.typography.map((item) => ({
            ...item,
            bbox: normalizeRegion(item.bbox, ratioX, ratioY, bounds),
            ...(item.style
              ? {
                  style: {
                    ...item.style,
                    ...(typeof item.style.fontSize === "number"
                      ? { fontSize: item.style.fontSize * ratioY }
                      : {}),
                    ...(typeof item.style.letterSpacing === "number"
                      ? { letterSpacing: item.style.letterSpacing * ratioX }
                      : {}),
                  },
                }
              : {}),
          })),
        }
      : {}),
    ...(Array.isArray(inventory.regions)
      ? {
          regions: inventory.regions.map((item) => ({
            ...item,
            bbox: normalizeRegion(item.bbox, ratioX, ratioY, bounds),
          })),
        }
      : {}),
    ...(Array.isArray(inventory.repeatGroups)
      ? {
          repeatGroups: inventory.repeatGroups.map((group) => ({
            ...group,
            bbox: normalizeRegion(group.bbox, ratioX, ratioY, bounds),
            ...(group.itemSize ? { itemSize: scaleSize(group.itemSize, ratioX, ratioY) } : {}),
            ...(typeof group.gap === "number" && group.orientation === "row"
              ? { gap: group.gap * ratioX }
              : {}),
            ...(typeof group.gap === "number" && group.orientation === "column"
              ? { gap: group.gap * ratioY }
              : {}),
            ...(typeof group.gapX === "number" ? { gapX: group.gapX * ratioX } : {}),
            ...(typeof group.gapY === "number" ? { gapY: group.gapY * ratioY } : {}),
          })),
        }
      : {}),
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
        contentBounds: normalizeRegion(
          analysis.source?.contentBounds ?? { x: 0, y: 0, w: actualSize.w, h: actualSize.h },
          1,
          1,
          actualSize,
        ),
      },
    };
  }

  const ratioX = actualSize.w / reported.w;
  const ratioY = actualSize.h / reported.h;
  const needsRescale = Math.abs(ratioX - 1) > 0.001 || Math.abs(ratioY - 1) > 0.001;
  const rawContentBounds = analysis.source?.contentBounds ?? {
    x: 0,
    y: 0,
    w: reported.w,
    h: reported.h,
  };
  const scaledContentBounds = needsRescale
    ? normalizeRegion(rawContentBounds, ratioX, ratioY, actualSize)
    : normalizeRegion(rawContentBounds, 1, 1, actualSize);
  const normalizedContentBounds =
    scaledContentBounds.w > 0 && scaledContentBounds.h > 0
      ? scaledContentBounds
      : { x: 0, y: 0, w: actualSize.w, h: actualSize.h };

  return {
    ...analysis,
    source: {
      ...(analysis.source ?? {}),
      dimensions: actualSize,
      reportedDimensions: reported,
      contentBounds: normalizedContentBounds,
    },
    ...(analysis.inventory
      ? {
          inventory: needsRescale
            ? normalizeInventory(analysis.inventory, ratioX, ratioY, actualSize)
            : analysis.inventory,
        }
      : {}),
    proposals: needsRescale
      ? proposals.map((proposal) => ({
          ...proposal,
          region: normalizeRegion(proposal.region, ratioX, ratioY, actualSize),
        }))
      : proposals,
  };
}
