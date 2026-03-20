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
  label: string;
  file: File;
  previewUrl: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  naturalSize: { w: number; h: number } | null; // original image dimensions
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
  panelWidth: number; // 0 when collapsed
  layoutKey: string; // "row" | "1" | "2" | "3" | "custom-N"

  // Actions
  addCard: (file: File) => string;
  removeCard: (id: string) => void;
  selectCard: (id: string | null) => void;
  updateDescription: (id: string, text: string) => void;
  startAnalysis: (id: string) => void;
  appendLog: (id: string, entry: LogEntry) => void;
  completeAnalysis: (id: string, result: AnalysisResult) => void;
  failAnalysis: (id: string, error: string) => void;
  setNaturalSize: (id: string, w: number, h: number) => void;
  selectTemplate: (id: string, index: number) => void;
  tickElapsed: (id: string) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  zoomToCard: (id: string, viewportW: number, viewportH: number, leftGap?: number) => void;
  arrangeCards: (cols: number, key: string) => void;
  setPanelWidth: (width: number) => void;
  openYamlModal: (cardId: string, templateIndex: number) => void;
  closeYamlModal: () => void;
  openLogModal: (cardId: string) => void;
  closeLogModal: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_SIZE = 480; // square cell for grid layout
const CARD_W = 480;   // default display width (overridden when naturalSize known)
const CARD_H = 270;   // default display height (16:9 fallback)
const GAP = 40;
const COLS = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let nextId = 0;
function generateId(): string {
  return `card-${++nextId}-${Date.now()}`;
}

/** Compute grid position for the nth card using square cells. */
function gridPosition(index: number): { x: number; y: number } {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return {
    x: GAP + col * (CELL_SIZE + GAP),
    y: GAP + row * (CELL_SIZE + GAP),
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
    panelWidth: 380,
    layoutKey: "3", // default: 3-column grid

    // Actions

    addCard(file: File): string {
      const id = generateId();
      const previewUrl = URL.createObjectURL(file);
      const index = get().cardOrder.length;
      const position = gridPosition(index);
      const label = `Slide #${Math.random().toString(36).slice(2, 5)}`;
      const card: SlideCard = {
        id,
        label,
        file,
        previewUrl,
        position,
        size: { w: CARD_W, h: CARD_H },
        naturalSize: null,
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

    setNaturalSize(id: string, w: number, h: number) {
      // Compute display size: fit within CELL_SIZE maintaining aspect ratio
      const aspect = w / h;
      let displayW: number;
      let displayH: number;
      if (aspect >= 1) {
        // Landscape or square — fit width
        displayW = CELL_SIZE;
        displayH = CELL_SIZE / aspect;
      } else {
        // Portrait — fit height
        displayH = CELL_SIZE;
        displayW = CELL_SIZE * aspect;
      }
      set((state) =>
        updateCard(state, id, () => ({
          naturalSize: { w, h },
          size: { w: Math.round(displayW), h: Math.round(displayH) },
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
      set({ zoom: Math.min(2.5, Math.max(0.25, zoom)) });
    },

    zoomToCard(id: string, viewportW: number, viewportH: number, leftGap = 0) {
      const card = get().cards.get(id);
      if (!card) return;

      const maxZoom = 2.5;
      // Padding around the card (including label row above)
      const pad = 40;
      const labelHeight = 24;
      const totalCardH = card.size.h + labelHeight;

      // Available space in viewport
      const availW = viewportW - leftGap - pad * 2;
      const availH = viewportH - pad * 2;

      // Fit card into available space, but don't exceed max zoom
      const zoom = Math.min(maxZoom, availW / card.size.w, availH / totalCardH);

      // Center the card in the available space
      const scaledW = card.size.w * zoom;
      const scaledH = totalCardH * zoom;
      const panX = leftGap + (availW - scaledW) / 2 + pad - card.position.x * zoom;
      const panY = (viewportH - scaledH) / 2 - (card.position.y - labelHeight) * zoom;

      set({ zoom, pan: { x: panX, y: panY } });
    },

    arrangeCards(cols: number, key: string) {
      const { cards, cardOrder } = get();
      if (cardOrder.length === 0) return;
      const newCards = new Map(cards);
      cardOrder.forEach((id, i) => {
        const card = newCards.get(id);
        if (!card) return;
        const col = i % cols;
        const row = Math.floor(i / cols);
        newCards.set(id, {
          ...card,
          position: {
            x: GAP + col * (CELL_SIZE + GAP),
            y: GAP + row * (CELL_SIZE + GAP),
          },
        });
      });
      set({ cards: newCards, layoutKey: key });
    },

    setPanelWidth(width: number) {
      set({ panelWidth: width });
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
