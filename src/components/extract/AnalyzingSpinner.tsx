"use client";

import { FileText } from "lucide-react";
import { useExtractStore } from "./store";
import type { SlideCard } from "./store";

interface AnalyzingSpinnerProps {
  card: SlideCard;
}

export default function AnalyzingSpinner({ card }: AnalyzingSpinnerProps) {
  const openLogModal = useExtractStore((s) => s.openLogModal);

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      <p className="text-sm text-gray-600">
        Analyzing... {card.elapsed}s
      </p>
      <button
        type="button"
        onClick={() => openLogModal(card.id)}
        className="flex items-center gap-1.5 animate-pulse text-xs text-blue-500 hover:text-blue-600"
      >
        <FileText className="h-3.5 w-3.5" />
        View log
      </button>
    </div>
  );
}
