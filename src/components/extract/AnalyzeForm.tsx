"use client";

import { Sparkles } from "lucide-react";
import {
  getCatalogEntriesForProvider,
  getModelCatalogEntry,
  getProviderOptions,
} from "@/lib/extract/providers/catalog";
import type { ProviderSelection } from "@/lib/extract/providers/shared";
import { resolveCardRefinePass, useExtractStore } from "./store";
import type { SlideCard } from "./store";

interface AnalyzeFormProps {
  card: SlideCard;
  onAnalyze: (cardId: string) => void;
}

const PASS_ROW_BREAKPOINT = 560;

function effortPrefix(selection: ProviderSelection): string {
  const entry = getModelCatalogEntry(selection.provider, selection.model);
  return entry?.effortMode === "budget" ? "Think" : "Effort";
}

function PassRow({
  label,
  selection,
  onProviderChange,
  onModelChange,
  onEffortChange,
  disabled,
  sub,
  wide,
}: {
  label: string;
  selection: ProviderSelection;
  onProviderChange: (provider: ProviderSelection["provider"]) => void;
  onModelChange: (model: string) => void;
  onEffortChange: (effort: string) => void;
  disabled?: boolean;
  sub?: boolean;
  wide: boolean;
}) {
  const providerOptions = getProviderOptions();
  const modelOptions = getCatalogEntriesForProvider(selection.provider);
  const currentEntry = getModelCatalogEntry(selection.provider, selection.model) ?? modelOptions[0];
  const effortOptions = currentEntry?.effortOptions ?? [];
  const effortLabel = effortPrefix(selection);

  if (wide) {
    return (
      <div className={`flex items-center gap-2${sub ? " pl-5" : ""}`}>
        <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${sub ? "text-gray-400 w-[52px]" : "text-gray-600 w-[72px]"}`}>
          {!sub && <span className="inline-block h-3.5 w-3.5 rounded bg-blue-600" />}
          {label}
        </span>
        <select
          value={selection.provider}
          onChange={(e) => onProviderChange(e.target.value as ProviderSelection["provider"])}
          disabled={disabled}
          className={`flex-1 min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none ${disabled ? "opacity-40 pointer-events-none" : ""}`}
        >
          {providerOptions.map((provider) => (
            <option key={provider.value} value={provider.value}>{provider.label}</option>
          ))}
        </select>
        <select
          value={selection.model}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={disabled}
          className={`flex-1 min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none ${disabled ? "opacity-40 pointer-events-none" : ""}`}
        >
          {modelOptions.map((model) => (
            <option key={model.model} value={model.model}>{model.label}</option>
          ))}
        </select>
        <select
          value={selection.effort}
          onChange={(e) => onEffortChange(e.target.value)}
          disabled={disabled}
          className={`flex-1 min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none ${disabled ? "opacity-40 pointer-events-none" : ""}`}
        >
          {effortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {`${effortLabel}: ${option.label}`}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={`flex items-center gap-1 text-xs font-medium ${sub ? "pl-5 text-gray-400" : "text-gray-600"}`}>
        {!sub && <span className="inline-block h-3.5 w-3.5 rounded bg-blue-600" />}
        {label}
      </span>
      <div className="grid min-w-0 grid-cols-2 gap-2 pl-5">
        <select
          value={selection.provider}
          onChange={(e) => onProviderChange(e.target.value as ProviderSelection["provider"])}
          disabled={disabled}
          className={`col-span-2 min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none ${disabled ? "opacity-40 pointer-events-none" : ""}`}
        >
          {providerOptions.map((provider) => (
            <option key={provider.value} value={provider.value}>{provider.label}</option>
          ))}
        </select>
        <select
          value={selection.model}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={disabled}
          className={`min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none ${disabled ? "opacity-40 pointer-events-none" : ""}`}
        >
          {modelOptions.map((model) => (
            <option key={model.model} value={model.model}>{model.label}</option>
          ))}
        </select>
        <select
          value={selection.effort}
          onChange={(e) => onEffortChange(e.target.value)}
          disabled={disabled}
          className={`min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none ${disabled ? "opacity-40 pointer-events-none" : ""}`}
        >
          {effortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {`${effortLabel}: ${option.label}`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function AnalyzeForm({ card, onAnalyze }: AnalyzeFormProps) {
  const updateDescription = useExtractStore((s) => s.updateDescription);
  const panelWidth = useExtractStore((s) => s.panelWidth);
  const analyzeSelection = useExtractStore((s) => s.analyzeSelection);
  const setAnalyzeProvider = useExtractStore((s) => s.setAnalyzeProvider);
  const setAnalyzeModel = useExtractStore((s) => s.setAnalyzeModel);
  const setAnalyzeEffort = useExtractStore((s) => s.setAnalyzeEffort);
  const setAutoRefine = useExtractStore((s) => s.setAutoRefine);
  const setCardAutoRefine = useExtractStore((s) => s.setCardAutoRefine);
  const setRefineMaxIterations = useExtractStore((s) => s.setRefineMaxIterations);
  const setRefineMismatchThreshold = useExtractStore((s) => s.setRefineMismatchThreshold);
  const refineVisionSelection = useExtractStore((s) => s.refineVisionSelection);
  const refineEditSelection = useExtractStore((s) => s.refineEditSelection);
  const setRefineVisionProvider = useExtractStore((s) => s.setRefineVisionProvider);
  const setRefineVisionModel = useExtractStore((s) => s.setRefineVisionModel);
  const setRefineVisionEffort = useExtractStore((s) => s.setRefineVisionEffort);
  const setRefineEditProvider = useExtractStore((s) => s.setRefineEditProvider);
  const setRefineEditModel = useExtractStore((s) => s.setRefineEditModel);
  const setRefineEditEffort = useExtractStore((s) => s.setRefineEditEffort);
  const setCardRefineVisionProvider = useExtractStore((s) => s.setCardRefineVisionProvider);
  const setCardRefineVisionModel = useExtractStore((s) => s.setCardRefineVisionModel);
  const setCardRefineVisionEffort = useExtractStore((s) => s.setCardRefineVisionEffort);
  const setCardRefineEditProvider = useExtractStore((s) => s.setCardRefineEditProvider);
  const setCardRefineEditModel = useExtractStore((s) => s.setCardRefineEditModel);
  const setCardRefineEditEffort = useExtractStore((s) => s.setCardRefineEditEffort);
  const refineSettingsLocked = card.refineSettingsLocked === true;
  const effectiveAutoRefine = card.autoRefine;
  const effectiveRefinePass = resolveCardRefinePass(card, {
    refineVisionSelection,
    refineEditSelection,
  });
  const effectiveRefineVisionSelection = effectiveRefinePass.vision!;
  const effectiveRefineEditSelection = effectiveRefinePass.edit!;
  const useWidePassLayout = panelWidth >= PASS_ROW_BREAKPOINT;

  const handleRefineToggle = (enabled: boolean) => {
    if (refineSettingsLocked) {
      setCardAutoRefine(card.id, enabled);
    } else {
      setAutoRefine(enabled);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <textarea
        rows={3}
        value={card.description}
        onChange={(e) => updateDescription(card.id, e.target.value)}
        placeholder="Describe the slide or what to extract..."
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none"
      />

      <div className="flex flex-col gap-1.5">
        <PassRow
          label="Extract"
          selection={analyzeSelection}
          onProviderChange={setAnalyzeProvider}
          onModelChange={setAnalyzeModel}
          onEffortChange={setAnalyzeEffort}
          wide={useWidePassLayout}
        />
        <label className="flex items-center gap-1 text-xs font-medium text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={effectiveAutoRefine}
            onChange={(e) => handleRefineToggle(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-400/40"
          />
          <span>Refine</span>
        </label>
        <PassRow
          label="Vision"
          sub
          selection={effectiveRefineVisionSelection}
          onProviderChange={(provider) => {
            if (refineSettingsLocked) {
              setCardRefineVisionProvider(card.id, provider);
            } else {
              setRefineVisionProvider(provider);
            }
          }}
          onModelChange={(model) => {
            if (refineSettingsLocked) {
              setCardRefineVisionModel(card.id, model);
            } else {
              setRefineVisionModel(model);
            }
          }}
          onEffortChange={(effort) => {
            if (refineSettingsLocked) {
              setCardRefineVisionEffort(card.id, effort);
            } else {
              setRefineVisionEffort(effort);
            }
          }}
          disabled={!effectiveAutoRefine}
          wide={useWidePassLayout}
        />
        <PassRow
          label="Edit"
          sub
          selection={effectiveRefineEditSelection}
          onProviderChange={(provider) => {
            if (refineSettingsLocked) {
              setCardRefineEditProvider(card.id, provider);
            } else {
              setRefineEditProvider(provider);
            }
          }}
          onModelChange={(model) => {
            if (refineSettingsLocked) {
              setCardRefineEditModel(card.id, model);
            } else {
              setRefineEditModel(model);
            }
          }}
          onEffortChange={(effort) => {
            if (refineSettingsLocked) {
              setCardRefineEditEffort(card.id, effort);
            } else {
              setRefineEditEffort(effort);
            }
          }}
          disabled={!effectiveAutoRefine}
          wide={useWidePassLayout}
        />
        {useWidePassLayout ? (
          <div className={`flex items-center gap-2 pl-5${!effectiveAutoRefine ? " opacity-40 pointer-events-none" : ""}`}>
            <span className="shrink-0 w-[52px]" />
            <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400/30">
              <span className="text-gray-500 whitespace-nowrap">Iters:</span>
              <input
                type="number"
                min={1}
                max={30}
                step={1}
                value={card.refineMaxIterations}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v) && v >= 1 && v <= 30) setRefineMaxIterations(card.id, v);
                }}
                disabled={!effectiveAutoRefine}
                className="flex-1 min-w-0 bg-transparent text-xs text-gray-700 focus:outline-none"
              />
            </div>
            <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400/30">
              <span className="text-gray-500 whitespace-nowrap">Target:</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round(card.refineMismatchThreshold * 100)}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v) && v >= 0 && v <= 100) {
                    setRefineMismatchThreshold(card.id, v / 100);
                  }
                }}
                disabled={!effectiveAutoRefine}
                className="flex-1 min-w-0 bg-transparent text-xs text-gray-700 focus:outline-none"
              />
              <span className="text-gray-500">%</span>
            </div>
          </div>
        ) : (
          <div className={`grid min-w-0 gap-2 pl-5 [grid-template-columns:repeat(auto-fit,minmax(8rem,1fr))]${!effectiveAutoRefine ? " opacity-40 pointer-events-none" : ""}`}>
            <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400/30">
              <span className="text-gray-500 whitespace-nowrap">Iters:</span>
              <input
                type="number"
                min={1}
                max={30}
                step={1}
                value={card.refineMaxIterations}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v) && v >= 1 && v <= 30) setRefineMaxIterations(card.id, v);
                }}
                disabled={!effectiveAutoRefine}
                className="flex-1 min-w-0 bg-transparent text-xs text-gray-700 focus:outline-none"
              />
            </div>
            <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus-within:border-blue-400 focus-within:ring-1 focus:ring-blue-400/30">
              <span className="text-gray-500 whitespace-nowrap">Target:</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round(card.refineMismatchThreshold * 100)}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v) && v >= 0 && v <= 100) {
                    setRefineMismatchThreshold(card.id, v / 100);
                  }
                }}
                disabled={!effectiveAutoRefine}
                className="flex-1 min-w-0 bg-transparent text-xs text-gray-700 focus:outline-none"
              />
              <span className="text-gray-500">%</span>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onAnalyze(card.id)}
        disabled={card.status === "analyzing"}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {card.status === "analyzing" ? "Analyzing..." : "Analyze"}
      </button>
    </div>
  );
}
