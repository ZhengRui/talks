"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileText, RotateCcw } from "lucide-react";
import { useExtractStore } from "./store";
import type { SlideCard } from "./store";
import { getStageAnalysis } from "./stage-utils";
import TemplateTabs from "./TemplateTabs";
import ParamsStyleView from "./ParamsStyleView";
import InlineYaml from "./InlineYaml";
import { LogEntryRow, filterLogEntries } from "./LogModal";
import type { Inventory } from "./types";

interface TemplateInspectorProps {
  card: SlideCard;
}

function formatModel(model: string): string {
  return model.replace("claude-", "").replace("-20251001", "");
}

function formatStageMeta(parts: Array<string | null>): string {
  return parts.filter(Boolean).join(" · ");
}

/** Minimal JSON syntax highlighting for inventory raw view (light theme). */
function HighlightedJson({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2);
  const parts = json.split(/("(?:[^"\\]|\\.)*"|\b\d+\.?\d*\b|\btrue\b|\bfalse\b|\bnull\b)/g);
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[10px] leading-4">
      {parts.map((part, i) => {
        if (/^".*":?$/.test(part)) {
          const next = parts[i + 1];
          if (next && next.trimStart().startsWith(":")) {
            return <span key={i} className="text-sky-700">{part}</span>;
          }
          return <span key={i} className="text-emerald-700">{part}</span>;
        }
        if (/^\d/.test(part)) return <span key={i} className="text-amber-700">{part}</span>;
        if (/^(true|false|null)$/.test(part)) return <span key={i} className="text-violet-600">{part}</span>;
        return <span key={i} className="text-gray-400">{part}</span>;
      })}
    </pre>
  );
}

function InventoryBullet({ color }: { color: string }) {
  return (
    <span
      className={`mt-[5px] block h-[6px] w-[6px] shrink-0 rounded-full ${color}`}
    />
  );
}

/** Fixed toggle row — rendered outside the scrollable area. */
function InventoryToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between border-b border-gray-200 bg-white px-3 py-2 text-left text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 shrink-0"
    >
      <span>Inventory</span>
      <span className="text-[10px] text-gray-400">{open ? "Hide" : "Show"}</span>
    </button>
  );
}

