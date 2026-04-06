import { readFileSync } from "fs";
import { join } from "path";
import type {
  GeometryHints,
  Inventory,
  InventoryRegion,
  SignatureVisual,
} from "@/components/extract/types";

export interface VisionSemanticAnchors {
  signatureVisuals?: SignatureVisual[];
  mustPreserve?: Inventory["mustPreserve"];
  regions?: Array<Pick<InventoryRegion, "id" | "kind" | "description" | "importance">>;
}

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
  semanticAnchors?: VisionSemanticAnchors | null;
  priorIssuesJson?: string | null;
}

export interface EditPromptContext {
  imageSize?: { w: number; h: number };
  proposalSpace?: { w: number; h: number } | null;
  issuesJson: string;
  proposalsJson: string;
  contentBounds?: { x: number; y: number; w: number; h: number } | null;
  geometryHints?: GeometryHints | null;
}

function isFullImageBounds(
  bounds: { x: number; y: number; w: number; h: number } | null | undefined,
  imageSize: { w: number; h: number } | undefined,
): boolean {
  return Boolean(
    bounds &&
    imageSize &&
    bounds.x === 0 &&
    bounds.y === 0 &&
    bounds.w === imageSize.w &&
    bounds.h === imageSize.h,
  );
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

- Return ONLY a JSON object with \`issues\` and optional \`resolvedRefs\`.
- Focus on the 3 most visually impactful differences first, but you may return up to 5 issues total.
- Use this schema exactly:
  \`\`\`json
  {
    "issues": [
      {
        "priority": 1,
        "category": "signature_visual",
        "ref": "hero-graphic",
        "area": "primary graphic group",
        "issue": "structure is wrong",
        "fixType": "structural_change",
        "observed": "Replica uses the wrong arrangement and relationships between parts.",
        "desired": "Original uses a different structure that changes the overall visual identity.",
        "confidence": 0.92
      }
    ],
    "resolvedRefs": ["previous-ref-that-now-matches"]
  }
  \`\`\`
- \`priority\` must be an integer rank starting at 1.
- \`category\` must be one of: \`content\`, \`signature_visual\`, \`layout\`, \`style\`.
- \`ref\` should match an extract inventory id when possible (for example a typography id, region id, or repeatGroup id). Use \`null\` when you cannot map confidently.
- \`fixType\` must be one of: \`structural_change\`, \`layout_adjustment\`, \`style_adjustment\`, \`content_fix\`.
- Use \`structural_change\` when the current encoding likely needs a local section rewrite instead of numeric nudges.
- \`area\` should name the concrete visual target or group being fixed.
- \`observed\` should describe what the REPLICA currently shows.
- \`desired\` should describe what the ORIGINAL shows.
- If semantic anchors are provided, treat \`signatureVisuals\` as top-priority identity constraints. If one is still visibly wrong, rank it above local text clipping or minor polish.
- For diagrams, decorative systems, repeating structures, and multi-part graphics: judge structure, topology, count, and attachment pattern before weight, opacity, or color.
- If multiple issue categories are visibly present, diversify the top 3 so they cover different classes when possible: \`content\`, \`signature_visual\`, and \`layout\` before second-order duplicates.
- If prior unresolved signature-visual issues are provided, do NOT omit them silently. Either carry them forward in \`issues\` or add their \`ref\` values to \`resolvedRefs\` if they now clearly match.
- Do not silently downgrade a prior structural signature-visual issue to a style issue unless the structure now clearly matches.
- **Do not chase pixel alignment.** If an element is roughly in the right place, leave it. Only fix things that are visibly wrong at a glance.
- Only the slide content inside contentBounds matters. Ignore pixels outside contentBounds — they are presentation chrome.

Return ONLY the JSON object.`;
}

export function buildVisionUserPrompt(context: VisionPromptContext): string {
  const contentBounds = context.contentBounds
    ? `(${context.contentBounds.x}, ${context.contentBounds.y}, ${context.contentBounds.w}x${context.contentBounds.h})`
    : "full image";
  const boundsMode = context.contentBounds
    ? "Treat everything outside that rectangle as non-slide chrome and ignore it."
    : "The full image is slide content.";
  const signatureVisualsSection = context.semanticAnchors?.signatureVisuals?.length
    ? `\nSignature visuals from extract (treat these as the slide's visual identity and keep them above local polish if still wrong):\n${context.semanticAnchors.signatureVisuals
      .map((item) => `- [${item.importance}] ${item.text}${item.ref ? ` (ref: ${item.ref})` : ""}`)
      .join("\n")}`
    : "";
  const mustPreserveSection = context.semanticAnchors?.mustPreserve?.length
    ? `\nMust-preserve content from extract:\n${context.semanticAnchors.mustPreserve
      .map((item) => `- ${item.text}${item.ref ? ` (ref: ${item.ref})` : ""}`)
      .join("\n")}`
    : "";
  const regionsSection = context.semanticAnchors?.regions?.length
    ? `\nImportant extracted regions:\n${context.semanticAnchors.regions
      .map((region) => `- [${region.importance}] ${region.id} (${region.kind}): ${region.description}`)
      .join("\n")}`
    : "";
  const priorIssuesSection = context.priorIssuesJson
    ? `\nPrevious unresolved issues from the prior iteration:\n\`\`\`json\n${context.priorIssuesJson}\n\`\`\`\nIf any of these are still visibly wrong, keep them at high priority instead of replacing them with lower-level cosmetic issues. If a prior signature-visual issue now clearly matches, list its ref under resolvedRefs.`
    : "";

  return `Image size: ${context.imageSize.w}x${context.imageSize.h}
Visible slide area (contentBounds): ${contentBounds}
${boundsMode}
${signatureVisualsSection}${mustPreserveSection}${regionsSection}${priorIssuesSection}

Compare the ORIGINAL against the REPLICA and list every visible difference.`;
}

