// --- Per-template slide data ---

export interface CoverSlideData {
  template: "cover";
  title: string;
  subtitle?: string;
  image?: string;
  author?: string;
}

export interface BulletSlideData {
  template: "bullets";
  title: string;
  bullets: string[];
  image?: string;
}

export interface ImageTextSlideData {
  template: "image-text";
  title: string;
  image: string;
  imagePosition?: "left" | "right";
  bullets?: string[];
  body?: string;
}

export interface FullImageSlideData {
  template: "full-image";
  image: string;
  title?: string;
  body?: string;
  overlay?: "dark" | "light";
}

// --- Discriminated union ---

export type SlideData =
  | CoverSlideData
  | BulletSlideData
  | ImageTextSlideData
  | FullImageSlideData;

// --- Template component props ---

export type TemplateProps<T extends SlideData = SlideData> = {
  slide: T;
  imageBase: string;
};

// --- What the registry stores ---

export type SlideComponent<T extends SlideData = SlideData> = React.FC<TemplateProps<T>>;

// --- Top-level YAML shape ---

export interface PresentationData {
  title: string;
  author?: string;
  theme?: string;
  slides: SlideData[];
}

// --- Lightweight type for home page listing ---

export interface PresentationSummary {
  slug: string;
  title: string;
  author?: string;
  slideCount: number;
}
