import type { SlideComponent, SlideData } from "@/lib/types";
import { CoverSlide } from "./CoverSlide";
import { BulletSlide } from "./BulletSlide";
import { ImageTextSlide } from "./ImageTextSlide";
import { FullImageSlide } from "./FullImageSlide";
import { SectionDividerSlide } from "./SectionDividerSlide";
import { QuoteSlide } from "./QuoteSlide";
import { StatementSlide } from "./StatementSlide";
import { NumberedListSlide } from "./NumberedListSlide";
import { DefinitionSlide } from "./DefinitionSlide";
import { AgendaSlide } from "./AgendaSlide";
import { CodeSlide } from "./CodeSlide";
import { CodeComparisonSlide } from "./CodeComparisonSlide";
import { TableSlide } from "./TableSlide";
import { TimelineSlide } from "./TimelineSlide";
import { StatsSlide } from "./StatsSlide";
import { ChartPlaceholderSlide } from "./ChartPlaceholderSlide";
import { DiagramSlide } from "./DiagramSlide";
import { ComparisonSlide } from "./ComparisonSlide";
import { StepsSlide } from "./StepsSlide";
import { ProfileSlide } from "./ProfileSlide";
import { IconGridSlide } from "./IconGridSlide";
import { HighlightBoxSlide } from "./HighlightBoxSlide";
import { QaSlide } from "./QaSlide";
import { VideoSlide } from "./VideoSlide";
import { IframeSlide } from "./IframeSlide";
import { BlankSlide } from "./BlankSlide";
import { EndSlide } from "./EndSlide";
import { ImageGridSlide } from "./ImageGridSlide";
import { ImageComparisonSlide } from "./ImageComparisonSlide";
import { ImageCaptionSlide } from "./ImageCaptionSlide";
import { ImageGallerySlide } from "./ImageGallerySlide";
import { TwoColumnSlide } from "./TwoColumnSlide";
import { ThreeColumnSlide } from "./ThreeColumnSlide";
import { TopBottomSlide } from "./TopBottomSlide";
import { SidebarSlide } from "./SidebarSlide";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry: Record<string, SlideComponent<any>> = {
  cover: CoverSlide,
  bullets: BulletSlide,
  "image-text": ImageTextSlide,
  "full-image": FullImageSlide,
  "section-divider": SectionDividerSlide,
  quote: QuoteSlide,
  statement: StatementSlide,
  "numbered-list": NumberedListSlide,
  definition: DefinitionSlide,
  agenda: AgendaSlide,
  code: CodeSlide,
  "code-comparison": CodeComparisonSlide,
  table: TableSlide,
  timeline: TimelineSlide,
  stats: StatsSlide,
  "chart-placeholder": ChartPlaceholderSlide,
  diagram: DiagramSlide,
  comparison: ComparisonSlide,
  steps: StepsSlide,
  profile: ProfileSlide,
  "icon-grid": IconGridSlide,
  "highlight-box": HighlightBoxSlide,
  qa: QaSlide,
  video: VideoSlide,
  iframe: IframeSlide,
  blank: BlankSlide,
  end: EndSlide,
  "image-grid": ImageGridSlide,
  "image-comparison": ImageComparisonSlide,
  "image-caption": ImageCaptionSlide,
  "image-gallery": ImageGallerySlide,
  "two-column": TwoColumnSlide,
  "three-column": ThreeColumnSlide,
  "top-bottom": TopBottomSlide,
  sidebar: SidebarSlide,
};

export function getTemplate(
  templateName: string
): SlideComponent<SlideData> | null {
  return registry[templateName] ?? null;
}
