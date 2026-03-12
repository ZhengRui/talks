import type { ResolvedTheme, TextStyle } from "@/lib/layout/types";
import { resolveThemeToken, resolveThemeTokenAny } from "@/lib/layout/components/theme-tokens";
import type {
  SceneAlign,
  SceneBackgroundSpec,
  SceneFitMode,
  SceneGuides,
  SceneGroupNode,
  SceneImageNode,
  SceneNode,
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

function prefixImageSrc(src: string, imageBase: string): string {
  if (!src || src.startsWith("/") || src.startsWith("http") || src.startsWith("data:")) {
    return src;
  }
  return `${imageBase}/${src}`;
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

function resolveSceneFontFamily(value: string | undefined, theme: ResolvedTheme): string {
  if (!value || value === "body") return theme.fontBody;
  if (value === "heading") return theme.fontHeading;
  if (value === "mono") return theme.fontMono;
  return resolveThemeToken(value, theme) ?? value;
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
    ...(node.border ? { border: resolveTokenTree(node.border, theme) } : {}),
    ...(node.shadow ? { shadow: resolveTokenTree(node.shadow, theme) } : {}),
    ...(node.effects ? { effects: resolveTokenTree(node.effects, theme) } : {}),
  };
}

function normalizeImageNode(node: SceneImageNode, theme: ResolvedTheme, imageBase: string): SceneImageNode {
  return {
    ...node,
    src: prefixImageSrc(node.src, imageBase),
    ...(node.border ? { border: resolveTokenTree(node.border, theme) } : {}),
    ...(node.shadow ? { shadow: resolveTokenTree(node.shadow, theme) } : {}),
    ...(node.effects ? { effects: resolveTokenTree(node.effects, theme) } : {}),
  };
}

function normalizeGroupNode(node: SceneGroupNode, theme: ResolvedTheme, imageBase: string): SceneGroupNode {
  return {
    ...node,
    ...(node.style ? { style: resolveTokenTree(node.style, theme) } : {}),
    ...(node.border ? { border: resolveTokenTree(node.border, theme) } : {}),
    ...(node.shadow ? { shadow: resolveTokenTree(node.shadow, theme) } : {}),
    ...(node.effects ? { effects: resolveTokenTree(node.effects, theme) } : {}),
    children: node.children.map((child) => normalizeSceneNode(child, theme, imageBase)),
  };
}

export function normalizeSceneNode(
  node: SceneNode,
  theme: ResolvedTheme,
  imageBase: string,
): SceneNode {
  switch (node.kind) {
    case "text":
      return normalizeTextNode(node, theme);
    case "shape":
      return {
        ...node,
        style: resolveTokenTree(node.style, theme),
        ...(node.border ? { border: resolveTokenTree(node.border, theme) } : {}),
        ...(node.shadow ? { shadow: resolveTokenTree(node.shadow, theme) } : {}),
        ...(node.effects ? { effects: resolveTokenTree(node.effects, theme) } : {}),
      };
    case "image":
      return normalizeImageNode(node, theme, imageBase);
    case "group":
      return normalizeGroupNode(node, theme, imageBase);
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
    sourceSize?: SceneSize;
    fit?: SceneFitMode;
    align?: SceneAlign;
    children: SceneNode[];
  },
  theme: ResolvedTheme,
  imageBase: string,
): NormalizedSceneSlide {
  const bg = normalizeSceneBackground(slide.background, theme, imageBase);
  return {
    ...bg,
    ...(slide.guides ? { guides: slide.guides } : {}),
    ...(slide.sourceSize ? { sourceSize: slide.sourceSize } : {}),
    ...(slide.fit ? { fit: slide.fit } : {}),
    ...(slide.align ? { align: slide.align } : {}),
    children: slide.children.map((child) => normalizeSceneNode(child, theme, imageBase)),
  };
}
