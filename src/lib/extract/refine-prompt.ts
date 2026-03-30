export interface RefinePromptContext {
  proposalsJson: string;
  imageSize: { w: number; h: number };
  contentBounds?: { x: number; y: number; w: number; h: number } | null;
}

export function buildRefineSystemPrompt(): string {
  return `You are refining a slide replica by comparing it against the original screenshot.

You will receive three images:
- Image 1: side-by-side (original left, replica right) for quick spatial comparison.
- Image 2: the original at full resolution.
- Image 3: the replica at full resolution.

## How to analyze

Look at Image 2 (original) carefully. Then look at Image 3 (replica). List every visible difference — do not rush, do not skip areas. Scan top-to-bottom, left-to-right.

Common things people miss:
- Decorative elements: wrong number of lines, wrong line pattern, wrong visual weight
- Text too small or too large relative to its container
- Fills that should extend beyond borders (or vice versa)
- Elements not centered when they should be
- Wrong font weight, wrong text alignment, wrong colors

**Only these are unfixable** (ignore them entirely):
- Emoji vs line-art/SVG icons
- Font rendering engine differences
- Image compression artifacts

Everything else is fixable. "Hard to implement" is not unfixable.

## Rules

- **Pick the 3 most visually impactful differences** and fix them. State each one before writing JSON.
- **Do not chase pixel alignment.** If an element is roughly in the right place, leave it. Only fix things that are visibly wrong at a glance.
- **Do not oscillate.** If you moved something last iteration, do not move it again.
- **If the replica already looks good, return the proposals unchanged.** A clean replica at higher mismatch is better than a distorted one at lower mismatch.
- Patch the proposals JSON surgically. Fix only the specific values causing visible mismatches.
- Do NOT rewrite proposals from scratch. Do NOT restructure, rename, or reorganize.
- Do NOT invent a new coordinate system, hidden scaling factor, or alternate slide bounds.
- The image origin is the top-left corner. x increases to the right. y increases downward.
- Only the slide content inside contentBounds matters. Ignore pixels outside contentBounds — they are presentation chrome.

Return ONLY a JSON array of proposals, wrapped in \`\`\`json fences.`;
}

export function buildRefineUserPrompt(context: RefinePromptContext): string {
  const contentBounds = context.contentBounds
    ? `(${context.contentBounds.x}, ${context.contentBounds.y}, ${context.contentBounds.w}x${context.contentBounds.h})`
    : "full image";
  const boundsMode = context.contentBounds
    ? "Treat everything outside that rectangle as non-slide chrome and ignore it."
    : "The full image is slide content.";

  return `Image size: ${context.imageSize.w}x${context.imageSize.h}
Visible slide area (contentBounds): ${contentBounds}
${boundsMode}

Current proposals:
\`\`\`json
${context.proposalsJson}
\`\`\`

Image 1 is the side-by-side overview. Images 2 and 3 are the original and replica at full resolution. Focus on the major structural and visual differences.

Patch the proposals to reduce the visual mismatch. Return the full proposals JSON array.`;
}
