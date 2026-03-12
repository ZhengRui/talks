import { CANVAS_H, CANVAS_W } from "@/lib/layout/helpers";
import type {
  BorderDef,
  BoxShadow,
  ElementEffects,
  LayoutSlide,
  ResolvedTheme,
  ShapeStyle,
} from "@/lib/layout/types";
import { compileSceneChildren } from "./solve";
import { normalizeSceneSlide } from "./normalize";
import type {
  FrameSpec,
  SceneAlign,
  SceneFitMode,
  SceneGuides,
  SceneGroupNode,
  SceneNode,
  ScenePadding,
  SceneRowLayout,
  SceneSize,
  SceneSlideData,
  SceneStackLayout,
  SceneValue,
} from "./types";

interface SceneViewport {
  x: number;
  y: number;
  w: number;
  h: number;
  scaleX: number;
  scaleY: number;
  visualScale: number;
}

function parseAlign(align: SceneAlign | undefined): {
  x: "left" | "center" | "right";
  y: "top" | "center" | "bottom";
} {
  switch (align ?? "center") {
    case "top-left":
      return { x: "left", y: "top" };
    case "top":
      return { x: "center", y: "top" };
    case "top-right":
      return { x: "right", y: "top" };
    case "left":
      return { x: "left", y: "center" };
    case "right":
      return { x: "right", y: "center" };
    case "bottom-left":
      return { x: "left", y: "bottom" };
    case "bottom":
      return { x: "center", y: "bottom" };
    case "bottom-right":
      return { x: "right", y: "bottom" };
    default:
      return { x: "center", y: "center" };
  }
}

function computeSceneViewport(
  sourceSize: SceneSize | undefined,
  fit: SceneFitMode | undefined,
  align: SceneAlign | undefined,
): SceneViewport {
  if (!sourceSize || sourceSize.w <= 0 || sourceSize.h <= 0) {
    return {
      x: 0,
      y: 0,
      w: CANVAS_W,
      h: CANVAS_H,
      scaleX: 1,
      scaleY: 1,
      visualScale: 1,
    };
  }

  const mode = fit ?? "contain";
  let scaleX = 1;
  let scaleY = 1;
  let w = sourceSize.w;
  let h = sourceSize.h;

  if (mode === "stretch") {
    scaleX = CANVAS_W / sourceSize.w;
    scaleY = CANVAS_H / sourceSize.h;
    w = CANVAS_W;
    h = CANVAS_H;
  } else if (mode === "contain" || mode === "cover") {
    const scale = mode === "cover"
      ? Math.max(CANVAS_W / sourceSize.w, CANVAS_H / sourceSize.h)
      : Math.min(CANVAS_W / sourceSize.w, CANVAS_H / sourceSize.h);
    scaleX = scale;
    scaleY = scale;
    w = sourceSize.w * scale;
    h = sourceSize.h * scale;
  }

  const anchor = parseAlign(align);
  const x = anchor.x === "left"
    ? 0
    : anchor.x === "right"
      ? CANVAS_W - w
      : (CANVAS_W - w) / 2;
  const y = anchor.y === "top"
    ? 0
    : anchor.y === "bottom"
      ? CANVAS_H - h
      : (CANVAS_H - h) / 2;

  return {
    x,
    y,
    w,
    h,
    scaleX,
    scaleY,
    visualScale: Math.min(scaleX, scaleY),
  };
}

function scaleSceneValue(value: SceneValue | undefined, scale: number): SceneValue | undefined {
  if (typeof value !== "number") return value;
  return value * scale;
}

function scaleFrame(frame: FrameSpec | undefined, viewport: SceneViewport): FrameSpec | undefined {
  if (!frame) return undefined;
  return {
    ...(frame.x !== undefined ? { x: scaleSceneValue(frame.x, viewport.scaleX) } : {}),
    ...(frame.y !== undefined ? { y: scaleSceneValue(frame.y, viewport.scaleY) } : {}),
    ...(frame.w !== undefined ? { w: scaleSceneValue(frame.w, viewport.scaleX) } : {}),
    ...(frame.h !== undefined ? { h: scaleSceneValue(frame.h, viewport.scaleY) } : {}),
    ...(frame.left !== undefined ? { left: scaleSceneValue(frame.left, viewport.scaleX) } : {}),
    ...(frame.top !== undefined ? { top: scaleSceneValue(frame.top, viewport.scaleY) } : {}),
    ...(frame.right !== undefined ? { right: scaleSceneValue(frame.right, viewport.scaleX) } : {}),
    ...(frame.bottom !== undefined ? { bottom: scaleSceneValue(frame.bottom, viewport.scaleY) } : {}),
    ...(frame.centerX !== undefined ? { centerX: scaleSceneValue(frame.centerX, viewport.scaleX) } : {}),
    ...(frame.centerY !== undefined ? { centerY: scaleSceneValue(frame.centerY, viewport.scaleY) } : {}),
  };
}

function scaleBorder(border: BorderDef | undefined, viewport: SceneViewport): BorderDef | undefined {
  if (!border) return undefined;
  return {
    ...border,
    width: border.width * viewport.visualScale,
  };
}

