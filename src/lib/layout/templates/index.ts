import type { SlideData } from "@/lib/types";
import type { LayoutSlide, ResolvedTheme } from "../types";
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
  video: layoutVideo as LayoutFunction,
  iframe: layoutIframe as LayoutFunction,
  freeform: layoutFreeform as LayoutFunction,
  "split-compose": layoutSplitCompose as LayoutFunction,
  "full-compose": layoutFullCompose as LayoutFunction,
};

export function getLayoutFunction(template: string): LayoutFunction | null {
  return layoutRegistry[template] ?? null;
}
