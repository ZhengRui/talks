"use client";

import { useEffect, useRef, useState } from "react";
import { useExtractStore } from "./store";
import {
  RowLayoutIcon,
  ColLayoutIcon,
  Grid2x2Icon,
  Grid3x3Icon,
  CustomGridIcon,
  TextFrameDebugIcon,
} from "./icons";

const layouts = [
  {
    cols: Infinity,
    key: "row",
    label: "Row",
    title: "Arrange in one row",
    icon: <RowLayoutIcon />,
  },
  {
    cols: 1,
    key: "1",
    label: "Col",
    title: "Arrange in one column",
    icon: <ColLayoutIcon />,
  },
  {
    cols: 2,
    key: "2",
    label: "2x2",
    title: "Arrange in 2-column grid",
    icon: <Grid2x2Icon />,
  },
  {
    cols: 3,
    key: "3",
    label: "3x3",
    title: "Arrange in 3-column grid",
    icon: <Grid3x3Icon />,
  },
];

export default function CanvasToolbar({
  onOpenBenchmark,
}: {
  onOpenBenchmark: () => void;
}) {
  const cardOrder = useExtractStore((s) => s.cardOrder);
  const arrangeCards = useExtractStore((s) => s.arrangeCards);
  const layoutKey = useExtractStore((s) => s.layoutKey);
  const previewDebugTextBoxes = useExtractStore((s) => s.previewDebugTextBoxes);
  const setPreviewDebugTextBoxes = useExtractStore((s) => s.setPreviewDebugTextBoxes);
  const [showCustom, setShowCustom] = useState(false);
  const [customCols, setCustomCols] = useState("4");
  const popupRef = useRef<HTMLDivElement>(null);

  const hasCards = cardOrder.length >= 2;
  const presetKeys = new Set(["row", "1", "2", "3"]);
  const isCustomActive = hasCards && !presetKeys.has(layoutKey);

  // Close popup on outside click
  useEffect(() => {
    if (!showCustom) return;
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowCustom(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showCustom]);

  return (
    <div className="fixed left-4 top-4 z-10 flex items-center gap-2">
      <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white/90 px-1.5 py-1 shadow-md backdrop-blur-sm">
        {layouts.map((layout) => {
          const active = hasCards && layoutKey === layout.key;
          return (
            <button
              key={layout.key}
              type="button"
              disabled={!hasCards}
              onClick={() => {
                const cols = layout.cols === Infinity ? cardOrder.length : layout.cols;
                arrangeCards(cols, layout.key);
              }}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none ${
                active
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              }`}
              title={layout.title}
            >
              {layout.icon}
            </button>
          );
        })}

        {/* Divider */}
        <div className="mx-0.5 h-4 w-px bg-gray-200" />

        {/* Custom grid */}
        <div className="relative" ref={popupRef}>
          <button
            type="button"
            disabled={!hasCards}
            onClick={() => setShowCustom(!showCustom)}
            className={`flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] transition-colors disabled:opacity-30 disabled:pointer-events-none ${
              isCustomActive
                ? "bg-blue-50 text-blue-600"
                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            }`}
            title="Custom grid"
          >
            <CustomGridIcon />
          </button>

          {showCustom && (
            <div className="absolute left-0 top-full mt-1 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
              <input
                type="number"
                min={1}
                max={20}
                value={customCols}
                onChange={(e) => setCustomCols(e.target.value)}
                className="h-7 w-12 rounded-md border border-gray-200 bg-gray-50 px-2 text-center text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
                placeholder="cols"
              />
              <span className="text-xs text-gray-400">cols</span>
              <button
                type="button"
                onClick={() => {
                  const cols = parseInt(customCols, 10);
                  if (cols > 0) {
                    arrangeCards(cols, `custom-${cols}`);
                    setShowCustom(false);
                  }
                }}
                className="flex h-7 items-center rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-0.5 h-4 w-px bg-gray-200" />

        {/* Preview text-box debug toggle */}
        <button
          type="button"
          onClick={() => setPreviewDebugTextBoxes(!previewDebugTextBoxes)}
          className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
            previewDebugTextBoxes
              ? "bg-blue-50 text-blue-600"
              : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          }`}
          title="Toggle preview text box guides"
          aria-label="Toggle preview text box guides"
        >
          <TextFrameDebugIcon />
        </button>
      </div>

      <button
        type="button"
        onClick={onOpenBenchmark}
        className="flex h-9 items-center rounded-lg border border-gray-200 bg-white/90 px-3 text-[11px] font-medium text-gray-500 shadow-md transition-colors backdrop-blur-sm hover:bg-gray-100 hover:text-gray-700"
        title="Load benchmark cards from content decks"
      >
        Bench
      </button>
    </div>
  );
}
