"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useExtractStore } from "./store";
import ThumbnailStrip from "./ThumbnailStrip";
import AnalyzeForm from "./AnalyzeForm";
import AnalyzingSpinner from "./AnalyzingSpinner";
import TemplateInspector from "./TemplateInspector";

const MIN_WIDTH = 300;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 380;

interface InspectorPanelProps {
  onAnalyze: (cardId: string) => void;
}

export default function InspectorPanel({ onAnalyze }: InspectorPanelProps) {
  const selectedCardId = useExtractStore((s) => s.selectedCardId);
  const cards = useExtractStore((s) => s.cards);

  const card = selectedCardId ? cards.get(selectedCardId) ?? null : null;

  const setPanelWidth = useExtractStore((s) => s.setPanelWidth);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const isResizing = useRef(false);

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
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
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
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      <div
        className="fixed z-20 flex flex-col rounded-xl border border-gray-200 bg-gray-50/80 shadow-xl backdrop-blur-sm"
        style={{ right: 16, top: 16, bottom: 16, width }}
      >
        {/* Resize handle — hover animates the vertical line */}
        <div
          className="group absolute left-0 top-0 bottom-0 flex w-3 cursor-col-resize items-center justify-center rounded-l-xl"
          onMouseDown={handleResizeStart}
        >
          <div className="h-8 w-1 rounded-full bg-gray-300 transition-all duration-300 group-hover:h-16 group-hover:bg-gray-500" />
        </div>

        <ThumbnailStrip />

        <div className="flex-1 overflow-y-auto">
          {!card && (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Select a slide to inspect
            </div>
          )}

          {card && (card.status === "idle" || card.status === "error") && (
            <AnalyzeForm card={card} onAnalyze={onAnalyze} />
          )}

          {card && card.status === "analyzing" && (
            <AnalyzingSpinner card={card} />
          )}

          {card && card.status === "analyzed" && (
            <TemplateInspector card={card} />
          )}
        </div>
      </div>
    </>
  );
}
