"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { regionColor, type Proposal } from "./types";
import { useExtractStore } from "./store";
import { ZoomToFitIcon } from "./icons";
import { LayoutSlideRenderer } from "@/components/LayoutRenderer";
import { compileProposalPreview } from "@/lib/extract/compile-preview";

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
  const setNaturalSize = useExtractStore((s) => s.setNaturalSize);
  const setViewMode = useExtractStore((s) => s.setViewMode);

  if (!card) return null;

  const isAnalyzed = card.status === "analyzed" && card.analysis;
  const isReplica = card.viewMode === "replica";
  const imgSrc = isAnalyzed ? card.analysis!.source.imagePath : card.previewUrl;

  const srcW = card.analysis?.source.dimensions.w ?? 0;
  const srcH = card.analysis?.source.dimensions.h ?? 0;
  const scaleX = srcW > 0 ? card.size.w / srcW : 1;
  const scaleY = srcH > 0 ? card.size.h / srcH : 1;

  // Find the slide-scope proposal for replica rendering
  const slideProposal = isAnalyzed
    ? card.analysis!.proposals.find((p) => p.scope === "slide") ?? null
    : null;

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
      {/* Top bar */}
      <div className="relative mb-1 flex h-5 items-center gap-1.5 px-0.5">
        <span className="max-w-[40%] truncate text-[11px] text-gray-500">
          {card.label}
        </span>
        {card.status === "analyzing" && (
          <span className="flex items-center gap-1 text-[11px] text-blue-500">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
            {card.elapsed}s
          </span>
        )}
        {card.status === "analyzed" && card.analysis && !isSelected && (
          <span className="text-[11px] text-emerald-600">
            {card.analysis.proposals.length} template
            {card.analysis.proposals.length !== 1 ? "s" : ""}
          </span>
        )}
        {card.status === "error" && (
          <span className="text-[11px] text-red-500">Error</span>
        )}

        {/* Right-side buttons */}
        <div className="ml-auto flex items-center gap-1">
          {/* View mode toggle — pill style */}
          {isAnalyzed && slideProposal && (
            <div className="relative flex items-center rounded-full bg-gray-200 p-0.5">
              <div
                className="absolute top-0.5 bottom-0.5 rounded-full bg-white shadow-sm transition-all duration-200"
                style={{
                  width: "calc(50% - 2px)",
                  left: isReplica ? "calc(50% + 1px)" : "2px",
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode(cardId, "original");
                }}
                className={`relative z-10 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  !isReplica ? "text-gray-700" : "text-gray-400"
                }`}
              >
                Original
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode(cardId, "replica");
                }}
                className={`relative z-10 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  isReplica ? "text-gray-700" : "text-gray-400"
                }`}
              >
                Replica
              </button>
            </div>
          )}
          {/* Zoom to fit */}
          {isSelected && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const rightGap = panelWidth > 0 ? panelWidth + 32 : 0;
                zoomToCard(cardId, vw - rightGap, vh, 40);
              }}
              className="flex h-5 w-5 items-center justify-center text-gray-400 transition-colors hover:text-gray-600"
              title="Zoom to fit"
            >
              <ZoomToFitIcon className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Delete */}
          {isSelected && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeCard(cardId);
              }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-red-400"
              title="Remove slide"
            >
              <X className="h-4 w-4 translate-y-px" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Image card */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          selectCard(cardId);
          if (isAnalyzed) selectTemplate(cardId, 0);
        }}
        className="group relative cursor-pointer overflow-hidden rounded-lg"
        style={{
          width: card.size.w,
          height: card.size.h,
          outline: isSelected
            ? "2px solid #22d3ee"
            : "1px solid rgba(0,0,0,0.1)",
          outlineOffset: -1,
          boxShadow: isSelected
            ? "0 8px 30px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.1)"
            : "0 2px 12px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)",
        }}
      >
        {isReplica && slideProposal ? (
          <ReplicaPreview
            proposal={slideProposal}
            allProposals={card.analysis!.proposals}
            canvasW={srcW}
            canvasH={srcH}
            displayW={card.size.w}
            displayH={card.size.h}
          />
        ) : (
          <>
            <img
              src={imgSrc}
              alt=""
              className="pointer-events-none h-full w-full object-contain select-none"
              onLoad={(e) => {
                if (!card.naturalSize) {
                  const img = e.currentTarget;
                  setNaturalSize(cardId, img.naturalWidth, img.naturalHeight);
                }
              }}
            />

            {/* Region overlays — only when selected AND analyzed AND in original view */}
            {isSelected && isAnalyzed && (
              <div className="absolute inset-0 overflow-hidden rounded-lg">
                {card.analysis!.proposals.map((proposal, i) => {
                  if (
                    proposal.region.w > srcW * 0.9 &&
                    proposal.region.h > srcH * 0.9
                  ) {
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
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Replica preview — compiles and renders the slide-scope proposal
// ---------------------------------------------------------------------------

function ReplicaPreview({
  proposal,
  allProposals,
  canvasW,
  canvasH,
  displayW,
  displayH,
}: {
  proposal: Proposal;
  allProposals: Proposal[];
  canvasW: number;
  canvasH: number;
  displayW: number;
  displayH: number;
}) {
  const layoutSlide = useMemo(() => {
    try {
      return compileProposalPreview(proposal, allProposals, canvasW, canvasH);
    } catch (e) {
      console.error("[ReplicaPreview] compile error:", e);
      return null;
    }
  }, [proposal, allProposals, canvasW, canvasH]);

  if (!layoutSlide) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-400">
        Compile error
      </div>
    );
  }

  const scale = Math.min(displayW / canvasW, displayH / canvasH);

  return (
    <div
      className="origin-top-left pointer-events-none"
      style={{
        width: canvasW,
        height: canvasH,
        transform: `scale(${scale})`,
      }}
    >
      <LayoutSlideRenderer slide={layoutSlide} animationNone />
    </div>
  );
}
