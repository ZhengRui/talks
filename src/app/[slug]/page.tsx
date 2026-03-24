import { notFound } from "next/navigation";
import { loadPresentation, getAllSlugs } from "@/lib/loadPresentation";
import { LayoutSlideRenderer } from "@/components/LayoutRenderer";
import { layoutPresentation } from "@/lib/layout";
import SlideEngine from "@/components/SlideEngine";
import { parseInitialSlide, resolveOverlayConfig, shouldShowChrome, type OverlaySearchParams } from "@/lib/overlay";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const data = loadPresentation(slug);
    return { title: data.title };
  } catch {
    return { title: "Presentation" };
  }
}

export default async function PresentationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<OverlaySearchParams>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  let data;
  try {
    data = loadPresentation(slug);
  } catch {
    notFound();
  }

  const imageBase = `/${slug}`;
  const layout = layoutPresentation(data.title, data.slides, data.theme, imageBase, data.author, data);
  const overlay = resolveOverlayConfig(slug, resolvedSearchParams);
  const initialSlide = parseInitialSlide(resolvedSearchParams.slide);
  const showChrome = shouldShowChrome(resolvedSearchParams.chrome);

  return (
    <main className="min-h-screen h-screen">
      <SlideEngine
        theme={data.theme}
        slideThemes={data.slides.map((s) => s.theme)}
        slug={slug}
        initialSlide={initialSlide}
        overlay={overlay}
        showChrome={showChrome}
      >
        {layout.slides.map((slide, i) => (
          <LayoutSlideRenderer
            key={i}
            slide={slide}
            animationNone={data.slides[i].animation === "none"}
          />
        ))}
      </SlideEngine>
    </main>
  );
}
