import { estimateTextHeight } from "@/lib/layout/helpers";
import { toPlainText } from "@/lib/layout/richtext";
import type {
  GroupElement,
  ImageElement,
  LayoutElement,
  Rect,
  ShapeElement,
  TextElement,
} from "@/lib/layout/types";
import type {
  FrameSpec,
  SceneGroupNode,
  SceneGuides,
  SceneImageNode,
  SceneIrNode,
  SceneNode,
  ScenePadding,
  SceneRowLayout,
  SceneShapeNode,
  SceneStackLayout,
  SceneTextNode,
  SceneValue,
} from "./types";

interface CompileContext {
  guides?: SceneGuides;
}

interface SizeHint {
  w?: number;
  h?: number;
}

function resolvePadding(padding?: ScenePadding): { top: number; right: number; bottom: number; left: number } {
  if (padding === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof padding === "number") return { top: padding, right: padding, bottom: padding, left: padding };
  return { top: padding[0], right: padding[1], bottom: padding[2], left: padding[3] };
}

function resolveGuide(value: string, guides: SceneGuides | undefined): number | undefined {
  if (value.startsWith("@x.")) {
    return guides?.x?.[value.slice(3)];
  }
  if (value.startsWith("@y.")) {
    return guides?.y?.[value.slice(3)];
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function resolveValue(value: SceneValue | undefined, guides: SceneGuides | undefined): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") return resolveGuide(value, guides);
  return undefined;
}

function hasExplicitX(frame?: FrameSpec): boolean {
  return frame?.x !== undefined || frame?.left !== undefined || frame?.right !== undefined || frame?.centerX !== undefined;
}

function hasExplicitY(frame?: FrameSpec): boolean {
  return frame?.y !== undefined || frame?.top !== undefined || frame?.bottom !== undefined || frame?.centerY !== undefined;
}

function resolveFrame(
  frame: FrameSpec | undefined,
  parent: Rect,
  guides: SceneGuides | undefined,
  hint: SizeHint = {},
): Rect {
  const left = resolveValue(frame?.left ?? frame?.x, guides);
  const top = resolveValue(frame?.top ?? frame?.y, guides);
  const right = resolveValue(frame?.right, guides);
  const bottom = resolveValue(frame?.bottom, guides);
  let w = resolveValue(frame?.w, guides);
  let h = resolveValue(frame?.h, guides);
  const centerX = resolveValue(frame?.centerX, guides);
  const centerY = resolveValue(frame?.centerY, guides);

  if (w === undefined) {
    if (left !== undefined && right !== undefined) w = parent.w - left - right;
    else w = hint.w;
  }
  if (h === undefined) {
    if (top !== undefined && bottom !== undefined) h = parent.h - top - bottom;
    else h = hint.h;
  }

  w = Math.max(0, w ?? parent.w);
  h = Math.max(0, h ?? hint.h ?? parent.h);

  let x: number;
  if (left !== undefined) x = parent.x + left;
  else if (right !== undefined) x = parent.x + parent.w - right - w;
  else if (centerX !== undefined) x = parent.x + centerX - w / 2;
  else x = parent.x;

  let y: number;
  if (top !== undefined) y = parent.y + top;
  else if (bottom !== undefined) y = parent.y + parent.h - bottom - h;
  else if (centerY !== undefined) y = parent.y + centerY - h / 2;
  else y = parent.y;

  return { x, y, w, h };
}

function applyNodeBase<T extends LayoutElement>(element: T, node: SceneNode): T {
  return {
    ...element,
    ...(node.opacity != null ? { opacity: node.opacity } : {}),
    ...(node.borderRadius != null ? { borderRadius: node.borderRadius } : {}),
    ...(node.shadow ? { shadow: node.shadow } : {}),
    ...(node.effects ? { effects: node.effects } : {}),
    ...(node.border ? { border: node.border } : {}),
    ...(node.entrance ? { entrance: node.entrance } : {}),
    ...(node.animation ? { animation: node.animation } : {}),
    ...(node.clipPath ? { clipPath: node.clipPath } : {}),
    ...(node.transform ? { transform: node.transform } : {}),
    ...(node.cssStyle ? { cssStyle: node.cssStyle } : {}),
  };
}

function compileTextNode(node: SceneTextNode, parent: Rect, ctx: CompileContext): TextElement {
  const widthHint = resolveValue(node.frame?.w, ctx.guides)
    ?? (() => {
      const left = resolveValue(node.frame?.left ?? node.frame?.x, ctx.guides);
      const right = resolveValue(node.frame?.right, ctx.guides);
      if (left !== undefined && right !== undefined) return parent.w - left - right;
      return parent.w;
    })();
  const heightHint = estimateTextHeight(
    toPlainText(node.text),
    node.style.fontSize,
    node.style.lineHeight ?? 1.2,
    widthHint,
    node.style.fontWeight,
  );
  const rect = resolveFrame(node.frame, parent, ctx.guides, { w: widthHint, h: heightHint });

  return applyNodeBase<TextElement>({
    kind: "text",
    id: node.id,
    rect,
    text: node.text,
    style: node.style as TextElement["style"],
  }, node);
}

function compileShapeNode(node: SceneShapeNode, parent: Rect, ctx: CompileContext): ShapeElement {
  const rect = resolveFrame(node.frame, parent, ctx.guides);
  return applyNodeBase<ShapeElement>({
    kind: "shape",
    id: node.id,
    rect,
    shape: node.shape,
    style: node.style,
  }, node);
}

function compileImageNode(node: SceneImageNode, parent: Rect, ctx: CompileContext): ImageElement {
  const rect = resolveFrame(node.frame, parent, ctx.guides);
  return applyNodeBase<ImageElement>({
    kind: "image",
    id: node.id,
    rect,
    src: node.src,
    objectFit: node.objectFit ?? "cover",
    ...(node.clipCircle ? { clipCircle: true } : {}),
  }, node);
}

function compileIrNode(node: SceneIrNode, parent: Rect, ctx: CompileContext): LayoutElement {
  const sourceRect = node.element.rect;
  const rect = node.frame
    ? resolveFrame(node.frame, parent, ctx.guides, { w: sourceRect.w, h: sourceRect.h })
    : {
        x: parent.x + sourceRect.x,
        y: parent.y + sourceRect.y,
        w: sourceRect.w,
        h: sourceRect.h,
      };
  return fitLayoutElementToRect(node.element, rect);
}

function setElementRect<T extends LayoutElement>(element: T, rect: Rect): T {
  return { ...element, rect };
}

function scaleLayoutRect(rect: Rect, scaleX: number, scaleY: number): Rect {
  return {
    x: rect.x * scaleX,
    y: rect.y * scaleY,
    w: rect.w * scaleX,
    h: rect.h * scaleY,
  };
}

function fitLayoutElementToRect<T extends LayoutElement>(element: T, targetRect: Rect): T {
  const sourceRect = element.rect;
  const scaleX = sourceRect.w !== 0 ? targetRect.w / sourceRect.w : 1;
  const scaleY = sourceRect.h !== 0 ? targetRect.h / sourceRect.h : 1;

  if (element.kind === "group") {
    return {
      ...element,
      rect: targetRect,
      children: element.children.map((child) => fitLayoutElementToRect(child, scaleLayoutRect(child.rect, scaleX, scaleY))),
    } as T;
  }

  return {
    ...element,
    rect: targetRect,
  };
}

function parseTrack(track: number | string | undefined, total: number): number | undefined {
  if (track === undefined) return undefined;
  if (typeof track === "number") return track;
  if (track.endsWith("%")) return total * (Number(track.slice(0, -1)) / 100);
  const numeric = Number(track);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function compileStackChildren(children: SceneNode[], parent: Rect, ctx: CompileContext, layout: SceneStackLayout): LayoutElement[] {
  const gap = layout.gap ?? 0;
  const pad = resolvePadding(layout.padding);
  const inner: Rect = {
    x: pad.left,
    y: pad.top,
    w: Math.max(0, parent.w - pad.left - pad.right),
    h: Math.max(0, parent.h - pad.top - pad.bottom),
  };

  let cursorY = inner.y;
  return children.map((child) => {
    let compiled = compileSceneNode(child, { x: 0, y: 0, w: inner.w, h: inner.h }, ctx);
    let rect = { ...compiled.rect };

    if (!hasExplicitX(child.frame)) {
      if (layout.align === "center") rect.x = inner.x + (inner.w - rect.w) / 2;
      else if (layout.align === "end") rect.x = inner.x + inner.w - rect.w;
      else {
        rect.x = inner.x;
        if (layout.align === "stretch") rect.w = inner.w;
      }
    } else {
      rect.x += inner.x;
    }

    if (!hasExplicitY(child.frame)) {
      rect.y = cursorY;
    } else {
      rect.y += inner.y;
    }

    compiled = setElementRect(compiled, rect);
    cursorY = rect.y + rect.h + gap;
    return compiled;
  });
}

function compileRowChildren(children: SceneNode[], parent: Rect, ctx: CompileContext, layout: SceneRowLayout): LayoutElement[] {
  const gap = layout.gap ?? 0;
  const pad = resolvePadding(layout.padding);
  const inner: Rect = {
    x: pad.left,
    y: pad.top,
    w: Math.max(0, parent.w - pad.left - pad.right),
    h: Math.max(0, parent.h - pad.top - pad.bottom),
  };

  const tracks = layout.tracks?.length === children.length
    ? layout.tracks.map((track) => parseTrack(track, inner.w))
    : [];
  const totalExplicit = tracks.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const autoCount = children.length - tracks.filter((value) => value !== undefined).length;
  const autoTrack = autoCount > 0 ? (inner.w - totalExplicit - gap * (children.length - 1)) / autoCount : 0;

  let cursorX = inner.x;
  return children.map((child, i) => {
    const trackW = tracks[i] ?? autoTrack;
    let compiled = compileSceneNode(child, { x: 0, y: 0, w: trackW, h: inner.h }, ctx);
    let rect = { ...compiled.rect };

    if (!hasExplicitX(child.frame)) {
      rect.x = cursorX;
      if (trackW > 0 && !child.frame?.w && !child.frame?.left && !child.frame?.right) {
        rect.w = trackW;
      }
    } else {
      rect.x += cursorX;
    }

    if (!hasExplicitY(child.frame)) {
      if (layout.align === "center") rect.y = inner.y + (inner.h - rect.h) / 2;
      else if (layout.align === "end") rect.y = inner.y + inner.h - rect.h;
      else {
        rect.y = inner.y;
        if (layout.align === "stretch") rect.h = inner.h;
      }
    } else {
      rect.y += inner.y;
    }

    compiled = setElementRect(compiled, rect);
    cursorX += trackW + gap;
    return compiled;
  });
}

function compileGroupNode(node: SceneGroupNode, parent: Rect, ctx: CompileContext): GroupElement {
  const hint = !node.frame ? { w: parent.w, h: parent.h } : {};
  const rect = resolveFrame(node.frame, parent, ctx.guides, hint);

  let children: LayoutElement[];
  if (!node.layout) {
    children = node.children.map((child) => compileSceneNode(child, { x: 0, y: 0, w: rect.w, h: rect.h }, ctx));
  } else if (node.layout.type === "stack") {
    children = compileStackChildren(node.children, { x: 0, y: 0, w: rect.w, h: rect.h }, ctx, node.layout);
  } else {
    children = compileRowChildren(node.children, { x: 0, y: 0, w: rect.w, h: rect.h }, ctx, node.layout);
  }

  return applyNodeBase<GroupElement>({
    kind: "group",
    id: node.id,
    rect,
    children,
    ...(node.style ? { style: node.style } : {}),
    ...(node.clipContent ? { clipContent: true } : {}),
  }, node);
}

export function compileSceneNode(node: SceneNode, parent: Rect, ctx: CompileContext): LayoutElement {
  switch (node.kind) {
    case "text":
      return compileTextNode(node, parent, ctx);
    case "shape":
      return compileShapeNode(node, parent, ctx);
    case "image":
      return compileImageNode(node, parent, ctx);
    case "ir":
      return compileIrNode(node, parent, ctx);
    case "group":
      return compileGroupNode(node, parent, ctx);
  }
}

export function compileSceneChildren(
  children: SceneNode[],
  parent: Rect,
  guides?: SceneGuides,
): LayoutElement[] {
  const ctx: CompileContext = { guides };
  return children.map((child) => compileSceneNode(child, parent, ctx));
}