export function buildEditSystemPrompt(): string {
  return `You are patching slide proposals to reduce visible mismatch.

You will receive:
- Two images, each labeled:
  - ORIGINAL: the unchanging reference screenshot. This is the ground truth.
  - REPLICA: the current rendered version we are trying to improve.
- A structured issue list produced by a visual comparison step
- The current proposals JSON
- contentBounds for the actual slide area

## Scene Authoring Reference

The following is the complete scene YAML syntax reference. The template body in each proposal follows this syntax exactly.

<reference>
${SCENE_REFERENCE_CONTENT}
</reference>

## Rules

- Fix the 3 highest-priority issues from the list, plus any unresolved sticky \`signature_visual\` issues.
- Use the ORIGINAL and REPLICA images as the source of truth when deciding what to patch.
- Use the structured issue list as guidance, but if it is incomplete or slightly wrong, resolve against the images.
- Each issue may include: \`priority\`, \`category\`, \`ref\`, \`area\`, \`issue\`, \`fixType\`, \`observed\`, \`desired\`, \`confidence\`, \`sticky\`.
- Treat \`sticky: true\` on a \`signature_visual\` issue as mandatory even if its priority falls below 3.
- The provided contentBounds is in the pixel space of the ORIGINAL/REPLICA images. It is only for identifying the visible slide area in those images.
- Treat image-space context and proposal-space context as separate. Do not mix them.
- Patch the proposals JSON surgically.
- Do NOT rewrite proposals from scratch.
- Do NOT restructure, rename, or reorganize proposals.
- If an issue has \`fixType: "structural_change"\`, you may replace the minimal relevant subsection of the proposal body required to fix it.
- Do NOT invent a new coordinate system, hidden scaling factor, or alternate slide bounds.
- The proposals may be authored in a different internal coordinate space than the images. Preserve that proposal-space coordinate system unless a visual fix truly requires changing proposal geometry.
- If geometry ground truth is provided in the user prompt, treat those rectangles as exact and patch toward them instead of re-guessing layout.
- The template body uses Nunjucks. Do NOT use filters like \`| min\`, \`| max\`, \`| abs\`, \`| round\` — they are not available. Use pre-computed numeric values instead.
- If the issue list is weak or unhelpful, keep the proposals unchanged.
- The coordinate origin is the top-left corner. x increases to the right. y increases downward.
- Only the slide content inside contentBounds matters. Ignore presentation chrome.

Return ONLY a JSON array of proposals, wrapped in \`\`\`json fences.`;
}

export function buildEditUserPrompt(context: EditPromptContext): string {
  const fullImageBounds = isFullImageBounds(context.contentBounds, context.imageSize);
  const imageSizeLine = context.imageSize
    ? `- Image size: ${context.imageSize.w}x${context.imageSize.h}`
    : null;
  const slideAreaLine = fullImageBounds
    ? "- Visible slide area in those images: full image"
    : context.contentBounds
      ? `- Visible slide area in those images (imageContentBounds): (${context.contentBounds.x}, ${context.contentBounds.y}, ${context.contentBounds.w}x${context.contentBounds.h})`
      : "- Visible slide area in those images: full image";
  const imageChromeLine = fullImageBounds || !context.contentBounds
    ? "- The full image is slide content."
    : "- Treat everything outside that rectangle as non-slide chrome and ignore it.";
  const proposalSpaceLine = context.proposalSpace
    ? `- Current proposals are authored in approximately ${context.proposalSpace.w}x${context.proposalSpace.h} space.`
    : "- Current proposals may use a different authored coordinate space than the images.";
  const geometrySection = context.geometryHints
    ? `\nGeometry ground truth:\n- These element rectangles come from the framework's rendered layout and are exact.\n- Reuse them when patching proposal geometry instead of re-estimating positions from the image.\n\`\`\`json\n${JSON.stringify(context.geometryHints, null, 2)}\n\`\`\`\n`
    : "";

  return `You will also receive two labeled images before this prompt:
- ORIGINAL slide: the target screenshot
- REPLICA slide: the current rendered output

Image context:
${[imageSizeLine, slideAreaLine, imageChromeLine].filter(Boolean).join("\n")}

Proposal context:
${proposalSpaceLine}
- Preserve that proposal-space coordinate system. Do not rescale or rewrite the whole proposal just to match the image dimensions.
${geometrySection}

Structured issues:
\`\`\`json
${context.issuesJson}
\`\`\`

Current proposals:
\`\`\`json
${context.proposalsJson}
\`\`\`

Fix the listed issues. Return the full proposals JSON array.`;
}
