/**
 * Prompts for the extract/analyze API route.
 *
 * reference.md is injected at build time via SCENE_REFERENCE_CONTENT.
 * The model has NO tool access (allowedTools: []) — it cannot read files.
 */

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

export const ANALYSIS_SYSTEM_PROMPT = `You extract reusable scene templates from slide screenshots. Output JSON only.

## Scene Authoring Reference

The following is the complete scene YAML syntax reference. Follow it exactly.

<reference>
${SCENE_REFERENCE_CONTENT}
</reference>

## Speed and decisiveness

Work fast. Pick dimensions, positions, and colors on first impression and commit. Do NOT recalculate measurements, debate between similar hex values, or revisit layout decisions. Approximate values are fine — the compiler scales everything.

Specifically:
- Choose one perceived image size immediately. Do NOT refine it. Small dimensional error is acceptable if internal geometry is self-consistent.
- Obvious presentation UI chrome (nav dots, counters, export buttons, control bars) is NOT slide content. Use the full image as \`source.dimensions\` and simply ignore chrome in the inventory and proposals.
- Do NOT debate template-authoring mechanics (loops vs explicit nodes, row layout vs manual positioning, border layering, z-order, quoting, preset organization). Pick the simplest valid encoding that preserves appearance and move on.
- Do NOT reverse-engineer viewport scaling, device pixel ratios, CSS layout, or rendering pipeline internals. The system normalizes coordinates automatically.
- For background gradients and atmospheric effects, use visually faithful approximations. Do NOT reconstruct exact canvas-vs-viewport coordinate mappings.

## Produce two outputs in order

First produce an \`inventory\` that captures visual perception.
Then produce \`proposals\` using the inventory as your source of truth.

The inventory is a compact verification/debug contract, not a second scene tree.
Do NOT skip the inventory.
Do NOT write proposals first.

If you discover a contradiction while writing proposals, update the inventory explicitly before continuing.

## Output format

\`\`\`json
{
  "source": {
    "image": "<filename>",
    "dimensions": { "w": <number>, "h": <number> }
  },
  "inventory": {
    "slideBounds": { "x": <number>, "y": <number>, "w": <number>, "h": <number> },
    "background": {
      "summary": "<short description>",
      "base": "<hex color>",
      "palette": ["<color>", "..."],
      "layers": [
        {
          "kind": "<string>",
          "bbox": { "x": <number>, "y": <number>, "w": <number>, "h": <number> },
          "description": "<short description>",
          "importance": "high" | "medium" | "low"
        }
      ]
    },
    "typography": [
      {
        "id": "<string>",
        "text": "<string>",
        "bbox": { "x": <number>, "y": <number>, "w": <number>, "h": <number> },
        "importance": "high" | "medium" | "low",
        "style": {
          "color": "<hex color>",
          "fontSize": <number>,
          "fontWeight": <number>,
          "textAlign": "left" | "center" | "right",
          "textTransform": "uppercase" | "lowercase" | "none",
          "letterSpacing": <number>,
          "fontFamilyHint": "heading" | "body" | "mono" | "<string>",
          "fontStyle": "normal" | "italic",
          "lineHeight": <number>
        }
      }
    ],
    "regions": [
      {
        "id": "<string>",
        "kind": "<string>",
        "bbox": { "x": <number>, "y": <number>, "w": <number>, "h": <number> },
        "importance": "high" | "medium" | "low",
        "description": "<short description>"
      }
    ],
    "repeatGroups": [
      {
        "id": "<string>",
        "bbox": { "x": <number>, "y": <number>, "w": <number>, "h": <number> },
        "count": <number>,
        "orientation": "row" | "column" | "grid",
        "itemSize": { "w": <number>, "h": <number> },
        "gap": <number>,
        "gapX": <number>,
        "gapY": <number>,
        "description": "<short description>",
        "variationPoints": ["<string>", "..."]
      }
    ],
    "signatureVisuals": [
      {
        "text": "<string>",
        "ref": "<inventory id or null>",
        "importance": "high" | "medium"
      }
    ],
    "mustPreserve": [
      { "text": "<string>", "ref": "<inventory id or null>" }
    ],
    "uncertainties": ["<string>", "..."],
    "blockCandidates": [
      {
        "name": "<kebab-case-name>",
        "sourceRepeatGroupId": "<repeat group id>",
        "reason": "<short description>",
        "defer": true
      }
    ]
  },
  "proposals": [
    {
      "scope": "slide",
      "name": "<kebab-case-name>",
      "description": "<one line>",
      "region": { "x": <number>, "y": <number>, "w": <number>, "h": <number> },
      "params": {
        "<name>": { "type": "string"|"number"|"array", "value": <extracted value> }
      },
      "style": {
        "<name>": { "type": "string"|"number", "value": <extracted value> }
      },
      "body": "<scene YAML template body>"
    }
  ]
}
\`\`\`

## How to write the body

The body is scene YAML — no header (no name/scope/params/style). The system injects \`mode: scene\` for slides, so do NOT include it.

Slide bodies include: sourceSize, background, guides, presets, children.

Use Nunjucks: \`{{ param | yaml_string }}\` for strings, \`{{ style.name }}\` for style values, \`{% for item in items %}\` for arrays. Include \`{{ loop.index0 }}\` in ids inside loops. In nested loops, capture the outer index first with \`{% set outerIdx = loop.index0 %}\` and use that inside the inner loop; do not use \`loop.parent\`. Do NOT use {% import %}, {% include %}, or {% from %}.

## Inventory requirements

The inventory must contain:
- \`slideBounds\` — always set to \`{ x: 0, y: 0, w: <source.dimensions.w>, h: <source.dimensions.h> }\`. Do not try to crop or exclude UI chrome from slideBounds.
- \`background\`
- \`typography\`
- \`regions\`
- \`repeatGroups\`
- \`signatureVisuals\`
- \`mustPreserve\`
- \`uncertainties\`
- \`blockCandidates\`

Inventory goals:
- capture visually salient structure, not every tiny detail
- record key geometry in source-pixel coordinates
- preserve the details most likely to be dropped during YAML encoding

Keep the inventory lean:
- \`typography\`: only distinct text style patterns (e.g., one entry for "card title" style, not one per card). Use \`repeatGroups\` to describe repeated content. Maximum 5 entries.
- \`regions\`: major groups only, not individual elements within groups. Maximum 5 entries.
- \`repeatGroups\`: enough to capture repeated structure. Maximum 3 entries.
- \`signatureVisuals\`: maximum 3 items.
- \`mustPreserve\`: maximum 5 items.
- \`uncertainties\`: maximum 3 items. Only note genuinely uncertain visual details, not implementation mechanics.

\`signatureVisuals\` rules:
- 1-3 items, non-text visual effects only.
- Use only \`importance: "high"\` or \`importance: "medium"\` for signatureVisuals. Do not use \`low\`.
- At least 1 must come from background/atmosphere when the background is visually distinctive (gradients, glows, particles, textures).
- At least 1 must come from dominant title/hero treatment when the title has a strong visual effect (color bands, shadows, emboss, clip effects).
- If an uncertainty touches a signatureVisual, it must be resolved before encoding when possible.

\`mustPreserve\` is for content that varies between slides: text values, data items, and element presence/absence.
\`signatureVisuals\` is for the visual identity that makes this slide look like itself: the things a human would notice first and that are hardest to get right in replication.

## Proposal requirements

1. Report source.dimensions as what you visually perceive. Do NOT round to standard resolutions.
2. Use source.dimensions as sourceSize in the slide template body. All coordinates — source.dimensions, inventory bboxes, proposal.region, guides, and all frame values in the body — must be in the same source-pixel coordinate space.
3. Do NOT include fit or align in template bodies — those go on the slide instance.
4. Always output exactly one slide-scope proposal for the whole slide.
5. Do NOT output block-scope proposals in v1. Put repeating structures in \`inventory.blockCandidates\` only.
6. For repeating elements (card rows, stat grids, list items), use a \`{% for %}\` loop over an items array when there are 3+ items with identical structure. This is faster and produces the same output. For 1-2 items, write explicit nodes. Do NOT create separate block-scope templates — keep loops inline in the slide body.
7. Every item in \`inventory.signatureVisuals\` and \`inventory.mustPreserve\` must be faithfully represented in the proposal body.
8. Match colors, font sizes, and font weights closely. Use explicit hex colors.
9. Use emoji characters directly (e.g. "💀") instead of image paths for icons that are emojis.
10. If a target slug is provided, append it to template names (e.g. \`proxy-card-mydeck\`) to avoid collisions.

## Common mistakes to avoid

These are errors models frequently make. Follow reference.md's Pitfalls section, and additionally:

- Text nodes and shape nodes MUST have a \`style:\` object — never put fontFamily, fill, etc. directly on the node.
- Presets MUST nest properties under \`style:\` — \`presets: { heading: { style: { ... } } }\`, not \`presets: { heading: { fontFamily: ... } }\`.
- Background with Nunjucks MUST use the object form: \`background: { type: solid, color: "{{ style.bgColor }}" }\`.
- Grid layouts: always set \`rowHeight\` when children have known heights — without it, cells expand to fill the container.
- Gradient stop \`position\` is 0–1 (NOT 0–100). Use \`position: 0\` and \`position: 1\`, not \`position: 100\`.
- Do not flatten rich visuals into plain shapes with solid fills. Use the full Visual Features section in reference.md: gradients, shadows, opacity, borders, rounded corners, mixed inline text styles (TextRun[] or markdown bold/italic), shape variety (circle, pill, arrow, triangle — not just rect), effects (glow, softEdge), transforms (rotation). If the source has it, reproduce it.
- For gradient/radial backgrounds: the \`background\` string form accepts any CSS background value, e.g. \`background: "radial-gradient(at 50% 50%, rgba(255,140,0,0.15) 0%, transparent 50%), #080808"\`. Use this when the source has non-uniform backgrounds.
- Stack/row layouts inside bounded containers: give each child an explicit \`frame.h\` (or use a suitable gap + container height that fits all items). Without explicit child heights, items may overflow or get clipped. Calculate: container_h should be >= (item_h * count) + (gap * (count - 1)).
- Text frame widths: use generous widths to avoid clipping. For centered titles/headings that appear single-line in the source, use generous widths, often 80%+ of the slide width. If the source heading is intentionally multiline, preserve the observed wrap instead of forcing one line. The renderer's heading font may be wider than you estimate — err on the side of slightly too wide rather than too narrow for single-line headings.`;

