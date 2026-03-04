import type { SlideData } from "@/lib/types";
import type { LayoutSlide, ResolvedTheme } from "../types";
import { layoutFreeform } from "./bases/freeform";
import { layoutSplitCompose } from "./bases/split-compose";
import { layoutFullCompose } from "./bases/full-compose";

export type LayoutFunction = (
  slide: SlideData,
  theme: ResolvedTheme,
  imageBase: string,
) => LayoutSlide;

const layoutRegistry: Record<string, LayoutFunction> = {
  freeform: layoutFreeform as LayoutFunction,
  "split-compose": layoutSplitCompose as LayoutFunction,
  "full-compose": layoutFullCompose as LayoutFunction,
};

export function getLayoutFunction(template: string): LayoutFunction | null {
  return layoutRegistry[template] ?? null;
}
