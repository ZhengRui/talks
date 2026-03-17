"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { regionColor, type Proposal } from "./types";

interface OverlayPreviewProps {
  screenshotUrl: string;
  sourceDimensions: { w: number; h: number };
  proposals: Proposal[];
  selectedIndex: number;
  onSelectProposal: (index: number) => void;
}

export default function OverlayPreview({
  screenshotUrl,
  sourceDimensions,
  proposals,
  selectedIndex,
  onSelectProposal,
}: OverlayPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [fit, setFit] = useState<{
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
  } | null>(null);

  const srcW = sourceDimensions.w;
  const srcH = sourceDimensions.h;

  // Check if the selected proposal covers the full slide
  const selectedProposal = proposals[selectedIndex];
  const selectedIsFullSlide = selectedProposal
    ? selectedProposal.region.w > srcW * 0.9 && selectedProposal.region.h > srcH * 0.9
    : false;

  useLayoutEffect(() => {
    function updateFit() {
      const container = containerRef.current;
      const img = imageRef.current;
      if (!container || !img) return;

      const containerW = container.clientWidth;
      const containerH = container.clientHeight;
      const naturalW = img.naturalWidth || srcW;
      const naturalH = img.naturalHeight || srcH;

      if (containerW === 0 || containerH === 0 || naturalW === 0 || naturalH === 0) {
        return;
      }

      const imageScale = Math.min(containerW / naturalW, containerH / naturalH);
      const renderedW = naturalW * imageScale;
      const renderedH = naturalH * imageScale;
      const offsetX = (containerW - renderedW) / 2;
      const offsetY = (containerH - renderedH) / 2;

      setFit({
        offsetX,
        offsetY,
        scaleX: renderedW / srcW,
        scaleY: renderedH / srcH,
      });
    }

    updateFit();

    const img = imageRef.current;
    img?.addEventListener("load", updateFit);

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => updateFit())
      : null;
    if (observer && containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener("resize", updateFit);

    return () => {
      img?.removeEventListener("load", updateFit);
      observer?.disconnect();
      window.removeEventListener("resize", updateFit);
    };
  }, [srcW, srcH, screenshotUrl]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto max-w-[800px] w-full overflow-hidden rounded-[20px] bg-[#090e17] transition-colors"
      style={{
        aspectRatio: `${srcW} / ${srcH}`,
        border: selectedIsFullSlide
          ? `2px solid ${regionColor(selectedIndex)}`
          : "1px solid #253044",
      }}
    >
      {/* Screenshot at native aspect ratio */}
      <img
        ref={imageRef}
        src={screenshotUrl}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
      />

      {/* Region outlines in source coordinates, scaled to container */}
      {fit && (
        <div
          className="absolute"
          style={{
            left: fit.offsetX,
            top: fit.offsetY,
            width: srcW,
            height: srcH,
            transform: `scale(${fit.scaleX}, ${fit.scaleY})`,
            transformOrigin: "top left",
          }}
        >
          {proposals.map((p, i) => {
            const color = regionColor(i);
            const isSelected = i === selectedIndex;
            // Skip outline for full-slide regions (>90% coverage)
            const coversFullSlide =
              p.region.w > srcW * 0.9 && p.region.h > srcH * 0.9;
            if (coversFullSlide) return null;
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => onSelectProposal(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectProposal(i);
                  }
                }}
                className="absolute cursor-pointer transition-opacity"
                style={{
                  left: p.region.x,
                  top: p.region.y,
                  width: p.region.w,
                  height: p.region.h,
                  border: `${isSelected ? 3 : 2}px solid ${color}`,
                  borderRadius: 6,
                  opacity: isSelected ? 1 : 0.6,
                  background: isSelected ? `${color}10` : "transparent",
                }}
              >
                <span
                  className="absolute -top-5 left-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: color, color: "#0a0f18" }}
                >
                  {p.name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
