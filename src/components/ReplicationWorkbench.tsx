"use client";

import { LayoutSlideRenderer } from "@/components/LayoutRenderer";
import type { LayoutPresentation } from "@/lib/layout/types";
import type { PresentationSummary } from "@/lib/types";
import {
  buildViewerUrl,
  normalizeWorkbenchMode,
  resolveWorkbenchReference,
  type WorkbenchMode,
} from "@/lib/workbench";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface WorkbenchLayoutPresentation extends LayoutPresentation {
  theme?: string;
  slideThemes?: (string | undefined)[];
  slug?: string;
}

interface ReplicationWorkbenchProps {
  presentations: PresentationSummary[];
  initialSlug: string;
  initialSlide: number;
  initialMode?: string;
  initialReference?: string;
  initialOpacity?: number;
  initialLayout?: WorkbenchLayoutPresentation;
}

function clampSlide(index: number, totalSlides: number): number {
  return Math.max(0, Math.min(index, Math.max(totalSlides - 1, 0)));
}

function useCanvasScale() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    function updateScale() {
      const container = containerRef.current;
      if (!container) return;

      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      setScale(Math.min(clientWidth / 1920, clientHeight / 1080));
    }

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return { containerRef, scale };
}

function SlideCanvas({
  slide,
  themeClass,
  overlaySrc,
  overlayOpacity,
  mode,
}: {
  slide?: WorkbenchLayoutPresentation["slides"][number];
  themeClass: string;
  overlaySrc?: string;
  overlayOpacity: number;
  mode: WorkbenchMode;
}) {
  const { containerRef, scale } = useCanvasScale();

  const overlayImage = overlaySrc ? (
    <img
      src={overlaySrc}
      alt=""
      className="absolute inset-0 h-full w-full object-fill pointer-events-none select-none"
      style={
        mode === "diff"
          ? { mixBlendMode: "difference", opacity: 1 }
          : { opacity: overlayOpacity }
      }
    />
  ) : null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-[20px] border border-[#253044] bg-[#090e17]"
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: 1920,
          height: 1080,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <div className={`slide active ${themeClass}`}>
          {mode === "reference" ? (
            overlayImage
          ) : (
            <>
              {slide ? <LayoutSlideRenderer slide={slide} /> : null}
              {(mode === "overlay" || mode === "diff") && overlayImage}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReplicationWorkbench({
  presentations,
  initialSlug,
  initialSlide,
  initialMode,
  initialReference,
  initialOpacity,
  initialLayout,
}: ReplicationWorkbenchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const uploadInputId = useId();

  const [slug, setSlug] = useState(initialSlug);
  const [slideIndex, setSlideIndex] = useState(initialSlide);
  const [mode, setMode] = useState<WorkbenchMode>(normalizeWorkbenchMode(initialMode));
  const [referenceInput, setReferenceInput] = useState(initialReference ?? "");
  const [overlayOpacity, setOverlayOpacity] = useState(initialOpacity ?? 0.5);
  const [uploadedReferenceUrl, setUploadedReferenceUrl] = useState<string>();
  const [uploadedFileName, setUploadedFileName] = useState<string>();
  const [layout, setLayout] = useState<WorkbenchLayoutPresentation | undefined>(initialLayout);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (layout?.slug === slug) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(undefined);

    fetch(`/api/layout?slug=${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${slug}`);
        }
        return (await response.json()) as WorkbenchLayoutPresentation;
      })
      .then((data) => {
        if (cancelled) return;
        setLayout(data);
        setSlideIndex((current) => clampSlide(current, data.slides.length));
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLayout(undefined);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [layout?.slug, slug]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("slug", slug);
    params.set("slide", String(slideIndex + 1));
    params.set("mode", mode);
    if (referenceInput) {
      params.set("reference", referenceInput);
    }
    if (overlayOpacity !== 0.5) {
      params.set("opacity", String(overlayOpacity));
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [slug, slideIndex, mode, referenceInput, overlayOpacity, pathname, router]);

  useEffect(() => {
    return () => {
      if (uploadedReferenceUrl) {
        URL.revokeObjectURL(uploadedReferenceUrl);
      }
    };
  }, [uploadedReferenceUrl]);

  const currentSlide = layout?.slides[slideIndex];
  const currentTheme = layout?.slideThemes?.[slideIndex] ?? layout?.theme ?? "modern";
  const themeClass = `theme-${currentTheme}`;
  const maxSlides = layout?.slides.length ?? 0;

  const resolvedReferencePath = useMemo(
    () => resolveWorkbenchReference(slug, referenceInput),
    [slug, referenceInput],
  );
  const referenceSrc = uploadedReferenceUrl ?? resolvedReferencePath;

  const viewerUrl = useMemo(
    () => buildViewerUrl("", slug, slideIndex, resolvedReferencePath, overlayOpacity),
    [slug, slideIndex, resolvedReferencePath, overlayOpacity],
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0a0f18] text-[#e6edf7]">
      <div className="mx-auto flex min-h-screen w-full min-w-0 max-w-[1880px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col gap-3 rounded-[20px] border border-[#253044] bg-[#121a28] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7c8ca8]">
                Replication Workbench
              </div>
              <h1 className="font-[var(--font-space-grotesk)] text-[2rem] font-semibold tracking-tight text-white sm:text-[2.35rem]">
                Screenshot-to-slide comparison
              </h1>
              <p className="mt-1 max-w-3xl text-[13px] leading-6 text-[#98a5bb]">
                Load any migrated deck, attach a reference screenshot, and inspect the result in render,
                reference, overlay, split, or difference view. Use the CLI for exact mismatch reporting.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#7c8ca8]">
              <span className="rounded-full border border-[#334155] px-3 py-1">
                Interactive parity review
              </span>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-12">
            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-[#9eabc0] 2xl:col-span-4">
              <span className="font-medium text-slate-100">Presentation</span>
              <select
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlideIndex(0);
                }}
                className="h-12 rounded-2xl border border-[#2b3648] bg-[#0d1421] px-4 text-[15px] text-white outline-none ring-0"
              >
                {presentations.map((presentation) => (
                  <option key={presentation.slug} value={presentation.slug}>
                    {presentation.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-[#9eabc0] 2xl:col-span-2">
              <span className="font-medium text-slate-100">Slide</span>
              <div className="flex h-12 items-center gap-2 rounded-2xl border border-[#2b3648] bg-[#0d1421] px-3">
                <button
                  type="button"
                  onClick={() => setSlideIndex((value) => clampSlide(value - 1, maxSlides))}
                  className="h-9 rounded-xl border border-[#364152] bg-[#1a2232] px-4 text-[15px] text-white disabled:opacity-40"
                  disabled={slideIndex <= 0}
                >
                  Prev
                </button>
                <input
                  type="number"
                  min={1}
                  max={Math.max(maxSlides, 1)}
                  value={maxSlides ? slideIndex + 1 : 1}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    setSlideIndex(clampSlide((Number.isFinite(next) ? next : 1) - 1, maxSlides));
                  }}
                  className="h-9 w-20 rounded-xl border border-[#364152] bg-[#0b111c] px-3 text-center text-[15px] text-white"
                />
                <span className="min-w-[3rem] text-xs text-[#8b98ae]">/ {maxSlides || 0}</span>
                <button
                  type="button"
                  onClick={() => setSlideIndex((value) => clampSlide(value + 1, maxSlides))}
                  className="ml-auto h-9 rounded-xl border border-[#364152] bg-[#1a2232] px-4 text-[15px] text-white disabled:opacity-40"
                  disabled={slideIndex >= maxSlides - 1}
                >
                  Next
                </button>
              </div>
            </label>

            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-[#9eabc0] 2xl:col-span-3">
              <span className="font-medium text-slate-100">Reference path</span>
              <input
                value={referenceInput}
                onChange={(e) => setReferenceInput(e.target.value)}
                placeholder="refs/slide-{n}.png or /shared/ref.png"
                className="h-12 rounded-2xl border border-[#2b3648] bg-[#0d1421] px-4 text-[15px] text-white placeholder:text-[#64748b]"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] text-[#9eabc0] 2xl:col-span-3">
              <span className="font-medium text-slate-100">Upload screenshot</span>
              <input
                id={uploadInputId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  if (uploadedReferenceUrl) {
                    URL.revokeObjectURL(uploadedReferenceUrl);
                  }
                  const url = URL.createObjectURL(file);
                  setUploadedReferenceUrl(url);
                  setUploadedFileName(file.name);
                }}
                className="hidden"
              />
              <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#2b3648] bg-[#0d1421] px-3">
                <label
                  htmlFor={uploadInputId}
                  className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-xl border border-[#2f5168] bg-[#133247] px-4 text-[13px] font-medium text-[#c6e5f4]"
                >
                  Choose File
                </label>
                <div className="min-w-0 truncate text-[13px] text-slate-200">
                  {uploadedFileName ?? "No file chosen"}
                </div>
              </div>
            </label>
          </div>

          <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {(["render", "reference", "overlay", "diff", "split"] as WorkbenchMode[]).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setMode(entry)}
                  className={`h-10 rounded-xl px-4 text-[14px] font-medium transition ${
                      mode === entry
                        ? "border border-[#4568a6] bg-[#2e5fbf] text-white"
                        : "border border-[#364152] bg-[#1a2232] text-slate-200"
                  }`}
                >
                  {entry}
                </button>
              ))}
            </div>

            <div className="flex min-w-0 flex-col gap-3 text-[13px] text-[#a6b3c9] sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
              <label className="flex min-w-0 flex-wrap items-center gap-3">
                <span>Overlay opacity</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(Number.parseFloat(e.target.value))}
                />
                <span className="w-12 text-right text-[13px] text-[#7c8ca8]">{Math.round(overlayOpacity * 100)}%</span>
              </label>
              <Link
                href={viewerUrl}
                className="inline-flex h-10 w-fit items-center rounded-xl border border-[#364152] bg-[#1a2232] px-4 text-[14px] font-medium text-slate-200 hover:bg-[#222c3f]"
              >
                Open viewer
              </Link>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 min-w-0 flex-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c8ca8]">
                Preview
              </div>
              <div className="min-w-0 text-[11px] text-[#7c8ca8] sm:text-xs">
                {mode === "split" ? "Reference vs rendered" : "Rendered slide canvas"}
              </div>
            </div>
            {mode === "split" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c8ca8]">
                    Reference
                  </div>
                  <div className="aspect-[16/9] min-h-[260px]">
                    <SlideCanvas
                      slide={currentSlide}
                      themeClass={themeClass}
                      overlaySrc={referenceSrc}
                      overlayOpacity={overlayOpacity}
                      mode="reference"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7c8ca8]">
                    Rendered
                  </div>
                  <div className="aspect-[16/9] min-h-[260px]">
                    <SlideCanvas
                      slide={currentSlide}
                      themeClass={themeClass}
                      overlaySrc={referenceSrc}
                      overlayOpacity={overlayOpacity}
                      mode="render"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-[16/9] min-h-[320px]">
                <SlideCanvas
                  slide={currentSlide}
                  themeClass={themeClass}
                  overlaySrc={referenceSrc}
                  overlayOpacity={overlayOpacity}
                  mode={mode}
                />
              </div>
            )}
          </div>

          <div className="grid min-w-0 items-start gap-3 xl:grid-cols-2 2xl:grid-cols-1">
            <div className="min-w-0 self-start rounded-[18px] border border-[#253044] bg-[#121a28] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#59b0d4]">
                Current state
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm text-[#c3cfdf]">
                <dt className="text-[#7c8ca8]">Deck</dt>
                <dd className="text-white">{layout?.title ?? slug}</dd>
                <dt className="text-[#7c8ca8]">Slide</dt>
                <dd className="text-white">{slideIndex + 1}{maxSlides ? ` / ${maxSlides}` : ""}</dd>
                <dt className="text-[#7c8ca8]">Theme</dt>
                <dd className="text-white">{currentTheme}</dd>
                <dt className="text-[#7c8ca8]">Reference</dt>
                <dd className="break-all text-white">
                  {uploadedFileName ? `upload: ${uploadedFileName}` : (referenceSrc ?? "none")}
                </dd>
                <dt className="text-[#7c8ca8]">Viewer URL</dt>
                <dd className="break-all font-mono text-[12px] text-[#7dd3fc]">{viewerUrl}</dd>
              </dl>
            </div>

            <div className="min-w-0 self-start rounded-[18px] border border-[#253044] bg-[#121a28] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#59b0d4]">
                CLI diff
              </div>
              <pre className="mt-3 overflow-x-auto rounded-2xl border border-[#2b3648] bg-[#0b111c] p-3 text-xs leading-6 text-slate-200">
{`bun run slide:diff -- --base-url http://127.0.0.1:4000 --slug ${slug} --slide ${slideIndex + 1} --reference /absolute/path/to/reference.png`}
              </pre>
              <p className="mt-3 text-sm leading-6 text-[#98a5bb]">
                Use the page for interactive visual inspection. Use the CLI when you need a rendered PNG,
                diff PNG, and machine-readable mismatch report.
              </p>
            </div>

            <div className="min-w-0 self-start rounded-[18px] border border-[#253044] bg-[#121a28] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#59b0d4]">
                Notes
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#c3cfdf]">
                <li><code>diff</code> mode uses CSS difference blending for fast visual inspection.</li>
                <li><code>overlay</code> mode is best for alignment and spacing checks.</li>
                <li>For per-slide refs in <code>public/&lt;slug&gt;/refs/</code>, use <code>refs/slide-12.png</code> as the reference path.</li>
              </ul>
            </div>
          </div>
        </div>

        {(loading || error) && (
          <div className="rounded-2xl border border-[#253044] bg-[#121a28] px-4 py-3 text-sm text-[#c3cfdf]">
            {loading ? "Loading layout..." : error}
          </div>
        )}
      </div>
    </main>
  );
}
