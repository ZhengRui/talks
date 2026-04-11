import { readFileSync } from "fs";
import { join } from "path";
import type {
  GeometryHints,
  Inventory,
  InventoryRegion,
  InventoryRepeatGroup,
  SignatureVisual,
} from "@/components/extract/types";

export interface VisionSemanticAnchors {
  signatureVisuals?: SignatureVisual[];
  mustPreserve?: Inventory["mustPreserve"];
  repeatGroups?: Array<Pick<InventoryRepeatGroup, "id" | "description" | "count" | "orientation" | "itemSize" | "gap" | "gapX" | "gapY" | "variationPoints">>;
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
  watchlistIssuesJson?: string | null;
}

export interface EditPromptContext {
  imageSize?: { w: number; h: number };
  proposalSpace?: { w: number; h: number } | null;
  fidelityIssuesJson: string;
  designQualityIssuesJson: string;
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

function buildVisionResponseSchema(): string {
  return `\`\`\`json
{
  "fidelityIssues": [
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
      "confidence": 0.92,
      "salience": "critical",
      "salienceReason": "A designer would notice this immediately because it changes the slide's dominant visual identity."
    }
  ],
  "designQualityIssues": [
    {
      "priority": 1,
      "issueId": "icon-badges.optical-centering",
      "category": "style",
      "ref": "icon-badges",
      "area": "badge and symbol balance",
      "issue": "icons are not optically centered inside the circular badges",
      "fixType": "style_adjustment",
      "observed": "Replica icons sit awkwardly within the badges and the row feels visually inconsistent.",
      "desired": "Original badges feel balanced and the icons sit calmly with even negative space around them.",
      "confidence": 0.88,
      "salience": "important",
      "salienceReason": "A designer would notice the repeated motif feels sloppy even before close screenshot comparison."
    }
  ]
}
\`\`\``;
}

export function buildVisionSystemPrompt(): string {
  return `You are visually comparing a slide replica against the original screenshot.

You will receive two images, each labeled:
- ORIGINAL: the unchanging reference screenshot. This is the ground truth — what the slide should look like.
- REPLICA: the current rendered version we are trying to improve. This is what needs fixing.

## How to analyze

Look at the ORIGINAL carefully — this is the target. Then look at the REPLICA — this is what we built. Describe what the REPLICA does wrong compared to the ORIGINAL. Do not rush, do not skip areas. Scan top-to-bottom, left-to-right.

Judge on two axes at once:
- Fidelity: how the REPLICA differs from the ORIGINAL
- Design quality: whether the REPLICA looks visually awkward, sloppy, unbalanced, inconsistent, or amateurish even before pixel-level comparison

Common things people miss:
- Decorative elements: wrong number of lines, wrong line pattern, wrong visual weight
- Text too small or too large relative to its container
- Fills that should extend beyond borders (or vice versa)
- Elements not centered when they should be
- Wrong font weight, wrong text alignment, wrong colors
- Icon systems that are inconsistent, optically off-center, or visually clumsy

Only these are unfixable (ignore them entirely):
- Exact icon stroke/rendering style differences when the icon identity and placement already match
- Font rendering engine differences
- Image compression artifacts

Everything else is fixable. "Hard to implement" is not unfixable.

## Rules

- Return ONLY a JSON object.
- Use this schema exactly:
${buildVisionResponseSchema()}
- The object must contain:
  - \`fidelityIssues\`: up to 5 issues
  - \`designQualityIssues\`: up to 3 issues
- \`fidelityIssues\` are for screenshot mismatch, structure, content correctness, layout correctness, and obvious replication misses.
- \`designQualityIssues\` are for visual ugliness or sloppiness even if screenshot mismatch is not the largest problem: icon consistency, optical centering, symbol appropriateness, badge balance, awkward typography, visual heaviness, per-item inconsistency, or anything else a competent designer would immediately fix.
- Do not duplicate the same \`issueId\` in both buckets.
- When obvious design-quality defects exist, \`designQualityIssues\` must not be empty.
- \`priority\` must be an integer rank starting at 1 within each bucket.
- \`issueId\` must identify the specific underlying issue, not just the element. Reuse the same \`issueId\` if the same issue is still visible. Examples: \`title.content\`, \`title.tricolor-direction\`, \`badge-pill.border-style\`.
- \`category\` must be one of: \`content\`, \`signature_visual\`, \`layout\`, \`style\`.
- \`ref\` should match an extract inventory id when possible (for example a typography id, region id, or repeatGroup id). Use \`null\` when you cannot map confidently.
- \`fixType\` must be one of: \`structural_change\`, \`layout_adjustment\`, \`style_adjustment\`, \`content_fix\`.
- Use \`structural_change\` when the current encoding likely needs a local section rewrite instead of numeric nudges.
- \`area\` should name the concrete visual target or group being fixed.
- \`observed\` should describe what the REPLICA currently shows.
- \`desired\` should describe what the ORIGINAL shows.
- \`salience\` must be one of: \`critical\`, \`important\`, \`polish\`.
- You own \`salience\`. Judge it from a designer's perspective based on how wrong the CURRENT REPLICA looks right now, not from the abstract issue category alone.
- The same kind of issue can change salience across iterations. Example: oversized text is \`critical\` when it clips or crowds the card, but only \`polish\` when it already fits and just feels a bit heavy.
- \`critical\`: immediately visible, harms readability, structure, or slide identity, or makes the slide feel obviously wrong at a glance.
- \`important\`: clearly noticeable and worth fixing in this pass, but not blocking readability or identity.
- \`polish\`: secondary tuning that should wait until higher-salience issues are fixed.
- \`salienceReason\` should briefly explain why a designer would notice this issue at that salience level.
- Do not behave like a pure diff engine. If the REPLICA contains an obviously awkward local design flaw that a competent designer would immediately fix, report it even when larger structural mismatches still exist.
- If semantic anchors are provided, treat \`signatureVisuals\` as top-priority identity constraints. If one is still visibly wrong, rank it high in \`fidelityIssues\`.
- If repeatGroups are provided, compare one representative repeated item as a complete component before judging local text or icon polish.
- For repeated motifs, explicitly audit local visual quality: optical centering, icon balance inside badges, symbol appropriateness, per-item consistency, and whether the component looks clean and intentional as a standalone design.
- When obvious design-quality flaws exist inside the main repeated motif, use the \`designQualityIssues\` bucket for them instead of spending every slot on macro topology.
- For repeated structures, explicitly check topology and attachment: whether subparts touch, overlap, interlock, or form one continuous composite component versus disconnected boxes.
- When the ORIGINAL reads as one composite component but the REPLICA splits it into detached subparts, report that as a structural/signature-visual fidelity issue above typography tweaks.
- For diagrams, decorative systems, repeating structures, and multi-part graphics: judge structure, topology, count, and attachment pattern before weight, opacity, or color.
- For ordered bands, layered graphics, repeated stripes, directional gradients, connector systems, and other directional/structural visuals: distinguish a true reversal from a visibility problem. If the structure/order is roughly present but one side dominates visually, report the residual issue as prominence, weighting, proportions, clipping, contrast, or color strength rather than claiming the direction/order is inverted.
- Only call something reversed, swapped, or structurally inverted when that conclusion is visually unambiguous in the CURRENT REPLICA image. If the evidence is mixed, use lower confidence and prefer the less destructive diagnosis.
- Do not chase pixel alignment. If an element is roughly in the right place, leave it. Only fix things that are visibly wrong at a glance.
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
  const repeatGroupsSection = context.semanticAnchors?.repeatGroups?.length
    ? `\nRepeated structure anchors from extract:\n${context.semanticAnchors.repeatGroups
      .map((group) => {
        const size = group.itemSize ? `, itemSize: ${group.itemSize.w}x${group.itemSize.h}` : "";
        const gap = group.gap != null
          ? `, gap: ${group.gap}`
          : group.gapX != null || group.gapY != null
            ? `, gapX: ${group.gapX ?? "?"}, gapY: ${group.gapY ?? "?"}`
            : "";
        const variations = group.variationPoints?.length
          ? `, varies by: ${group.variationPoints.join(", ")}`
          : "";
        return `- ${group.id}: ${group.description} (count: ${group.count}, orientation: ${group.orientation}${size}${gap}${variations})`;
      })
      .join("\n")}`
    : "";
  const regionsSection = context.semanticAnchors?.regions?.length
    ? `\nImportant extracted regions:\n${context.semanticAnchors.regions
      .map((region) => `- [${region.importance}] ${region.id} (${region.kind}): ${region.description}`)
      .join("\n")}`
    : "";
  const watchlistSection = context.watchlistIssuesJson
    ? `\nTiny watchlist from the last iteration (use only as lightweight context, not as a checklist):\n\`\`\`json\n${context.watchlistIssuesJson}\n\`\`\`\nIf one of these issues is still clearly visible and still important, reuse the same issueId in the same bucket. If it no longer matters, drop it without explanation.`
    : "";

  return `Image size: ${context.imageSize.w}x${context.imageSize.h}
Visible slide area (contentBounds): ${contentBounds}
${boundsMode}
${signatureVisualsSection}${mustPreserveSection}${repeatGroupsSection}${regionsSection}${watchlistSection}

Compare the ORIGINAL against the REPLICA and return a JSON object with fidelityIssues and designQualityIssues.`;
}

export function buildEditSystemPrompt(): string {
  return `You are patching slide proposals to reduce visible mismatch while also improving standalone visual quality.

You will receive:
- Two images, each labeled:
  - ORIGINAL: the unchanging reference screenshot. This is the ground truth.
  - REPLICA: the current rendered version we are trying to improve.
- A fidelity issue bucket produced by a visual comparison step
- A design-quality issue bucket produced by the same visual comparison step
- The current proposals JSON
- contentBounds for the actual slide area

## Scene Authoring Reference

The following is the complete scene YAML syntax reference. The template body in each proposal follows this syntax exactly.

<reference>
${SCENE_REFERENCE_CONTENT}
</reference>

## Rules

- Fix the highest-salience fidelity issues first.
- Always resolve critical fidelity issues.
- When the designQualityIssues bucket is non-empty, also address at least one design-quality issue in the same pass when possible.
- Do not let fidelity consume the entire pass if the result still looks visually sloppy, awkward, or amateurish.
- Use the ORIGINAL and REPLICA images as the source of truth when deciding what to patch.
- Use the issue buckets as guidance, but if they are incomplete or slightly wrong, resolve against the images.
- Each issue may include: \`priority\`, \`issueId\`, \`category\`, \`ref\`, \`area\`, \`issue\`, \`fixType\`, \`observed\`, \`desired\`, \`confidence\`, \`salience\`, \`salienceReason\`, \`persistenceCount\`.
- Treat \`salience: "critical"\` as mandatory. Do not let lower-salience polish work displace a critical unresolved issue.
- When an issue has \`persistenceCount >= 2\`, treat another tiny nudge as failure.
- For persistent critical \`layout\` or \`signature_visual\` issues, make a materially stronger change to the governing geometry, proportions, spacing, or subsection structure instead of another micro-adjustment.
- Do not return effectively unchanged values for a persistent issue unless the proposal already clearly matches the requested structure and the diagnosis is wrong.
- The provided contentBounds is in the pixel space of the ORIGINAL/REPLICA images. It is only for identifying the visible slide area in those images.
- Treat image-space context and proposal-space context as separate. Do not mix them.
- For noncritical issues, patch the proposals JSON surgically.
- Do NOT rewrite proposals from scratch.
- Do NOT restructure, rename, or reorganize the whole proposal.
- If a persistent critical issue has \`fixType: "structural_change"\`, you may replace the relevant local component, repeated structure block, or minimal proposal subsection required to fix it.
- Treat the issue buckets as a diagnosis, not a literal patch recipe.
- For high-reversal edits such as swapping direction/order, flipping layers, changing topology, or undoing an earlier structural fix: first verify that the current proposal does NOT already encode the desired structure. If it already does, do not blindly reverse it again.
- When the proposal already encodes the requested structure but the replica still looks wrong, prefer lower-level fixes like proportions, clip bounds, band heights, opacity, contrast, color strength, spacing, or scale before applying another structural reversal.
- Only apply a structural reversal when the image evidence is unambiguous and the proposal does not already match the intended direction/order.
- Do NOT invent a new coordinate system, hidden scaling factor, or alternate slide bounds.
- The proposals may be authored in a different internal coordinate space than the images. Preserve that proposal-space coordinate system unless a visual fix truly requires changing proposal geometry.
- If geometry ground truth is provided in the user prompt, treat those rectangles as exact and patch toward them instead of re-guessing layout.
- The template body uses Nunjucks. Do NOT use filters like \`| min\`, \`| max\`, \`| abs\`, \`| round\` — they are not available. Use pre-computed numeric values instead.
- For any interpolated text field, always use quoted Nunjucks with \`| yaml_string\`, for example \`text: "{{ item.body | yaml_string }}"\`.
- Never use YAML block scalars like \`text: |-\` or \`text: |\` with a Nunjucks interpolation line under them. That becomes invalid YAML when the value contains real newlines.
- If the issue buckets are weak or unhelpful, keep the proposals unchanged.
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

Fidelity issues:
\`\`\`json
${context.fidelityIssuesJson}
\`\`\`

Design quality issues:
\`\`\`json
${context.designQualityIssuesJson}
\`\`\`

Current proposals:
\`\`\`json
${context.proposalsJson}
\`\`\`

Fix the listed issues. Return the full proposals JSON array.`;
}