function scaleShadow(shadow: BoxShadow | undefined, viewport: SceneViewport): BoxShadow | undefined {
  if (!shadow) return undefined;
  return {
    ...shadow,
    offsetX: shadow.offsetX * viewport.scaleX,
    offsetY: shadow.offsetY * viewport.scaleY,
    blur: shadow.blur * viewport.visualScale,
    ...(shadow.spread != null ? { spread: shadow.spread * viewport.visualScale } : {}),
  };
}

function scaleEffects(effects: ElementEffects | undefined, viewport: SceneViewport): ElementEffects | undefined {
  if (!effects) return undefined;
  return {
    ...(effects.glow ? {
      glow: {
        ...effects.glow,
        radius: effects.glow.radius * viewport.visualScale,
      },
    } : {}),
    ...(effects.softEdge != null ? { softEdge: effects.softEdge * viewport.visualScale } : {}),
    ...(effects.blur != null ? { blur: effects.blur * viewport.visualScale } : {}),
  };
}

function scaleShapeStyle(style: ShapeStyle | undefined, viewport: SceneViewport): ShapeStyle | undefined {
  if (!style) return undefined;
  return {
    ...style,
    ...(style.strokeWidth != null ? { strokeWidth: style.strokeWidth * viewport.visualScale } : {}),
  };
}

function scalePadding(padding: ScenePadding | undefined, viewport: SceneViewport): ScenePadding | undefined {
  if (padding === undefined) return undefined;
  if (typeof padding === "number") return padding * viewport.visualScale;
  return [
    padding[0] * viewport.scaleY,
    padding[1] * viewport.scaleX,
    padding[2] * viewport.scaleY,
    padding[3] * viewport.scaleX,
  ];
}

function scaleTrack(track: number | string, viewport: SceneViewport): number | string {
  if (typeof track === "number") return track * viewport.scaleX;
  if (track.endsWith("%")) return track;
  const numeric = Number(track);
  return Number.isFinite(numeric) ? numeric * viewport.scaleX : track;
}

function scaleLayout(
  layout: SceneStackLayout | SceneRowLayout | undefined,
  viewport: SceneViewport,
): SceneStackLayout | SceneRowLayout | undefined {
  if (!layout) return undefined;
  if (layout.type === "stack") {
    return {
      ...layout,
      ...(layout.gap != null ? { gap: layout.gap * viewport.scaleY } : {}),
      ...(layout.padding != null ? { padding: scalePadding(layout.padding, viewport) } : {}),
    };
  }

  return {
    ...layout,
    ...(layout.gap != null ? { gap: layout.gap * viewport.scaleX } : {}),
    ...(layout.padding != null ? { padding: scalePadding(layout.padding, viewport) } : {}),
    ...(layout.tracks ? { tracks: layout.tracks.map((track) => scaleTrack(track, viewport)) } : {}),
  };
}

function scaleGuides(guides: SceneGuides | undefined, viewport: SceneViewport): SceneGuides | undefined {
  if (!guides) return undefined;
  return {
    ...(guides.x ? {
      x: Object.fromEntries(
        Object.entries(guides.x).map(([key, value]) => [key, value * viewport.scaleX]),
      ),
    } : {}),
    ...(guides.y ? {
      y: Object.fromEntries(
        Object.entries(guides.y).map(([key, value]) => [key, value * viewport.scaleY]),
      ),
    } : {}),
  };
}

function scaleSceneNode(node: SceneNode, viewport: SceneViewport): SceneNode {
  const base = {
    ...node,
    ...(node.frame ? { frame: scaleFrame(node.frame, viewport) } : {}),
    ...(node.borderRadius != null ? { borderRadius: node.borderRadius * viewport.visualScale } : {}),
    ...(node.shadow ? { shadow: scaleShadow(node.shadow, viewport) } : {}),
    ...(node.effects ? { effects: scaleEffects(node.effects, viewport) } : {}),
    ...(node.border ? { border: scaleBorder(node.border, viewport) } : {}),
  };

  switch (node.kind) {
    case "text":
      return {
        ...base,
        style: {
          ...node.style,
          fontSize: node.style.fontSize * viewport.visualScale,
          ...(node.style.letterSpacing != null ? { letterSpacing: node.style.letterSpacing * viewport.visualScale } : {}),
        },
      };
    case "shape":
      return {
        ...base,
        style: scaleShapeStyle(node.style, viewport) ?? node.style,
      };
    case "image":
      return base;
    case "group":
      return {
        ...base,
        ...(node.style ? { style: scaleShapeStyle(node.style, viewport) } : {}),
        ...(node.layout ? { layout: scaleLayout(node.layout, viewport) } : {}),
        children: node.children.map((child) => scaleSceneNode(child, viewport)),
      } satisfies SceneGroupNode;
  }
}

export function compileSceneSlide(
  slide: SceneSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const normalized = normalizeSceneSlide(slide, theme, imageBase);
  const viewport = computeSceneViewport(normalized.sourceSize, normalized.fit, normalized.align);
  const children = normalized.children.map((child) => scaleSceneNode(child, viewport));
  const guides = scaleGuides(normalized.guides, viewport);

  return {
    width: CANVAS_W,
    height: CANVAS_H,
    background: normalized.background,
    ...(normalized.backgroundImage ? { backgroundImage: normalized.backgroundImage } : {}),
    ...(normalized.overlay ? { overlay: normalized.overlay } : {}),
    elements: compileSceneChildren(
      children,
      { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h },
      guides,
    ),
  };
}
