/**
 * Prompts for the extract/analyze API route.
 */

export const ANALYSIS_SYSTEM_PROMPT = `You extract reusable scene templates from slide screenshots. Output JSON only.

## Step 1: Read the reference

Read .claude/skills/replicate-slides/reference.md for the complete scene YAML syntax, node types, pitfalls, and examples. Follow it exactly — it is the authoritative source.

## Step 2: Produce two outputs in order

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

Use Nunjucks: \`{{ param | yaml_string }}\` for strings, \`{{ style.name }}\` for style values, \`{% for item in items %}\` for arrays. Include \`{{ loop.index0 }}\` in ids inside loops. Do NOT use {% import %}, {% include %}, or {% from %}.

## Inventory requirements

The inventory must contain:
- \`slideBounds\`
- \`background\`
- \`typography\`
- \`regions\`
- \`repeatGroups\`
- \`mustPreserve\`
- \`uncertainties\`
- \`blockCandidates\`

Inventory goals:
- capture visually salient structure, not every tiny detail
- record key geometry in source-pixel coordinates
- preserve the details most likely to be dropped during YAML encoding

Do not turn the inventory into a full scene tree.
Do not enumerate every decorative particle unless it materially affects the look.
Prefer concise group descriptions over exhaustive node lists.

## Proposal requirements

1. Report source.dimensions as what you visually perceive. Do NOT round to standard resolutions.
2. Use source.dimensions as sourceSize in the slide template body. All coordinates — source.dimensions, inventory bboxes, proposal.region, guides, and all frame values in the body — must be in the same source-pixel coordinate space.
3. Do NOT include fit or align in template bodies — those go on the slide instance.
4. Always output exactly one slide-scope proposal for the whole slide.
5. Do NOT output block-scope proposals in v1. Put repeating structures in \`inventory.blockCandidates\` only.
6. Write repeated elements as literal explicit nodes. First-pass extraction optimizes for replication fidelity, not reusable compactness. A 4-card hero row should be 4 explicit card groups, not a loop over an items array. Only use a \`{% for %}\` loop in exceptional cases where repetition is very dense (8+ identical items) and literal nodes would clearly harm readability without any fidelity benefit.
7. Every item in \`inventory.mustPreserve\` must be represented in the proposal body.
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
- Stack/row layouts inside bounded containers: give each child an explicit \`frame.h\` (or use a suitable gap + container height that fits all items). Without explicit child heights, items may overflow or get clipped. Calculate: container_h should be >= (item_h * count) + (gap * (count - 1)).`;

export function buildAnalysisPrompt(
  text: string | null,
  slug: string | null,
): string {
  let prompt = `Analyze this screenshot and produce inventory-first reusable scene templates. Read .claude/skills/replicate-slides/reference.md first for the correct scene YAML syntax.`;
  prompt += `\n\nCRITICAL for source.dimensions: Report the pixel dimensions as you visually perceive the image. Do NOT round to standard resolutions (not 1366x768, not 1920x1080). Your coordinates and region boxes must be consistent with the dimensions you report.`;
  if (text) prompt += `\n\nAdditional context: ${text}`;
  if (slug) prompt += `\n\nTarget slug: ${slug}`;
  return prompt;
}
