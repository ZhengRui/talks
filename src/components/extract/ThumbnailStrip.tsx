"use client";

import { useExtractStore } from "./store";

export default function ThumbnailStrip() {
  const cardOrder = useExtractStore((s) => s.cardOrder);
  const cards = useExtractStore((s) => s.cards);
  const selectedCardId = useExtractStore((s) => s.selectedCardId);
  const selectCard = useExtractStore((s) => s.selectCard);

  if (cardOrder.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto rounded-t-xl p-2 border-b border-gray-200 bg-gray-50/50">
      {cardOrder.map((id) => {
        const card = cards.get(id);
        if (!card) return null;
        const isSelected = id === selectedCardId;
        return (
          <button
            key={id}
            type="button"
            onClick={() => selectCard(id)}
            className="shrink-0 flex items-center justify-center overflow-hidden rounded-md"
            style={{
              width: 48,
              height: 48,
              border: isSelected
                ? "2px solid #22d3ee"
                : "2px solid transparent",
              opacity: isSelected ? 1 : 0.6,
            }}
          >
            <img
              src={card.previewUrl}
              alt={`Slide ${id}`}
              className="max-h-full max-w-full object-contain"
            />
          </button>
        );
      })}
    </div>
  );
}
