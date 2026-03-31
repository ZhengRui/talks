import { buildGeometryHints } from "@/lib/extract/geometry-hints";
import { layoutSlide } from "@/lib/layout";
import { loadPresentation, discoverPresentations } from "@/lib/loadPresentation";
import { renderSlideToImage } from "@/lib/render/screenshot";
import type { GeometryHints } from "@/components/extract/types";

export interface BenchmarkDeckOption {
  slug: string;
  title: string;
  slideCount: number;
}

export interface BenchmarkSlidePayload {
  slug: string;
  title: string;
  slideIndex: number;
  label: string;
  fileName: string;
  mimeType: "image/png";
  width: number;
  height: number;
  imageDataUrl: string;
  geometryHints: GeometryHints;
}

export function listBenchmarkDecks(): BenchmarkDeckOption[] {
  return discoverPresentations()
    .map((deck) => ({
      slug: deck.slug,
      title: deck.title,
      slideCount: deck.slideCount,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export async function loadBenchmarkSlide(
  slug: string,
  slideIndex: number,
  options: { assetBaseUrl?: string } = {},
): Promise<BenchmarkSlidePayload> {
  if (!Number.isInteger(slideIndex) || slideIndex < 1) {
    throw new Error("slideIndex must be a positive integer");
  }

  const presentation = loadPresentation(slug);
  if (slideIndex > presentation.slides.length) {
    throw new Error(`Slide ${slideIndex} is out of range for ${slug}`);
  }

  const slide = presentation.slides[slideIndex - 1];
  const imageBase = `/${slug}`;
  const layout = layoutSlide(
    slide,
    presentation.theme,
    imageBase,
    slideIndex - 1,
    {
      canvasSize: presentation.canvasSize,
      fit: presentation.fit,
      align: presentation.align,
    },
  );

  const imageBuffer = await renderSlideToImage(layout, {
    width: layout.width,
    height: layout.height,
    assetBaseUrl: options.assetBaseUrl,
  });
  const imageDataUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;

  return {
    slug,
    title: presentation.title,
    slideIndex,
    label: `${slug} slide ${slideIndex}`,
    fileName: `${slug}-slide-${slideIndex}.png`,
    mimeType: "image/png",
    width: layout.width,
    height: layout.height,
    imageDataUrl,
    geometryHints: buildGeometryHints(layout),
  };
}
