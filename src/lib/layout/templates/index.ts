import type { SlideData } from "@/lib/types";
import type { LayoutSlide, ResolvedTheme } from "../types";
import { layoutCover } from "./cover";
import { layoutBullets } from "./bullets";
import { layoutStats } from "./stats";
import { layoutComparison } from "./comparison";
import { layoutTable } from "./table";
import { layoutBlank } from "./blank";
import { layoutEnd } from "./end";
import { layoutStatement } from "./statement";
import { layoutSectionDivider } from "./section-divider";
import { layoutFullImage } from "./full-image";
import { layoutQuote } from "./quote";
import { layoutHighlightBox } from "./highlight-box";
import { layoutQa } from "./qa";
import { layoutNumberedList } from "./numbered-list";
import { layoutDefinition } from "./definition";
import { layoutAgenda } from "./agenda";
import { layoutCode } from "./code";
import { layoutCodeComparison } from "./code-comparison";
import { layoutDiagram } from "./diagram";
import { layoutChartPlaceholder } from "./chart-placeholder";
import { layoutImageCaption } from "./image-caption";
import { layoutTwoColumn } from "./two-column";
import { layoutThreeColumn } from "./three-column";
import { layoutTopBottom } from "./top-bottom";
import { layoutSidebar } from "./sidebar";
import { layoutImageText } from "./image-text";
import { layoutImageGrid } from "./image-grid";
import { layoutImageComparison } from "./image-comparison";
import { layoutImageGallery } from "./image-gallery";
import { layoutTimeline } from "./timeline";
import { layoutSteps } from "./steps";
import { layoutProfile } from "./profile";
import { layoutIconGrid } from "./icon-grid";
import { layoutVideo } from "./video";
import { layoutIframe } from "./iframe";

export type LayoutFunction = (
  slide: SlideData,
  theme: ResolvedTheme,
  imageBase: string,
) => LayoutSlide;

const layoutRegistry: Record<string, LayoutFunction> = {
  cover: layoutCover as LayoutFunction,
  bullets: layoutBullets as LayoutFunction,
  stats: layoutStats as LayoutFunction,
  comparison: layoutComparison as LayoutFunction,
  table: layoutTable as LayoutFunction,
  blank: layoutBlank as LayoutFunction,
  end: layoutEnd as LayoutFunction,
  statement: layoutStatement as LayoutFunction,
  "section-divider": layoutSectionDivider as LayoutFunction,
  "full-image": layoutFullImage as LayoutFunction,
  quote: layoutQuote as LayoutFunction,
  "highlight-box": layoutHighlightBox as LayoutFunction,
  qa: layoutQa as LayoutFunction,
  "numbered-list": layoutNumberedList as LayoutFunction,
  definition: layoutDefinition as LayoutFunction,
  agenda: layoutAgenda as LayoutFunction,
  code: layoutCode as LayoutFunction,
  "code-comparison": layoutCodeComparison as LayoutFunction,
  diagram: layoutDiagram as LayoutFunction,
  "chart-placeholder": layoutChartPlaceholder as LayoutFunction,
  "image-caption": layoutImageCaption as LayoutFunction,
  "two-column": layoutTwoColumn as LayoutFunction,
  "three-column": layoutThreeColumn as LayoutFunction,
  "top-bottom": layoutTopBottom as LayoutFunction,
  sidebar: layoutSidebar as LayoutFunction,
  "image-text": layoutImageText as LayoutFunction,
  "image-grid": layoutImageGrid as LayoutFunction,
  "image-comparison": layoutImageComparison as LayoutFunction,
  "image-gallery": layoutImageGallery as LayoutFunction,
  timeline: layoutTimeline as LayoutFunction,
  steps: layoutSteps as LayoutFunction,
  profile: layoutProfile as LayoutFunction,
  "icon-grid": layoutIconGrid as LayoutFunction,
  video: layoutVideo as LayoutFunction,
  iframe: layoutIframe as LayoutFunction,
};

export function getLayoutFunction(template: string): LayoutFunction | null {
  return layoutRegistry[template] ?? null;
}
