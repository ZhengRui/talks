import type { SlideData } from "@/lib/types";
import type { LayoutSlide, ResolvedTheme } from "../types";
import { layoutCover } from "./cover";
import { layoutTable } from "./table";
import { layoutSectionDivider } from "./section-divider";
import { layoutFullImage } from "./full-image";
import { layoutHighlightBox } from "./highlight-box";
import { layoutQa } from "./qa";
import { layoutAgenda } from "./agenda";
import { layoutDiagram } from "./diagram";
import { layoutChartPlaceholder } from "./chart-placeholder";
import { layoutThreeColumn } from "./three-column";
import { layoutTopBottom } from "./top-bottom";
import { layoutImageGrid } from "./image-grid";
import { layoutImageGallery } from "./image-gallery";
import { layoutTimeline } from "./timeline";
import { layoutSteps } from "./steps";
import { layoutIconGrid } from "./icon-grid";
import { layoutVideo } from "./video";
import { layoutIframe } from "./iframe";
import { layoutFreeform } from "./freeform";
import { layoutSplitCompose } from "./split-compose";
import { layoutFullCompose } from "./full-compose";

export type LayoutFunction = (
  slide: SlideData,
  theme: ResolvedTheme,
  imageBase: string,
) => LayoutSlide;

const layoutRegistry: Record<string, LayoutFunction> = {
  cover: layoutCover as LayoutFunction,
  table: layoutTable as LayoutFunction,
  "section-divider": layoutSectionDivider as LayoutFunction,
  "full-image": layoutFullImage as LayoutFunction,
  "highlight-box": layoutHighlightBox as LayoutFunction,
  qa: layoutQa as LayoutFunction,
  agenda: layoutAgenda as LayoutFunction,
  diagram: layoutDiagram as LayoutFunction,
  "chart-placeholder": layoutChartPlaceholder as LayoutFunction,
  "three-column": layoutThreeColumn as LayoutFunction,
  "top-bottom": layoutTopBottom as LayoutFunction,
  "image-grid": layoutImageGrid as LayoutFunction,
  "image-gallery": layoutImageGallery as LayoutFunction,
  timeline: layoutTimeline as LayoutFunction,
  steps: layoutSteps as LayoutFunction,
  "icon-grid": layoutIconGrid as LayoutFunction,
  video: layoutVideo as LayoutFunction,
  iframe: layoutIframe as LayoutFunction,
  freeform: layoutFreeform as LayoutFunction,
  "split-compose": layoutSplitCompose as LayoutFunction,
  "full-compose": layoutFullCompose as LayoutFunction,
};

export function getLayoutFunction(template: string): LayoutFunction | null {
  return layoutRegistry[template] ?? null;
}
