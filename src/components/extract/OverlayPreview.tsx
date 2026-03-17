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
  const [scale, setScale] = useState(1);

  const srcW = sourceDimensions.w;
  const srcH = sourceDimensions.h;

  useLayoutEffect(() => {
    function updateScale() {
      const el = containerRef.current;
      if (!el) return;
      const { clientWidth } = el;
      if (clientWidth === 0) return;
      setScale(clientWidth / srcW);
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [srcW]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-[20px] border border-[#253044] bg-[#090e17]"
      style={{ aspectRatio: `${srcW} / ${srcH}` }}
    >
      {/* Screenshot at native aspect ratio */}
      <img
        src={screenshotUrl}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
      />

      {/* Region outlines in source coordinates, scaled to container */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: srcW,
          height: srcH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {proposals.map((p, i) => {
          const color = regionColor(i);
          const isSelected = i === selectedIndex;
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
    </div>
  );
}
