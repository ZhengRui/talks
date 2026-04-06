"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import React from "react";
import { resolveOverlayPath, type SlideOverlayConfig } from "@/lib/overlay";

function NavDots({ total, current, goTo }: { total: number; current: number; goTo: (i: number) => void }) {
  const maxVisible = 32;
  const half = maxVisible / 2; // 16
  const dotSize = 8;
  const dotGap = 6;
  const dotUnit = dotSize + dotGap;

  // Container shows at most 32 dots; all dots are rendered, overflow clipped
  const visibleH = Math.min(total, maxVisible) * dotUnit - dotGap;

  // Scroll offset — keeps active dot centered in the middle range
  let offset = 0;
  if (total > maxVisible) {
    const activeTop = current * dotUnit;
    const maxOffset = total * dotUnit - dotGap - visibleH;
    if (current < half) {
      offset = 0; // first 16: dot moves top→middle
    } else if (current >= total - half) {
      offset = maxOffset; // last 16: dot moves middle→bottom
    } else {
      offset = activeTop - half * dotUnit + dotSize / 2 + dotGap / 2;
    }
  }

  return (
    <nav
      className="slide-nav-dots"
      aria-label="Slide navigation"
      style={{ height: visibleH }}
    >
      <div
        className="slide-nav-track"
        style={{ transform: `translateY(-${offset}px)` }}
      >
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            className={`slide-nav-dot${i === current ? " active" : ""}`}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === current ? "step" : undefined}
          >
            <span className="slide-nav-hint">{i + 1}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

interface SlideEngineProps {
  children: React.ReactNode;
  theme?: string;
  slideThemes?: (string | undefined)[];
  slug?: string;
  initialSlide?: number;
  overlay?: SlideOverlayConfig;
  showChrome?: boolean;
}

function clampSlideIndex(index: number, totalSlides: number): number {
  return Math.max(0, Math.min(index, Math.max(totalSlides - 1, 0)));
}

const SlideEngine: React.FC<SlideEngineProps> = ({
  children,
  theme = "modern",
  slideThemes,
  slug,
  initialSlide = 0,
  overlay,
  showChrome = true,
}) => {
  const slides = React.Children.toArray(children);
  const totalSlides = slides.length;

  const [currentSlide, setCurrentSlide] = useState(() => clampSlideIndex(initialSlide, totalSlides));
  const [animKey, setAnimKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(Boolean(overlay));
  const [overlayOpacity, setOverlayOpacity] = useState(overlay?.opacity ?? 0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const overlayPath = resolveOverlayPath(overlay, currentSlide);
  const overlayEnabled = Boolean(overlay);

  useEffect(() => {
    setCurrentSlide(clampSlideIndex(initialSlide, totalSlides));
  }, [initialSlide, totalSlides]);

  useEffect(() => {
    setOverlayVisible(Boolean(overlay));
    setOverlayOpacity(overlay?.opacity ?? 0.5);
  }, [overlay]);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, totalSlides - 1));
      if (clamped !== currentSlide) {
        setCurrentSlide(clamped);
        // Increment key to force re-mount of active slide, retriggering CSS animations
        setAnimKey((k) => k + 1);
      }
    },
    [totalSlides, currentSlide]
  );

  const next = useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo]);
  const prev = useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          prev();
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(totalSlides - 1);
          break;
        case "o":
        case "O":
          if (overlayEnabled) {
            e.preventDefault();
            setOverlayVisible((visible) => !visible);
          }
          break;
        case "[":
          if (overlayEnabled) {
            e.preventDefault();
            setOverlayOpacity((value) => Math.max(0, Number((value - 0.1).toFixed(2))));
          }
          break;
        case "]":
          if (overlayEnabled) {
            e.preventDefault();
            setOverlayOpacity((value) => Math.min(1, Number((value + 0.1).toFixed(2))));
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, prev, goTo, totalSlides, overlayEnabled]);

  // Scroll / wheel navigation — accumulate delta, trigger at threshold
  useEffect(() => {
    let accum = 0;
    let cooldown = false;
    let resetTimer: ReturnType<typeof setTimeout>;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      if (cooldown) return;

      accum += e.deltaY;

      // Reset accumulator after a pause (new scroll gesture)
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { accum = 0; }, 200);

      const threshold = 80;
      if (Math.abs(accum) >= threshold) {
        if (accum > 0) next();
        else prev();
        accum = 0;
        cooldown = true;
        setTimeout(() => { cooldown = false; }, 500);
      }
    }
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => {
        container.removeEventListener("wheel", handleWheel);
        clearTimeout(resetTimer);
      };
    }
  }, [next, prev]);

  // Per-presentation CSS (e.g. content/<slug>/animations.css → public/<slug>/animations.css)
  useEffect(() => {
    if (!slug) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/${slug}/animations.css`;
    link.dataset.presentation = slug;
    // Silently ignore 404 — CSS file is optional
    link.onerror = () => link.remove();
    document.head.appendChild(link);
    return () => link.remove();
  }, [slug]);

  // Viewport scaling
  useLayoutEffect(() => {
    function updateScale() {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const { clientWidth, clientHeight } = container;
      const scale = Math.min(clientWidth / 1920, clientHeight / 1080);
      canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
      setCanvasReady(true);
    }

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`slide-engine theme-${theme}`}
      tabIndex={0}
    >
      <div ref={canvasRef} className={`slide-canvas${canvasReady ? " ready" : ""}`}>
        {slides.map((slide, i) => (
          <div
            key={i === currentSlide ? `slide-${i}-${animKey}` : `slide-${i}`}
            className={`slide ${i === currentSlide ? "active" : "inactive"} theme-${slideThemes?.[i] ?? theme}`}
          >
            {slide}
            {i === currentSlide && overlayVisible && overlayPath && (
              <div className="slide-overlay-layer" aria-hidden="true">
                {/* Overlay rendering uses a raw img to avoid framework image wrappers in the slide canvas. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="slide-overlay-image"
                  src={overlayPath}
                  alt=""
                  style={{ opacity: overlayOpacity }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {showChrome && slug && (
        <button
          className="slide-export-btn"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              const layoutRes = await fetch(`/api/layout?slug=${slug}`);
              if (!layoutRes.ok) throw new Error("Failed to fetch layout");
              const layoutJson = await layoutRes.json();
              const pptxRes = await fetch("/api/export_pptx", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(layoutJson),
              });
              if (!pptxRes.ok) throw new Error("Failed to generate PPTX");
              const blob = await pptxRes.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${slug}.pptx`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (err) {
              console.error("Export failed:", err);
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? "Exporting..." : "Export PPTX"}
        </button>
      )}
      {showChrome && <NavDots total={totalSlides} current={currentSlide} goTo={goTo} />}
      {showChrome && overlayPath && (
        <div className="slide-overlay-hud">
          overlay {overlayVisible ? "on" : "off"} {Math.round(overlayOpacity * 100)}%
        </div>
      )}
      {showChrome && (
        <div className="slide-counter">
          {currentSlide + 1} / {totalSlides}
        </div>
      )}
      {showChrome && (
        <div
          className="slide-progress"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const target = Math.min(Math.floor(ratio * totalSlides), totalSlides - 1);
            goTo(target);
          }}
        >
          <div
            className="slide-progress-bar"
            style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default SlideEngine;
