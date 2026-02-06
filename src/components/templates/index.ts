import type { SlideComponent, SlideData } from "@/lib/types";
import { CoverSlide } from "./CoverSlide";
import { BulletSlide } from "./BulletSlide";
import { ImageTextSlide } from "./ImageTextSlide";
import { FullImageSlide } from "./FullImageSlide";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry: Record<string, SlideComponent<any>> = {
  cover: CoverSlide,
  bullets: BulletSlide,
  "image-text": ImageTextSlide,
  "full-image": FullImageSlide,
};

export function getTemplate(
  templateName: string
): SlideComponent<SlideData> | null {
  return registry[templateName] ?? null;
}
