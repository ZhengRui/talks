import { readFileSync } from "fs";
import { join } from "path";

/** Injected at import time so it's available as a constant. */
const SCENE_REFERENCE_CONTENT = (() => {
  try {
    return readFileSync(
      join(process.cwd(), ".claude/skills/replicate-slides/reference.md"),
      "utf-8",
    );
  } catch {
    return "<!-- reference.md not found -->";
  }
})();

export interface VisionPromptContext {
  imageSize: { w: number; h: number };
  contentBounds?: { x: number; y: number; w: number; h: number } | null;
}

export interface EditPromptContext {
  differences: string;
  proposalsJson: string;
  contentBounds?: { x: number; y: number; w: number; h: number } | null;
}

export function buildVisionSystemPrompt(): string {
  return `You are visually comparing a slide replica against the original screenshot.

You will receive two images, each labeled:
- ORIGINAL: the unchanging reference screenshot. This is the ground truth — what the slide should look like.
- REPLICA: the current rendered version we are trying to improve. This is what needs fixing.

## How to analyze

Look at the ORIGINAL carefully — this is the target. Then look at the REPLICA — this is what we built. Describe what the REPLICA does wrong compared to the ORIGINAL. Do not rush, do not skip areas. Scan top-to-bottom, left-to-right.

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

- List the visible differences in plain text, ordered by visual impact.
- Focus on the 3 most visually impactful differences first.
- **Do not chase pixel alignment.** If an element is roughly in the right place, leave it. Only fix things that are visibly wrong at a glance.
- Only the slide content inside contentBounds matters. Ignore pixels outside contentBounds — they are presentation chrome.

Return ONLY the visible difference list as plain text.`;
}

export function buildVisionUserPrompt(context: VisionPromptContext): string {
  const contentBounds = context.contentBounds
    ? `(${context.contentBounds.x}, ${context.contentBounds.y}, ${context.contentBounds.w}x${context.contentBounds.h})`
    : "full image";
  const boundsMode = context.contentBounds
    ? "Treat everything outside that rectangle as non-slide chrome and ignore it."
    : "The full image is slide content.";

  return `Image size: ${context.imageSize.w}x${context.imageSize.h}
Visible slide area (contentBounds): ${contentBounds}
${boundsMode}

Compare the ORIGINAL against the REPLICA and list every visible difference.`;
}

export function buildEditSystemPrompt(): string {
  return `You are patching slide proposals to reduce visible mismatch.

You will receive:
- A plain text difference list produced by a visual comparison step
- The current proposals JSON
- contentBounds for the actual slide area

## Scene Authoring Reference

The following is the complete scene YAML syntax reference. The template body in each proposal follows this syntax exactly.

<reference>
${SCENE_REFERENCE_CONTENT}
</reference>

## Rules

- Fix only the 3 most visually impactful differences from the list.
- Patch the proposals JSON surgically.
- Do NOT rewrite proposals from scratch.
- Do NOT restructure, rename, or reorganize proposals.
- Do NOT invent a new coordinate system, hidden scaling factor, or alternate slide bounds.
- The template body uses Nunjucks. Do NOT use filters like \`| min\`, \`| max\`, \`| abs\`, \`| round\` — they are not available. Use pre-computed numeric values instead.
- If the difference list is weak or unhelpful, keep the proposals unchanged.
- The coordinate origin is the top-left corner. x increases to the right. y increases downward.
- Only the slide content inside contentBounds matters. Ignore presentation chrome.

Return ONLY a JSON array of proposals, wrapped in \`\`\`json fences.`;
}

export function buildEditUserPrompt(context: EditPromptContext): string {
  const contentBounds = context.contentBounds
    ? `(${context.contentBounds.x}, ${context.contentBounds.y}, ${context.contentBounds.w}x${context.contentBounds.h})`
    : "full image";
  const boundsMode = context.contentBounds
    ? "Treat everything outside that rectangle as non-slide chrome and ignore it."
    : "The full image is slide content.";

  return `Visible slide area (contentBounds): ${contentBounds}
${boundsMode}

Difference list:
${context.differences}

Current proposals:
\`\`\`json
${context.proposalsJson}
\`\`\`

Fix the 3 most impactful differences. Return the full proposals JSON array.`;
}
