import type { LayoutElement, ResolvedTheme, TextStyle } from "@/lib/layout/types";
import { resolveThemeToken, resolveThemeTokenAny } from "@/lib/layout/theme-tokens";
import type {
  SceneAlign,
  SceneBackgroundSpec,
  SceneFitMode,
  SceneGuides,
  SceneGroupNode,
  SceneImageNode,
  SceneIrNode,
  SceneNode,
  ScenePreset,
  SceneSize,
  SceneTextNode,
} from "./types";

export interface NormalizedSceneBackground {
  background: string;
  backgroundImage?: string;
  overlay?: string;
}

export interface NormalizedSceneSlide extends NormalizedSceneBackground {
  guides?: SceneGuides;
  sourceSize?: SceneSize;
  fit?: SceneFitMode;
  align?: SceneAlign;
  children: SceneNode[];
}

function mergeOptionalObject<T extends Record<string, unknown> | undefined>(
  base: T,
  override: T,
): T {
  if (!base) return override;
  if (!override) return base;
  return {
    ...base,
    ...override,
  } as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const merge = mergeOptionalObject as (a: any, b: any) => any;

function applyScenePreset<T extends SceneNode>(
  node: T,
  presets: Record<string, ScenePreset> | undefined,
): T {
  if (!node.preset) return node;
  const preset = presets?.[node.preset];
  if (!preset) {
    throw new Error(`[scene] Unknown preset "${node.preset}" on node "${node.id}"`);
  }

  const base = {
    ...preset,
    ...node,
    ...(preset.frame || node.frame ? { frame: merge(preset.frame, node.frame) } : {}),
    ...(preset.shadow || node.shadow ? { shadow: merge(preset.shadow, node.shadow) } : {}),
    ...(preset.effects || node.effects ? { effects: merge(preset.effects, node.effects) } : {}),
    ...(preset.border || node.border ? { border: merge(preset.border, node.border) } : {}),
    ...(preset.entrance || node.entrance ? { entrance: merge(preset.entrance, node.entrance) } : {}),
    ...(preset.transform || node.transform ? { transform: merge(preset.transform, node.transform) } : {}),
    ...(preset.cssStyle || node.cssStyle ? { cssStyle: merge(preset.cssStyle, node.cssStyle) } : {}),
  };

  switch (node.kind) {
    case "text":
      return {
        ...base,
        style: merge(preset.style, node.style) ?? node.style,
      } as T;
    case "shape":
      return {
        ...base,
        style: merge(preset.style, node.style) ?? node.style,
      } as T;
    case "image":
      return {
        ...base,
        objectFit: node.objectFit ?? preset.objectFit,
        clipCircle: node.clipCircle ?? preset.clipCircle,
      } as T;
    case "group":
      return {
        ...base,
        ...(preset.style || node.style ? { style: merge(preset.style, node.style) } : {}),
        clipContent: node.clipContent ?? preset.clipContent,
        ...(preset.layout || node.layout ? { layout: merge(preset.layout, node.layout) } : {}),
      } as T;
    case "ir":
      return base as T;
    case "block":
      return node;
  }
}

function resolveScenePresets(
  presets: Record<string, ScenePreset> | undefined,
): Record<string, ScenePreset> | undefined {
  if (!presets) return undefined;

  const presetsMap = presets;
  const resolved = new Map<string, ScenePreset>();
  const resolving = new Set<string>();

  function visit(name: string): ScenePreset {
    const cached = resolved.get(name);
    if (cached) return cached;

    const preset = presetsMap[name];
    if (!preset) {
      throw new Error(`[scene] Unknown preset "${name}"`);
    }
    if (resolving.has(name)) {
      throw new Error(`[scene] Circular preset inheritance involving "${name}"`);
    }

    resolving.add(name);
    const base = preset.extends ? visit(preset.extends) : undefined;
    const merged = base
      ? {
          ...base,
          ...preset,
          extends: preset.extends,
          ...(base.frame || preset.frame ? { frame: merge(base.frame, preset.frame) } : {}),
          ...(base.shadow || preset.shadow ? { shadow: merge(base.shadow, preset.shadow) } : {}),
          ...(base.effects || preset.effects ? { effects: merge(base.effects, preset.effects) } : {}),
          ...(base.border || preset.border ? { border: merge(base.border, preset.border) } : {}),
          ...(base.entrance || preset.entrance ? { entrance: merge(base.entrance, preset.entrance) } : {}),
          ...(base.transform || preset.transform ? { transform: merge(base.transform, preset.transform) } : {}),
          ...(base.cssStyle || preset.cssStyle ? { cssStyle: merge(base.cssStyle, preset.cssStyle) } : {}),
          ...(base.style || preset.style ? { style: merge(base.style, preset.style) } : {}),
          ...(base.layout || preset.layout ? { layout: merge(base.layout, preset.layout) } : {}),
        }
      : preset;

    resolving.delete(name);
    resolved.set(name, merged);
    return merged;
  }

  for (const name of Object.keys(presets)) {
    visit(name);
  }

  return Object.fromEntries(resolved);
}

function prefixImageSrc(src: string, imageBase: string): string {
  if (!src || src.startsWith("/") || src.startsWith("http") || src.startsWith("data:")) {
    return src;
  }
  return `${imageBase}/${src}`;
}

function resolveSceneFontFamily(value: string | undefined, theme: ResolvedTheme): string {
  if (!value || value === "body") return theme.fontBody;
  if (value === "heading") return theme.fontHeading;
  if (value === "mono") return theme.fontMono;
  return resolveThemeToken(value, theme) ?? value;
}

const IR_TOKEN_SKIP = new Set(["text", "id", "code", "src", "language", "shape", "kind"]);

function resolveIrTokenTree<T>(value: T, theme: ResolvedTheme, key?: string): T {
  if (key && IR_TOKEN_SKIP.has(key)) return value;
  if (Array.isArray(value)) {
    return value.map((item) => resolveIrTokenTree(item, theme)) as T;
  }
  if (typeof value === "string" && value.startsWith("theme.")) {
    return (resolveThemeTokenAny(value, theme) ?? value) as T;
  }
  if (key === "fontFamily" && typeof value === "string") {
    return resolveSceneFontFamily(value, theme) as T;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(value)) {
      next[childKey] = resolveIrTokenTree(child, theme, childKey);
    }
    return next as T;
  }
  return value;
}

