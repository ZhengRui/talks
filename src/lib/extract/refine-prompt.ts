import type { DiffRegion } from "@/lib/render/compare";

export interface RefinePromptContext {
  mismatchRatio: number;
  regions: DiffRegion[];
  proposalsJson: string;
  fullImageSize: { w: number; h: number };
  croppedImageSize: { w: number; h: number };
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
- All three attached images share the same pixel coordinate space.
- The image origin is the top-left corner. x increases to the right. y increases downward.
- Mismatch region coordinates refer to the attached images, not to the uncropped screenshot.
- If the images were cropped to contentBounds, map a crop-space coordinate back to full-image space by adding contentBounds.x/contentBounds.y first. If the proposal body's sourceSize differs from the full-image size, then scale from full-image space into sourceSize proportionally.
- Patch the proposals JSON surgically. Fix only the specific values causing visible mismatches.
- Do NOT rewrite proposals from scratch. Do NOT restructure, rename, or reorganize.
- Do NOT change template mechanics unless they directly cause a visible mismatch.
- Do NOT invent a new coordinate system, hidden scaling factor, or alternate slide bounds.
- Prefer small, evidence-based numeric adjustments. Only move an entire structure when the same offset is clearly visible across multiple elements.
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
  const cropMode = context.contentBounds
    ? "The attached images are already cropped to contentBounds, so mismatch-region coordinates are in cropped-image space."
    : "The attached images use the full-image coordinate space.";

  return `Overall mismatch: ${mismatchPct}%

Full image size: ${context.fullImageSize.w}x${context.fullImageSize.h}
Attached image size: ${context.croppedImageSize.w}x${context.croppedImageSize.h}
Visible slide area (contentBounds): ${contentBounds}
${cropMode}

Mismatch regions (largest first):
${regionList || "No significant mismatch regions detected."}

Current proposals:
\`\`\`json
${context.proposalsJson}
\`\`\`

Compare the original screenshot (image 1) with the rendered replica (image 2). The annotated diff (image 3) highlights mismatched areas in red with labeled region boxes.

Patch the proposals to reduce the visual mismatch. Return the full proposals JSON array.`;
}
