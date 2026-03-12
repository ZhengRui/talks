import type {
  BorderDef,
  BoxShadow,
  ElementEffects,
  EntranceDef,
  LayoutElement,
  RichText,
  ShapeStyle,
  TransformDef,
} from "@/lib/layout/types";

export type SceneValue = number | string;

export interface FrameSpec {
  x?: SceneValue;
  y?: SceneValue;
  w?: SceneValue;
  h?: SceneValue;
  left?: SceneValue;
  top?: SceneValue;
  right?: SceneValue;
  bottom?: SceneValue;
  centerX?: SceneValue;
  centerY?: SceneValue;
}

export interface SceneGuides {
  x?: Record<string, number>;
  y?: Record<string, number>;
}

export interface SceneSize {
  w: number;
  h: number;
}

export type SceneFitMode = "contain" | "cover" | "stretch" | "none";

export type SceneAlign =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export interface SceneTextStyle {
  fontFamily?: string;
  fontSize: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  color?: string;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  textShadow?: string;
  letterSpacing?: number;
  textTransform?: "uppercase" | "lowercase" | "none";
  verticalAlign?: "top" | "middle" | "bottom";
  highlightColor?: string;
}

export interface ScenePreset {
  frame?: FrameSpec;
  opacity?: number;
  borderRadius?: number;
  shadow?: BoxShadow;
  effects?: ElementEffects;
  border?: BorderDef;
  entrance?: EntranceDef;
  animation?: string;
  clipPath?: string;
  transform?: TransformDef;
  cssStyle?: Record<string, string>;
  style?: SceneTextStyle | ShapeStyle;
  objectFit?: "cover" | "contain";
  clipCircle?: boolean;
  clipContent?: boolean;
  layout?: SceneLayout;
}

export interface SceneNodeBase {
  id: string;
  preset?: string;
  frame?: FrameSpec;
  opacity?: number;
  borderRadius?: number;
  shadow?: BoxShadow;
  effects?: ElementEffects;
  border?: BorderDef;
  entrance?: EntranceDef;
  animation?: string;
  clipPath?: string;
  transform?: TransformDef;
  cssStyle?: Record<string, string>;
}

export interface SceneTextNode extends SceneNodeBase {
  kind: "text";
  text: RichText;
  style: SceneTextStyle;
}

export interface SceneShapeNode extends SceneNodeBase {
  kind: "shape";
  shape: "rect" | "circle" | "line" | "pill" | "arrow" | "triangle" | "chevron" | "diamond" | "star" | "callout";
  style: ShapeStyle;
}

export interface SceneImageNode extends SceneNodeBase {
  kind: "image";
  src: string;
  objectFit?: "cover" | "contain";
  clipCircle?: boolean;
}

export interface SceneIrNode extends SceneNodeBase {
  kind: "ir";
  element: LayoutElement;
}

export type ScenePadding = number | [number, number, number, number];

export interface SceneStackLayout {
  type: "stack";
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  padding?: ScenePadding;
}

export interface SceneRowLayout {
  type: "row";
  gap?: number;
  tracks?: (number | string)[];
  align?: "start" | "center" | "end" | "stretch";
  padding?: ScenePadding;
}

export type SceneLayout = SceneStackLayout | SceneRowLayout;

export interface SceneGroupNode extends SceneNodeBase {
  kind: "group";
  children: SceneNode[];
  style?: ShapeStyle;
  clipContent?: boolean;
  layout?: SceneLayout;
}

export type SceneNode =
  | SceneTextNode
  | SceneShapeNode
  | SceneImageNode
  | SceneIrNode
  | SceneGroupNode;

export type SceneBackgroundSpec =
  | string
  | { type: "solid"; color: string }
  | { type: "image"; src: string; overlay?: "dark" | "light" | "none" | string };

export interface SceneSlideData {
  mode: "scene";
  background?: SceneBackgroundSpec;
  guides?: SceneGuides;
  presets?: Record<string, ScenePreset>;
  sourceSize?: SceneSize;
  fit?: SceneFitMode;
  align?: SceneAlign;
  children: SceneNode[];
}