function normalizeLayoutElement(element: LayoutElement, theme: ResolvedTheme, imageBase: string): LayoutElement {
  const resolved = resolveIrTokenTree(element, theme) as LayoutElement;
  if (resolved.kind === "image" && resolved.src) {
    return {
      ...resolved,
      src: prefixImageSrc(resolved.src, imageBase),
    };
  }
  if (resolved.kind === "group") {
    return {
      ...resolved,
      children: resolved.children.map((child) => normalizeLayoutElement(child, theme, imageBase)),
    };
  }
  return resolved;
}

function resolveTokenTree<T>(value: T, theme: ResolvedTheme): T {
  if (Array.isArray(value)) {
    return value.map((item) => resolveTokenTree(item, theme)) as T;
  }
  if (typeof value === "string") {
    return (resolveThemeTokenAny(value, theme) ?? value) as T;
  }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      next[key] = resolveTokenTree(child, theme);
    }
    return next as T;
  }
  return value;
}

function normalizeTextNode(node: SceneTextNode, theme: ResolvedTheme): SceneTextNode {
  const style: TextStyle = {
    fontFamily: resolveSceneFontFamily(node.style.fontFamily, theme),
    fontSize: node.style.fontSize,
    fontWeight: node.style.fontWeight ?? 400,
    color: resolveThemeToken(node.style.color, theme) ?? theme.text,
    lineHeight: node.style.lineHeight ?? 1.2,
    ...(node.style.fontStyle ? { fontStyle: node.style.fontStyle } : {}),
    ...(node.style.textAlign ? { textAlign: node.style.textAlign } : {}),
    ...(node.style.textShadow ? { textShadow: node.style.textShadow } : {}),
    ...(node.style.letterSpacing != null ? { letterSpacing: node.style.letterSpacing } : {}),
    ...(node.style.textTransform ? { textTransform: node.style.textTransform } : {}),
    ...(node.style.verticalAlign ? { verticalAlign: node.style.verticalAlign } : {}),
    ...(node.style.highlightColor ? { highlightColor: resolveThemeToken(node.style.highlightColor, theme) ?? node.style.highlightColor } : {}),
  };

  return {
    ...node,
    style,
    ...(node.opacity != null ? { opacity: resolveTokenTree(node.opacity, theme) } : {}),
    ...(node.borderRadius != null ? { borderRadius: resolveTokenTree(node.borderRadius, theme) } : {}),
    ...(node.border ? { border: resolveTokenTree(node.border, theme) } : {}),
    ...(node.shadow ? { shadow: resolveTokenTree(node.shadow, theme) } : {}),
    ...(node.effects ? { effects: resolveTokenTree(node.effects, theme) } : {}),
  };
}

function normalizeImageNode(node: SceneImageNode, theme: ResolvedTheme, imageBase: string): SceneImageNode {
  return {
    ...node,
    src: prefixImageSrc(node.src, imageBase),
    ...(node.opacity != null ? { opacity: resolveTokenTree(node.opacity, theme) } : {}),
    ...(node.borderRadius != null ? { borderRadius: resolveTokenTree(node.borderRadius, theme) } : {}),
    ...(node.border ? { border: resolveTokenTree(node.border, theme) } : {}),
    ...(node.shadow ? { shadow: resolveTokenTree(node.shadow, theme) } : {}),
    ...(node.effects ? { effects: resolveTokenTree(node.effects, theme) } : {}),
  };
}

