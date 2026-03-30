import type { DiffRegion } from "@/lib/render/compare";

export interface RefinePromptContext {
  mismatchRatio: number;
  regions: DiffRegion[];
  proposalsJson: string;
  imageSize: { w: number; h: number };
  contentBounds?: { x: number; y: number; w: number; h: number } | null;
  hasDiffImage: boolean;
}

export function buildRefineSystemPrompt(hasDiffImage: boolean): string {
  const imageDesc = hasDiffImage
    ? `You will receive two images:
1. A side-by-side comparison: left half is the original reference screenshot, right half is the rendered replica
2. An annotated diff heatmap showing mismatched regions`
    : `You will receive one image:
1. A side-by-side comparison: left half is the original reference screenshot, right half is the rendered replica

The mismatch is too high for a pixel diff to be useful. Compare the two halves directly.`;

  return `You are refining a slide replica template by comparing a rendered replica against the original screenshot.

${imageDesc}

Plus structured data: mismatch regions with coordinates and severity, content bounds for the visible slide area, and the current proposals JSON.

## How to analyze

First, list ALL visible differences between the original and replica — missing elements, wrong colors, wrong sizes, wrong positions, missing content, structural issues. Do not fixate on one category. Then pick the **3 most impactful** differences to fix this iteration.

Common things to check:
- Missing or wrong content (text, icons, images that should be there but aren't)
- Clearly wrong colors (green where it should be red — but don't debate similar shades)
- Structural issues (elements missing, wrong element types, wrong layering)
- Proportion and spacing (elements too tall/short/wide/narrow compared to the original)

## Rules for changes

- **At most 3 changes per iteration.** State each change and why before writing JSON.
- **Do not oscillate.** If you adjusted a dimension last iteration, do not adjust the same dimension again unless you have clear new evidence.
- **Do not change colors that are approximately correct.** Only fix colors that are obviously the wrong hue (e.g. cyan where it should be tan).
- **Judge proportions from the original image**, not from the current replica. If the replica has elements that are clearly too tall, too short, or misplaced compared to the original, fix them.
- **A clean slide at high mismatch is better than a distorted slide at lower mismatch.**
- If uncertain whether a change helps, skip it.

## Rules

- The side-by-side image shows the original on the left and the replica on the right. Compare them at the same vertical positions to spot differences.${hasDiffImage ? "\n- Use the annotated diff and region data to prioritize the largest mismatches." : ""}
- All attached images share the same pixel coordinate space.
- The image origin is the top-left corner. x increases to the right. y increases downward.
- Only the slide content inside contentBounds matters for scoring.
- Ignore pixels outside contentBounds — they are presentation chrome.
- Patch the proposals JSON surgically. Fix only the specific values causing visible mismatches.
- Do NOT rewrite proposals from scratch. Do NOT restructure, rename, or reorganize.
- Do NOT change template mechanics unless they directly cause a visible mismatch.
- Do NOT invent a new coordinate system, hidden scaling factor, or alternate slide bounds.

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
  const boundsMode = context.contentBounds
    ? "Only pixels inside contentBounds are scored. Treat everything outside that rectangle as non-slide chrome and ignore it."
    : "The full image is slide content.";

  return `Overall mismatch: ${mismatchPct}%

Image size: ${context.imageSize.w}x${context.imageSize.h}
Visible slide area (contentBounds): ${contentBounds}
${boundsMode}

Mismatch regions (largest first):
${regionList || "No significant mismatch regions detected."}

Current proposals:
\`\`\`json
${context.proposalsJson}
\`\`\`

The side-by-side image (image 1) shows the original on the left and the replica on the right.${context.hasDiffImage ? " The annotated diff (image 2) highlights mismatched areas in red with labeled region boxes." : " Focus on the major structural and color differences between the two halves."}

Patch the proposals to reduce the visual mismatch. Return the full proposals JSON array.`;
}
