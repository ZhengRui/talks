import ReplicationWorkbench from "@/components/ReplicationWorkbench";
import { discoverPresentations, loadPresentation } from "@/lib/loadPresentation";
import { layoutPresentation } from "@/lib/layout";
import { clampOverlayOpacity, parseInitialSlide, type OverlaySearchParams } from "@/lib/overlay";
import { normalizeWorkbenchMode } from "@/lib/workbench";

export const metadata = {
  title: "Replication Workbench",
};

export default async function ReplicateWorkbenchPage({
  searchParams,
}: {
  searchParams: Promise<OverlaySearchParams & {
    slug?: string | string[];
    mode?: string | string[];
    reference?: string | string[];
    opacity?: string | string[];
  }>;
}) {
  const presentations = discoverPresentations();
  const resolvedSearchParams = await searchParams;
  const initialSlug = Array.isArray(resolvedSearchParams.slug)
    ? resolvedSearchParams.slug[0]
    : resolvedSearchParams.slug;
  const selectedSlug =
    (initialSlug && presentations.find((presentation) => presentation.slug === initialSlug)?.slug)
    ?? presentations[0]?.slug
    ?? "";
  const initialLayout = selectedSlug
    ? (() => {
        const data = loadPresentation(selectedSlug);
        const imageBase = `/${selectedSlug}`;
        const layout = layoutPresentation(
          data.title,
          data.slides,
          data.theme,
          imageBase,
          data.author,
        );

        return {
          ...layout,
          theme: data.theme,
          slideThemes: data.slides.map((slide) => slide.theme),
          slug: selectedSlug,
        };
      })()
    : undefined;

  return (
    <ReplicationWorkbench
      presentations={presentations}
      initialSlug={selectedSlug}
      initialSlide={parseInitialSlide(resolvedSearchParams.slide)}
      initialMode={normalizeWorkbenchMode(Array.isArray(resolvedSearchParams.mode) ? resolvedSearchParams.mode[0] : resolvedSearchParams.mode)}
      initialReference={Array.isArray(resolvedSearchParams.reference) ? resolvedSearchParams.reference[0] : resolvedSearchParams.reference}
      initialOpacity={clampOverlayOpacity(Array.isArray(resolvedSearchParams.opacity) ? resolvedSearchParams.opacity[0] : resolvedSearchParams.opacity, 0.5)}
      initialLayout={initialLayout}
    />
  );
}
