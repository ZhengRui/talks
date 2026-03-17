import { parse } from "yaml";
import type { DslTemplateDef } from "./types";
import { createTemplateEnvironment, smartify } from "./nunjucks-env";
import {
  SCENE_ANCHOR_PROPERTIES,
  type SceneBlockNode,
  type SceneGroupNode,
  type SceneNode,
  type SceneNodeBase,
  type ScenePreset,
} from "@/lib/scene/types";

// --- Separator for block ID prefixing ---
// Uses __ instead of . because the anchor parser splits on . to separate nodeId from property.
const SEP = "__";

// --- ID/preset/anchor rewriting ---

// Derived from the single source of truth in types.ts
const ANCHOR_PROPERTIES = new Set<string>(SCENE_ANCHOR_PROPERTIES);

// Guide namespace prefixes — @x.foo and @y.foo are guide refs unless foo is an anchor property.
const GUIDE_PREFIXES = new Set(["x", "y"]);

function collectIds(nodes: Record<string, unknown>[]): Set<string> {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (typeof node.id === "string") ids.add(node.id);
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (typeof child === "object" && child !== null) {
          for (const id of collectIds([child as Record<string, unknown>])) {
            ids.add(id);
          }
        }
      }
    }
  }
  return ids;
}

/**
 * Rewrite anchor references in a string value.
 * Replaces @oldId.property with @prefix__oldId.property for any oldId in the known set.
 *
 * Special case: @x.foo and @y.foo are guide refs unless the property is a known anchor
 * property (left, right, top, etc.) AND x/y is in knownIds. This lets blocks have
 * children named "x" or "y" while still supporting guide refs.
 */
function rewriteAnchors(value: string, prefix: string, knownIds: Set<string>): string {
  return value.replace(/@([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/g, (match, nodeId, prop) => {
    if (!knownIds.has(nodeId)) return match;
    // If nodeId is a guide prefix (x or y), only rewrite when the property
    // is a known anchor property — otherwise it's a guide ref like @x.content
    if (GUIDE_PREFIXES.has(nodeId) && !ANCHOR_PROPERTIES.has(prop)) {
      return match;
    }
    return `@${prefix}${SEP}${nodeId}.${prop}`;
  });
}

/**
 * Rewrite anchor references in frame values (both string refs and { ref, offset } objects).
 */
function rewriteFrameAnchors(
  frame: Record<string, unknown>,
  prefix: string,
  knownIds: Set<string>,
): void {
  for (const [key, val] of Object.entries(frame)) {
    if (typeof val === "string" && val.startsWith("@")) {
      frame[key] = rewriteAnchors(val, prefix, knownIds);
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      const ref = (val as Record<string, unknown>).ref;
      if (typeof ref === "string" && ref.startsWith("@")) {
        (val as Record<string, unknown>).ref = rewriteAnchors(ref, prefix, knownIds);
      }
    }
  }
}

/**
 * Recursively prefix `id`, `preset` fields and rewrite anchor references on scene nodes.
 */
function prefixNode(
  node: Record<string, unknown>,
  prefix: string,
  knownIds: Set<string>,
): void {
  if (typeof node.id === "string") {
    node.id = `${prefix}${SEP}${node.id}`;
  }
  if (typeof node.preset === "string") {
    node.preset = `${prefix}${SEP}${node.preset}`;
  }
  // Rewrite anchor refs in frame
  if (node.frame && typeof node.frame === "object" && !Array.isArray(node.frame)) {
    rewriteFrameAnchors(node.frame as Record<string, unknown>, prefix, knownIds);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (typeof child === "object" && child !== null) {
        prefixNode(child as Record<string, unknown>, prefix, knownIds);
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

  // 7. Collect known child IDs before any prefixing (needed for anchor rewriting)
  const children = (parsed.children ?? []) as Record<string, unknown>[];
  const knownIds = collectIds(children);

  // 8. Extract and namespace presets, rewriting extends and frame anchor references
  let presets: Record<string, ScenePreset> | undefined;
  const rawPresets = parsed.presets as Record<string, ScenePreset> | undefined;
  if (rawPresets && typeof rawPresets === "object") {
    const originalPresetNames = new Set(Object.keys(rawPresets));
    presets = {};
    for (const [name, preset] of Object.entries(rawPresets)) {
      const namespaced = { ...preset };
      // Rewrite extends reference if it points to a preset within this block
      if (typeof namespaced.extends === "string" && originalPresetNames.has(namespaced.extends)) {
        namespaced.extends = `${blockId}${SEP}${namespaced.extends}`;
      }
      // Rewrite anchor refs in preset frame
      if (namespaced.frame && typeof namespaced.frame === "object") {
        rewriteFrameAnchors(namespaced.frame as Record<string, unknown>, blockId, knownIds);
      }
      presets[`${blockId}${SEP}${name}`] = namespaced;
    }
  }

  // 9. Prefix child IDs, preset references, and anchor references
  for (const child of children) {
    prefixNode(child, blockId, knownIds);
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
