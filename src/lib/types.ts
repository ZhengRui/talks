import type { LayoutElement } from "./layout/types";
import type { SlideComponent, PanelDef } from "./layout/components/types";

// --- Per-template slide data ---

// Image-focused
export interface ImageGridSlideData {
  template: "image-grid";
  title?: string;
  images: { src: string; caption?: string }[];
  columns?: 2 | 3;
}

export interface ImageGallerySlideData {
  template: "image-gallery";
  title?: string;
  images: { src: string; caption?: string }[];
}

// Data & Technical
export interface TableSlideData {
  template: "table";
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface TimelineSlideData {
  template: "timeline";
  title?: string;
  events: { date: string; label: string; description?: string }[];
}

export interface ChartPlaceholderSlideData {
  template: "chart-placeholder";
  title: string;
  image: string;
  caption?: string;
}

export interface DiagramSlideData {
  template: "diagram";
  title?: string;
  image: string;
  caption?: string;
}

// Storytelling
export interface StepsSlideData {
  template: "steps";
  title?: string;
  steps: { label: string; description?: string }[];
}

export interface IconGridSlideData {
  template: "icon-grid";
  title?: string;
  items: { icon: string; label: string }[];
  columns?: 2 | 3 | 4;
}

// Interactive/Special
export interface VideoSlideData {
  template: "video";
  src: string;
  title?: string;
}

export interface IframeSlideData {
  template: "iframe";
  src: string;
  title?: string;
}

// Freeform (v6 — direct Level 2 IR passthrough)
export interface FreeformSlideData {
  template: "freeform";
  background?: string;
  backgroundImage?: string;
  overlay?: string;
  elements: LayoutElement[];
}

// Composable (v6 — component tree → vertical stacker → Level 2 IR)
export interface SplitComposeSlideData {
  template: "split-compose";
  ratio?: number;
  left: PanelDef;
  right: PanelDef;
}

export interface FullComposeSlideData {
  template: "full-compose";
  background?: string;
  backgroundImage?: string;
  overlay?: "dark" | "light" | "none" | string;  // default "dark" when backgroundImage set
  verticalAlign?: "top" | "center" | "bottom";
  children: SlideComponent[];
}

// Re-export for convenience
export type { SlideComponent, PanelDef };

// --- Discriminated union ---

export type SlideData = (
  | ImageGridSlideData
  | ImageGallerySlideData
  | TableSlideData
  | TimelineSlideData
  | ChartPlaceholderSlideData
  | DiagramSlideData
  | StepsSlideData
  | IconGridSlideData
  | VideoSlideData
  | IframeSlideData
  | FreeformSlideData
  | SplitComposeSlideData
  | FullComposeSlideData
) & SlideBaseFields;

// --- Animation override ---

export type AnimationOverride = "stagger" | "fade" | "counter" | "none";

// --- Base slide fields (mixed into each template via YAML) ---

export interface SlideBaseFields {
  animation?: AnimationOverride;
  theme?: ThemeName;
}

// --- Top-level YAML shape ---

export type ThemeName =
  | "modern" | "bold" | "elegant" | "dark-tech"
  | "bold-signal" | "electric-studio" | "creative-voltage" | "dark-botanical"
  | "notebook-tabs" | "pastel-geometry" | "split-pastel" | "vintage-editorial"
  | "neon-cyber" | "terminal-green" | "swiss-modern" | "paper-ink";

export interface PresentationData {
  title: string;
  author?: string;
  theme?: ThemeName;
  slides: SlideData[];
}

// --- Lightweight type for home page listing ---

export interface PresentationSummary {
  slug: string;
  title: string;
  author?: string;
  slideCount: number;
}
