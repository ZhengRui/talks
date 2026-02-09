// Layout model types — intermediate representation for both web and PPTX rendering.
// Canvas is always 1920×1080. All coordinates/sizes are in px.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GradientDef {
  type: "linear";
  angle: number;
  stops: { color: string; position: number }[];
}

export interface BoxShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread?: number;
  color: string;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: "normal" | "italic";
  color: string;
  lineHeight: number;
  textAlign?: "left" | "center" | "right";
  textShadow?: string;
  letterSpacing?: number;
  textTransform?: "uppercase" | "lowercase" | "none";
  verticalAlign?: "top" | "middle" | "bottom";
}

/** OOXML pattern fill presets supported for both web and PPTX. */
export type PatternPreset =
  | "narHorz"    // scan lines (narrow horizontal)
  | "narVert"    // narrow vertical lines
  | "smGrid"     // small grid
  | "lgGrid"     // large grid
  | "dotGrid"    // dot grid
  | "pct5"       // 5% dots (subtle halftone)
  | "pct10"      // 10% dots
  | "dnDiag"     // diagonal lines (down)
  | "upDiag"     // diagonal lines (up)
  | "diagCross"; // diagonal crosshatch

export interface PatternFillDef {
  preset: PatternPreset;
  fgColor: string;
  fgOpacity?: number; // 0-1, default 1
  bgColor?: string;   // default: transparent
  bgOpacity?: number; // 0-1, default 0
}

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  opacity?: number;
  gradient?: GradientDef;
  patternFill?: PatternFillDef;
  shadow?: BoxShadow;
}

// --- Effects (glow, softEdge, blur) — applied via OOXML post-processing + CSS ---

export interface GlowEffect {
  color: string;
  radius: number;   // blur radius in px (mapped to EMU for OOXML)
  opacity?: number;  // 0-1, default 0.6
}

export interface ElementEffects {
  glow?: GlowEffect;
  softEdge?: number; // feather radius in px
  blur?: number;     // Gaussian blur radius in px
}

export interface BorderDef {
  width: number;
  color: string;
  sides?: ("top" | "right" | "bottom" | "left")[];
}

export type AnimationType =
  | "fade-up"
  | "fade-in"
  | "slide-left"
  | "slide-right"
  | "scale-up"
  | "count-up"
  | "none";

export interface AnimationDef {
  type: AnimationType;
  delay: number;
  duration: number;
}

// --- Element types (discriminated union) ---

export interface TextElement {
  kind: "text";
  id: string;
  rect: Rect;
  text: string;
  style: TextStyle;
  effects?: ElementEffects;
  animation?: AnimationDef;
}

export interface ImageElement {
  kind: "image";
  id: string;
  rect: Rect;
  src: string;
  objectFit: "cover" | "contain";
  borderRadius?: number;
  clipCircle?: boolean;
  opacity?: number;
  animation?: AnimationDef;
}

export interface ShapeElement {
  kind: "shape";
  id: string;
  rect: Rect;
  shape: "rect" | "circle" | "line" | "pill";
  style: ShapeStyle;
  border?: BorderDef;
  effects?: ElementEffects;
  animation?: AnimationDef;
}

export interface GroupElement {
  kind: "group";
  id: string;
  rect: Rect;
  children: LayoutElement[];
  style?: ShapeStyle;
  border?: BorderDef;
  clipContent?: boolean;
  effects?: ElementEffects;
  animation?: AnimationDef;
}

export interface CodeElement {
  kind: "code";
  id: string;
  rect: Rect;
  code: string;
  language?: string;
  style: {
    fontFamily: string;
    fontSize: number;
    color: string;
    background: string;
    borderRadius: number;
    padding: number;
  };
  animation?: AnimationDef;
}

export interface TableElement {
  kind: "table";
  id: string;
  rect: Rect;
  headers: string[];
  rows: string[][];
  headerStyle: TextStyle & { background: string };
  cellStyle: TextStyle & { background: string; altBackground: string };
  borderColor: string;
  animation?: AnimationDef;
}

export interface ListElement {
  kind: "list";
  id: string;
  rect: Rect;
  items: string[];
  ordered: boolean;
  itemStyle: TextStyle;
  bulletColor?: string;
  itemSpacing: number;
  animation?: AnimationDef;
}

export type LayoutElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | GroupElement
  | CodeElement
  | TableElement
  | ListElement;

// --- Slide and Presentation ---

export interface LayoutSlide {
  width: 1920;
  height: 1080;
  background: string;
  backgroundImage?: string;
  overlay?: string;
  elements: LayoutElement[];
}

export interface LayoutPresentation {
  title: string;
  author?: string;
  slides: LayoutSlide[];
}

// --- Decorator IDs for theme signature elements ---

export type DecoratorId =
  // Tier 1A — standard shapes
  | "split-bg"
  | "edge-tabs"
  | "section-number"
  | "geometric-accent"
  | "accent-line"
  | "binder-holes"
  | "bordered-box"
  // Tier 1B — effects shapes (glow, softEdge, patternFill)
  | "glow-accent"
  | "soft-gradient-circles"
  | "scan-lines"
  | "grid-overlay"
  | "halftone-dots";

// --- Resolved theme (concrete values, no CSS vars) ---

export interface ResolvedTheme {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  text: string;
  textMuted: string;
  heading: string;
  accent: string;
  accent2: string;
  accentGradient: GradientDef;
  fontHeading: string;
  fontBody: string;
  fontMono: string;
  radius: number;
  radiusSm: number;
  shadow: BoxShadow;
  shadowLg: BoxShadow;
  border: BorderDef;
  cardBg: string;
  cardBorder: BorderDef;
  codeBg: string;
  codeText: string;
  overlayBg: string;
  progressBg: string;
  highlightInfoBg: string;
  highlightInfoBorder: string;
  highlightWarningBg: string;
  highlightWarningBorder: string;
  highlightSuccessBg: string;
  highlightSuccessBorder: string;
  decorators?: DecoratorId[];
}
