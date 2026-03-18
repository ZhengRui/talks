"use client";

import { useExtractStore } from "./store";
import type { SlideCard } from "./store";
import TemplateTabs from "./TemplateTabs";
import ParamsStyleView from "./ParamsStyleView";

interface TemplateInspectorProps {
  card: SlideCard;
}

export default function TemplateInspector({ card }: TemplateInspectorProps) {
  const selectTemplate = useExtractStore((s) => s.selectTemplate);
  const openYamlModal = useExtractStore((s) => s.openYamlModal);
  const openLogModal = useExtractStore((s) => s.openLogModal);

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
    <div className="flex flex-col">
      <TemplateTabs
        proposals={proposals}
        selectedIndex={selectedIndex}
        onSelect={(i) => selectTemplate(card.id, i)}
      />

      <ParamsStyleView proposal={selectedProposal} />

      <div className="flex items-center justify-end gap-1.5 border-t border-gray-200 px-3 py-2">
        <button
          type="button"
          onClick={() => openYamlModal(card.id, selectedIndex)}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title="View YAML"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
          </svg>
          YAML
        </button>
        <button
          type="button"
          onClick={() => openLogModal(card.id)}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          title="View log"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          Log
        </button>
      </div>
    </div>
  );
}
