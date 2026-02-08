import { notFound } from "next/navigation";
import { loadPresentation, getAllSlugs } from "@/lib/loadPresentation";
import { LayoutSlideRenderer } from "@/components/LayoutRenderer";
import { layoutPresentation } from "@/lib/layout";
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
  const layout = layoutPresentation(data.title, data.slides, data.theme, imageBase, data.author);

  return (
    <main className="min-h-screen h-screen">
      <SlideEngine theme={data.theme} slideThemes={data.slides.map(s => s.theme)} slug={slug}>
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
