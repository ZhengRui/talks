import { notFound } from "next/navigation";
import { loadPresentation, getAllSlugs } from "@/lib/loadPresentation";
import { LayoutSlideRenderer } from "@/components/LayoutRenderer";
import { layoutSlide } from "@/lib/layout";
import SlideEngine from "@/components/SlideEngine";

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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let data;
  try {
    data = loadPresentation(slug);
  } catch {
    notFound();
  }

  const imageBase = `/${slug}`;

  return (
    <main className="min-h-screen h-screen">
      <SlideEngine theme={data.theme} slideThemes={data.slides.map(s => s.theme)} slug={slug}>
        {data.slides.map((slide, i) => {
          const layout = layoutSlide(slide, data.theme, imageBase);
          return (
            <LayoutSlideRenderer
              key={i}
              slide={layout}
              animationNone={slide.animation === "none"}
            />
          );
        })}
      </SlideEngine>
    </main>
  );
}
