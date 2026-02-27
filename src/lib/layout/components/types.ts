import type { AnimationType, LayoutElement } from "../types";

// --- Composable slide components (v6) ---

/** Union of all component variants, with shared animationType mixin. */
export type SlideComponent =
  ( TextComponent
  | HeadingComponent
  | BodyComponent
  | BulletsComponent
  | StatComponent
  | TagComponent
  | DividerComponent
  | QuoteComponent
  | CardComponent
  | ImageComponent
  | CodeComponent
  | SpacerComponent
  | RawComponent
  | ColumnsComponent
  | BoxComponent
  ) & { animationType?: AnimationType; animationDelay?: number; opacity?: number };

export interface TextComponent {
  type: "text";
  text: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  color?: string;                                 // theme token or hex
  textAlign?: "left" | "center" | "right";
  fontStyle?: "normal" | "italic";
  fontFamily?: "heading" | "body" | "mono";       // maps to theme fonts, default "body"
  lineHeight?: number;
  maxWidth?: number;                              // constrain width, centered within panel
  /** Gap before this component, replaces default stacker gap */
  marginTop?: number;
  /** Gap after this component, replaces default stacker gap */
  marginBottom?: number;
}

export interface HeadingComponent {
  type: "heading";
  text: string;
  level?: 1 | 2 | 3;
  fontSize?: number;
  textAlign?: "left" | "center" | "right";
  color?: string;
}

export interface BodyComponent {
  type: "body";
  text: string;
  fontSize?: number;
  color?: string;
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;
  /** Gap before this component, replaces default stacker gap */
  marginTop?: number;
  /** Gap after this component, replaces default stacker gap */
  marginBottom?: number;
}

export interface BulletsComponent {
  type: "bullets";
  items: string[];
  fontSize?: number;
  gap?: number;
  ordered?: boolean;            // circle number badges instead of accent bar
  variant?: "card" | "plain" | "list";   // default "card"; "list" = native bullet dots
}

export interface StatComponent {
  type: "stat";
  value: string;
  label: string;
  textAlign?: "left" | "center";
  fontSize?: number;      // value font size, default 64
  labelFontSize?: number; // label font size, default 24
}

export interface TagComponent {
  type: "tag";
  text: string;
  color?: string;
}

export interface DividerComponent {
  type: "divider";
  variant?: "solid" | "gradient" | "ink" | "border";
  width?: number;
  align?: "left" | "center";
  /** Gap before this divider, replaces default stacker gap */
  marginTop?: number;
  /** Gap after this divider, replaces default stacker gap */
  marginBottom?: number;
}

export interface QuoteComponent {
  type: "quote";
  text: string;
  attribution?: string;
  textAlign?: "left" | "center" | "right";
  fontSize?: number;              // quote text font size, default 30
  attributionFontSize?: number;   // attribution font size, default 22
  decorative?: boolean;           // large opening quote mark above text
}

export interface CardComponent {
  type: "card";
  title: string;
  body: string;
  dark?: boolean;
}

export interface ImageComponent {
  type: "image";
  src: string;
  height?: number;
  objectFit?: "contain" | "cover";
  clipCircle?: boolean;
  borderRadius?: number;   // override default theme.radiusSm
}

export interface CodeComponent {
  type: "code";
  code: string;
  language?: string;
  fontSize?: number;     // default 24
  padding?: number;      // default 32
}

export interface SpacerComponent {
  type: "spacer";
  height?: number;
  flex?: boolean; // fills remaining vertical space (like CSS flex-grow)
}

export interface RawComponent {
  type: "raw";
  height: number;
  elements: LayoutElement[];
}

export interface ColumnsComponent {
  type: "columns";
  children: SlideComponent[];
  gap?: number;          // default 32
  ratio?: number;        // first column width fraction for 2-column layouts (e.g. 0.3)
  equalHeight?: boolean; // stretch all columns to same height
}

export interface BoxComponent {
  type: "box";
  children: SlideComponent[];
  padding?: number;       // default 28
  accentTop?: boolean;    // 3px accent bar on top
  accentColor?: string;   // custom accent bar color (hex or theme token), default theme.accent
  height?: number;        // fixed height (content vertically centered when set)
  animationType?: AnimationType; // override stacker/columns default fade-up (e.g. "slide-left")
  variant?: "card" | "flat" | "panel"; // default "card"; "flat" = transparent, no bg/shadow/border; "panel" = bg + radius, no shadow/border
  background?: string;    // override card bg color (theme token or hex), default theme.cardBg
  fill?: boolean;         // expand to fill available panel height (content stays top-aligned)
}

// --- Panel definition for split-compose ---

export interface PanelDef {
  background?: string;
  textColor?: string;
  verticalAlign?: "top" | "center" | "bottom";
  /** Edge-to-edge mode: zero padding so content fills the entire panel */
  fill?: boolean;
  /** CSS-style padding: number | [vert, horiz] | [top, right, bottom, left]. Overrides fill when set. */
  padding?: number | number[];
  /** Override default stacker gap (28) between children */
  gap?: number;
  children: SlideComponent[];
}
