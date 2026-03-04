import type { LayoutElement } from "./layout/types";
import type { SlideComponent, PanelDef } from "./layout/components/types";

// --- Per-template slide data ---

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
