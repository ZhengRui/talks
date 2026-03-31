"use client";

import { Sparkles } from "lucide-react";
import { useExtractStore } from "./store";
import type { SlideCard } from "./store";

interface AnalyzeFormProps {
  card: SlideCard;
  onAnalyze: (cardId: string) => void;
}

const MODELS = [
  { value: "claude-opus-4-6", label: "Opus 4.6" },
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
  { value: "mock-claude", label: "Mock Claude" },
];

// Opus 4.6 & Sonnet 4.6: adaptive thinking with effort levels
// Haiku 4.5: manual thinking with budget_tokens (no effort parameter)
const EFFORT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  "claude-opus-4-6": [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "max", label: "Max" },
  ],
  "claude-sonnet-4-6": [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "max", label: "Max" },
  ],
  "claude-haiku-4-5-20251001": [
    { value: "10000", label: "10k tokens" },
    { value: "30000", label: "30k tokens" },
    { value: "60000", label: "60k tokens" },
  ],
  "mock-claude": [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ],
};

function isAdaptiveModel(model: string): boolean {
  return model === "claude-opus-4-6" || model === "claude-sonnet-4-6";
}

function PassRow({
  label,
  model,
  onModelChange,
  effort,
  onEffortChange,
  disabled,
  sub,
}: {
  label: string;
  model: string;
  onModelChange: (v: string) => void;
  effort: string;
  onEffortChange: (v: string) => void;
  disabled?: boolean;
  sub?: boolean;
}) {
  const effortOptions = EFFORT_OPTIONS[model] ?? EFFORT_OPTIONS["claude-opus-4-6"];
  return (
    <div className={`flex items-center gap-2${sub ? " pl-5" : ""}`}>
      <span className={`flex shrink-0 items-center gap-1 text-xs font-medium ${sub ? "text-gray-400 w-[52px]" : "text-gray-600 w-[72px]"}`}>
        {!sub && <span className="inline-block h-3.5 w-3.5 rounded bg-blue-600" />}
        {label}
      </span>
      <select
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={disabled}
        className={`flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none ${disabled ? "opacity-40 pointer-events-none" : ""}`}
      >
        {MODELS.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <select
        value={effort}
        onChange={(e) => onEffortChange(e.target.value)}
        disabled={disabled}
        className={`flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none ${disabled ? "opacity-40 pointer-events-none" : ""}`}
      >
        {effortOptions.map((e) => (
          <option key={e.value} value={e.value}>
            {isAdaptiveModel(model) ? `Effort: ${e.label}` : `Think: ${e.label}`}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AnalyzeForm({ card, onAnalyze }: AnalyzeFormProps) {
  const updateDescription = useExtractStore((s) => s.updateDescription);
  const model = useExtractStore((s) => s.model);
  const effort = useExtractStore((s) => s.effort);
  const setAutoRefine = useExtractStore((s) => s.setAutoRefine);
  const setCardAutoRefine = useExtractStore((s) => s.setCardAutoRefine);
  const setRefineMaxIterations = useExtractStore((s) => s.setRefineMaxIterations);
  const setRefineMismatchThreshold = useExtractStore((s) => s.setRefineMismatchThreshold);
  const refineVisionModel = useExtractStore((s) => s.refineVisionModel);
  const refineVisionEffort = useExtractStore((s) => s.refineVisionEffort);
  const refineEditModel = useExtractStore((s) => s.refineEditModel);
  const refineEditEffort = useExtractStore((s) => s.refineEditEffort);
  const setRefineVisionModel = useExtractStore((s) => s.setRefineVisionModel);
  const setRefineVisionEffort = useExtractStore((s) => s.setRefineVisionEffort);
  const setRefineEditModel = useExtractStore((s) => s.setRefineEditModel);
  const setRefineEditEffort = useExtractStore((s) => s.setRefineEditEffort);
  const setCardRefineVisionModel = useExtractStore((s) => s.setCardRefineVisionModel);
  const setCardRefineVisionEffort = useExtractStore((s) => s.setCardRefineVisionEffort);
  const setCardRefineEditModel = useExtractStore((s) => s.setCardRefineEditModel);
  const setCardRefineEditEffort = useExtractStore((s) => s.setCardRefineEditEffort);
  const setModel = useExtractStore((s) => s.setModel);
  const setEffort = useExtractStore((s) => s.setEffort);
  const refineSettingsLocked = card.refineSettingsLocked === true;
  const effectiveAutoRefine = card.autoRefine;
  const effectiveRefineVisionModel = card.refinePass?.visionModel ?? refineVisionModel;
  const effectiveRefineVisionEffort = card.refinePass?.visionEffort ?? refineVisionEffort;
  const effectiveRefineEditModel = card.refinePass?.editModel ?? refineEditModel;
  const effectiveRefineEditEffort = card.refinePass?.editEffort ?? refineEditEffort;

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    const opts = EFFORT_OPTIONS[newModel];
    if (opts && !opts.some((o) => o.value === effort)) {
      setEffort(opts[0].value);
    }
  };

  const handleRefineModelChange = (
    step: "vision" | "edit",
    newModel: string,
    currentEffort: string,
  ) => {
    if (step === "vision") {
      if (refineSettingsLocked) {
        setCardRefineVisionModel(card.id, newModel);
      } else {
        setRefineVisionModel(newModel);
      }
    } else if (refineSettingsLocked) {
      setCardRefineEditModel(card.id, newModel);
    } else {
      setRefineEditModel(newModel);
    }

    const opts = EFFORT_OPTIONS[newModel];
    if (opts && !opts.some((o) => o.value === currentEffort)) {
      if (step === "vision") {
        if (refineSettingsLocked) {
          setCardRefineVisionEffort(card.id, opts[0].value);
        } else {
          setRefineVisionEffort(opts[0].value);
        }
      } else if (refineSettingsLocked) {
        setCardRefineEditEffort(card.id, opts[0].value);
      } else {
        setRefineEditEffort(opts[0].value);
      }
    }
  };

  const handleRefineToggle = (enabled: boolean) => {
    if (refineSettingsLocked) {
      setCardAutoRefine(card.id, enabled);
    } else {
      setAutoRefine(enabled);
    }
  };

  const handleRefineEffortChange = (step: "vision" | "edit", value: string) => {
    if (step === "vision") {
      if (refineSettingsLocked) {
        setCardRefineVisionEffort(card.id, value);
      } else {
        setRefineVisionEffort(value);
      }
    } else if (refineSettingsLocked) {
      setCardRefineEditEffort(card.id, value);
    } else {
      setRefineEditEffort(value);
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
          model={model}
          onModelChange={handleModelChange}
          effort={effort}
          onEffortChange={setEffort}
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
          model={effectiveRefineVisionModel}
          onModelChange={(value) => {
            handleRefineModelChange("vision", value, effectiveRefineVisionEffort);
          }}
          effort={effectiveRefineVisionEffort}
          onEffortChange={(value) => handleRefineEffortChange("vision", value)}
          disabled={!effectiveAutoRefine}
        />
        <PassRow
          label="Edit"
          sub
          model={effectiveRefineEditModel}
          onModelChange={(value) => {
            handleRefineModelChange("edit", value, effectiveRefineEditEffort);
          }}
          effort={effectiveRefineEditEffort}
          onEffortChange={(value) => handleRefineEffortChange("edit", value)}
          disabled={!effectiveAutoRefine}
        />
        <div className={`flex items-center gap-2${!effectiveAutoRefine ? " opacity-40 pointer-events-none" : ""}`}>
          <span className="shrink-0 w-[72px]" />
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
              min={1}
              max={99}
              step={1}
              value={Math.round(card.refineMismatchThreshold * 100)}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isFinite(v) && v >= 1 && v <= 99) setRefineMismatchThreshold(card.id, v / 100);
              }}
              disabled={!effectiveAutoRefine}
              className="flex-1 min-w-0 bg-transparent text-xs text-gray-700 focus:outline-none"
            />
            <span className="text-gray-500">%</span>
          </div>
        </div>
      </div>

      {card.error && (
        <p className="text-sm text-red-500">{card.error}</p>
      )}

      <button
        type="button"
        onClick={() => onAnalyze(card.id)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow active:scale-[0.98]"
      >
        <Sparkles className="h-4 w-4" />
        Analyze
      </button>
    </div>
  );
}
