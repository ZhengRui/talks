"use client";

import { Sparkles } from "lucide-react";
import { useExtractStore } from "./store";
import type { SlideCard } from "./store";

interface AnalyzeFormProps {
  card: SlideCard;
  onAnalyze: (cardId: string) => void;
}

export default function AnalyzeForm({ card, onAnalyze }: AnalyzeFormProps) {
  const updateDescription = useExtractStore((s) => s.updateDescription);

  return (
    <div className="flex flex-col gap-3 p-3">
      <textarea
        rows={3}
        value={card.description}
        onChange={(e) => updateDescription(card.id, e.target.value)}
        placeholder="Describe the slide or what to extract..."
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 focus:outline-none"
      />

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
