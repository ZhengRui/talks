import { CANVAS_H, CANVAS_W } from "@/lib/layout/helpers";
import type {
  BorderDef,
  BoxShadow,
  ElementEffects,
  GroupElement,
  LayoutSlide,
  ListElement,
  LayoutElement,
  ResolvedTheme,
  ShapeStyle,
  TableElement,
  TextElement,
  TextRun,
  TextStyle,
} from "@/lib/layout/types";
import { compileSceneChildren } from "./solve";
import { normalizeSceneSlide } from "./normalize";
import type {
  FrameSpec,
  SceneAlign,
  SceneFitMode,
  SceneGuides,
  SceneGroupNode,
  SceneIrNode,
  SceneNode,
  ScenePadding,
  SceneReferenceValue,
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
  if (typeof value === "number") return value * scale;
  if (value && typeof value === "object") {
    return {
      ...value,
      ...(value.offset != null ? { offset: value.offset * scale } : {}),
    } satisfies SceneReferenceValue;
  }
  return value;
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

function scaleTextStyle(style: TextStyle, viewport: SceneViewport): TextStyle {
  return {
    ...style,
    fontSize: style.fontSize * viewport.visualScale,
    ...(style.letterSpacing != null ? { letterSpacing: style.letterSpacing * viewport.visualScale } : {}),
  };
}

function scaleRichTextRuns(text: TextElement["text"], viewport: SceneViewport): TextElement["text"] {
  if (typeof text === "string") return text;
  return text.map((run: TextRun) => ({
    ...run,
    ...(run.fontSize != null ? { fontSize: run.fontSize * viewport.visualScale } : {}),
    ...(run.letterSpacing != null ? { letterSpacing: run.letterSpacing * viewport.visualScale } : {}),
  }));
}

function scaleRect(rect: LayoutElement["rect"], scaleX: number, scaleY: number): LayoutElement["rect"] {
  return {
    x: rect.x * scaleX,
    y: rect.y * scaleY,
    w: rect.w * scaleX,
    h: rect.h * scaleY,
  };
}

function scaleIrLayoutMode(
  layout: GroupElement["layout"] | undefined,
  scaleX: number,
  scaleY: number,
): GroupElement["layout"] | undefined {
  if (!layout) return undefined;
  if (layout.type === "flex") {
    return {
      ...layout,
      ...(layout.gap != null ? { gap: layout.direction === "row" ? layout.gap * scaleX : layout.gap * scaleY } : {}),
      ...(layout.padding != null ? {
        padding: typeof layout.padding === "number"
          ? layout.padding * Math.min(scaleX, scaleY)
          : [
              layout.padding[0] * scaleY,
              layout.padding[1] * scaleX,
              layout.padding[2] * scaleY,
              layout.padding[3] * scaleX,
            ],
      } : {}),
    };
  }

  return {
    ...layout,
    ...(layout.gap != null ? { gap: layout.gap * Math.min(scaleX, scaleY) } : {}),
    ...(layout.rowGap != null ? { rowGap: layout.rowGap * scaleY } : {}),
    ...(layout.columnGap != null ? { columnGap: layout.columnGap * scaleX } : {}),
    ...(layout.padding != null ? {
      padding: typeof layout.padding === "number"
        ? layout.padding * Math.min(scaleX, scaleY)
        : [
            layout.padding[0] * scaleY,
            layout.padding[1] * scaleX,
            layout.padding[2] * scaleY,
            layout.padding[3] * scaleX,
          ],
    } : {}),
  };
}

function scaleLayoutElement(
  element: LayoutElement,
  scaleX: number,
  scaleY: number,
): LayoutElement {
  const visualScale = Math.min(scaleX, scaleY);
  const base = {
    ...element,
    rect: scaleRect(element.rect, scaleX, scaleY),
    ...(element.borderRadius != null ? { borderRadius: element.borderRadius * visualScale } : {}),
    ...(element.shadow ? {
      shadow: {
        ...element.shadow,
        offsetX: element.shadow.offsetX * scaleX,
        offsetY: element.shadow.offsetY * scaleY,
        blur: element.shadow.blur * visualScale,
        ...(element.shadow.spread != null ? { spread: element.shadow.spread * visualScale } : {}),
      },
    } : {}),
    ...(element.effects ? {
      effects: {
        ...(element.effects.glow ? {
          glow: {
            ...element.effects.glow,
            radius: element.effects.glow.radius * visualScale,
          },
        } : {}),
        ...(element.effects.softEdge != null ? { softEdge: element.effects.softEdge * visualScale } : {}),
        ...(element.effects.blur != null ? { blur: element.effects.blur * visualScale } : {}),
      },
    } : {}),
    ...(element.border ? {
      border: {
        ...element.border,
        width: element.border.width * visualScale,
      },
    } : {}),
  };

  switch (element.kind) {
    case "text":
      return {
        ...base,
        text: scaleRichTextRuns(element.text, { x: 0, y: 0, w: 0, h: 0, scaleX, scaleY, visualScale }),
        style: scaleTextStyle(element.style, { x: 0, y: 0, w: 0, h: 0, scaleX, scaleY, visualScale }),
      } as TextElement;
    case "shape":
      return {
        ...base,
        style: scaleShapeStyle(element.style, { x: 0, y: 0, w: 0, h: 0, scaleX, scaleY, visualScale }) ?? element.style,
      };
    case "image":
      return base;
    case "group":
      return {
        ...base,
        ...(element.style ? { style: scaleShapeStyle(element.style, { x: 0, y: 0, w: 0, h: 0, scaleX, scaleY, visualScale }) } : {}),
        ...(element.layout ? { layout: scaleIrLayoutMode(element.layout, scaleX, scaleY) } : {}),
        children: element.children.map((child) => scaleLayoutElement(child, scaleX, scaleY)),
      };
    case "code":
      return {
        ...base,
        style: {
          ...element.style,
          fontSize: element.style.fontSize * visualScale,
          borderRadius: element.style.borderRadius * visualScale,
          padding: element.style.padding * visualScale,
        },
      };
    case "table":
      return {
        ...base,
        headerStyle: {
          ...scaleTextStyle(element.headerStyle, { x: 0, y: 0, w: 0, h: 0, scaleX, scaleY, visualScale }),
          background: element.headerStyle.background,
        },
        cellStyle: {
          ...scaleTextStyle(element.cellStyle, { x: 0, y: 0, w: 0, h: 0, scaleX, scaleY, visualScale }),
          background: element.cellStyle.background,
          altBackground: element.cellStyle.altBackground,
        },
      } as TableElement;
    case "list":
      return {
        ...base,
        itemStyle: scaleTextStyle(element.itemStyle, { x: 0, y: 0, w: 0, h: 0, scaleX, scaleY, visualScale }),
        ...(element.itemSpacing != null ? { itemSpacing: element.itemSpacing * scaleY } : {}),
      } as ListElement;
    case "video":
    case "iframe":
      return base;
  }
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
    case "ir":
      return {
        ...base,
        element: scaleLayoutElement(node.element, viewport.scaleX, viewport.scaleY),
      } satisfies SceneIrNode;
    case "group":
      return {
        ...base,
        ...(node.style ? { style: scaleShapeStyle(node.style, viewport) } : {}),
        ...(node.layout ? { layout: scaleLayout(node.layout, viewport) } : {}),
        children: node.children.map((child) => scaleSceneNode(child, viewport)),
      } satisfies SceneGroupNode;
  }
}

function validateSceneNodeIds(children: SceneNode[]): void {
  const seen = new Set<string>();

  function visit(node: SceneNode): void {
    if (seen.has(node.id)) {
      throw new Error(`[scene] Duplicate node id "${node.id}"`);
    }
    seen.add(node.id);

    if (node.kind === "group") {
      node.children.forEach(visit);
    }
  }

  children.forEach(visit);
}

export function compileSceneSlide(
  slide: SceneSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  validateSceneNodeIds(slide.children);
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
