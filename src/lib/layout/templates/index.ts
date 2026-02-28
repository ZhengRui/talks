import type { SlideData } from "@/lib/types";
import type { LayoutSlide, ResolvedTheme } from "../types";
import { layoutTable } from "./table";
import { layoutDiagram } from "./diagram";
import { layoutChartPlaceholder } from "./chart-placeholder";
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
  table: layoutTable as LayoutFunction,
  diagram: layoutDiagram as LayoutFunction,
  "chart-placeholder": layoutChartPlaceholder as LayoutFunction,
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
