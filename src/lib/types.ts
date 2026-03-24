import type {
  SceneAlign,
  SceneBackgroundSpec,
  SceneFitMode,
  SceneGuides,
  SceneNode,
  ScenePreset,
  SceneSize,
} from "./scene/types";

export type { SceneAlign, SceneBackgroundSpec, SceneFitMode, SceneGuides, SceneNode, ScenePreset, SceneSize };

export interface SceneSlideData {
  mode: "scene";
  children: SceneNode[];
  background?: SceneBackgroundSpec;
  guides?: SceneGuides;
  presets?: Record<string, ScenePreset>;
  sourceSize?: SceneSize;
  fit?: SceneFitMode;
  align?: SceneAlign;
}

// --- Slide data ---

export type SlideData = SceneSlideData & SlideBaseFields;

// --- Animation override ---

export type AnimationOverride = "stagger" | "fade" | "counter" | "none";

// --- Base slide fields (mixed into each template via YAML) ---

export interface SlideBaseFields {
  animation?: AnimationOverride;
  theme?: ThemeName;
  canvasSize?: SceneSize;
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
  canvasSize?: SceneSize;
  fit?: SceneFitMode;
  align?: SceneAlign;
  slides: SlideData[];
}

// --- Lightweight type for home page listing ---

export interface PresentationSummary {
  slug: string;
  title: string;
  author?: string;
  slideCount: number;
}
