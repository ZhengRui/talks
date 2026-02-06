import { notFound } from "next/navigation";
import { loadPresentation, getAllSlugs } from "@/lib/loadPresentation";
import { getTemplate } from "@/components/templates";
import Presentation from "@/components/Presentation";

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
      <Presentation>
        {data.slides.map((slide, i) => {
          const Template = getTemplate(slide.template);
          if (!Template) {
            return (
              <section key={i}>
                <h2>Unknown template: {slide.template}</h2>
              </section>
            );
          }
          return <Template key={i} slide={slide} imageBase={imageBase} />;
        })}
      </Presentation>
    </main>
  );
}
