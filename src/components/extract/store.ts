import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import type { AnalysisResult } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogEntry {
  type: "status" | "thinking" | "text" | "tool" | "tool_result" | "error";
  content: string;
  timestamp: number;
}

export interface SlideCard {
  id: string;
  file: File;
  previewUrl: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  status: "idle" | "analyzing" | "analyzed" | "error";
  description: string;
  analysis: AnalysisResult | null;
  log: LogEntry[];
  elapsed: number;
  error: string | null;
  selectedTemplateIndex: number;
}

export interface ExtractState {
  // State
  cards: Map<string, SlideCard>;
  cardOrder: string[];
  pan: { x: number; y: number };
  zoom: number;
  selectedCardId: string | null;
  yamlModal: { open: boolean; cardId: string; templateIndex: number };
  logModal: { open: boolean; cardId: string };

  // Actions
  addCard: (file: File) => string;
  removeCard: (id: string) => void;
  selectCard: (id: string | null) => void;
  updateDescription: (id: string, text: string) => void;
  startAnalysis: (id: string) => void;
  appendLog: (id: string, entry: LogEntry) => void;
  completeAnalysis: (id: string, result: AnalysisResult) => void;
  failAnalysis: (id: string, error: string) => void;
  selectTemplate: (id: string, index: number) => void;
  tickElapsed: (id: string) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  openYamlModal: (cardId: string, templateIndex: number) => void;
  closeYamlModal: () => void;
  openLogModal: (cardId: string) => void;
  closeLogModal: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_W = 480;
const CARD_H = 270;
const GAP = 40;
const COLS = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let nextId = 0;
function generateId(): string {
  return `card-${++nextId}-${Date.now()}`;
}

/** Compute grid position for the nth card. */
function gridPosition(index: number): { x: number; y: number } {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return {
    x: GAP + col * (CARD_W + GAP),
    y: GAP + row * (CARD_H + GAP),
  };
}

/** Update a single card immutably. */
function updateCard(
  state: ExtractState,
  id: string,
  updater: (card: SlideCard) => Partial<SlideCard>,
): Partial<ExtractState> {
  const card = state.cards.get(id);
  if (!card) return {};
  const next = new Map(state.cards);
  next.set(id, { ...card, ...updater(card) });
  return { cards: next };
}

/** Types that should merge by appending content to the last entry. */
const STREAMING_TYPES = new Set<LogEntry["type"]>(["text", "thinking"]);

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createExtractStore(): StoreApi<ExtractState> {
  return createStore<ExtractState>((set, get) => ({
    // Initial state
    cards: new Map(),
    cardOrder: [],
    pan: { x: 0, y: 0 },
    zoom: 1,
    selectedCardId: null,
    yamlModal: { open: false, cardId: "", templateIndex: 0 },
    logModal: { open: false, cardId: "" },

    // Actions

    addCard(file: File): string {
      const id = generateId();
      const previewUrl = URL.createObjectURL(file);
      const index = get().cardOrder.length;
      const position = gridPosition(index);
      const card: SlideCard = {
        id,
        file,
        previewUrl,
        position,
        size: { w: CARD_W, h: CARD_H },
        status: "idle",
        description: "",
        analysis: null,
        log: [],
        elapsed: 0,
        error: null,
        selectedTemplateIndex: 0,
      };
      set((state) => {
        const next = new Map(state.cards);
        next.set(id, card);
        return { cards: next, cardOrder: [...state.cardOrder, id] };
      });
      return id;
    },

    removeCard(id: string) {
      set((state) => {
        const card = state.cards.get(id);
        if (card) URL.revokeObjectURL(card.previewUrl);
        const next = new Map(state.cards);
        next.delete(id);
        return {
          cards: next,
          cardOrder: state.cardOrder.filter((cid) => cid !== id),
          selectedCardId:
            state.selectedCardId === id ? null : state.selectedCardId,
        };
      });
    },

    selectCard(id: string | null) {
      set({ selectedCardId: id });
    },

    updateDescription(id: string, text: string) {
      set((state) => updateCard(state, id, () => ({ description: text })));
    },

    startAnalysis(id: string) {
      set((state) =>
        updateCard(state, id, () => ({
          status: "analyzing" as const,
          log: [],
          error: null,
          elapsed: 0,
        })),
      );
    },

    appendLog(id: string, entry: LogEntry) {
      set((state) =>
        updateCard(state, id, (card) => {
          const log = [...card.log];
          const last = log[log.length - 1];
          if (
            last &&
            STREAMING_TYPES.has(entry.type) &&
            last.type === entry.type
          ) {
            // Merge: append content to last entry of same streaming type
            log[log.length - 1] = {
              ...last,
              content: last.content + entry.content,
              timestamp: entry.timestamp,
            };
          } else {
            log.push(entry);
          }
          return { log };
        }),
      );
    },

    completeAnalysis(id: string, result: AnalysisResult) {
      set((state) =>
        updateCard(state, id, () => ({
          status: "analyzed" as const,
          analysis: result,
          selectedTemplateIndex: 0,
        })),
      );
    },

    failAnalysis(id: string, error: string) {
      set((state) =>
        updateCard(state, id, () => ({
          status: "error" as const,
          error,
        })),
      );
    },

    selectTemplate(id: string, index: number) {
      set((state) =>
        updateCard(state, id, () => ({ selectedTemplateIndex: index })),
      );
    },

    tickElapsed(id: string) {
      set((state) =>
        updateCard(state, id, (card) =>
          card.status === "analyzing"
            ? { elapsed: card.elapsed + 1 }
            : {},
        ),
      );
    },

    setPan(pan: { x: number; y: number }) {
      set({ pan });
    },

    setZoom(zoom: number) {
      set({ zoom: Math.min(2.0, Math.max(0.25, zoom)) });
    },

    openYamlModal(cardId: string, templateIndex: number) {
      set({ yamlModal: { open: true, cardId, templateIndex } });
    },

    closeYamlModal() {
      set((state) => ({
        yamlModal: { ...state.yamlModal, open: false },
      }));
    },

    openLogModal(cardId: string) {
      set({ logModal: { open: true, cardId } });
    },

    closeLogModal() {
      set((state) => ({
        logModal: { ...state.logModal, open: false },
      }));
    },
  }));
}

// ---------------------------------------------------------------------------
// Singleton hook for React components
// ---------------------------------------------------------------------------

let singletonStore: StoreApi<ExtractState> | null = null;

function getStore(): StoreApi<ExtractState> {
  if (!singletonStore) {
    singletonStore = createExtractStore();
  }
  return singletonStore;
}

/**
 * React hook to consume the extract store.
 * Usage: `const cards = useExtractStore(s => s.cards)`
 *
 * Also exposes `useExtractStore.getState()` for non-React contexts.
 */
export function useExtractStore(): ExtractState;
export function useExtractStore<U>(selector: (state: ExtractState) => U): U;
export function useExtractStore<U>(
  selector?: (state: ExtractState) => U,
): ExtractState | U {
  const store = getStore();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return selector ? useStore(store, selector) : useStore(store);
}

/** Direct access for non-React contexts. */
useExtractStore.getState = (): ExtractState => getStore().getState();

/** Access the underlying store API. */
useExtractStore.store = (): StoreApi<ExtractState> => getStore();
