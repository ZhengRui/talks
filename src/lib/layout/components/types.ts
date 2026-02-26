import type { LayoutElement } from "../types";

// --- Composable slide components (v6) ---

export type SlideComponent =
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
  | RawComponent;

export interface HeadingComponent {
  type: "heading";
  text: string;
  level?: 1 | 2 | 3;
}

export interface BodyComponent {
  type: "body";
  text: string;
}

export interface BulletsComponent {
  type: "bullets";
  items: string[];
}

export interface StatComponent {
  type: "stat";
  value: string;
  label: string;
}

export interface TagComponent {
  type: "tag";
  text: string;
  color?: string;
}

export interface DividerComponent {
  type: "divider";
  variant?: "solid" | "gradient" | "ink";
}

export interface QuoteComponent {
  type: "quote";
  text: string;
  attribution?: string;
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
}

export interface SpacerComponent {
  type: "spacer";
  height: number;
}

export interface RawComponent {
  type: "raw";
  height: number;
  elements: LayoutElement[];
}

// --- Panel definition for split-compose ---

export interface PanelDef {
  background?: string;
  textColor?: string;
  children: SlideComponent[];
}
