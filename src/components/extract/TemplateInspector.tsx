"use client";

import { useRef, useState, useEffect } from "react";
import { Check, Copy, RotateCcw, Sparkles } from "lucide-react";
import { formatModelLabel } from "@/lib/extract/providers/catalog";
import { resolveCardRefinePass, useExtractStore } from "./store";
import type { SlideCard } from "./store";
import { getStageAnalysis } from "./stage-utils";
import TemplateTabs from "./TemplateTabs";
import ParamsStyleView from "./ParamsStyleView";
import InlineYaml from "./InlineYaml";
import { LogEntryRow, filterLogEntries, LOG_ICONS } from "./log-utils";
import type { Inventory, PromptRecord } from "./types";
import type { LogEntry } from "./store";

function CopyLogButton({ log }: { log: LogEntry[] }) {
  const [copied, setCopied] = useState(false);
  const text = log.map((e) => `${LOG_ICONS[e.type] ?? ""} ${e.content}`).join("\n\n");
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="sticky top-0 float-right z-10 flex h-6 w-6 items-center justify-center rounded bg-white/80 text-gray-400 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-gray-600"
      title={copied ? "Copied!" : "Copy log"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CopyPromptButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="absolute right-5 top-5 z-10 flex h-6 w-6 items-center justify-center rounded bg-white/80 text-gray-400 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-gray-600"
      title={copied ? "Copied!" : "Copy prompt"}
      aria-label={copied ? "Copied!" : "Copy prompt"}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

interface TemplateInspectorProps {
  card: SlideCard;
  onAnalyze?: (cardId: string) => void;
  onRefine: (cardId: string, maxIterations?: number) => void;
  onCancelRefine: (cardId: string) => void;
  defaultTab?: "result" | "log" | "prompt";
  onScrollTargetChange?: (element: HTMLDivElement | null) => void;
}

function formatModel(model: string, provider: string = "claude-code"): string {
  return formatModelLabel(provider as "claude-code" | "openai-codex" | "mock", model);
}

function formatStageMeta(parts: Array<string | null>): string {
  return parts.filter(Boolean).join(" · ");
}

function filterPromptEntries(promptHistory: PromptRecord[], stage: "extract" | "refine"): PromptRecord[] {
  return promptHistory.filter((entry) => entry.stage === stage);
}

function formatPromptHeading(entry: PromptRecord): string {
  const modelMeta = entry.model
    ? formatStageMeta([
        formatModel(entry.model, entry.provider),
        entry.effort ?? null,
      ])
    : null;

  if (entry.stage === "extract") {
    return modelMeta ? `Extract · ${modelMeta}` : "Extract";
  }

  const phaseLabel = entry.phase === "vision" ? "Vision" : "Edit";
  const iterLabel = entry.iteration != null ? `Iter ${entry.iteration}` : "Iter ?";
  return modelMeta
    ? `${iterLabel} · ${phaseLabel} · ${modelMeta}`
    : `${iterLabel} · ${phaseLabel}`;
}

function PromptPane({ entries }: { entries: PromptRecord[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-gray-400">
        No prompts captured for this stage yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      {entries.map((entry, index) => (
        <div key={`${entry.timestamp}-${index}`} className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-700">
            {formatPromptHeading(entry)}
          </div>
          <PromptSection label="System Prompt" text={entry.systemPrompt} />
          <PromptSection label="User Prompt" text={entry.userPrompt} />
        </div>
      ))}
    </div>
  );
}

function PromptSection({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-gray-50"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </span>
        <span className="text-[10px] text-gray-500">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <div className="relative px-3 pb-3">
          <CopyPromptButton text={text} />
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] leading-5 text-gray-700">
            {text}
          </pre>
        </div>
      ) : null}
    </div>
  );
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

/** Popover that left-aligns by default but flips to right-align when it would overflow the viewport. */
function ResetConfirmPopover({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<"measuring" | "left" | "right">("measuring");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPlacement(rect.right > window.innerWidth ? "right" : "left");
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onCancel} />
      <div
        ref={ref}
        className={`absolute top-[calc(100%+7px)] z-20 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg ${placement === "right" ? "right-0" : "left-0"} ${placement === "measuring" ? "opacity-0" : "opacity-100"}`}
      >
        <p className="text-xs text-gray-600 mb-2.5">Clear all extracted templates?</p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

export default function TemplateInspector({
  card,
  onAnalyze,
  onRefine,
  onCancelRefine,
  defaultTab = "result",
  onScrollTargetChange,
}: TemplateInspectorProps) {
  const selectTemplate = useExtractStore((s) => s.selectTemplate);
  const resetAnalysis = useExtractStore((s) => s.resetAnalysis);
  const setActiveStage = useExtractStore((s) => s.setActiveStage);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const resultScrollRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const promptScrollRef = useRef<HTMLDivElement>(null);

  const activeAnalysis = getStageAnalysis(card, card.activeStage);
  const proposals = activeAnalysis?.proposals ?? [];
  const selectedIndex = proposals[card.selectedTemplateIndex[card.activeStage]]
    ? card.selectedTemplateIndex[card.activeStage]
    : 0;
  const selectedProposal = proposals[selectedIndex] ?? proposals[0] ?? null;
  const hasRefineStage = card.autoRefine || card.refineStatus !== "idle" || card.refineAnalysis !== null;
  const activeMeta =
    card.activeStage === "extract"
      ? {
          pass: card.pass1,
          elapsed: card.pass1Elapsed,
          cost: card.pass1Cost,
        }
      : null;
  const refineSummary = card.refineResult
    ? `${card.refineIteration}/${card.refineMaxIterations} · ${Math.round(card.refineResult.mismatchRatio * 100)}%`
    : card.refineStatus === "running"
      ? `${card.refineIteration}/${card.refineMaxIterations}`
      : null;

  const refineVisionSelection = useExtractStore((s) => s.refineVisionSelection);
  const refineEditSelection = useExtractStore((s) => s.refineEditSelection);
  const refinePass = resolveCardRefinePass(card, {
    refineVisionSelection,
    refineEditSelection,
  });
  const [viewTab, setViewTab] = useState<"result" | "log" | "prompt">(defaultTab);
  // Sync when defaultTab changes (e.g. analyzing → analyzed)
  const prevDefaultTab = useRef(defaultTab);
  useEffect(() => {
    if (prevDefaultTab.current !== defaultTab) {
      setViewTab(defaultTab);
      prevDefaultTab.current = defaultTab;
    }
  }, [defaultTab]);

  useEffect(() => {
    if (!onScrollTargetChange) return;

    const nextTarget =
      viewTab === "log"
        ? logScrollRef.current
        : viewTab === "prompt"
          ? promptScrollRef.current
          : resultScrollRef.current;

    onScrollTargetChange(nextTarget);

    return () => {
      onScrollTargetChange(null);
    };
  }, [onScrollTargetChange, viewTab, card.activeStage, proposals.length, inventoryOpen]);

  const activeLogEntries = filterLogEntries(card.log, card.activeStage);
  const activePromptEntries = filterPromptEntries(card.promptHistory ?? [], card.activeStage);
  const activeStageError = card.activeStage === "extract" ? card.error : card.refineError;
  const showRetryAnalyze = card.activeStage === "extract" && card.status === "error" && Boolean(onAnalyze);

  // Build stage meta string for the active stage
  const stageMetaLines = (() => {
    if (card.activeStage === "refine") {
      const resolvedPass = refinePass;
      const totals = formatStageMeta([
        card.refineElapsed > 0 ? `${card.refineElapsed}s` : null,
        card.refineCost != null ? `$${card.refineCost.toFixed(2)}` : null,
      ]);

      if (
        resolvedPass.visionModel === resolvedPass.editModel &&
        resolvedPass.visionEffort === resolvedPass.editEffort
      ) {
        return [
          formatStageMeta([
            formatModel(resolvedPass.visionModel, resolvedPass.vision?.provider),
            resolvedPass.visionEffort,
            totals || null,
          ]),
        ];
      }

      return [
        `vision: ${formatStageMeta([
          formatModel(resolvedPass.visionModel, resolvedPass.vision?.provider),
          resolvedPass.visionEffort,
        ])}`,
        `edit: ${formatStageMeta([
          formatModel(resolvedPass.editModel, resolvedPass.edit?.provider),
          resolvedPass.editEffort,
        ])}`,
        ...(totals ? [totals] : []),
      ];
    }
    if (activeMeta?.pass) {
      return [formatStageMeta([
        formatModel(activeMeta.pass.model, activeMeta.pass.provider),
        activeMeta.pass.effort,
        activeMeta.elapsed > 0 ? `${activeMeta.elapsed}s` : null,
        activeMeta.cost != null ? `$${activeMeta.cost.toFixed(2)}` : null,
      ])];
    }
    return null;
  })();

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Row 1: Stage tabs + Reset (far right) */}
      <div className="@container flex items-center gap-1.5 border-b border-gray-200 px-3 py-2 shrink-0">
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
        {hasRefineStage && (
          <button
            type="button"
            onClick={() => setActiveStage(card.id, "refine")}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              card.activeStage === "refine"
                ? "bg-gray-900 text-white"
                : "border border-gray-200 bg-white text-gray-500 hover:text-gray-700"
            }`}
          >
            Refine
            {refineSummary ? (
              <span className={card.activeStage === "refine" ? "text-white/80" : "text-gray-400"}>
                {refineSummary}
              </span>
            ) : null}
          </button>
        )}
        <div className="flex-1" />
        {card.refineStatus === "running" && (
          <button
            type="button"
            onClick={() => onCancelRefine(card.id)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-amber-600 transition-colors hover:bg-amber-100/60 hover:text-amber-700"
            title="Cancel refinement"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            <span className="hidden @[22rem]:inline">Cancel</span>
          </button>
        )}
        {showRetryAnalyze && onAnalyze && (
          <button
            type="button"
            onClick={() => onAnalyze(card.id)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-100/60 hover:text-red-700"
            title="Retry extract"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden @[22rem]:inline">Retry</span>
          </button>
        )}
        {card.status === "analyzed" && card.refineStatus !== "running" && (
          <button
            type="button"
            onClick={() => onRefine(card.id, 1)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-200/60 hover:text-gray-700"
            title="Refine one more iteration"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden @[22rem]:inline">Refine</span>
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
            <span className="hidden @[22rem]:inline">Reset</span>
          </button>
          {showResetConfirm && (
            <ResetConfirmPopover
              onConfirm={() => { resetAnalysis(card.id); setShowResetConfirm(false); }}
              onCancel={() => setShowResetConfirm(false)}
            />
          )}
        </div>
      </div>

      {/* Row 2: Result/Log toggle + stage meta (far right) */}
      <div className="@container flex items-center gap-2 border-b border-gray-200 px-3 py-1.5 shrink-0 text-xs">
        <div className="flex overflow-hidden rounded-md border border-gray-200 shrink-0">
          <button
            type="button"
            onClick={() => setViewTab("result")}
            className={`w-[72px] px-2.5 py-1 text-xs font-medium transition-colors ${
              viewTab === "result"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-500 hover:text-gray-700"
            }`}
          >
            Result
          </button>
          <button
            type="button"
            onClick={() => setViewTab("log")}
            className={`w-[72px] border-l border-gray-200 px-2.5 py-1 text-xs font-medium transition-colors ${
              viewTab === "log"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-500 hover:text-gray-700"
            }`}
          >
            Log
          </button>
          <button
            type="button"
            onClick={() => setViewTab("prompt")}
            className={`w-[72px] border-l border-gray-200 px-2.5 py-1 text-xs font-medium transition-colors ${
              viewTab === "prompt"
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-500 hover:text-gray-700"
            }`}
          >
            Prompt
          </button>
        </div>
        <div className="flex-1" />
        {stageMetaLines ? (
          <div className="hidden @[22rem]:flex flex-col items-end text-[10px] text-gray-400">
            {stageMetaLines.map((line) => (
              <span key={line} className="truncate">{line}</span>
            ))}
          </div>
        ) : null}
      </div>

      {activeStageError ? (
        <div className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <div className="font-medium">Stage error</div>
          <div className="mt-1 leading-5">{activeStageError}</div>
          {showRetryAnalyze ? (
            <div className="mt-1 text-red-600/80">Use Retry to rerun current settings, or Reset to change them.</div>
          ) : null}
        </div>
      ) : null}

      {viewTab === "log" ? (
        /* Log view — inline, filtered to active stage */
        <div
          ref={logScrollRef}
          className="relative flex-1 overflow-y-auto min-h-0 px-3 py-3"
          style={{ scrollbarWidth: "none" }}
        >
          {activeLogEntries.length > 0 && (
            <CopyLogButton log={activeLogEntries} />
          )}
          {activeLogEntries.length === 0 ? (
            <p className="text-sm text-gray-400">No log entries for this stage.</p>
          ) : (
            activeLogEntries.map((entry, index) => (
              <LogEntryRow key={`${entry.timestamp}-${index}`} entry={entry} />
            ))
          )}
        </div>
      ) : viewTab === "prompt" ? (
        <div
          ref={promptScrollRef}
          className="flex-1 overflow-y-auto min-h-0"
          style={{ scrollbarWidth: "none" }}
        >
          <PromptPane entries={activePromptEntries} />
        </div>
      ) : (
        /* Result view */
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
                  if (!v) resultScrollRef.current?.scrollTo?.({ top: 0 });
                  return !v;
                });
              }}
            />
          )}

          <div
            ref={resultScrollRef}
            className="flex-1 overflow-y-auto min-h-0"
            style={{ scrollbarWidth: "none" }}
          >
            {card.activeStage === "refine" && (card.refineStartMismatch != null || card.refineHistory.length > 0) && (
              <div className="border-b border-gray-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 font-mono tabular-nums">
                {card.refineStartMismatch != null && (
                  <div className="flex">
                    <span className="w-12 text-right">Start</span>
                    <span className="px-0.5">:</span>
                    <span>{Math.round(card.refineStartMismatch * 100)}%</span>
                  </div>
                )}
                {card.refineHistory.map((item) => (
                  <div key={item.iteration} className="flex">
                    <span className="w-12 text-right">Iter {item.iteration}</span>
                    <span className="px-0.5">:</span>
                    <span>{Math.round(item.mismatchRatio * 100)}%</span>
                  </div>
                ))}
              </div>
            )}

            {proposals.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-sm text-gray-400">
                {activeStageError ? "No parsed result for this stage. Check Log or Prompt." : "No templates extracted."}
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
