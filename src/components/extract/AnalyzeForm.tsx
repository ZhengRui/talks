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

export default function AnalyzeForm({ card, onAnalyze }: AnalyzeFormProps) {
  const updateDescription = useExtractStore((s) => s.updateDescription);
  const model = useExtractStore((s) => s.model);
  const effort = useExtractStore((s) => s.effort);
  const setModel = useExtractStore((s) => s.setModel);
  const setEffort = useExtractStore((s) => s.setEffort);

  const effortOptions = EFFORT_OPTIONS[model] ?? EFFORT_OPTIONS["claude-opus-4-6"];

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    // Reset effort to first option of new model
    const opts = EFFORT_OPTIONS[newModel];
    if (opts && !opts.some((o) => o.value === effort)) {
      setEffort(opts[0].value);
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

      <div className="flex gap-2">
        <select
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none"
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select
          value={effort}
          onChange={(e) => setEffort(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none"
        >
          {effortOptions.map((e) => (
            <option key={e.value} value={e.value}>
              {isAdaptiveModel(model) ? `Effort: ${e.label}` : `Think: ${e.label}`}
            </option>
          ))}
        </select>
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
