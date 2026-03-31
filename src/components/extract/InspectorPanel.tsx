"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useExtractStore } from "./store";
import ThumbnailStrip from "./ThumbnailStrip";
import AnalyzeForm from "./AnalyzeForm";
import TemplateInspector from "./TemplateInspector";

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 380;

interface InspectorPanelProps {
  onAnalyze: (cardId: string) => void;
  onRefine: (cardId: string, maxIterations?: number) => void;
  onCancelRefine: (cardId: string) => void;
}

export default function InspectorPanel({
  onAnalyze,
  onRefine,
  onCancelRefine,
}: InspectorPanelProps) {
  const selectedCardId = useExtractStore((s) => s.selectedCardId);
  const cards = useExtractStore((s) => s.cards);

  const card = selectedCardId ? cards.get(selectedCardId) ?? null : null;

  const setPanelWidth = useExtractStore((s) => s.setPanelWidth);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const isResizing = useRef(false);
  const analyzeScrollRef = useRef<HTMLDivElement>(null);
  const templateScrollTargetRef = useRef<HTMLDivElement | null>(null);

  // Sync panel width to store so other components can read it
  useEffect(() => {
    setPanelWidth(collapsed ? 0 : width + 16 /* right margin */);
  }, [width, collapsed, setPanelWidth]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      const startX = e.clientX;
      const startWidth = width;

      function onMove(ev: MouseEvent) {
        if (!isResizing.current) return;
        const delta = startX - ev.clientX;
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
      }

      function onUp() {
        isResizing.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [width],
  );

  const setTemplateScrollTarget = useCallback((element: HTMLDivElement | null) => {
    templateScrollTargetRef.current = element;
  }, []);

  const getActiveScrollTarget = useCallback(() => {
    if (!card) return null;
    if (card.status === "idle" || card.status === "error") {
      return analyzeScrollRef.current;
    }
    if (card.status === "analyzing" || card.status === "analyzed") {
      return templateScrollTargetRef.current;
    }
    return null;
  }, [card]);

  const scrollToTop = useCallback(() => {
    const target = getActiveScrollTarget();
    target?.scrollTo({ top: 0, behavior: "smooth" });
  }, [getActiveScrollTarget]);

  const scrollToBottom = useCallback(() => {
    const target = getActiveScrollTarget();
    target?.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
  }, [getActiveScrollTarget]);

  // Shared style for expand/collapse toggle button
  const toggleBtnClass =
    "fixed z-30 flex h-8 w-8 items-center justify-center rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 text-gray-400 shadow-md hover:bg-white hover:text-gray-600 transition-colors";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={toggleBtnClass}
        style={{ right: 0, bottom: 24 }}
        title="Expand panel"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    );
  }

  return (
    <>
      {/* Collapse button — outer bottom left of the panel, same style as expand */}
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        className={toggleBtnClass}
        style={{
          right: width + 16 + 8,
          bottom: 24,
          borderRadius: "8px 0 0 8px",
        }}
        title="Collapse panel"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div
        className="fixed z-20 flex flex-col rounded-xl border border-gray-200 bg-gray-100 shadow-xl"
        style={{ right: 16, top: 16, bottom: 16, width }}
      >
        {/* Resize handle — hover animates the vertical line */}
        <div
          className="group absolute left-0 top-0 bottom-0 z-30 flex w-3 cursor-col-resize items-center justify-center rounded-l-xl"
          onMouseDown={handleResizeStart}
        >
          <div className="h-8 w-1 rounded-full bg-gray-300 transition-all duration-300 group-hover:h-16 group-hover:bg-gray-500" />
        </div>

        <ThumbnailStrip />

        <div className="flex flex-1 flex-col min-h-0">
          {!card && (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Select a slide to inspect
            </div>
          )}

          {card && (card.status === "idle" || card.status === "error") && (
            <div ref={analyzeScrollRef} className="overflow-y-auto min-h-0">
              <AnalyzeForm card={card} onAnalyze={onAnalyze} />
            </div>
          )}

          {card && (card.status === "analyzing" || card.status === "analyzed") && (
            <TemplateInspector
              card={card}
              onRefine={onRefine}
              onCancelRefine={onCancelRefine}
              onScrollTargetChange={setTemplateScrollTarget}
              defaultTab={
                // Stay on log until the entire pipeline is done.
                // Pipeline is done when: analyzed + refine is not running
                card.status === "analyzed" && card.refineStatus !== "running"
                  ? "result"
                  : "log"
              }
            />
          )}
        </div>

        {card ? (
          <div className="pointer-events-none absolute bottom-4 right-4 z-30 flex flex-col gap-2">
            <button
              type="button"
              onClick={scrollToTop}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-500 shadow-md backdrop-blur transition-colors hover:bg-white hover:text-gray-700"
              title="Jump to top"
            >
              <ArrowUpToLine className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={scrollToBottom}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-500 shadow-md backdrop-blur transition-colors hover:bg-white hover:text-gray-700"
              title="Jump to bottom"
            >
              <ArrowDownToLine className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
