"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { regionColor, type Proposal } from "./types";
import { useExtractStore } from "./store";
import { getStageAnalysis } from "./stage-utils";
import { ZoomToFitIcon } from "./icons";
import { LayoutSlideRenderer } from "@/components/LayoutRenderer";
import { compileProposalPreview } from "@/lib/extract/compile-preview";

interface SlideCardProps {
  cardId: string;
}

function getSlideProposal(proposals: Proposal[] | undefined): Proposal | null {
  return proposals?.find((proposal) => proposal.scope === "slide") ?? null;
}

function benchmarkBadgeClass(variant: "control" | "coords" | null): string {
  if (variant === "coords") return "bg-amber-100 text-amber-800";
  if (variant === "control") return "bg-sky-100 text-sky-800";
  return "";
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
  const previewDebugTextBoxes = useExtractStore((s) => s.previewDebugTextBoxes);

  if (!card) return null;

  const isAnalyzed = card.status === "analyzed" && card.analysis;
  const imgSrc = card.previewUrl;
  const activeAnalysis = getStageAnalysis(card, card.activeStage);
  const activeProposals = activeAnalysis?.proposals ?? [];
  const activeSource = activeAnalysis?.source ?? card.analysis?.source;
  const srcW = activeSource?.dimensions.w ?? 0;
  const srcH = activeSource?.dimensions.h ?? 0;
  const scaleX = srcW > 0 ? card.size.w / srcW : 1;
  const scaleY = srcH > 0 ? card.size.h / srcH : 1;
  const selectedTemplateIndex =
    activeProposals[card.selectedTemplateIndex[card.activeStage]]
      ? card.selectedTemplateIndex[card.activeStage]
      : 0;

  const extractAnalysis = getStageAnalysis(card, "extract");
  const refineAnalysis = getStageAnalysis(card, "refine");
  const extractSlideProposal = getSlideProposal(extractAnalysis?.proposals);
  const refineSlideProposal = getSlideProposal(refineAnalysis?.proposals);
  const previewOptions = [
    { value: "original" as const, label: "Original" },
    { value: "extract" as const, label: "Extract" },
    ...(card.refineIteration > 0
      ? [
          {
            value: "iter" as const,
            label: "Iter",
          },
          { value: "diff" as const, label: "Diff" },
        ]
      : []),
  ];
  const activeViewMode = previewOptions.some((option) => option.value === card.viewMode)
    ? card.viewMode
    : "original";
  const activePreview =
    activeViewMode === "extract"
      ? {
          proposal: extractSlideProposal,
          allProposals: extractAnalysis?.proposals ?? [],
          source: extractAnalysis?.source,
        }
      : activeViewMode === "iter"
        ? {
            proposal: refineSlideProposal,
            allProposals: refineAnalysis?.proposals ?? [],
            source: refineAnalysis?.source,
          }
        : null;

  return (
    <div
      data-testid={`slide-card-${cardId}`}
      className={`absolute${card.naturalSize ? "" : " opacity-0"}`}
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
        {card.benchmarkVariant && (
          <span
            className={`rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${benchmarkBadgeClass(card.benchmarkVariant)}`}
          >
            {card.benchmarkVariant}
          </span>
        )}
        {(card.status === "analyzing" || card.refineStatus === "running") && (
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
          {/* View mode toggle — underline tabs */}
          {isAnalyzed && extractSlideProposal && (
            <div className="flex items-center gap-2">
              {previewOptions.map((option) => {
                const isActive = activeViewMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewMode(cardId, option.value);
                    }}
                    className={`text-[9px] font-medium pb-px transition-colors ${
                      isActive
                        ? "text-gray-700 border-b-2 border-gray-700"
                        : "text-gray-400 border-b-2 border-transparent hover:text-gray-500"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
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
        {activeViewMode === "diff" ? (
          <DiffImageView diffObjectUrl={card.diffObjectUrl} />
        ) : activeViewMode !== "original" && activePreview?.proposal && activePreview.source ? (
          <ReplicaPreview
            key={activeViewMode}
            proposal={activePreview.proposal}
            allProposals={activePreview.allProposals}
            canvasW={activePreview.source.dimensions.w}
            canvasH={activePreview.source.dimensions.h}
            displayW={card.size.w}
            displayH={card.size.h}
            debugTextOverflow={previewDebugTextBoxes}
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
            {isSelected && isAnalyzed && activeViewMode === "original" && activeProposals.length > 0 && (
              <div className="absolute inset-0 overflow-hidden rounded-lg">
                {activeProposals.map((proposal, i) => {
                  if (
                    proposal.region.w > srcW * 0.9 &&
                    proposal.region.h > srcH * 0.9
                  ) {
                    return null;
                  }

                  const color = regionColor(i);
                  const isActive = i === selectedTemplateIndex;

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

function DiffImageView({ diffObjectUrl }: { diffObjectUrl: string | null }) {
  if (!diffObjectUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-400">
        Diff pending
      </div>
    );
  }

  return (
    <img
      src={diffObjectUrl}
      alt=""
      className="pointer-events-none h-full w-full object-contain select-none"
    />
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
  debugTextOverflow = false,
}: {
  proposal: Proposal;
  allProposals: Proposal[];
  canvasW: number;
  canvasH: number;
  displayW: number;
  displayH: number;
  debugTextOverflow?: boolean;
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
      <LayoutSlideRenderer
        slide={layoutSlide}
        animationNone
        debugTextOverflow={debugTextOverflow}
      />
    </div>
  );
}
