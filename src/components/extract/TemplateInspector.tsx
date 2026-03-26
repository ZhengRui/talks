"use client";

import { useState } from "react";
import { FileText, RotateCcw } from "lucide-react";
import { useExtractStore } from "./store";
import type { SlideCard } from "./store";
import TemplateTabs from "./TemplateTabs";
import ParamsStyleView from "./ParamsStyleView";
import InlineYaml from "./InlineYaml";
import type { Inventory } from "./types";

interface TemplateInspectorProps {
  card: SlideCard;
}

function InventorySection({ inventory }: { inventory: Inventory }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
      >
        <span>Inventory</span>
        <span className="text-[10px] text-gray-400">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="space-y-3 px-3 pb-3 text-xs text-gray-600">
          <div>
            <div className="mb-1 font-medium text-gray-700">Must Preserve</div>
            <ul className="space-y-1">
              {inventory.mustPreserve.map((item, index) => (
                <li key={`${item.text}-${index}`} className="flex items-start gap-2">
                  <span className="mt-[3px] inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>
                    {item.text}
                    {item.ref ? (
                      <span className="ml-1 text-[10px] text-gray-400">({item.ref})</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {inventory.uncertainties.length > 0 && (
            <div>
              <div className="mb-1 font-medium text-gray-700">Uncertainties</div>
              <ul className="space-y-1">
                {inventory.uncertainties.map((item, index) => (
                  <li key={`${item}-${index}`} className="text-amber-700">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {inventory.blockCandidates.length > 0 && (
            <div>
              <div className="mb-1 font-medium text-gray-700">Block Candidates</div>
              <div className="flex flex-wrap gap-1.5">
                {inventory.blockCandidates.map((item) => (
                  <span
                    key={item.name}
                    className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700"
                  >
                    {item.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <details>
            <summary className="cursor-pointer font-medium text-gray-700">Raw JSON</summary>
            <pre className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-2 text-[10px] leading-4 text-gray-600">
              {JSON.stringify(inventory, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
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
        {card.usedModel && (
          <span className="ml-auto text-[10px] text-gray-400 whitespace-nowrap">
            {card.usedModel.replace("claude-", "").replace("-20251001", "")}
            {card.usedEffort ? ` / ${card.usedEffort}` : ""}
            {card.elapsed > 0 ? ` / ${card.elapsed}s` : ""}
          </span>
        )}
      </div>

      {/* Fixed: template tabs */}
      <TemplateTabs
        proposals={proposals}
        selectedIndex={selectedIndex}
        onSelect={(i) => selectTemplate(card.id, i)}
      />

      {/* Scrollable: params + style + YAML */}
      <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: "none" }}>
        {card.analysis?.inventory ? <InventorySection inventory={card.analysis.inventory} /> : null}

        <ParamsStyleView proposal={selectedProposal} />

        <InlineYaml proposal={selectedProposal} />
      </div>
    </div>
  );
}
