import { resolvePublicOverlayPath } from "./overlay";

export type WorkbenchMode = "render" | "reference" | "overlay" | "diff" | "split";

export function resolveWorkbenchReference(slug: string, referenceInput?: string): string | undefined {
  const value = referenceInput?.trim();
  if (!value) {
    return undefined;
  }
  return resolvePublicOverlayPath(slug, value);
}

export function buildViewerUrl(
  basePath: string,
  slug: string,
  slideIndex: number,
  referencePath?: string,
  overlayOpacity = 0.5,
): string {
  const url = new URL(`${basePath.replace(/\/$/, "")}/${slug}`, "http://localhost");
  url.searchParams.set("slide", String(slideIndex + 1));
  url.searchParams.set("chrome", "0");

  if (referencePath) {
    url.searchParams.set("overlay", referencePath);
    url.searchParams.set("overlayOpacity", String(overlayOpacity));
  }

  return `${url.pathname}${url.search}`;
}

export function normalizeWorkbenchMode(value?: string): WorkbenchMode {
  switch (value) {
    case "reference":
    case "overlay":
    case "diff":
    case "split":
      return value;
    default:
      return "render";
  }
}
