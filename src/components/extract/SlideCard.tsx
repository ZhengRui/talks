"use client";

import { regionColor } from "./types";
import { useExtractStore } from "./store";

interface SlideCardProps {
  cardId: string;
}

export default function SlideCard({ cardId }: SlideCardProps) {
  const card = useExtractStore((s) => s.cards.get(cardId));
  const isSelected = useExtractStore((s) => s.selectedCardId === cardId);
  const selectCard = useExtractStore((s) => s.selectCard);
  const selectTemplate = useExtractStore((s) => s.selectTemplate);
  const removeCard = useExtractStore((s) => s.removeCard);
  const zoomToCard = useExtractStore((s) => s.zoomToCard);
  const panelWidth = useExtractStore((s) => s.panelWidth);

  if (!card) return null;

  const isAnalyzed = card.status === "analyzed" && card.analysis;
  const imgSrc = isAnalyzed ? card.analysis!.source.imagePath : card.previewUrl;

  const srcW = card.analysis?.source.dimensions.w ?? 0;
  const srcH = card.analysis?.source.dimensions.h ?? 0;
  const scaleX = srcW > 0 ? card.size.w / srcW : 1;
  const scaleY = srcH > 0 ? card.size.h / srcH : 1;

  return (
    <div
      data-testid={`slide-card-${cardId}`}
      className="absolute"
      style={{
        left: card.position.x,
        top: card.position.y,
        width: card.size.w,
      }}
    >
      {/* Filename + status + delete — above the image, fixed height to avoid layout shift */}
      <div className="relative mb-1 flex h-5 items-center gap-1.5 px-0.5">
        <span className="max-w-[60%] truncate text-[11px] text-gray-500">
          {card.label}
        </span>
        {card.status === "analyzing" && (
          <span className="flex items-center gap-1 text-[11px] text-blue-500">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            {card.elapsed}s
          </span>
        )}
        {card.status === "analyzed" && card.analysis && (
          <span className="text-[11px] text-emerald-600">
            {card.analysis.proposals.length} template{card.analysis.proposals.length !== 1 ? "s" : ""}
          </span>
        )}
        {card.status === "error" && (
          <span className="text-[11px] text-red-500">Error</span>
        )}
        {/* Center: zoom-to-fit + delete */}
        {isSelected && <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const vw = window.innerWidth;
              const vh = window.innerHeight;
              const rightGap = panelWidth > 0 ? panelWidth + 32 : 0;
              zoomToCard(cardId, vw - rightGap, vh, 40);
            }}
            className="flex h-4 w-4 items-center justify-center text-gray-400 transition-colors hover:text-gray-600"
            title="Zoom to fit"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          </button>
        </div>}
        {/* Delete button — only on selected card */}
        {isSelected && <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            removeCard(cardId);
          }}
          className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-red-400"
          title="Remove slide"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>}
      </div>

      {/* Image card */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          selectCard(cardId);
        }}
        className="group relative cursor-pointer overflow-hidden rounded-lg"
        style={{
          width: card.size.w,
          height: card.size.h,
          outline: isSelected ? "2px solid #22d3ee" : "1px solid rgba(0,0,0,0.1)",
          outlineOffset: -1,
          boxShadow: isSelected
            ? "0 8px 30px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.1)"
            : "0 2px 12px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Slide image */}
        <img
          src={imgSrc}
          alt=""
          className="pointer-events-none h-full w-full object-cover select-none"
        />

        {/* Region overlays — only when selected AND analyzed */}
        {isSelected && isAnalyzed && (
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            {card.analysis!.proposals.map((proposal, i) => {
              if (proposal.region.w > srcW * 0.9 && proposal.region.h > srcH * 0.9) {
                return null;
              }

              const color = regionColor(i);
              const isActive = i === card.selectedTemplateIndex;

              return (
                <div
                  key={i}
                  className="absolute cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectTemplate(cardId, i);
                  }}
                  style={{
                    left: proposal.region.x * scaleX,
                    top: proposal.region.y * scaleY,
                    width: proposal.region.w * scaleX,
                    height: proposal.region.h * scaleY,
                    border: `${isActive ? 3 : 2}px solid ${color}`,
                    borderRadius: 4,
                    opacity: isActive ? 1 : 0.5,
                    background: isActive ? `${color}15` : "transparent",
                  }}
                >
                  <span
                    className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: color, color: "#0a0f18" }}
                  >
                    {proposal.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