/** Inventory content — rendered inside the scrollable area. */
function InventoryContent({ inventory }: { inventory: Inventory }) {
  const signatureVisuals = inventory.signatureVisuals ?? [];

  return (
    <div className="border-b border-gray-200">
      <div className="px-3 pt-3 pb-3 text-xs text-gray-600">
          {signatureVisuals.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Signature Visuals
              </div>
              <ul className="space-y-1.5 pl-[14px]">
                {signatureVisuals.map((item, index) => (
                  <li key={`${item.text}-${index}`} className="flex items-start gap-1.5">
                    <InventoryBullet color="bg-sky-500" />
                    <div className="min-w-0">
                      <span className="text-gray-700">{item.text}</span>
                      <span className="ml-1.5 inline-block rounded bg-gray-100 px-1 py-px text-[9px] font-medium uppercase text-gray-400">
                        {item.importance}
                      </span>
                      {item.ref ? (
                        <span className="ml-1 text-[10px] text-gray-400">({item.ref})</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Must Preserve
            </div>
            <ul className="space-y-1 pl-[14px]">
              {inventory.mustPreserve.map((item, index) => (
                <li key={`${item.text}-${index}`} className="flex items-start gap-1.5">
                  <InventoryBullet color="bg-emerald-500" />
                  <div className="min-w-0">
                    <span className="text-gray-700">{item.text}</span>
                    {item.ref ? (
                      <span className="ml-1 text-[10px] text-gray-400">({item.ref})</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {inventory.uncertainties.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Uncertainties
              </div>
              <ul className="space-y-1 pl-[14px]">
                {inventory.uncertainties.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex items-start gap-1.5">
                    <InventoryBullet color="bg-amber-400" />
                    <span className="text-amber-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {inventory.blockCandidates.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Block Candidates
              </div>
              <div className="flex flex-wrap gap-1.5 pl-[14px]">
                {inventory.blockCandidates.map((item) => (
                  <span
                    key={item.name}
                    className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700"
                  >
                    {item.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <details className="mt-2">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600">
              Raw JSON
            </summary>
            <HighlightedJson data={inventory} />
          </details>
        </div>
    </div>
  );
}

export default function TemplateInspector({ card }: TemplateInspectorProps) {
  const selectTemplate = useExtractStore((s) => s.selectTemplate);
  const openLogModal = useExtractStore((s) => s.openLogModal);
  const resetAnalysis = useExtractStore((s) => s.resetAnalysis);
  const setActiveStage = useExtractStore((s) => s.setActiveStage);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const extractAnalysis = getStageAnalysis(card, "extract");
  const critiqueAnalysis = getStageAnalysis(card, "critique");
  const activeAnalysis = getStageAnalysis(card, card.activeStage);
  const proposals = activeAnalysis?.proposals ?? [];
  const selectedIndex = proposals[card.selectedTemplateIndex[card.activeStage]]
    ? card.selectedTemplateIndex[card.activeStage]
    : 0;
  const selectedProposal = proposals[selectedIndex] ?? proposals[0] ?? null;
  const critiqueFailed = card.usedCritique && !card.pass2;
  const isCritiqueFailureView =
    card.activeStage === "critique" && critiqueFailed;
  const critiqueLogs = filterLogEntries(card.log, "critique");
  const activeMeta =
    card.activeStage === "extract"
      ? {
          pass: card.pass1,
          elapsed: card.pass1Elapsed,
          cost: card.pass1Cost,
        }
      : {
          pass: card.pass2,
          elapsed: card.pass2Elapsed,
          cost: card.pass2Cost,
        };
  const critiqueMatchesExtract =
    card.activeStage === "critique" &&
    critiqueAnalysis &&
    extractAnalysis &&
    JSON.stringify(critiqueAnalysis.proposals) ===
      JSON.stringify(extractAnalysis.proposals);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center gap-1.5 border-b border-gray-200 px-3 py-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveStage(card.id, "extract")}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            card.activeStage === "extract"
              ? "bg-gray-900 text-white"
              : "border border-gray-200 bg-white text-gray-500 hover:text-gray-700"
          }`}
        >
          Extract
        </button>
        {card.usedCritique && (
          <button
            type="button"
            onClick={() => setActiveStage(card.id, "critique")}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              card.activeStage === "critique"
                ? critiqueFailed
                  ? "bg-amber-100 text-amber-800"
                  : "bg-gray-900 text-white"
                : critiqueFailed
                  ? "border border-amber-200 bg-amber-50 text-amber-700 hover:text-amber-800"
                  : "border border-gray-200 bg-white text-gray-500 hover:text-gray-700"
            }`}
          >
            {critiqueFailed && <AlertTriangle className="h-3.5 w-3.5" />}
            Critique
          </button>
        )}
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

      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-1.5 shrink-0 text-xs text-gray-500">
        <button
          type="button"
          onClick={() => openLogModal(card.id)}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-200/60 hover:text-gray-700"
          title="View log"
        >
          <FileText className="h-3.5 w-3.5" />
          Log
        </button>
        {isCritiqueFailureView ? (
          <span className="truncate text-amber-700">Critique failed</span>
        ) : activeMeta.pass ? (
          <span className="truncate text-[10px] text-gray-400">
            {formatStageMeta([
              formatModel(activeMeta.pass.model),
              activeMeta.pass.effort,
              activeMeta.elapsed > 0 ? `${activeMeta.elapsed}s` : null,
              activeMeta.cost != null ? `$${activeMeta.cost.toFixed(2)}` : null,
            ])}
          </span>
        ) : null}
      </div>

      {isCritiqueFailureView ? (
        <div
          className="flex-1 overflow-y-auto min-h-0 px-3 py-3"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Critique pass failed. Showing critique-stage logs only; extract results remain available on the Extract tab.
          </div>
          {critiqueLogs.length === 0 ? (
            <p className="text-sm text-gray-400">No critique log entries.</p>
          ) : (
            critiqueLogs.map((entry, index) => (
              <LogEntryRow key={`${entry.timestamp}-${index}`} entry={entry} />
            ))
          )}
        </div>
      ) : (
        <>
          {proposals.length > 0 ? (
            <TemplateTabs
              proposals={proposals}
              selectedIndex={selectedIndex}
              onSelect={(i) => selectTemplate(card.id, i)}
            />
          ) : null}

          {activeAnalysis?.inventory && (
            <InventoryToggle
              open={inventoryOpen}
              onToggle={() => {
                setInventoryOpen((v) => {
                  if (!v) scrollRef.current?.scrollTo?.({ top: 0 });
                  return !v;
                });
              }}
            />
          )}

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto min-h-0"
            style={{ scrollbarWidth: "none" }}
          >
            {critiqueMatchesExtract && (
              <div className="border-b border-gray-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No changes from extract pass.
              </div>
            )}

            {proposals.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-sm text-gray-400">
                No templates extracted.
              </div>
            ) : (
              <>
                {activeAnalysis?.inventory && inventoryOpen && (
                  <InventoryContent inventory={activeAnalysis.inventory} />
                )}

                {selectedProposal ? <ParamsStyleView proposal={selectedProposal} /> : null}

                {selectedProposal ? <InlineYaml proposal={selectedProposal} /> : null}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
