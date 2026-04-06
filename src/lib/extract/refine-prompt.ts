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

export interface VisionSystemPromptOptions {
  hasPriorIssues?: boolean;
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

function buildVisionResponseSchema(options: VisionSystemPromptOptions): string {
  const { hasPriorIssues = false } = options;

  if (!hasPriorIssues) {
    return `\`\`\`json
[
  {
    "priority": 1,
    "issueId": "hero-graphic.structure",
    "category": "signature_visual",
    "ref": "hero-graphic",
    "area": "primary graphic group",
    "issue": "structure is wrong",
    "fixType": "structural_change",
    "observed": "Replica uses the wrong arrangement and relationships between parts.",
    "desired": "Original uses a different structure that changes the overall visual identity.",
    "confidence": 0.92
  }
]
\`\`\``;
  }

  const lines = ["{"] as string[];
  if (hasPriorIssues) {
    lines.push(`  "priorIssueChecks": [`);
    lines.push("    {");
    lines.push('      "issueId": "hero-graphic.structure",');
    lines.push('      "status": "still_wrong",');
    lines.push('      "note": "The same structural mismatch is still clearly visible."');
    lines.push("    }");
    lines.push("  ],");
  }
  lines.push('  "issues": [');
  lines.push("    {");
  lines.push('      "priority": 1,');
  lines.push('      "issueId": "hero-graphic.structure",');
  lines.push('      "category": "signature_visual",');
  lines.push('      "ref": "hero-graphic",');
  lines.push('      "area": "primary graphic group",');
  lines.push('      "issue": "structure is wrong",');
  lines.push('      "fixType": "structural_change",');
  lines.push('      "observed": "Replica uses the wrong arrangement and relationships between parts.",');
  lines.push('      "desired": "Original uses a different structure that changes the overall visual identity.",');
  lines.push('      "confidence": 0.92');
  lines.push("    }");
  lines.push("  ]");
  lines.push("}");

  return `\`\`\`json\n${lines.join("\n")}\n\`\`\``;
}

export function buildVisionSystemPrompt(options: VisionSystemPromptOptions = {}): string {
  const { hasPriorIssues = false } = options;
  const needsObject = hasPriorIssues;
  const optionalFieldInstructions = [
    hasPriorIssues
      ? "- Include one `priorIssueChecks` entry for each provided prior issue."
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  const priorIssueRules = hasPriorIssues
    ? `
- \`status\` in \`priorIssueChecks\` must be one of: \`resolved\`, \`still_wrong\`, \`unclear\`.
- Use \`resolved\` only when that exact prior issue now clearly matches in the CURRENT REPLICA image.
- Use \`still_wrong\` when that exact prior issue is still visibly present.
- Use \`unclear\` when the evidence is ambiguous or mixed. Do not force a binary decision when the image does not support it confidently.
- \`note\` should briefly explain the adjudication when helpful.
- If prior issues to re-check are provided, judge each one against the CURRENT REPLICA image before generating the final issue list. Use \`priorIssueChecks\` to classify each one as \`resolved\`, \`still_wrong\`, or \`unclear\`.
- Treat prior issues as hypotheses to re-check, not as truth. The CURRENT REPLICA image wins if a prior issue no longer matches.
- Do not mark an entire element as resolved because one issue on that element changed. One \`ref\` can have multiple simultaneous issue ids.
- Do not silently downgrade a prior structural signature-visual issue to a style issue unless the structure now clearly matches.`
    : "";

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

- Return ONLY a ${needsObject ? "JSON object" : "JSON array"}.
- Focus on the 3 most visually impactful differences first, but you may return up to 5 issues total.
- Use this schema exactly:
${buildVisionResponseSchema(options)}
- \`priority\` must be an integer rank starting at 1.
- \`issueId\` must identify the specific underlying issue, not just the element. Reuse the same \`issueId\` if the same issue is still visible. Examples: \`title.content\`, \`title.tricolor-direction\`, \`badge-pill.border-style\`.
${optionalFieldInstructions}
- \`category\` must be one of: \`content\`, \`signature_visual\`, \`layout\`, \`style\`.
- \`ref\` should match an extract inventory id when possible (for example a typography id, region id, or repeatGroup id). Use \`null\` when you cannot map confidently.
- \`fixType\` must be one of: \`structural_change\`, \`layout_adjustment\`, \`style_adjustment\`, \`content_fix\`.
- Use \`structural_change\` when the current encoding likely needs a local section rewrite instead of numeric nudges.
- \`area\` should name the concrete visual target or group being fixed.
- \`observed\` should describe what the REPLICA currently shows.
- \`desired\` should describe what the ORIGINAL shows.
- If semantic anchors are provided, treat \`signatureVisuals\` as top-priority identity constraints. If one is still visibly wrong, rank it above local text clipping or minor polish.
- For diagrams, decorative systems, repeating structures, and multi-part graphics: judge structure, topology, count, and attachment pattern before weight, opacity, or color.
- For ordered bands, layered graphics, repeated stripes, directional gradients, connector systems, and other directional/structural visuals: distinguish a true reversal from a visibility problem. If the structure/order is roughly present but one side dominates visually, report the residual issue as prominence, weighting, proportions, clipping, contrast, or color strength rather than claiming the direction/order is inverted.
- Only call something reversed, swapped, or structurally inverted when that conclusion is visually unambiguous in the CURRENT REPLICA image. If the evidence is mixed, use lower confidence and prefer the less destructive diagnosis.
- If multiple issue categories are visibly present, diversify the top 3 so they cover different classes when possible: \`content\`, \`signature_visual\`, and \`layout\` before second-order duplicates.
${priorIssueRules}
- **Do not chase pixel alignment.** If an element is roughly in the right place, leave it. Only fix things that are visibly wrong at a glance.
- Only the slide content inside contentBounds matters. Ignore pixels outside contentBounds — they are presentation chrome.

Return ONLY the ${needsObject ? "JSON object" : "JSON array"}.`;
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
    ? `\nPrevious issues to re-check from the prior iteration:\n\`\`\`json\n${context.priorIssuesJson}\n\`\`\`\nBefore producing the final issue list, classify each prior issue under priorIssueChecks as resolved, still_wrong, or unclear. Keep the same issueId when the same issue is still visible. Do not treat one change on a shared ref like "title" as resolving every other issue on that ref.`
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
- Each issue may include: \`priority\`, \`issueId\`, \`category\`, \`ref\`, \`area\`, \`issue\`, \`fixType\`, \`observed\`, \`desired\`, \`confidence\`, \`sticky\`.
- Treat \`sticky: true\` on a \`signature_visual\` issue as mandatory even if its priority falls below 3.
- The provided contentBounds is in the pixel space of the ORIGINAL/REPLICA images. It is only for identifying the visible slide area in those images.
- Treat image-space context and proposal-space context as separate. Do not mix them.
- Patch the proposals JSON surgically.
- Do NOT rewrite proposals from scratch.
- Do NOT restructure, rename, or reorganize proposals.
- If an issue has \`fixType: "structural_change"\`, you may replace the minimal relevant subsection of the proposal body required to fix it.
- Treat the structured issue list as a diagnosis, not a literal patch recipe.
- For high-reversal edits such as swapping direction/order, flipping layers, changing topology, or undoing an earlier structural fix: first verify that the current proposal does NOT already encode the desired structure. If it already does, do not blindly reverse it again.
- When the proposal already encodes the requested structure but the replica still looks wrong, prefer lower-level fixes like proportions, clip bounds, band heights, opacity, contrast, color strength, spacing, or scale before applying another structural reversal.
- Only apply a structural reversal when the image evidence is unambiguous and the proposal does not already match the intended direction/order.
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
