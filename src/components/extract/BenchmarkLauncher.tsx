"use client";

import { useEffect, useMemo, useState } from "react";

interface BenchmarkDeck {
  slug: string;
  title: string;
  slideCount: number;
}

interface BenchmarkLauncherProps {
  open: boolean;
  onClose: () => void;
  onRun: (slug: string, slideIndex: number) => Promise<void>;
}

export default function BenchmarkLauncher({
  open,
  onClose,
  onRun,
}: BenchmarkLauncherProps) {
  const [decks, setDecks] = useState<BenchmarkDeck[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [slideIndex, setSlideIndex] = useState("1");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadCatalog() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/extract/benchmark/catalog");
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? `Failed to load benchmark catalog (${response.status})`);
        }
        const data = await response.json() as { decks?: BenchmarkDeck[] };
        if (cancelled) return;
        const nextDecks = Array.isArray(data.decks) ? data.decks : [];
        setDecks(nextDecks);
        setSelectedSlug((current) => current || nextDecks[0]?.slug || "");
        setSlideIndex("1");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedDeck = useMemo(
    () => decks.find((deck) => deck.slug === selectedSlug) ?? null,
    [decks, selectedSlug],
  );
  const maxSlide = selectedDeck?.slideCount ?? 1;

  if (!open) return null;

  return (
    <div className="fixed left-4 top-14 z-20 w-[360px] rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Load Benchmark</h2>
          <p className="text-xs text-gray-500">Add `control` and `coords` cards from `content/*`.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          Close
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Deck</span>
          <select
            value={selectedSlug}
            onChange={(e) => {
              setSelectedSlug(e.target.value);
              setSlideIndex("1");
            }}
            disabled={loading || running || decks.length === 0}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30"
          >
            {decks.map((deck) => (
              <option key={deck.slug} value={deck.slug}>
                {deck.title} ({deck.slug}) · {deck.slideCount} slides
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Slide</span>
          <input
            type="number"
            min={1}
            max={maxSlide}
            value={slideIndex}
            onChange={(e) => setSlideIndex(e.target.value)}
            disabled={loading || running || !selectedDeck}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/30"
          />
          {selectedDeck && (
            <span className="text-[11px] text-gray-500">1 to {selectedDeck.slideCount}</span>
          )}
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        <button
          type="button"
          disabled={loading || running || !selectedDeck}
          onClick={async () => {
            const parsedSlideIndex = Number.parseInt(slideIndex, 10);
            if (!selectedDeck || !Number.isInteger(parsedSlideIndex)) {
              setError("Pick a valid deck and slide number.");
              return;
            }
            if (parsedSlideIndex < 1 || parsedSlideIndex > selectedDeck.slideCount) {
              setError(`Slide number must be between 1 and ${selectedDeck.slideCount}.`);
              return;
            }

            setRunning(true);
            setError(null);
            try {
              await onRun(selectedDeck.slug, parsedSlideIndex);
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setRunning(false);
            }
          }}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {running ? "Loading..." : loading ? "Loading..." : "Load"}
        </button>
      </div>
    </div>
  );
}
