import { parse } from "yaml";
import type { DslTemplateDef } from "./types";
import { createTemplateEnvironment, smartify } from "./nunjucks-env";
import type {
  SceneBlockNode,
  SceneGroupNode,
  SceneNode,
  SceneNodeBase,
  ScenePreset,
} from "@/lib/scene/types";

// --- ID/preset prefixing ---

/**
 * Recursively prefix `id` and `preset` fields on scene nodes.
 */
function prefixNode(node: Record<string, unknown>, prefix: string): void {
  if (typeof node.id === "string") {
    node.id = `${prefix}.${node.id}`;
  }
  if (typeof node.preset === "string") {
    node.preset = `${prefix}.${node.preset}`;
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (typeof child === "object" && child !== null) {
        prefixNode(child as Record<string, unknown>, prefix);
      }
    }
  }
}

// --- Return type ---

export interface ExpandBlockResult {
  node: SceneGroupNode;
  presets?: Record<string, ScenePreset>;
}

// --- SceneNodeBase property keys (for overlaying block node props) ---

const NODE_BASE_KEYS: (keyof SceneNodeBase)[] = [
  "frame",
  "opacity",
  "borderRadius",
  "shadow",
  "effects",
  "border",
  "entrance",
  "animation",
  "clipPath",
  "transform",
  "cssStyle",
];

// --- Main expansion function ---

/**
 * Expand a block template definition with block node data into a
 * SceneGroupNode and optional namespaced presets.
 */
export function expandBlockTemplate(
  blockNode: SceneBlockNode,
  templateDef: DslTemplateDef,
): ExpandBlockResult {
  const blockId = blockNode.id;

  // Reject slide-scoped templates used as blocks
  if (templateDef.scope === "slide") {
    throw new Error(
      `[block] Template "${templateDef.name}" has scope: slide and cannot be used as a block. ` +
      `Use it as a slide-level template: reference instead.`,
    );
  }

  // 1. Validate required params
  const blockParams = blockNode.params ?? {};
  for (const [name, def] of Object.entries(templateDef.params)) {
    if (def.required && !(name in blockParams)) {
      throw new Error(
        `[block] Template "${templateDef.name}" requires param "${name}" but it was not provided`,
      );
    }
  }

  // 2. Build style context with defaults, merged with block overrides
  const styleContext: Record<string, string | number> = {};
  if (templateDef.style) {
    for (const [name, def] of Object.entries(templateDef.style)) {
      styleContext[name] = def.default;
    }
  }
  if (blockNode.style) {
    for (const [k, v] of Object.entries(blockNode.style)) {
      if (v !== undefined) styleContext[k] = v;
    }
  }

  // 3. Build Nunjucks render context
  const context: Record<string, unknown> = { style: styleContext };
  for (const name of Object.keys(templateDef.params)) {
    if (name in blockParams) {
      context[name] = smartify(blockParams[name]);
    }
  }

  // 4. Render through Nunjucks
  let rendered: string;
  try {
    const env = createTemplateEnvironment(templateDef);
    rendered = env.renderString(templateDef.rawBody, context);
  } catch (e) {
    throw new Error(
      `[block] Nunjucks render failed for block template "${templateDef.name}": ${e}`,
    );
  }

  // 5. Parse rendered YAML
  let parsed: Record<string, unknown>;
  try {
    parsed = parse(rendered) as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      `[block] YAML parse failed after rendering block template "${templateDef.name}": ${e}\n\nRendered output:\n${rendered}`,
    );
  }

  // 6. Validate output shape
  if (parsed.mode === "scene") {
    throw new Error(
      `[block] Block template "${templateDef.name}" must not emit mode: scene. ` +
      `Block templates produce fragments, not whole slides.`,
    );
  }
  if (parsed.kind !== undefined && parsed.kind !== "group") {
    throw new Error(
      `[block] Block template "${templateDef.name}" must emit kind: group at top level. ` +
      `Got kind: ${parsed.kind}`,
    );
  }
  if (!parsed.children) {
    throw new Error(
      `[block] Block template "${templateDef.name}" must have children.`,
    );
  }

  // 7. Extract and namespace presets
  let presets: Record<string, ScenePreset> | undefined;
  if (parsed.presets && typeof parsed.presets === "object") {
    presets = {};
    for (const [name, preset] of Object.entries(
      parsed.presets as Record<string, ScenePreset>,
    )) {
      presets[`${blockId}.${name}`] = preset;
    }
  }

  // 8. Prefix child IDs and preset references
  const children = (parsed.children ?? []) as Record<string, unknown>[];
  for (const child of children) {
    prefixNode(child, blockId);
  }

  // 9. Build the group node — start from template output, overlay block props
  const groupNode: SceneGroupNode = {
    kind: "group",
    id: blockId,
    children: children as unknown as SceneNode[],
  };

  // Carry through template's layout, style, clipContent
  if (parsed.layout !== undefined) {
    groupNode.layout = parsed.layout as SceneGroupNode["layout"];
  }
  if (parsed.style !== undefined) {
    groupNode.style = parsed.style as SceneGroupNode["style"];
  }
  if (parsed.clipContent !== undefined) {
    groupNode.clipContent = parsed.clipContent as boolean;
  }

  // Apply SceneNodeBase props from the block node (frame, entrance, opacity, etc.)
  for (const key of NODE_BASE_KEYS) {
    const value = blockNode[key];
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (groupNode as any)[key] = value;
    }
  }

  return { node: groupNode, ...(presets ? { presets } : {}) };
}