function normalizeGroupNode(
  node: SceneGroupNode,
  theme: ResolvedTheme,
  imageBase: string,
  presets?: Record<string, ScenePreset>,
): SceneGroupNode {
  return {
    ...node,
    ...(node.opacity != null ? { opacity: resolveTokenTree(node.opacity, theme) } : {}),
    ...(node.borderRadius != null ? { borderRadius: resolveTokenTree(node.borderRadius, theme) } : {}),
    ...(node.style ? { style: resolveTokenTree(node.style, theme) } : {}),
    ...(node.border ? { border: resolveTokenTree(node.border, theme) } : {}),
    ...(node.shadow ? { shadow: resolveTokenTree(node.shadow, theme) } : {}),
    ...(node.effects ? { effects: resolveTokenTree(node.effects, theme) } : {}),
    children: node.children.map((child) => normalizeSceneNode(child, theme, imageBase, presets)),
  };
}

function normalizeIrNode(node: SceneIrNode, theme: ResolvedTheme, imageBase: string): SceneIrNode {
  return {
    ...node,
    ...(node.opacity != null ? { opacity: resolveTokenTree(node.opacity, theme) } : {}),
    ...(node.borderRadius != null ? { borderRadius: resolveTokenTree(node.borderRadius, theme) } : {}),
    ...(node.border ? { border: resolveTokenTree(node.border, theme) } : {}),
    ...(node.shadow ? { shadow: resolveTokenTree(node.shadow, theme) } : {}),
    ...(node.effects ? { effects: resolveTokenTree(node.effects, theme) } : {}),
    element: normalizeLayoutElement(node.element, theme, imageBase),
  };
}

export function normalizeSceneNode(
  node: SceneNode,
  theme: ResolvedTheme,
  imageBase: string,
  presets?: Record<string, ScenePreset>,
): SceneNode {
  const mergedNode = applyScenePreset(node, presets);

  switch (mergedNode.kind) {
    case "text":
      return normalizeTextNode(mergedNode, theme);
    case "shape":
      return {
        ...mergedNode,
        ...(mergedNode.opacity != null ? { opacity: resolveTokenTree(mergedNode.opacity, theme) } : {}),
        ...(mergedNode.borderRadius != null ? { borderRadius: resolveTokenTree(mergedNode.borderRadius, theme) } : {}),
        style: resolveTokenTree(mergedNode.style, theme),
        ...(mergedNode.border ? { border: resolveTokenTree(mergedNode.border, theme) } : {}),
        ...(mergedNode.shadow ? { shadow: resolveTokenTree(mergedNode.shadow, theme) } : {}),
        ...(mergedNode.effects ? { effects: resolveTokenTree(mergedNode.effects, theme) } : {}),
      };
    case "image":
      return normalizeImageNode(mergedNode, theme, imageBase);
    case "ir":
      return normalizeIrNode(mergedNode, theme, imageBase);
    case "group":
      return normalizeGroupNode(mergedNode, theme, imageBase, presets);
    case "block":
      throw new Error(
        `[scene] Block node "${mergedNode.id}" must be expanded before normalization. ` +
        `Call expandBlockNodes() before compileSceneSlide().`,
      );
  }
}

export function normalizeSceneBackground(
  background: SceneBackgroundSpec | undefined,
  theme: ResolvedTheme,
  imageBase: string,
): NormalizedSceneBackground {
  if (!background) {
    return { background: theme.bg };
  }

  if (typeof background === "string") {
    return { background: resolveThemeToken(background, theme) ?? background };
  }

  if (background.type === "solid") {
    return { background: resolveThemeToken(background.color, theme) ?? background.color };
  }

  return {
    background: theme.bg,
    backgroundImage: prefixImageSrc(background.src, imageBase),
    ...(background.overlay ? { overlay: background.overlay } : {}),
  };
}

export function normalizeSceneSlide(
  slide: {
    background?: SceneBackgroundSpec;
    guides?: SceneGuides;
    presets?: Record<string, ScenePreset>;
    sourceSize?: SceneSize;
    fit?: SceneFitMode;
    align?: SceneAlign;
    children: SceneNode[];
  },
  theme: ResolvedTheme,
  imageBase: string,
): NormalizedSceneSlide {
  const bg = normalizeSceneBackground(slide.background, theme, imageBase);
  const resolvedPresets = resolveScenePresets(slide.presets);
  return {
    ...bg,
    ...(slide.guides ? { guides: slide.guides } : {}),
    ...(slide.sourceSize ? { sourceSize: slide.sourceSize } : {}),
    ...(slide.fit ? { fit: slide.fit } : {}),
    ...(slide.align ? { align: slide.align } : {}),
    children: slide.children.map((child) => normalizeSceneNode(child, theme, imageBase, resolvedPresets)),
  };
}
