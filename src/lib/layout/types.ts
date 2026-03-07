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

export interface TransformDef {
  rotate?: number;      // degrees (positive = clockwise)
  scaleX?: number;      // default 1.0
  scaleY?: number;      // default 1.0
  flipH?: boolean;
  flipV?: boolean;
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
  /** Color applied to **bold** inline markdown segments. */
  highlightColor?: string;
}

/** A styled run of text within a rich text block. */
export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  letterSpacing?: number;
  highlight?: string;     // background color on this run
  superscript?: boolean;
  subscript?: boolean;
}

/**
 * Rich text content: plain string (backward compat) or array of styled runs.
 * Markdown shorthand: "The **Fall** of *Tang*" is parsed by renderers.
 */
export type RichText = string | TextRun[];

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
  gradient?: GradientDef;
  patternFill?: PatternFillDef;
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

export type EntranceType =
  | "fade-up"
  | "fade-in"
  | "slide-left"
  | "slide-right"
  | "scale-up"
  | "count-up"
  | "none";

export interface EntranceDef {
  type: EntranceType;
  delay: number;
  duration: number;
}

export interface ElementBase {
  id: string;
  rect: Rect;
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

// --- Element types (discriminated union on `kind`) ---
// All elements extend ElementBase which provides:
//   opacity?, borderRadius?, shadow?, effects?, border?  — visual properties
//   entrance?   — one-shot entrance effect (fade-up, scale-up, etc.)
//   animation?  — raw CSS `animation` shorthand for continuous/custom animations
//   clipPath?   — CSS clip-path value
//   transform?  — rotation, scale, flip
//   cssStyle?   — web-only inline CSS overrides

export interface TextElement extends ElementBase {
  kind: "text";
  text: RichText;
  style: TextStyle;
}

export interface ImageElement extends ElementBase {
  kind: "image";
  src: string;
  objectFit: "cover" | "contain";
  clipCircle?: boolean;
}

export interface ShapeElement extends ElementBase {
  kind: "shape";
  shape: "rect" | "circle" | "line" | "pill";
  style: ShapeStyle;
}

export interface GroupElement extends ElementBase {
  kind: "group";
  children: LayoutElement[];
  style?: ShapeStyle;
  clipContent?: boolean;
}

export interface CodeElement extends ElementBase {
  kind: "code";
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
}

export interface TableElement extends ElementBase {
  kind: "table";
  headers: RichText[];
  rows: RichText[][];
  headerStyle: TextStyle & { background: string };
  cellStyle: TextStyle & { background: string; altBackground: string };
  borderColor: string;
}

export interface ListElement extends ElementBase {
  kind: "list";
  items: RichText[];
  ordered: boolean;
  itemStyle: TextStyle;
  bulletColor?: string;
  itemSpacing: number;
}

export interface VideoElement extends ElementBase {
  kind: "video";
  src: string;
  poster?: string;
}

export interface IframeElement extends ElementBase {
  kind: "iframe";
  src: string;
}

export type LayoutElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | GroupElement
  | CodeElement
  | TableElement
  | ListElement
  | VideoElement
  | IframeElement;

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