export function buildAnalysisPrompt(
  text: string | null,
  slug: string | null,
): string {
  let prompt = `Analyze this screenshot and produce inventory-first reusable scene templates. The scene YAML reference is already in your system prompt — do not attempt to read any files.`;
  prompt += `\n\nFor source.dimensions: estimate the image size on first look. Do not round to standard resolutions. Stay self-consistent — do not refine dimensions after your initial estimate.`;
  if (text) prompt += `\n\nAdditional context: ${text}`;
  if (slug) prompt += `\n\nTarget slug: ${slug}`;
  return prompt;
}

export const CRITIQUE_ADDENDUM = `

## Critique Mode — SURGICAL PATCH ONLY

You are reviewing a first-pass analysis. Your job is to find and fix only clear errors, not to redo the analysis.

Rules:
- Do NOT re-describe the slide, re-measure the layout, or re-argue dimensions.
- Preserve pass-1 geometry, colors, and structure unless a clear visual error is present.
- Do NOT validate template mechanics, track math, row-vs-manual layout choices, quoting, or YAML authoring style unless they create a visible mismatch in the rendered slide.
- Ignore geometry differences under ~10px and close hex-shade differences unless they change a signature visual.
- Never touch \`source.dimensions\` unless the first-pass value is obviously impossible for the screenshot.
- If no clear high-impact mismatch is visible on first inspection, stop and return the input JSON unchanged.
- If you find fewer than 3 issues, make only those edits. If no issues, return the JSON unchanged.
- Do NOT rewrite the proposal from scratch. Patch only the specific values that are wrong.

What to check (briefly):
1. Are \`signatureVisuals\` faithfully encoded? Any dominant visual feature obviously missing or wrong?
2. Any uncertainty that affects a high-importance element and can now be clearly resolved?
3. Any obvious content error (wrong text, missing element)?

## Output

Output the complete revised JSON. Change only what needs fixing — keep everything else identical to the input.

\`\`\`json
{
  "source": { ... },
  "inventory": { ... },
  "proposals": [ ... ]
}
\`\`\`

If no changes are needed, output the input JSON unchanged.`;

export function buildCritiquePrompt(passOneResult: string): string {
  return `Here is the first-pass analysis of this screenshot. Review it against the original image and fix only clear high-impact perception errors or missing visual signatures. If no such issue is obvious on first inspection, output the input JSON unchanged.

First-pass analysis:
\`\`\`json
${passOneResult}
\`\`\``;
}
