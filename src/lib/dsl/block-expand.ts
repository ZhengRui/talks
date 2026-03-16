import type { DslTemplateDef } from "./types";
import type {
  SceneBlockNode,
  SceneGroupNode,
  SceneNode,
  ScenePreset,
  SceneSlideData,
} from "@/lib/scene/types";
import { expandBlockTemplate } from "./block";
import { findTemplate } from "./loader";

const MAX_EXPANSION_DEPTH = 5;

/**
 * Check whether a node tree contains any `kind: "block"` nodes.
 */
function hasBlockNodes(nodes: SceneNode[]): boolean {
  for (const node of nodes) {
    if (node.kind === "block") return true;
    if (node.kind === "group" && hasBlockNodes(node.children)) return true;
  }
  return false;
}

/**
 * Resolve a template definition — prefer overrides (test-only), fall back to
 * filesystem via `findTemplate`.
 */
function resolveTemplate(
  name: string,
  slug: string | undefined,
  overrides?: Record<string, DslTemplateDef>,
): DslTemplateDef {
  if (overrides && name in overrides) {
    return overrides[name];
  }
  const def = findTemplate(name, slug);
  if (!def) {
    throw new Error(
      `[block-expand] Template "${name}" not found${slug ? ` (slug: ${slug})` : ""}`,
    );
  }
  return def;
}

/**
 * Recursively walk a list of scene nodes, expanding `kind: "block"` nodes via
 * `expandBlockTemplate()`. Returns the transformed node list and any collected
 * presets.
 */
function walkChildren(
  nodes: SceneNode[],
  slug: string | undefined,
  overrides: Record<string, DslTemplateDef> | undefined,
  depth: number,
): { nodes: SceneNode[]; presets: Record<string, ScenePreset> } {
  const collectedPresets: Record<string, ScenePreset> = {};
  const result: SceneNode[] = [];

  for (const node of nodes) {
    if (node.kind === "block") {
      if (depth >= MAX_EXPANSION_DEPTH) {
        throw new Error(
          `[block-expand] Maximum expansion depth (${MAX_EXPANSION_DEPTH}) exceeded — possible circular block reference`,
        );
      }

      const blockNode = node as SceneBlockNode;
      const def = resolveTemplate(blockNode.template, slug, overrides);
      const expanded = expandBlockTemplate(blockNode, def);

      // Collect presets from this block
      if (expanded.presets) {
        Object.assign(collectedPresets, expanded.presets);
      }

      // Recursively expand any block nodes in the expanded group's children
      const groupNode = expanded.node;
      const inner = walkChildren(
        groupNode.children,
        slug,
        overrides,
        depth + 1,
      );
      groupNode.children = inner.nodes;
      Object.assign(collectedPresets, inner.presets);

      result.push(groupNode);
    } else if (node.kind === "group") {
      const groupNode = node as SceneGroupNode;
      const inner = walkChildren(
        groupNode.children,
        slug,
        overrides,
        depth,
      );
      // Mutate children in place — same depth level (groups don't increase depth)
      groupNode.children = inner.nodes;
      Object.assign(collectedPresets, inner.presets);
      result.push(groupNode);
    } else {
      // text, shape, image, ir — pass through unchanged
      result.push(node);
    }
  }

  return { nodes: result, presets: collectedPresets };
}

/**
 * Recursively walks slide children, expands `kind: "block"` nodes via
 * `expandBlockTemplate()`, collects presets into parent slide, with depth
 * guard for circular references.
 *
 * @param slide        The scene slide to process
 * @param slug         Presentation slug for template lookup
 * @param overrides    Test-only template overrides (bypasses filesystem)
 * @returns            The modified SceneSlideData with blocks expanded
 */
export function expandBlockNodes(
  slide: SceneSlideData,
  slug?: string,
  overrides?: Record<string, DslTemplateDef>,
): SceneSlideData {
  // Fast path: no block nodes in the tree — return as-is
  if (!hasBlockNodes(slide.children)) {
    return slide;
  }

  const { nodes, presets } = walkChildren(
    slide.children,
    slug,
    overrides,
    0,
  );

  // Build result slide with expanded children
  const result: SceneSlideData = { ...slide, children: nodes };

  // Merge collected presets into slide presets
  if (Object.keys(presets).length > 0) {
    result.presets = { ...(slide.presets ?? {}), ...presets };
  }

  return result;
}
