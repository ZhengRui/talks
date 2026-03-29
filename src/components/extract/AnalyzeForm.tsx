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
};

function isAdaptiveModel(model: string): boolean {
  return model === "claude-opus-4-6" || model === "claude-sonnet-4-6";
}

function PassRow({
  label,
  toggled,
  onToggle,
  model,
  onModelChange,
  effort,
  onEffortChange,
  disabled,
}: {
  label: string;
  toggled: boolean;
  onToggle?: (v: boolean) => void;
  model: string;
  onModelChange: (v: string) => void;
  effort: string;
  onEffortChange: (v: string) => void;
  disabled?: boolean;
}) {
  const effortOptions = EFFORT_OPTIONS[model] ?? EFFORT_OPTIONS["claude-opus-4-6"];
  return (
    <div className="flex items-center gap-2">
      {onToggle ? (
        <label className="flex shrink-0 items-center gap-1 text-xs font-medium text-gray-600 w-[72px] cursor-pointer">
          <input
            type="checkbox"
            checked={toggled}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-400/40"
          />
          <span>{label}</span>
        </label>
      ) : (
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-gray-600 w-[72px]">
          <span className="inline-block h-3.5 w-3.5 rounded bg-blue-600" />
          <span>{label}</span>
        </span>
      )}
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
  const critique = useExtractStore((s) => s.critique);
  const critiqueModel = useExtractStore((s) => s.critiqueModel);
  const critiqueEffort = useExtractStore((s) => s.critiqueEffort);
  const setAutoRefine = useExtractStore((s) => s.setAutoRefine);
  const setRefineMaxIterations = useExtractStore((s) => s.setRefineMaxIterations);
  const setRefineMismatchThreshold = useExtractStore((s) => s.setRefineMismatchThreshold);
  const refineModel = useExtractStore((s) => s.refineModel);
  const refineEffort = useExtractStore((s) => s.refineEffort);
  const setRefineModel = useExtractStore((s) => s.setRefineModel);
  const setRefineEffort = useExtractStore((s) => s.setRefineEffort);
  const setModel = useExtractStore((s) => s.setModel);
  const setEffort = useExtractStore((s) => s.setEffort);
  const setCritique = useExtractStore((s) => s.setCritique);
  const setCritiqueModel = useExtractStore((s) => s.setCritiqueModel);
  const setCritiqueEffort = useExtractStore((s) => s.setCritiqueEffort);

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    const opts = EFFORT_OPTIONS[newModel];
    if (opts && !opts.some((o) => o.value === effort)) {
      setEffort(opts[0].value);
    }
  };

  const handleCritiqueModelChange = (newModel: string) => {
    setCritiqueModel(newModel);
    const opts = EFFORT_OPTIONS[newModel];
    if (opts && !opts.some((o) => o.value === critiqueEffort)) {
      setCritiqueEffort(opts[0].value);
    }
  };

  const handleRefineModelChange = (newModel: string) => {
    setRefineModel(newModel);
    const opts = EFFORT_OPTIONS[newModel];
    if (opts && !opts.some((o) => o.value === refineEffort)) {
      setRefineEffort(opts[0].value);
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
          toggled={true}
          model={model}
          onModelChange={handleModelChange}
          effort={effort}
          onEffortChange={setEffort}
        />
        <PassRow
          label="Critique"
          toggled={critique}
          onToggle={setCritique}
          model={critiqueModel}
          onModelChange={handleCritiqueModelChange}
          effort={critiqueEffort}
          onEffortChange={setCritiqueEffort}
          disabled={!critique}
        />
        <PassRow
          label="Refine"
          toggled={card.autoRefine}
          onToggle={(v) => setAutoRefine(card.id, v)}
          model={refineModel}
          onModelChange={handleRefineModelChange}
          effort={refineEffort}
          onEffortChange={setRefineEffort}
          disabled={!card.autoRefine}
        />
        <div className={`flex items-center gap-2${!card.autoRefine ? " opacity-40 pointer-events-none" : ""}`}>
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
              disabled={!card.autoRefine}
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
              disabled={!card.autoRefine}
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
