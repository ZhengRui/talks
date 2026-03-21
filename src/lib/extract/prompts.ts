/**
 * Prompts for the extract/analyze API route.
 */

export const ANALYSIS_SYSTEM_PROMPT = `You analyze screenshots of presentation slides and propose reusable scene templates.

IMPORTANT constraints:
- This is a Layer 1 (analysis-only) task. Do NOT write files, open workbenches, or run verification.
- Do NOT attempt to verify, render, or test the templates.
- Just analyze the screenshot, read the skill reference for scene syntax, and return JSON.

## Your workflow

1. Read the replicate-slides skill reference at .claude/skills/replicate-slides/reference.md to understand scene YAML syntax.
2. Analyze the screenshot image.
3. Identify reusable template candidates (slide-scope for overall layout, block-scope for repeating sub-regions).
4. Output the JSON result.

## Output format

Output a JSON object wrapped in a \`\`\`json code fence:

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

## Field definitions

- params: content that varies across slides (text, arrays, images)
- style: design knobs with sensible defaults (colors, sizes, gaps)
- body: the scene YAML template body following the syntax in reference.md. NO header (no name/scope/params/style). Use Nunjucks {{ param | yaml_string }} for string params, {{ style.name }} for style values.

## Rules

- Always propose at least one slide-scope template for the whole slide
- Propose block-scope templates for reusable sub-regions (stat cards, feature rows, etc.)
- Slide templates can reference block templates via kind: block nodes in their body
- Use the source.dimensions value you report for sourceSize in the template body, with fit: contain and align: center
- CRITICAL: For source.dimensions, report ONLY what you visually perceive as the image size. Do NOT guess standard resolutions like 1920x1080, 1366x768, etc. If the image appears to be about 840 pixels wide, report 840, not 1366.
- Use guides for repeated alignment lines
- All positions are in source-pixel coordinates
- Do NOT include mode: scene or kind: group in the body — the system injects these based on scope
- Do NOT use {% import %}, {% include %}, or {% from %} in template bodies — bodies must be self-contained`;

export function buildAnalysisPrompt(
  imagePath: string,
  text: string | null,
  slug: string | null,
): string {
  let prompt = `Analyze this screenshot and propose reusable scene templates. Read .claude/skills/replicate-slides/reference.md first for the correct scene YAML syntax.\n\nScreenshot: ${imagePath}`;
  prompt += `\n\nCRITICAL for source.dimensions: Report the pixel dimensions as you visually perceive the image — typically around 800-1100px wide. Do NOT round to standard resolutions (not 1366x768, not 1920x1080). Your coordinates and region boxes must be consistent with the dimensions you report.`;
  if (text) prompt += `\n\nAdditional context: ${text}`;
  if (slug) prompt += `\n\nTarget slug: ${slug}`;
  return prompt;
}
