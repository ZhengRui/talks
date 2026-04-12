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
  iterationHistory?: string | null;
  priorChecklist?: string | null;
}

export interface IterationRecord {
  iteration: number;
  issuesFound: Array<{ issueId: string; category: string; summary: string }>;
  issuesEdited: string[];
  editApplied: boolean;
  issuesResolved: string[];
  issuesUnresolved: string[];
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
- ORIGINAL: the unchanging reference screenshot. This is the ground truth.
- REPLICA: the current rendered version we are trying to improve.

## How to analyze

Look at the ORIGINAL carefully — this is the target. Then look at the REPLICA —
this is what we built. Describe what the REPLICA does wrong compared to the
ORIGINAL. Do not rush, do not skip areas. Scan top-to-bottom, left-to-right.

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

## How to use iteration history

If iteration history is provided, use it as lightweight context:
- If an issue was edited in the prior iteration and the result is close enough
  that a designer would sign off and move on, treat it as resolved. Do not
  re-raise minor residual imperfections from a recently-fixed issue.
- Be self-consistent: do not mark an issue resolved and also raise it
  in the issues array.
- Issues resolved in older iterations should stay resolved. Only re-raise
  a previously resolved issue if there is an obvious regression — a prior
  fix visibly undone by a later edit. Do not hunt for old problems.
- If an issue has been edited multiple times without being resolved, describe
  the problem more precisely or suggest a different approach rather than
  repeating the same generic wording.
- Focus your attention on genuinely unresolved issues and new problems visible
  in the CURRENT REPLICA.

## How to evaluate prior issues

If a checklist of prior issues is provided, you must account for each one:
- If the issue is fixed in the CURRENT REPLICA (applying designer tolerance —
  close enough counts), include its issueId in the \`resolved\` array.
- If the issue is still visible, re-raise it in the \`issues\` array with the
  same issueId. You may update the description if the nature of the problem
  has changed.
- Do not skip any prior issue. Every prior issueId must appear in either
  \`resolved\` or \`issues\`.

## Rules

- Return ONLY a JSON object with \`resolved\` and \`issues\` fields.
- \`resolved\` is an array of issueIds from the prior issues checklist that are
  now fixed. Empty array \`[]\` when there are no prior issues or none are fixed.
- \`issues\` is a JSON array of current issues (re-raised priors + new issues).
- Focus on the most visually impactful differences first.
- Use this schema exactly:

\`\`\`json
{
  "resolved": ["title.scale", "card-row.position"],
  "issues": [
    {
      "priority": 1,
      "issueId": "hero-graphic.structure",
      "category": "signature_visual",
      "ref": "hero-graphic",
      "area": "primary graphic group",
      "issue": "structure is wrong",
      "fixType": "structural_change",
      "observed": "Replica uses the wrong arrangement.",
      "desired": "Original uses a different structure.",
      "confidence": 0.92
    }
  ]
}
\`\`\`

- \`priority\` must be an integer rank starting at 1.
- \`issueId\` must identify the specific underlying issue, not just the element.
  Reuse the same \`issueId\` if the same issue is still visible.
- \`category\` must be one of: \`content\`, \`signature_visual\`, \`layout\`, \`style\`.
- \`ref\` should match an extract inventory id when possible. Use \`null\` otherwise.
- \`fixType\` must be one of: \`structural_change\`, \`layout_adjustment\`,
  \`style_adjustment\`, \`content_fix\`.
- \`observed\` should describe what the REPLICA currently shows.
- \`desired\` should describe what the ORIGINAL shows.
- If semantic anchors are provided, treat \`signatureVisuals\` as top-priority
  identity constraints. If one is still visibly wrong, rank it above local
  text clipping or minor polish.
- For diagrams, decorative systems, repeating structures, and multi-part graphics:
  judge structure, topology, count, and attachment pattern before weight,
  opacity, or color.
- For ordered bands, layered graphics, repeated stripes, directional gradients,
  connector systems, and other directional/structural visuals: distinguish a true
  reversal from a visibility problem.
- Only call something reversed or structurally inverted when that conclusion is
  visually unambiguous. If evidence is mixed, use lower confidence and prefer
  the less destructive diagnosis.
- **Do not chase pixel alignment.** Only fix things visibly wrong at a glance.
- Only the slide content inside contentBounds matters. Ignore presentation chrome.

Return ONLY the JSON object.`;
}

export function formatIterationHistory(records: IterationRecord[]): string {
  if (records.length === 0) return "";
  const lines = records.map((r) => {
    // Vision-empty iteration: no issues found, no edit attempted
    if (r.issuesFound.length === 0) {
      return `- Iter ${r.iteration}: no issues found`;
    }
    const found = r.issuesFound
      .map((i) => `${i.issueId} (${i.category})`)
      .join(", ");
    const allEdited =
      r.issuesEdited.length > 0 &&
      r.issuesFound.every((i) => r.issuesEdited.includes(i.issueId));
    const editedPart = allEdited
      ? "all"
      : r.issuesEdited.join(", ");
    const editSuffix = !r.editApplied ? " (edit failed)" : "";
    let line = `- Iter ${r.iteration}: found ${found}\n        ; edited ${editedPart}${editSuffix}`;
    if (r.issuesResolved.length > 0) {
      line += `\n        → resolved: ${r.issuesResolved.join(", ")}`;
    }
    if (r.issuesUnresolved.length > 0) {
      line += `\n        → unresolved: ${r.issuesUnresolved.join(", ")}`;
    }
    return line;
  });
  return `\nIteration history:\n${lines.join("\n")}`;
}

export function formatPriorIssuesChecklist(
  issues: Array<{ issueId: string; category: string; issue: string }>,
): string {
  if (issues.length === 0) return "";
  const lines = issues.map(
    (i) => `- ${i.issueId} (${i.category}): ${i.issue}`,
  );
  return `\nIssues from the previous iteration to evaluate:\n${lines.join("\n")}`;
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
  const iterationHistorySection = context.iterationHistory ?? "";
  const priorChecklistSection = context.priorChecklist ?? "";

  return `Image size: ${context.imageSize.w}x${context.imageSize.h}
Visible slide area (contentBounds): ${contentBounds}
${boundsMode}
${signatureVisualsSection}${mustPreserveSection}${regionsSection}${iterationHistorySection}${priorChecklistSection}

Compare the ORIGINAL against the REPLICA. Evaluate any prior issues, then list every visible difference.`;
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

- Fix the listed issues, prioritizing by priority rank.
- Use the ORIGINAL and REPLICA images as the source of truth when deciding what to patch.
- Use the structured issue list as guidance, but if it is incomplete or slightly wrong, resolve against the images.
- Each issue may include: \`priority\`, \`issueId\`, \`category\`, \`ref\`, \`area\`, \`issue\`, \`fixType\`, \`observed\`, \`desired\`, \`confidence\`.
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
