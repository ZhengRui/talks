"use client";

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
        <button
          type="button"
          onClick={() => resetAnalysis(card.id)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-200/60 hover:text-gray-700"
          title="Reset analysis"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
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
