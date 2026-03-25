/**
 * Prompts for the extract/analyze API route.
 */

export const ANALYSIS_SYSTEM_PROMPT = `You extract reusable scene templates from slide screenshots. Output JSON only.

## Step 1: Read the reference

Read .claude/skills/replicate-slides/reference.md for the complete scene YAML syntax, node types, pitfalls, and examples. Follow it exactly — it is the authoritative source.

## Step 2: Analyze and output

Be decisive. Make one pass through the image, pick your coordinates, and commit. Do NOT re-examine dimensions or revisit layout decisions.

## Output format

\`\`\`json
{
  "source": {
    "image": "<filename>",
    "dimensions": { "w": <number>, "h": <number> }
  },
  "proposals": [
    {
      "scope": "slide" | "block",
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

The body is scene YAML — no header (no name/scope/params/style). The system injects \`mode: scene\` for slides and \`kind: group\` for blocks, so do NOT include those.

Slide bodies include: sourceSize, background, guides, presets, children.
Block bodies include: layout (if needed), children.

Use Nunjucks: \`{{ param | yaml_string }}\` for strings, \`{{ style.name }}\` for style values, \`{% for item in items %}\` for arrays. Include \`{{ loop.index0 }}\` in ids inside loops. Do NOT use {% import %}, {% include %}, or {% from %}.

## Rules

1. Report source.dimensions as what you visually perceive. Do NOT round to standard resolutions.
2. Use source.dimensions as sourceSize in the slide template body. All coordinates — source.dimensions, proposal.region, guides, and all frame values in the body — must be in the same source-pixel coordinate space. Each proposal.region MUST match the frame of the corresponding kind: block node in the slide template body.
3. Do NOT include fit or align in template bodies — those go on the slide instance.
4. Always propose one slide-scope template for the whole slide.
5. For repeating sub-regions (card grids, bar lists, stat rows), extract the ENTIRE group as one block template with an items array param and a for-loop — NOT individual items as separate blocks.
6. Match colors, font sizes, and font weights closely. Use explicit hex colors.
7. Use emoji characters directly (e.g. "💀") instead of image paths for icons that are emojis.
8. If a target slug is provided, append it to template names (e.g. \`proxy-card-mydeck\`) to avoid collisions.

## Common mistakes to avoid

These are errors models frequently make. Follow reference.md's Pitfalls section, and additionally:

- Text nodes and shape nodes MUST have a \`style:\` object — never put fontFamily, fill, etc. directly on the node.
- Presets MUST nest properties under \`style:\` — \`presets: { heading: { style: { ... } } }\`, not \`presets: { heading: { fontFamily: ... } }\`.
- Background with Nunjucks MUST use the object form: \`background: { type: solid, color: "{{ style.bgColor }}" }\`.
- Grid layouts: always set \`rowHeight\` when children have known heights — without it, cells expand to fill the container.
- Stack/row layouts inside bounded containers: give each child an explicit \`frame.h\` (or use a suitable gap + container height that fits all items). Without explicit child heights, items may overflow or get clipped. Calculate: container_h should be >= (item_h * count) + (gap * (count - 1)).`;

export function buildAnalysisPrompt(
  text: string | null,
  slug: string | null,
): string {
  let prompt = `Analyze this screenshot and propose reusable scene templates. Read .claude/skills/replicate-slides/reference.md first for the correct scene YAML syntax.`;
  prompt += `\n\nCRITICAL for source.dimensions: Report the pixel dimensions as you visually perceive the image. Do NOT round to standard resolutions (not 1366x768, not 1920x1080). Your coordinates and region boxes must be consistent with the dimensions you report.`;
  if (text) prompt += `\n\nAdditional context: ${text}`;
  if (slug) prompt += `\n\nTarget slug: ${slug}`;
  return prompt;
}
