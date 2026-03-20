"use client";

import { useState } from "react";
import { FileText, RotateCcw } from "lucide-react";
import { useExtractStore } from "./store";
import type { SlideCard } from "./store";
import TemplateTabs from "./TemplateTabs";
import ParamsStyleView from "./ParamsStyleView";
import InlineYaml from "./InlineYaml";

interface TemplateInspectorProps {
  card: SlideCard;
}

export default function TemplateInspector({ card }: TemplateInspectorProps) {
  const selectTemplate = useExtractStore((s) => s.selectTemplate);
  const openLogModal = useExtractStore((s) => s.openLogModal);
  const resetAnalysis = useExtractStore((s) => s.resetAnalysis);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const proposals = card.analysis?.proposals ?? [];

  if (proposals.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-gray-400">
        No templates extracted.
      </div>
    );
  }

  const selectedIndex = card.selectedTemplateIndex;
  const selectedProposal = proposals[selectedIndex] ?? proposals[0];

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Fixed: action bar */}
      <div className="flex items-center gap-1.5 border-b border-gray-200 px-3 py-1.5 shrink-0">
        <button
          type="button"
          onClick={() => openLogModal(card.id)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-200/60 hover:text-gray-700"
          title="View log"
        >
          <FileText className="h-3.5 w-3.5" />
          Log
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-200/60 hover:text-gray-700"
            title="Reset analysis"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          {showResetConfirm && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowResetConfirm(false)} />
              <div className="absolute left-0 top-[calc(100%+7px)] z-20 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                <p className="text-xs text-gray-600 mb-2.5">Clear all extracted templates?</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      resetAnalysis(card.id);
                      setShowResetConfirm(false);
                    }}
                    className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="rounded-md px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fixed: template tabs */}
      <TemplateTabs
        proposals={proposals}
        selectedIndex={selectedIndex}
        onSelect={(i) => selectTemplate(card.id, i)}
      />

      {/* Scrollable: params + style + YAML */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: "none" }}>
        <ParamsStyleView proposal={selectedProposal} />

        <InlineYaml proposal={selectedProposal} />
      </div>
    </div>
  );
}
