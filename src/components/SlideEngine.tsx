"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import React from "react";

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
}

const SlideEngine: React.FC<SlideEngineProps> = ({
  children,
  theme = "modern",
  slideThemes,
  slug,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const slides = React.Children.toArray(children);
  const totalSlides = slides.length;

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
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, prev, goTo, totalSlides]);

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

  // Viewport scaling
  useEffect(() => {
    function updateScale() {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const { clientWidth, clientHeight } = container;
      const scale = Math.min(clientWidth / 1920, clientHeight / 1080);
      canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
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
      <div ref={canvasRef} className="slide-canvas">
        {slides.map((slide, i) => (
          <div
            key={i === currentSlide ? `slide-${i}-${animKey}` : `slide-${i}`}
            className={`slide ${i === currentSlide ? "active" : "inactive"} theme-${slideThemes?.[i] ?? theme}`}
          >
            {slide}
          </div>
        ))}
      </div>
      {slug && (
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
      <NavDots total={totalSlides} current={currentSlide} goTo={goTo} />
      <div className="slide-counter">
          {currentSlide + 1} / {totalSlides}
        </div>
        <div className="slide-progress">
        <div
          className="slide-progress-bar"
          style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default SlideEngine;
