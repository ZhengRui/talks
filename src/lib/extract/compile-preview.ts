/**
 * Compiles an extracted proposal into a LayoutSlide for preview rendering.
 * Client-safe — no file system access.
 */

import { parse as yamlParse } from "yaml";
import { createMinimalEnvironment, smartify } from "@/lib/dsl/nunjucks-filters";
import { expandBlockNodes, type BlockExpansionRuntime } from "@/lib/dsl/block-expand";
import { compileSceneSlide } from "@/lib/scene/compiler";
import { THEMES } from "@/lib/layout/theme";
import type { LayoutSlide } from "@/lib/layout/types";
import type { SceneSlideData } from "@/lib/scene/types";
import type { DslTemplateDef } from "@/lib/dsl/types";
import type { Proposal } from "@/components/extract/types";

// ---------------------------------------------------------------------------
// Shared minimal Nunjucks environment (singleton)
// ---------------------------------------------------------------------------

const minimalEnv = createMinimalEnvironment();

// ---------------------------------------------------------------------------
// Guard: reject unsupported Nunjucks constructs
// ---------------------------------------------------------------------------

const UNSUPPORTED_PATTERN = /\{%\s*(import|include|from)\b/;

function validateBody(body: string, name: string): void {
  if (UNSUPPORTED_PATTERN.test(body)) {
    throw new Error(
      `[preview] Template "${name}" uses {% import %}, {% include %}, or {% from %} which are not supported in preview mode`,
    );
  }
}

// ---------------------------------------------------------------------------
// Convert block proposals to DslTemplateDef for the runtime resolver
// ---------------------------------------------------------------------------

function buildProposalMap(proposals: Proposal[]): Map<string, DslTemplateDef> {
  const map = new Map<string, DslTemplateDef>();
  for (const p of proposals) {
    if (p.scope !== "block") continue;
    validateBody(p.body, p.name);
    map.set(p.name, {
      name: p.name,
      scope: "block",
      params: Object.fromEntries(
        Object.entries(p.params).map(([k, f]) => [k, { type: f.type }]),
      ),
      style: Object.fromEntries(
        Object.entries(p.style).map(([k, f]) => [k, { type: f.type, default: f.value as string | number }]),
      ),
      rawBody: p.body,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Compile a slide-scope proposal to a LayoutSlide at given canvas dimensions
// ---------------------------------------------------------------------------

export function compileProposalPreview(
  proposal: Proposal,
  allProposals: Proposal[],
  canvasW: number,
  canvasH: number,
): LayoutSlide {
  validateBody(proposal.body, proposal.name);

  // Build template context (smartify for array/object serialization parity)
  const context: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(proposal.params)) {
    context[key] = smartify(field.value);
  }
  const styleContext: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(proposal.style)) {
    styleContext[key] = field.value;
  }
  context.style = styleContext;

  // Render slide template body
  const renderedBody = minimalEnv.renderString(proposal.body, context);

  // Parse as SceneSlideData — strip fit/align (consumer concerns, not template concerns)
  const parsed = yamlParse(renderedBody) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fit, align, ...rest } = parsed;
  let sceneSlide: SceneSlideData = {
    mode: "scene",
    ...rest,
    fit: "contain",
    align: "center",
    children: (parsed.children as SceneSlideData["children"]) ?? [],
  };

  // Expand block nodes using proposals as template source
  const proposalMap = buildProposalMap(allProposals);
  if (proposalMap.size > 0) {
    const runtime: BlockExpansionRuntime = {
      resolveTemplate: (name) => proposalMap.get(name) ?? null,
      createEnvironment: () => minimalEnv,
      sourceLabel: "extract-preview",
    };
    sceneSlide = expandBlockNodes(sceneSlide, runtime);
  }

  return compileSceneSlide(sceneSlide, THEMES.modern, "", { canvasW, canvasH });
}
