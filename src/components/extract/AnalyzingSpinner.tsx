"use client";

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
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        View log
      </button>
    </div>
  );
}
