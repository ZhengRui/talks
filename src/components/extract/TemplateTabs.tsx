"use client";

import type { Proposal } from "./types";
import { regionColor } from "./types";

interface TemplateTabsProps {
  proposals: Proposal[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}

export default function TemplateTabs({
  proposals,
  selectedIndex,
  onSelect,
}: TemplateTabsProps) {
  return (
    <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50/50" style={{ scrollbarWidth: "none" }}>
      {proposals.map((proposal, i) => {
        const isActive = i === selectedIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition-colors ${
              isActive
                ? "border-blue-500 bg-white text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: regionColor(i) }}
            />
            <span
              className="truncate"
              style={{ maxWidth: 120 }}
            >
              {proposal.name}
            </span>
            <span
              className={`rounded px-1 py-0.5 text-[10px] font-medium ${
                proposal.scope === "slide"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {proposal.scope}
            </span>
          </button>
        );
      })}
    </div>
  );
}
