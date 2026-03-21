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
import {
  SCENE_ANCHOR_PROPERTIES,
  type SceneAnchorKey,
  type FrameSpec,
  type SceneGridLayout,
  type SceneGroupNode,
  type SceneGuides,
  type SceneImageNode,
  type SceneIrNode,
  type SceneNode,
  type ScenePadding,
  type SceneRowLayout,
  type SceneReferenceValue,
  type SceneShapeNode,
  type SceneStackLayout,
  type SceneTextNode,
  type SceneValue,
} from "./types";

interface CompileContext {
  guides?: SceneGuides;
  anchors: Map<string, Rect>;
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
    const resolved = guides?.x?.[value.slice(3)];
    if (resolved === undefined) {
      throw new Error(`[scene] Unknown x guide "${value}"`);
    }
    return resolved;
  }
  if (value.startsWith("@y.")) {
    const resolved = guides?.y?.[value.slice(3)];
    if (resolved === undefined) {
      throw new Error(`[scene] Unknown y guide "${value}"`);
    }
    return resolved;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function resolveAnchorValue(rect: Rect, anchor: SceneAnchorKey): number {
  switch (anchor) {
    case "left":
    case "x":
      return rect.x;
    case "right":
      return rect.x + rect.w;
    case "centerX":
      return rect.x + rect.w / 2;
    case "w":
    case "width":
      return rect.w;
    case "top":
    case "y":
      return rect.y;
    case "bottom":
      return rect.y + rect.h;
    case "centerY":
      return rect.y + rect.h / 2;
    case "h":
    case "height":
      return rect.h;
  }
}

const ANCHOR_REGEX = new RegExp(
  `^@([A-Za-z0-9_-]+)\\.(${SCENE_ANCHOR_PROPERTIES.join("|")})$`,
);

function resolveAnchorReference(value: string, ctx: CompileContext): number | undefined {
  const match = value.match(ANCHOR_REGEX);
  if (!match) return undefined;

  const [, nodeId, anchor] = match;
  const rect = ctx.anchors.get(nodeId);
  if (!rect) {
    throw new Error(
      `[scene] Unknown anchor reference "${value}". Anchor refs can only target previously compiled nodes in the same container.`,
    );
  }
  return resolveAnchorValue(rect, anchor as SceneAnchorKey);
}

function resolveReferenceValue(value: string, ctx: CompileContext): number | undefined {
  const guide = resolveGuide(value, ctx.guides);
  if (guide !== undefined) return guide;
  const anchor = resolveAnchorReference(value, ctx);
  if (anchor !== undefined) return anchor;
  if (value.startsWith("@")) {
    throw new Error(`[scene] Invalid guide or anchor reference "${value}"`);
  }
  return undefined;
}

function resolveSceneReference(ref: SceneReferenceValue, ctx: CompileContext): number | undefined {
  const base = resolveReferenceValue(ref.ref, ctx);
  if (base === undefined) return undefined;
  return base + (ref.offset ?? 0);
}

function resolveValue(value: SceneValue | undefined, ctx: CompileContext): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") return resolveReferenceValue(value, ctx);
  if (value && typeof value === "object") return resolveSceneReference(value, ctx);
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
  ctx: CompileContext,
  hint: SizeHint = {},
): Rect {
  const left = resolveValue(frame?.left ?? frame?.x, ctx);
  const top = resolveValue(frame?.top ?? frame?.y, ctx);
  const right = resolveValue(frame?.right, ctx);
  const bottom = resolveValue(frame?.bottom, ctx);
  let w = resolveValue(frame?.w, ctx);
  let h = resolveValue(frame?.h, ctx);
  const centerX = resolveValue(frame?.centerX, ctx);
  const centerY = resolveValue(frame?.centerY, ctx);

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

function registerAnchorRect(ctx: CompileContext, element: LayoutElement, parent: Rect): void {
  ctx.anchors.set(element.id, {
    x: element.rect.x - parent.x,
    y: element.rect.y - parent.y,
    w: element.rect.w,
    h: element.rect.h,
  });
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
  const widthHint = resolveValue(node.frame?.w, ctx)
    ?? (() => {
      const left = resolveValue(node.frame?.left ?? node.frame?.x, ctx);
      const right = resolveValue(node.frame?.right, ctx);
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
  const rect = resolveFrame(node.frame, parent, ctx, { w: widthHint, h: heightHint });

  return applyNodeBase<TextElement>({
    kind: "text",
    id: node.id,
    rect,
    text: node.text,
    style: node.style as TextElement["style"],
  }, node);
}

function compileShapeNode(node: SceneShapeNode, parent: Rect, ctx: CompileContext): ShapeElement {
  const rect = resolveFrame(node.frame, parent, ctx);
  return applyNodeBase<ShapeElement>({
    kind: "shape",
    id: node.id,
    rect,
    shape: node.shape,
    style: node.style,
  }, node);
}

function compileImageNode(node: SceneImageNode, parent: Rect, ctx: CompileContext): ImageElement {
  const rect = resolveFrame(node.frame, parent, ctx);
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
    ? resolveFrame(node.frame, parent, ctx, { w: sourceRect.w, h: sourceRect.h })
    : {
        x: parent.x + sourceRect.x,
        y: parent.y + sourceRect.y,
        w: sourceRect.w,
        h: sourceRect.h,
      };
  return applyNodeBase(fitLayoutElementToRect(node.element, rect), node);
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

function resolveGridTracks(
  columns: number,
  innerWidth: number,
  tracks: (number | string)[] | undefined,
  columnGap: number,
): number[] {
  const parsedTracks = tracks?.length === columns
    ? tracks.map((track) => parseTrack(track, innerWidth))
    : Array.from({ length: columns }, () => undefined);
  const totalExplicit = parsedTracks.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const autoCount = parsedTracks.filter((value) => value === undefined).length;
  const autoTrack = autoCount > 0
    ? (innerWidth - totalExplicit - columnGap * Math.max(0, columns - 1)) / autoCount
    : 0;

  return parsedTracks.map((track) => Math.max(0, track ?? autoTrack));
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
  const elements: LayoutElement[] = [];
  const autoFlowChildren: LayoutElement[] = [];
  const shouldJustify = layout.justify && children.every((child) => !hasExplicitY(child.frame));

  for (const child of children) {
    let compiled = compileSceneNode(child, { x: 0, y: 0, w: inner.w, h: inner.h }, ctx);
    const rect = { ...compiled.rect };

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
    registerAnchorRect(ctx, compiled, parent);
    elements.push(compiled);
    if (shouldJustify) autoFlowChildren.push(compiled);
  }

  if (shouldJustify && autoFlowChildren.length > 0) {
    const totalHeight = cursorY - inner.y - gap;
    const shiftY = layout.justify === "center"
      ? (inner.h - totalHeight) / 2
      : layout.justify === "end"
        ? inner.h - totalHeight
        : 0;

    if (shiftY !== 0) {
      for (let index = 0; index < elements.length; index += 1) {
        const element = elements[index];
        const shifted = setElementRect(element, {
          ...element.rect,
          y: element.rect.y + shiftY,
        });
        elements[index] = shifted;
      }
      ctx.anchors.clear();
      for (const element of elements) {
        registerAnchorRect(ctx, element, parent);
      }
    }
  }
  return elements;
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
  const elements: LayoutElement[] = [];
  for (const [i, child] of children.entries()) {
    const trackW = tracks[i] ?? autoTrack;
    let compiled = compileSceneNode(child, { x: 0, y: 0, w: trackW, h: inner.h }, ctx);
    const rect = { ...compiled.rect };

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
    registerAnchorRect(ctx, compiled, parent);
    elements.push(compiled);
  }
  return elements;
}

function compileGridChildren(children: SceneNode[], parent: Rect, ctx: CompileContext, layout: SceneGridLayout): LayoutElement[] {
  if (!Number.isFinite(layout.columns) || layout.columns <= 0) {
    throw new Error(`[scene] Grid layout requires columns > 0`);
  }

  const columnGap = layout.columnGap ?? 0;
  const rowGap = layout.rowGap ?? 0;
  const pad = resolvePadding(layout.padding);
  const inner: Rect = {
    x: pad.left,
    y: pad.top,
    w: Math.max(0, parent.w - pad.left - pad.right),
    h: Math.max(0, parent.h - pad.top - pad.bottom),
  };

  const trackWidths = resolveGridTracks(layout.columns, inner.w, layout.tracks, columnGap);
  const elements: LayoutElement[] = [];
  let cursorY = inner.y;

  for (let rowStart = 0; rowStart < children.length; rowStart += layout.columns) {
    const rowChildren = children.slice(rowStart, rowStart + layout.columns);
    const rowItems: Array<{
      child: SceneNode;
      compiled: LayoutElement;
      rect: Rect;
      cellX: number;
      cellW: number;
    }> = [];

    // Pre-compute row height from explicit child frame.h values (Option C).
    // When all children in a row declare frame.h, use the max as the compile
    // height so that bottom/centerY constraints resolve against the cell, not
    // the full grid container.
    let precomputedRowH: number | undefined;
    if (layout.rowHeight == null) {
      const explicitHeights = rowChildren.map(c => resolveValue(c.frame?.h, ctx));
      if (explicitHeights.every((h): h is number => h !== undefined)) {
        precomputedRowH = Math.max(...explicitHeights);
      }
    }
    const compileH = layout.rowHeight ?? precomputedRowH ?? inner.h;

    let cursorX = inner.x;
    for (const [index, child] of rowChildren.entries()) {
      const cellW = trackWidths[index] ?? 0;
      const compiled = compileSceneNode(
        child,
        { x: 0, y: 0, w: cellW, h: compileH },
        ctx,
      );
      rowItems.push({
        child,
        compiled,
        rect: { ...compiled.rect },
        cellX: cursorX,
        cellW,
      });
      cursorX += cellW + columnGap;
    }

    const rowHeight = layout.rowHeight
      ?? precomputedRowH
      ?? rowItems.reduce((max, item) => Math.max(max, item.rect.y + item.rect.h), 0);

    for (const item of rowItems) {
      const { child, cellX, cellW } = item;
      const { rect } = item;
      let { compiled } = item;

      if (!hasExplicitX(child.frame)) {
        rect.x = cellX;
        if (cellW > 0 && !child.frame?.w && !child.frame?.left && !child.frame?.right) {
          rect.w = cellW;
        }
      } else {
        rect.x += cellX;
      }

      if (!hasExplicitY(child.frame)) {
        rect.y = cursorY;
        if (layout.rowHeight != null && !child.frame?.h && !child.frame?.top && !child.frame?.bottom) {
          rect.h = layout.rowHeight;
        }
      } else {
        rect.y += cursorY;
      }

      compiled = setElementRect(compiled, rect);
      registerAnchorRect(ctx, compiled, parent);
      elements.push(compiled);
    }

    cursorY += rowHeight + rowGap;
  }

  return elements;
}

function compileGroupNode(node: SceneGroupNode, parent: Rect, ctx: CompileContext): GroupElement {
  const hint = !node.frame ? { w: parent.w, h: parent.h } : {};
  const rect = resolveFrame(node.frame, parent, ctx, hint);
  const groupCtx: CompileContext = { guides: ctx.guides, anchors: new Map() };

  let children: LayoutElement[];
  if (!node.layout) {
    children = compileSceneChildren(node.children, { x: 0, y: 0, w: rect.w, h: rect.h }, ctx.guides, groupCtx);
  } else if (node.layout.type === "stack") {
    children = compileStackChildren(node.children, { x: 0, y: 0, w: rect.w, h: rect.h }, groupCtx, node.layout);
  } else if (node.layout.type === "grid") {
    children = compileGridChildren(node.children, { x: 0, y: 0, w: rect.w, h: rect.h }, groupCtx, node.layout);
  } else {
    children = compileRowChildren(node.children, { x: 0, y: 0, w: rect.w, h: rect.h }, groupCtx, node.layout);
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
    case "block":
      throw new Error(
        `[scene] Block node "${node.id}" must be expanded before compilation. ` +
        `Call expandBlockNodes() before compileSceneSlide().`,
      );
  }
}

export function compileSceneChildren(
  children: SceneNode[],
  parent: Rect,
  guides?: SceneGuides,
  ctx: CompileContext = { guides, anchors: new Map() },
): LayoutElement[] {
  const elements: LayoutElement[] = [];
  for (const child of children) {
    const compiled = compileSceneNode(child, parent, ctx);
    registerAnchorRect(ctx, compiled, parent);
    elements.push(compiled);
  }
  return elements;
}
