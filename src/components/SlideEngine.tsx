"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import React from "react";

interface SlideEngineProps {
  children: React.ReactNode;
  theme?: string;
}

const SlideEngine: React.FC<SlideEngineProps> = ({
  children,
  theme = "modern",
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animKey, setAnimKey] = useState(0);
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

  // Viewport scaling
  useEffect(() => {
    function updateScale() {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const { clientWidth, clientHeight } = container;
      const scale = Math.min(clientWidth / 1920, clientHeight / 1080);
      canvas.style.transform = `scale(${scale})`;
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
            className={`slide ${i === currentSlide ? "active" : "inactive"}`}
          >
            {slide}
          </div>
        ))}
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
