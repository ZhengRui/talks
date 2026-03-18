"use client";

import { useEffect, useRef, useState } from "react";
import { useExtractStore } from "./store";

// Stroke-only icons for thin, clean look
const S = "currentColor";
const W = 1.2;

const layouts = [
  {
    cols: Infinity,
    key: "row",
    label: "Row",
    title: "Arrange in one row",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke={S} strokeWidth={W}>
        <rect x="1.5" y="5.5" width="4.5" height="9" rx="1" />
        <rect x="7.75" y="5.5" width="4.5" height="9" rx="1" />
        <rect x="14" y="5.5" width="4.5" height="9" rx="1" />
      </svg>
    ),
  },
  {
    cols: 1,
    key: "1",
    label: "Col",
    title: "Arrange in one column",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke={S} strokeWidth={W}>
        <rect x="3.5" y="1.5" width="13" height="4.5" rx="1" />
        <rect x="3.5" y="7.75" width="13" height="4.5" rx="1" />
        <rect x="3.5" y="14" width="13" height="4.5" rx="1" />
      </svg>
    ),
  },
  {
    cols: 2,
    key: "2",
    label: "2x2",
    title: "Arrange in 2-column grid",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke={S} strokeWidth={W}>
        <rect x="1.5" y="1.5" width="7" height="7" rx="1" />
        <rect x="11.5" y="1.5" width="7" height="7" rx="1" />
        <rect x="1.5" y="11.5" width="7" height="7" rx="1" />
        <rect x="11.5" y="11.5" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    cols: 3,
    key: "3",
    label: "3x3",
    title: "Arrange in 3-column grid",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke={S} strokeWidth={W}>
        <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="0.75" />
        <rect x="7.75" y="1.5" width="4.5" height="4.5" rx="0.75" />
        <rect x="14" y="1.5" width="4.5" height="4.5" rx="0.75" />
        <rect x="1.5" y="7.75" width="4.5" height="4.5" rx="0.75" />
        <rect x="7.75" y="7.75" width="4.5" height="4.5" rx="0.75" />
        <rect x="14" y="7.75" width="4.5" height="4.5" rx="0.75" />
        <rect x="1.5" y="14" width="4.5" height="4.5" rx="0.75" />
        <rect x="7.75" y="14" width="4.5" height="4.5" rx="0.75" />
        <rect x="14" y="14" width="4.5" height="4.5" rx="0.75" />
      </svg>
    ),
  },
];

export default function CanvasToolbar() {
  const cardOrder = useExtractStore((s) => s.cardOrder);
  const arrangeCards = useExtractStore((s) => s.arrangeCards);
  const layoutKey = useExtractStore((s) => s.layoutKey);
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
    <div className="fixed left-4 top-4 z-10 flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white/90 px-1.5 py-1 shadow-md backdrop-blur-sm">
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
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={W}>
            <rect x="1.5" y="1.5" width="3" height="3" rx="0.5" />
            <rect x="6.25" y="1.5" width="3" height="3" rx="0.5" />
            <rect x="11" y="1.5" width="3" height="3" rx="0.5" />
            <rect x="15.5" y="1.5" width="3" height="3" rx="0.5" />
            <rect x="1.5" y="6.25" width="3" height="3" rx="0.5" />
            <rect x="6.25" y="6.25" width="3" height="3" rx="0.5" />
            <rect x="11" y="6.25" width="3" height="3" rx="0.5" />
            <rect x="15.5" y="6.25" width="3" height="3" rx="0.5" />
            <rect x="1.5" y="11" width="3" height="3" rx="0.5" />
            <rect x="6.25" y="11" width="3" height="3" rx="0.5" />
            <rect x="11" y="11" width="3" height="3" rx="0.5" />
            <rect x="15.5" y="11" width="3" height="3" rx="0.5" />
            <rect x="1.5" y="15.5" width="3" height="3" rx="0.5" />
            <rect x="6.25" y="15.5" width="3" height="3" rx="0.5" />
            <rect x="11" y="15.5" width="3" height="3" rx="0.5" />
            <rect x="15.5" y="15.5" width="3" height="3" rx="0.5" />
          </svg>
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
    </div>
  );
}
