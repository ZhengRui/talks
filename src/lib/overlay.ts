export type OverlayQueryValue = string | string[] | undefined;

export interface OverlaySearchParams {
  slide?: OverlayQueryValue;
  overlay?: OverlayQueryValue;
  overlayDir?: OverlayQueryValue;
  overlayPattern?: OverlayQueryValue;
  overlayOpacity?: OverlayQueryValue;
  chrome?: OverlayQueryValue;
}

export interface SlideOverlayConfig {
  mode: "single" | "sequence";
  opacity: number;
  path?: string;
  basePath?: string;
  pattern?: string;
}

export function firstQueryValue(value: OverlayQueryValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function clampOverlayOpacity(value: string | number | undefined, fallback = 0.5): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "");
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, parsed));
}

export function parseInitialSlide(value: OverlayQueryValue): number {
  const raw = firstQueryValue(value);
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed - 1;
}

export function resolvePublicOverlayPath(slug: string, input: string): string {
  if (/^https?:\/\//.test(input)) {
    return input;
  }

  if (input.startsWith("/")) {
    return input;
  }

  return `/${slug}/${input.replace(/^\/+/, "")}`;
}

export function resolveOverlayConfig(
  slug: string,
  searchParams: OverlaySearchParams,
): SlideOverlayConfig | undefined {
  const overlay = firstQueryValue(searchParams.overlay);
  const overlayDir = firstQueryValue(searchParams.overlayDir);
  const overlayPattern = firstQueryValue(searchParams.overlayPattern) ?? "slide-{n}.png";
  const opacity = clampOverlayOpacity(firstQueryValue(searchParams.overlayOpacity), 0.5);

  if (overlay) {
    return {
      mode: "single",
      opacity,
      path: resolvePublicOverlayPath(slug, overlay),
    };
  }

  if (overlayDir) {
    return {
      mode: "sequence",
      opacity,
      basePath: resolvePublicOverlayPath(slug, overlayDir).replace(/\/+$/, ""),
      pattern: overlayPattern,
    };
  }

  return undefined;
}

export function resolveOverlayPath(
  overlay: SlideOverlayConfig | undefined,
  slideIndex: number,
): string | undefined {
  if (!overlay) {
    return undefined;
  }

  if (overlay.mode === "single") {
    return overlay.path;
  }

  const pattern = overlay.pattern ?? "slide-{n}.png";
  const filename = pattern
    .replaceAll("{n}", String(slideIndex + 1))
    .replaceAll("{i}", String(slideIndex));
  return `${overlay.basePath}/${filename}`;
}

export function shouldShowChrome(value: OverlayQueryValue): boolean {
  const raw = firstQueryValue(value);
  return raw !== "0" && raw !== "false";
}
