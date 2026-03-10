import type { SlideComponent } from "./layout/components/types";

// Re-export for convenience
export type { SlideComponent };

// Component slide (root component tree)
export interface ComponentSlideData {
  children: SlideComponent[];
  background?: string;
  backgroundImage?: string;
  overlay?: "dark" | "light" | "none" | string;
}

// --- Slide data ---

export type SlideData = ComponentSlideData & SlideBaseFields;

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
