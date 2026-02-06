// --- Per-template slide data ---

// Text-focused
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

export interface SectionDividerSlideData {
  template: "section-divider";
  title: string;
  subtitle?: string;
  image?: string;
}

export interface QuoteSlideData {
  template: "quote";
  quote: string;
  attribution?: string;
  image?: string;
}

export interface StatementSlideData {
  template: "statement";
  statement: string;
  subtitle?: string;
  image?: string;
}

export interface NumberedListSlideData {
  template: "numbered-list";
  title: string;
  items: string[];
}

export interface DefinitionSlideData {
  template: "definition";
  title: string;
  definitions: { term: string; description: string }[];
}

export interface AgendaSlideData {
  template: "agenda";
  title: string;
  items: string[];
  activeIndex?: number;
}

// Image-focused
export interface FullImageSlideData {
  template: "full-image";
  image: string;
  title?: string;
  body?: string;
  overlay?: "dark" | "light";
}

export interface ImageTextSlideData {
  template: "image-text";
  title: string;
  image: string;
  imagePosition?: "left" | "right";
  bullets?: string[];
  body?: string;
}

export interface ImageGridSlideData {
  template: "image-grid";
  title?: string;
  images: { src: string; caption?: string }[];
  columns?: 2 | 3;
}

export interface ImageComparisonSlideData {
  template: "image-comparison";
  title?: string;
  before: { image: string; label?: string };
  after: { image: string; label?: string };
}

export interface ImageCaptionSlideData {
  template: "image-caption";
  image: string;
  caption: string;
  title?: string;
}

export interface ImageGallerySlideData {
  template: "image-gallery";
  title?: string;
  images: { src: string; caption?: string }[];
}

// Layout
export interface TwoColumnSlideData {
  template: "two-column";
  title?: string;
  left: string;
  right: string;
}

export interface ThreeColumnSlideData {
  template: "three-column";
  title?: string;
  columns: { icon?: string; heading?: string; body: string }[];
}

export interface TopBottomSlideData {
  template: "top-bottom";
  title?: string;
  top: string;
  bottom: string;
}

export interface SidebarSlideData {
  template: "sidebar";
  title?: string;
  sidebar: string;
  main: string;
  sidebarPosition?: "left" | "right";
}

// Data & Technical
export interface CodeSlideData {
  template: "code";
  title?: string;
  code: string;
  language?: string;
}

export interface CodeComparisonSlideData {
  template: "code-comparison";
  title?: string;
  before: { code: string; label?: string; language?: string };
  after: { code: string; label?: string; language?: string };
}

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

export interface StatsSlideData {
  template: "stats";
  title?: string;
  stats: { value: string; label: string }[];
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
export interface ComparisonSlideData {
  template: "comparison";
  title?: string;
  left: { heading: string; items: string[] };
  right: { heading: string; items: string[] };
}

export interface StepsSlideData {
  template: "steps";
  title?: string;
  steps: { label: string; description?: string }[];
}

export interface ProfileSlideData {
  template: "profile";
  name: string;
  title?: string;
  image?: string;
  bio?: string;
}

export interface IconGridSlideData {
  template: "icon-grid";
  title?: string;
  items: { icon: string; label: string }[];
  columns?: 2 | 3 | 4;
}

export interface HighlightBoxSlideData {
  template: "highlight-box";
  title?: string;
  body: string;
  variant?: "info" | "warning" | "success";
}

export interface QaSlideData {
  template: "qa";
  question: string;
  answer: string;
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

export interface BlankSlideData {
  template: "blank";
  image?: string;
}

export interface EndSlideData {
  template: "end";
  title?: string;
  subtitle?: string;
  image?: string;
}

// --- Discriminated union ---

export type SlideData =
  | CoverSlideData
  | BulletSlideData
  | SectionDividerSlideData
  | QuoteSlideData
  | StatementSlideData
  | NumberedListSlideData
  | DefinitionSlideData
  | AgendaSlideData
  | FullImageSlideData
  | ImageTextSlideData
  | ImageGridSlideData
  | ImageComparisonSlideData
  | ImageCaptionSlideData
  | ImageGallerySlideData
  | TwoColumnSlideData
  | ThreeColumnSlideData
  | TopBottomSlideData
  | SidebarSlideData
  | CodeSlideData
  | CodeComparisonSlideData
  | TableSlideData
  | TimelineSlideData
  | StatsSlideData
  | ChartPlaceholderSlideData
  | DiagramSlideData
  | ComparisonSlideData
  | StepsSlideData
  | ProfileSlideData
  | IconGridSlideData
  | HighlightBoxSlideData
  | QaSlideData
  | VideoSlideData
  | IframeSlideData
  | BlankSlideData
  | EndSlideData;

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
