import type { LayoutElement } from "../types";

// --- Composable slide components (v6) ---

export type SlideComponent =
  | TextComponent
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
  | BoxComponent;

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
}

export interface BulletsComponent {
  type: "bullets";
  items: string[];
  fontSize?: number;
  gap?: number;
  ordered?: boolean;            // circle number badges instead of accent bar
  variant?: "card" | "plain";   // default "card"
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
}

export interface CodeComponent {
  type: "code";
  code: string;
  language?: string;
  fontSize?: number;     // default 24
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
  gap?: number; // default 32
}

export interface BoxComponent {
  type: "box";
  children: SlideComponent[];
  padding?: number;    // default 28
  accentTop?: boolean; // 3px accent bar on top
  height?: number;     // fixed height (content vertically centered when set)
}

// --- Panel definition for split-compose ---

export interface PanelDef {
  background?: string;
  textColor?: string;
  verticalAlign?: "top" | "center" | "bottom";
  children: SlideComponent[];
}
