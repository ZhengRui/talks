import type {
  CodeElement,
  IframeElement,
  LayoutElement,
  LayoutPresentation,
  LayoutSlide,
  ListElement,
  TableElement,
  VideoElement,
} from "@/lib/layout/types";
import type { SceneNode, SceneSlideData } from "@/lib/scene/types";

export interface ImportLayoutOptions {
  rewriteAssetPath?: (path: string) => string;
  idPrefix?: string;
}

function rewriteAssetPath(path: string, options?: ImportLayoutOptions): string {
  return options?.rewriteAssetPath ? options.rewriteAssetPath(path) : path;
}

function prefixId(id: string, options?: ImportLayoutOptions): string {
  return options?.idPrefix ? `${options.idPrefix}${id}` : id;
}

function toSceneBase(element: LayoutElement) {
  return {
    id: element.id,
    frame: { ...element.rect },
    ...(element.opacity != null ? { opacity: element.opacity } : {}),
    ...(element.borderRadius != null ? { borderRadius: element.borderRadius } : {}),
    ...(element.shadow ? { shadow: element.shadow } : {}),
    ...(element.effects ? { effects: element.effects } : {}),
    ...(element.border ? { border: element.border } : {}),
    ...(element.entrance ? { entrance: element.entrance } : {}),
    ...(element.animation ? { animation: element.animation } : {}),
    ...(element.clipPath ? { clipPath: element.clipPath } : {}),
    ...(element.transform ? { transform: element.transform } : {}),
    ...(element.cssStyle ? { cssStyle: element.cssStyle } : {}),
  };
}

function rewriteIrElementAssetPaths(
  element:
    | CodeElement
    | TableElement
    | ListElement
    | VideoElement
    | IframeElement,
  options?: ImportLayoutOptions,
): LayoutElement {
  if (element.kind === "video") {
    return {
      ...element,
      src: rewriteAssetPath(element.src, options),
      ...(element.poster ? { poster: rewriteAssetPath(element.poster, options) } : {}),
    };
  }

  if (element.kind === "iframe") {
    return {
      ...element,
      src: rewriteAssetPath(element.src, options),
    };
  }

  return element;
}

export function importLayoutElement(
  element: LayoutElement,
  options?: ImportLayoutOptions,
): SceneNode {
  const base = {
    ...toSceneBase(element),
    id: prefixId(element.id, options),
  };

  switch (element.kind) {
    case "text":
      return {
        kind: "text",
        ...base,
        text: element.text,
        style: element.style,
      };
    case "shape":
      return {
        kind: "shape",
        ...base,
        shape: element.shape,
        style: element.style,
      };
    case "image":
      return {
        kind: "image",
        ...base,
        src: rewriteAssetPath(element.src, options),
        objectFit: element.objectFit,
        ...(element.clipCircle ? { clipCircle: element.clipCircle } : {}),
      };
    case "group":
      return {
        kind: "group",
        ...base,
        ...(element.style ? { style: element.style } : {}),
        ...(element.clipContent != null ? { clipContent: element.clipContent } : {}),
        children: element.children.map((child) => importLayoutElement(child, options)),
      };
    case "code":
    case "table":
    case "list":
    case "video":
    case "iframe":
      return {
        kind: "ir",
        ...base,
        element: rewriteIrElementAssetPaths(element, options),
      };
  }
}

export function importLayoutSlide(
  slide: LayoutSlide,
  options?: ImportLayoutOptions,
): SceneSlideData {
  const children: SceneNode[] = [];

  if (slide.backgroundImage) {
    children.push({
      kind: "image",
      id: prefixId("bg-image", options),
      frame: { x: 0, y: 0, w: slide.width, h: slide.height },
      src: rewriteAssetPath(slide.backgroundImage, options),
      objectFit: "cover",
    });
  }

  if (slide.overlay && slide.overlay !== "none") {
    children.push({
      kind: "shape",
      id: prefixId("bg-overlay", options),
      frame: { x: 0, y: 0, w: slide.width, h: slide.height },
      shape: "rect",
      style: { fill: slide.overlay },
    });
  }

  children.push(...slide.elements.map((element) => importLayoutElement(element, options)));

  return {
    mode: "scene",
    background: slide.background,
    children,
  };
}

export function importLayoutPresentation(
  presentation: LayoutPresentation,
  options?: ImportLayoutOptions,
): LayoutPresentation & { slides: SceneSlideData[] } {
  return {
    title: presentation.title,
    ...(presentation.author ? { author: presentation.author } : {}),
    slides: presentation.slides.map((slide) => importLayoutSlide(slide, options)),
  };
}
