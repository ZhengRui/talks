import type { DiffRegion } from "@/lib/render/compare";

export interface RefinePromptContext {
  mismatchRatio: number;
  regions: DiffRegion[];
  proposalsJson: string;
  contentBounds?: { x: number; y: number; w: number; h: number } | null;
}

export function buildRefineSystemPrompt(): string {
  return `You are refining a slide replica template by comparing a rendered replica against the original screenshot.

You will receive three images:
1. The original reference screenshot
2. The rendered replica from the current proposals
3. An annotated diff heatmap showing mismatched regions

Plus structured data: mismatch regions with coordinates and severity, content bounds for the visible slide area, and the current proposals JSON.

Rules:
- Compare the original and replica visually to understand what is wrong.
- Use the annotated diff and region data to prioritize the largest mismatches.
- Patch the proposals JSON surgically. Fix only the specific values causing visible mismatches.
- Do NOT rewrite proposals from scratch. Do NOT restructure, rename, or reorganize.
- Do NOT change template mechanics unless they directly cause a visible mismatch.
- Focus on visual fidelity: colors, font sizes, positions, gradients, spacing, opacity, missing elements, and obvious structural errors.
- Return the complete proposals JSON array with your modifications applied.

Return ONLY a JSON array of proposals, wrapped in \`\`\`json fences.`;
}

export function buildRefineUserPrompt(context: RefinePromptContext): string {
  const mismatchPct = Math.round(context.mismatchRatio * 100);
  const regionList = context.regions
    .map(
      (region, index) =>
        `R${index + 1}: (${region.x}, ${region.y}, ${region.w}x${region.h}) — ${Math.round(region.mismatchRatio * 100)}% mismatch`,
    )
    .join("\n");
  const contentBounds = context.contentBounds
    ? `(${context.contentBounds.x}, ${context.contentBounds.y}, ${context.contentBounds.w}x${context.contentBounds.h})`
    : "full image";

  return `Overall mismatch: ${mismatchPct}%

Visible slide area (contentBounds): ${contentBounds}

Mismatch regions (largest first):
${regionList || "No significant mismatch regions detected."}

Current proposals:
\`\`\`json
${context.proposalsJson}
\`\`\`

Compare the original screenshot (image 1) with the rendered replica (image 2). The annotated diff (image 3) highlights mismatched areas in red with labeled region boxes.

Patch the proposals to reduce the visual mismatch. Return the full proposals JSON array.`;
}
