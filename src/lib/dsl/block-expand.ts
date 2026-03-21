import type nunjucks from "nunjucks";
import type { DslTemplateDef } from "./types";
import type {
  SceneBlockNode,
  SceneGroupNode,
  SceneNode,
  ScenePreset,
  SceneSlideData,
} from "@/lib/scene/types";
import { expandBlockTemplate } from "./block";

const MAX_EXPANSION_DEPTH = 5;

// ---------------------------------------------------------------------------
// Runtime interface — injected by callers to decouple from fs/loader
// ---------------------------------------------------------------------------

export interface BlockExpansionRuntime {
  resolveTemplate(name: string): DslTemplateDef | null;
  createEnvironment(templateDef: DslTemplateDef): nunjucks.Environment;
  sourceLabel?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hasBlockNodes(nodes: SceneNode[]): boolean {
  for (const node of nodes) {
    if (node.kind === "block") return true;
    if (node.kind === "group" && hasBlockNodes(node.children)) return true;
  }
  return false;
}

function walkChildren(
  nodes: SceneNode[],
  runtime: BlockExpansionRuntime,
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
      const def = runtime.resolveTemplate(blockNode.template);
      if (!def) {
        const label = runtime.sourceLabel ?? "unknown";
        throw new Error(
          `[block-expand] Template "${blockNode.template}" not found (source: ${label})`,
        );
      }
      const env = runtime.createEnvironment(def);
      const expanded = expandBlockTemplate(blockNode, def, env);

      if (expanded.presets) {
        Object.assign(collectedPresets, expanded.presets);
      }

      const groupNode = expanded.node;
      const inner = walkChildren(groupNode.children, runtime, depth + 1);
      groupNode.children = inner.nodes;
      Object.assign(collectedPresets, inner.presets);

      result.push(groupNode);
    } else if (node.kind === "group") {
      const groupNode = node as SceneGroupNode;
      const inner = walkChildren(groupNode.children, runtime, depth);
      groupNode.children = inner.nodes;
      Object.assign(collectedPresets, inner.presets);
      result.push(groupNode);
    } else {
      result.push(node);
    }
  }

  return { nodes: result, presets: collectedPresets };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function expandBlockNodes(
  slide: SceneSlideData,
  runtime: BlockExpansionRuntime,
): SceneSlideData {
  if (!hasBlockNodes(slide.children)) {
    return slide;
  }

  const { nodes, presets } = walkChildren(slide.children, runtime, 0);

  const result: SceneSlideData = { ...slide, children: nodes };

  if (Object.keys(presets).length > 0) {
    result.presets = { ...(slide.presets ?? {}), ...presets };
  }

  return result;
}
