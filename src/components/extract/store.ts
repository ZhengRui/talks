import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import type {
  AnalysisResult,
  AnalysisResultPayload,
  AnalysisStage,
  BenchmarkVariant,
  GeometryHints,
  PromptRecord,
  RefineProvenance,
  RefineIterationResult,
  StageAnalysisProvenance,
} from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogEntry {
  type: "status" | "thinking" | "text" | "tool" | "tool_result" | "error";
  content: string;
  timestamp: number;
  stage?: AnalysisStage;
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
  pass1Analysis: AnalysisResult | null; // normalized render-space extract analysis
  log: LogEntry[];
  elapsed: number;
  pass1: StageAnalysisProvenance | null;
  pass1Elapsed: number;
  pass1Cost: number | null;
  refinePass?: RefineProvenance | null;
  refineSettingsLocked?: boolean;
  error: string | null;
  activeStage: AnalysisStage;
  selectedTemplateIndex: Record<AnalysisStage, number>;
  viewMode: "original" | "extract" | "iter" | "diff";
  refineAnalysis: AnalysisResult | null;
  refineStatus: "idle" | "running" | "done" | "error";
  refineIteration: number;
  refineMaxIterations: number;
  refineMismatchThreshold: number;
  refineResult: RefineIterationResult | null;
  refineHistory: RefineIterationResult[];
  refineError: string | null;
  refineElapsed: number;
  refineCost: number | null;
  refineStartMismatch: number | null;
  refinePriorIssuesJson: string | null;
  autoRefine: boolean;
  normalizedImage: File | null;
  diffObjectUrl: string | null;
  promptHistory: PromptRecord[];
  benchmarkGroupId: string | null;
  benchmarkVariant: BenchmarkVariant | null;
  benchmarkSlug: string | null;
  benchmarkSlideIndex: number | null;
  geometryHints: GeometryHints | null;
}

export interface AddCardOptions {
  label?: string;
  position?: { x: number; y: number };
  benchmarkGroupId?: string | null;
  benchmarkVariant?: BenchmarkVariant | null;
  benchmarkSlug?: string | null;
  benchmarkSlideIndex?: number | null;
  geometryHints?: GeometryHints | null;
}

export interface ExtractState {
  // State
  cards: Map<string, SlideCard>;
  cardOrder: string[];
  pan: { x: number; y: number };
  zoom: number;
  selectedCardId: string | null;
  yamlModal: { open: boolean; cardId: string; templateIndex: number };
  panelWidth: number; // 0 when collapsed
  layoutKey: string; // "row" | "1" | "2" | "3" | "custom-N"
  model: string;
  effort: string;
  autoRefine: boolean;
  refineVisionModel: string;
  refineVisionEffort: string;
  refineEditModel: string;
  refineEditEffort: string;
  refineDefaultMaxIterations: number;
  refineDefaultMismatchThreshold: number;
  previewDebugTextBoxes: boolean;

  // Actions
  addCard: (file: File, options?: AddCardOptions) => string;
  removeCard: (id: string) => void;
  selectCard: (id: string | null) => void;
  updateDescription: (id: string, text: string) => void;
  startAnalysis: (id: string) => void;
  appendLog: (id: string, entry: LogEntry) => void;
  appendPrompt: (id: string, entry: PromptRecord) => void;
  completeAnalysis: (id: string, result: AnalysisResultPayload) => void;
  failAnalysis: (id: string, error: string) => void;
  setNormalizedImage: (id: string, file: File | null) => void;
  setNaturalSize: (id: string, w: number, h: number) => void;
  resetAnalysis: (id: string) => void;
  setViewMode: (id: string, mode: "original" | "extract" | "iter" | "diff") => void;
  setActiveStage: (id: string, stage: AnalysisStage) => void;
  selectTemplate: (id: string, index: number) => void;
  setAutoRefine: (enabled: boolean) => void;
  setCardAutoRefine: (id: string, enabled: boolean) => void;
  setRefineMaxIterations: (id: string, max: number) => void;
  setRefineMismatchThreshold: (id: string, threshold: number) => void;
  startRefinement: (id: string) => void;
  continueRefinement: (id: string) => void;
  updateRefineDiff: (id: string, iteration: number, mismatchRatio: number, diffArtifactUrl: string) => void;
  updateRefinement: (id: string, result: RefineIterationResult) => void;
  setRefinePriorIssuesJson: (id: string, issuesJson: string | null) => void;
  completeRefineIteration: (id: string, mismatchRatio: number) => void;
  setDiffObjectUrl: (id: string, url: string | null) => void;
  completeRefinement: (id: string, elapsed?: number, cost?: number | null) => void;
  failRefinement: (id: string, error: string) => void;
  abortRefinement: (id: string) => void;
  tickElapsed: (id: string) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  zoomToCard: (id: string, viewportW: number, viewportH: number, leftGap?: number) => void;
  arrangeCards: (cols: number, key: string) => void;
  setPanelWidth: (width: number) => void;
  openYamlModal: (cardId: string, templateIndex: number) => void;
  closeYamlModal: () => void;
  setModel: (model: string) => void;
  setEffort: (effort: string) => void;
  setRefineVisionModel: (model: string) => void;
  setRefineVisionEffort: (effort: string) => void;
  setRefineEditModel: (model: string) => void;
  setRefineEditEffort: (effort: string) => void;
  setCardRefineVisionModel: (id: string, model: string) => void;
  setCardRefineVisionEffort: (id: string, effort: string) => void;
  setCardRefineEditModel: (id: string, model: string) => void;
  setCardRefineEditEffort: (id: string, effort: string) => void;
  setPreviewDebugTextBoxes: (enabled: boolean) => void;
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

/** Derive column count from a layout key. */
function colsFromLayoutKey(key: string, cardCount: number): number {
  if (key === "row") return Math.max(1, cardCount);
  if (key.startsWith("custom-")) {
    const n = parseInt(key.slice(7), 10);
    return n > 0 ? n : COLS;
  }
  const n = parseInt(key, 10);
  return n > 0 ? n : COLS;
}

/** Compute grid position for the nth card using square cells. */
function gridPosition(index: number, cols: number = COLS): { x: number; y: number } {
  const col = index % cols;
  const row = Math.floor(index / cols);
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

function createSelectedTemplateIndex(): Record<AnalysisStage, number> {
  return { extract: 0, refine: 0 };
}

function sortAnalysisResult(analysis: AnalysisResult | null | undefined): AnalysisResult | null {
  if (!analysis) return null;
  const proposals = [...analysis.proposals].sort((a, b) => {
    if (a.scope === "slide" && b.scope !== "slide") return -1;
    if (a.scope !== "slide" && b.scope === "slide") return 1;
    return 0;
  });
  return { ...analysis, proposals };
}

function revokeObjectUrl(url: string | null | undefined): void {
  if (!url) return;
  URL.revokeObjectURL(url);
}

function updateUnlockedCards(
  state: ExtractState,
  updater: (card: SlideCard) => Partial<SlideCard>,
): Map<string, SlideCard> | null {
  let changed = false;
  const next = new Map(state.cards);

  for (const [id, card] of state.cards.entries()) {
    if (card.refineSettingsLocked) continue;
    next.set(id, { ...card, ...updater(card) });
    changed = true;
  }

  return changed ? next : null;
}

function currentRefinePass(
  state: Pick<
    ExtractState,
    "refineVisionModel" | "refineVisionEffort" | "refineEditModel" | "refineEditEffort"
  >,
): RefineProvenance {
  return {
    visionModel: state.refineVisionModel,
    visionEffort: state.refineVisionEffort,
    editModel: state.refineEditModel,
    editEffort: state.refineEditEffort,
  };
}

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
    panelWidth: 380,
    layoutKey: "3", // default: 3-column grid
    model: "claude-opus-4-6",
    effort: "medium",
    autoRefine: true,
    refineVisionModel: "claude-opus-4-6",
    refineVisionEffort: "medium",
    refineEditModel: "claude-opus-4-6",
    refineEditEffort: "medium",
    refineDefaultMaxIterations: 4,
    refineDefaultMismatchThreshold: 0.05,
    previewDebugTextBoxes: false,

    // Actions

    addCard(file: File, options: AddCardOptions = {}): string {
      const id = generateId();
      const previewUrl = URL.createObjectURL(file);
      const { cardOrder, layoutKey } = get();
      const index = cardOrder.length;
      // +1 because this card is about to be added
      const cols = colsFromLayoutKey(layoutKey, index + 1);
      const position = options.position ?? gridPosition(index, cols);
      const label = options.label ?? `Slide #${Math.random().toString(36).slice(2, 5)}`;
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
        pass1Analysis: null,
        log: [],
        elapsed: 0,
        pass1: null,
        pass1Elapsed: 0,
        pass1Cost: null,
        refinePass: currentRefinePass(get()),
        refineSettingsLocked: false,
        error: null,
        activeStage: "extract",
        selectedTemplateIndex: createSelectedTemplateIndex(),
        viewMode: "original",
        refineAnalysis: null,
        refineStatus: "idle",
        refineIteration: 0,
        refineMaxIterations: get().refineDefaultMaxIterations,
        refineMismatchThreshold: get().refineDefaultMismatchThreshold,
        refineResult: null,
        refineHistory: [],
        refineError: null,
        refineElapsed: 0,
        refineCost: null,
        refineStartMismatch: null,
        refinePriorIssuesJson: null,
        autoRefine: get().autoRefine,
        normalizedImage: null,
        diffObjectUrl: null,
        promptHistory: [],
        benchmarkGroupId: options.benchmarkGroupId ?? null,
        benchmarkVariant: options.benchmarkVariant ?? null,
        benchmarkSlug: options.benchmarkSlug ?? null,
        benchmarkSlideIndex: options.benchmarkSlideIndex ?? null,
        geometryHints: options.geometryHints ?? null,
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
        if (card) {
          URL.revokeObjectURL(card.previewUrl);
          revokeObjectUrl(card.diffObjectUrl);
        }
        const newOrder = state.cardOrder.filter((cid) => cid !== id);
        const cols = colsFromLayoutKey(state.layoutKey, newOrder.length);
        const next = new Map(state.cards);
        next.delete(id);
        // Re-position remaining cards to close the gap
        for (let i = 0; i < newOrder.length; i++) {
          const c = next.get(newOrder[i]);
          if (c) next.set(newOrder[i], { ...c, position: gridPosition(i, cols) });
        }
        return {
          cards: next,
          cardOrder: newOrder,
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
      const {
        model,
        effort,
        autoRefine,
        refineVisionModel,
        refineVisionEffort,
        refineEditModel,
        refineEditEffort,
        refineDefaultMaxIterations,
        refineDefaultMismatchThreshold,
      } = get();
      set((state) => {
        const card = state.cards.get(id);
        revokeObjectUrl(card?.diffObjectUrl);
        const lockedRefineSettings = card?.refineSettingsLocked === true;
        const nextRefinePass = lockedRefineSettings
          ? (card?.refinePass ?? {
              visionModel: refineVisionModel,
              visionEffort: refineVisionEffort,
              editModel: refineEditModel,
              editEffort: refineEditEffort,
            })
          : {
              visionModel: refineVisionModel,
              visionEffort: refineVisionEffort,
              editModel: refineEditModel,
              editEffort: refineEditEffort,
            };
        return updateCard(state, id, () => ({
          status: "analyzing" as const,
          log: [],
          error: null,
          elapsed: 0,
          pass1: { model, effort },
          pass1Elapsed: 0,
          pass1Cost: null,
          refinePass: nextRefinePass,
          refineSettingsLocked: true,
          activeStage: "extract" as const,
          viewMode: "original" as const,
          autoRefine: lockedRefineSettings ? (card?.autoRefine ?? autoRefine) : autoRefine,
          refineAnalysis: null,
          refineStatus: "idle" as const,
          refineIteration: 0,
          refineMaxIterations: lockedRefineSettings
            ? (card?.refineMaxIterations ?? refineDefaultMaxIterations)
            : refineDefaultMaxIterations,
          refineMismatchThreshold: lockedRefineSettings
            ? (card?.refineMismatchThreshold ?? refineDefaultMismatchThreshold)
            : refineDefaultMismatchThreshold,
          refineResult: null,
          refineHistory: [],
          refineError: null,
          refineElapsed: 0,
          refineCost: null,
          refineStartMismatch: null,
          refinePriorIssuesJson: null,
          diffObjectUrl: null,
          promptHistory: [],
        }));
      });
    },

    appendLog(id: string, entry: LogEntry) {
      set((state) =>
        updateCard(state, id, (card) => {
          const log = [...card.log];
          const last = log[log.length - 1];
          if (
            last &&
            STREAMING_TYPES.has(entry.type) &&
            last.type === entry.type &&
            last.stage === entry.stage
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

    appendPrompt(id: string, entry: PromptRecord) {
      set((state) =>
        updateCard(state, id, (card) => {
          const alreadyCaptured = card.promptHistory.some((existing) =>
            existing.stage === entry.stage &&
            existing.phase === entry.phase &&
            existing.iteration === entry.iteration &&
            existing.systemPrompt === entry.systemPrompt &&
            existing.userPrompt === entry.userPrompt,
          );

          if (alreadyCaptured) {
            return {};
          }

          return {
            promptHistory: [...card.promptHistory, entry],
          };
        }),
      );
    },

    completeAnalysis(id: string, result: AnalysisResultPayload) {
      const provenance = result.provenance;
      const analysis = sortAnalysisResult({
        source: result.source,
        ...(result.inventory ? { inventory: result.inventory } : {}),
        ...(provenance ? { provenance } : {}),
        proposals: result.proposals,
      });
      const normalizedAnalysis = sortAnalysisResult(
        result.normalizedAnalysis ?? analysis,
      );
      set((state) => {
        const card = state.cards.get(id);
        revokeObjectUrl(card?.diffObjectUrl);
        return updateCard(state, id, () => ({
          status: "analyzed" as const,
          analysis,
          pass1Analysis: normalizedAnalysis,
          pass1: provenance?.pass1 ?? null,
          pass1Elapsed: provenance?.pass1?.elapsed ?? 0,
          pass1Cost: provenance?.pass1?.cost ?? null,
          activeStage: "extract" as const,
          selectedTemplateIndex: createSelectedTemplateIndex(),
          viewMode: "original" as const,
          refineAnalysis: null,
          refineStatus: "idle" as const,
          refineIteration: 0,
          refineResult: null,
          refineHistory: [],
          refineError: null,
          refineElapsed: 0,
          refineCost: null,
          refineStartMismatch: null,
          refinePriorIssuesJson: null,
          diffObjectUrl: null,
        }));
      });
    },

    failAnalysis(id: string, error: string) {
      set((state) =>
        updateCard(state, id, () => ({
          status: "error" as const,
          error,
        })),
      );
    },

    setNormalizedImage(id: string, file: File | null) {
      set((state) => updateCard(state, id, () => ({ normalizedImage: file })));
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

    resetAnalysis(id: string) {
      const {
        autoRefine,
        refineVisionModel,
        refineVisionEffort,
        refineEditModel,
        refineEditEffort,
        refineDefaultMaxIterations,
        refineDefaultMismatchThreshold,
      } = get();
      set((state) => {
        const card = state.cards.get(id);
        revokeObjectUrl(card?.diffObjectUrl);
        return updateCard(state, id, () => ({
          status: "idle" as const,
          analysis: null,
          pass1Analysis: null,
          log: [],
          elapsed: 0,
          pass1: null,
          pass1Elapsed: 0,
          pass1Cost: null,
          refinePass: {
            visionModel: refineVisionModel,
            visionEffort: refineVisionEffort,
            editModel: refineEditModel,
            editEffort: refineEditEffort,
          },
          refineSettingsLocked: false,
          error: null,
          activeStage: "extract" as const,
          selectedTemplateIndex: createSelectedTemplateIndex(),
          viewMode: "original" as const,
          refineAnalysis: null,
          refineStatus: "idle" as const,
          refineIteration: 0,
          autoRefine,
          refineMaxIterations: refineDefaultMaxIterations,
          refineMismatchThreshold: refineDefaultMismatchThreshold,
          refineResult: null,
          refineHistory: [],
          refineError: null,
          refineElapsed: 0,
          refineCost: null,
          refinePriorIssuesJson: null,
          normalizedImage: null,
          diffObjectUrl: null,
          promptHistory: [],
        }));
      });
    },

    setViewMode(id: string, mode: "original" | "extract" | "iter" | "diff") {
      set((state) => updateCard(state, id, () => ({ viewMode: mode })));
    },

    setActiveStage(id: string, stage: AnalysisStage) {
      set((state) => updateCard(state, id, () => ({ activeStage: stage })));
    },

    selectTemplate(id: string, index: number) {
      set((state) =>
        updateCard(state, id, (card) => ({
          selectedTemplateIndex: {
            ...card.selectedTemplateIndex,
            [card.activeStage]: index,
          },
        })),
      );
    },

    setAutoRefine(enabled: boolean) {
      set((state) => {
        const cards = updateUnlockedCards(state, () => ({ autoRefine: enabled }));
        return cards ? { autoRefine: enabled, cards } : { autoRefine: enabled };
      });
    },

    setCardAutoRefine(id: string, enabled: boolean) {
      set((state) => updateCard(state, id, () => ({ autoRefine: enabled })));
    },

    setRefineMaxIterations(id: string, max: number) {
      set((state) => {
        const card = state.cards.get(id);
        if (!card) return {};
        if (card.refineSettingsLocked) {
          return updateCard(state, id, () => ({ refineMaxIterations: max }));
        }
        const cards = updateUnlockedCards(state, () => ({ refineMaxIterations: max }));
        return cards
          ? { refineDefaultMaxIterations: max, cards }
          : { refineDefaultMaxIterations: max };
      });
    },

    setRefineMismatchThreshold(id: string, threshold: number) {
      set((state) => {
        const card = state.cards.get(id);
        if (!card) return {};
        if (card.refineSettingsLocked) {
          return updateCard(state, id, () => ({ refineMismatchThreshold: threshold }));
        }
        const cards = updateUnlockedCards(state, () => ({ refineMismatchThreshold: threshold }));
        return cards
          ? { refineDefaultMismatchThreshold: threshold, cards }
          : { refineDefaultMismatchThreshold: threshold };
      });
    },

    startRefinement(id: string) {
      set((state) => {
        const card = state.cards.get(id);
        revokeObjectUrl(card?.diffObjectUrl);
        return updateCard(state, id, () => ({
          refineAnalysis: null,
          refineStatus: "running" as const,
          refineIteration: 0,
          refineResult: null,
          refineHistory: [],
          refineError: null,
          refineElapsed: 0,
          refineCost: null,
          refineStartMismatch: null,
          refinePriorIssuesJson: null,
          diffObjectUrl: null,
          promptHistory: card?.promptHistory.filter((entry) => entry.stage !== "refine") ?? [],
          activeStage: "refine" as const,
        }));
      });
    },

    /** Continue refinement: keep existing history, bump maxIterations by 1, set running. */
    continueRefinement(id: string) {
      set((state) =>
        updateCard(state, id, (card) => ({
          refineStatus: "running" as const,
          refineError: null,
          refineMaxIterations: card.refineIteration + 1,
          activeStage: "refine" as const,
        })),
      );
    },

    setRefinePriorIssuesJson(id: string, issuesJson: string | null) {
      set((state) => updateCard(state, id, () => ({
        refinePriorIssuesJson: issuesJson,
      })));
    },

    updateRefineDiff(id: string, iteration: number, mismatchRatio: number, diffArtifactUrl: string) {
      set((state) => {
        const card = state.cards.get(id);
        return updateCard(state, id, () => ({
          refineIteration: iteration,
          // Capture the initial (pre-refine) mismatch on the first diff
          ...(card?.refineStartMismatch == null ? { refineStartMismatch: mismatchRatio } : {}),
          refineResult: {
            ...(card?.refineResult ?? {
              proposals: [],
              regions: [],
              diffArtifactUrl: "",
              mismatchRatio: 0,
              iteration: 0,
            }),
            iteration,
            mismatchRatio,
            diffArtifactUrl,
          },
        }));
      },
      );
    },

    updateRefinement(id: string, result: RefineIterationResult) {
      set((state) =>
        updateCard(state, id, (card) => {
          const baseAnalysis = card.refineAnalysis ?? card.analysis;
          const refineAnalysis = baseAnalysis
            ? sortAnalysisResult({
                ...baseAnalysis,
                proposals: result.proposals,
              })
            : null;

          // Update current result and proposals but do NOT push to history here.
          // History is pushed by completeRefineIteration once the post-patch
          // diff score is known, avoiding duplicate or stale entries.
          return {
            refineAnalysis,
            refineIteration: result.iteration,
            refineResult: result,
          };
        }),
      );
    },

    /** Push the current refineResult to history with the final post-patch score. */
    completeRefineIteration(id: string, mismatchRatio: number) {
      set((state) =>
        updateCard(state, id, (card) => {
          if (!card.refineResult) return {};
          const entry = { ...card.refineResult, mismatchRatio };
          return {
            refineResult: entry,
            refineHistory: [...card.refineHistory, entry],
          };
        }),
      );
    },

    setDiffObjectUrl(id: string, url: string | null) {
      set((state) => {
        const card = state.cards.get(id);
        revokeObjectUrl(card?.diffObjectUrl);
        return updateCard(state, id, () => ({ diffObjectUrl: url }));
      });
    },

    completeRefinement(id: string, elapsed?: number, cost?: number | null) {
      set((state) =>
        updateCard(state, id, (card) => ({
          refineStatus: "done" as const,
          refineError: null,
          ...(elapsed != null ? { refineElapsed: card.refineElapsed + elapsed } : {}),
          ...(cost != null ? { refineCost: (card.refineCost ?? 0) + cost } : {}),
        })),
      );
    },

    failRefinement(id: string, error: string) {
      set((state) =>
        updateCard(state, id, () => ({
          refineStatus: "error" as const,
          refineError: error,
        })),
      );
    },

    abortRefinement(id: string) {
      set((state) =>
        updateCard(state, id, () => ({
          refineStatus: "done" as const,
          refineError: null,
        })),
      );
    },

    tickElapsed(id: string) {
      set((state) =>
        updateCard(state, id, (card) =>
          card.status === "analyzing" || card.refineStatus === "running"
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
        newCards.set(id, { ...card, position: gridPosition(i, cols) });
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

    setModel(model: string) {
      set({ model });
    },

    setEffort(effort: string) {
      set({ effort });
    },

    setRefineVisionModel(refineVisionModel: string) {
      set((state) => {
        const cards = updateUnlockedCards(state, (card) => ({
          refinePass: {
            ...(card.refinePass ?? currentRefinePass(state)),
            visionModel: refineVisionModel,
          },
        }));
        return cards ? { refineVisionModel, cards } : { refineVisionModel };
      });
    },

    setRefineVisionEffort(refineVisionEffort: string) {
      set((state) => {
        const cards = updateUnlockedCards(state, (card) => ({
          refinePass: {
            ...(card.refinePass ?? currentRefinePass(state)),
            visionEffort: refineVisionEffort,
          },
        }));
        return cards
          ? { refineVisionEffort, cards }
          : { refineVisionEffort };
      });
    },

    setRefineEditModel(refineEditModel: string) {
      set((state) => {
        const cards = updateUnlockedCards(state, (card) => ({
          refinePass: {
            ...(card.refinePass ?? currentRefinePass(state)),
            editModel: refineEditModel,
          },
        }));
        return cards ? { refineEditModel, cards } : { refineEditModel };
      });
    },

    setRefineEditEffort(refineEditEffort: string) {
      set((state) => {
        const cards = updateUnlockedCards(state, (card) => ({
          refinePass: {
            ...(card.refinePass ?? currentRefinePass(state)),
            editEffort: refineEditEffort,
          },
        }));
        return cards
          ? { refineEditEffort, cards }
          : { refineEditEffort };
      });
    },

    setCardRefineVisionModel(id: string, model: string) {
      set((state) =>
        updateCard(state, id, (card) => ({
          refinePass: {
            ...(card.refinePass ?? currentRefinePass(state)),
            visionModel: model,
          },
        })),
      );
    },

    setCardRefineVisionEffort(id: string, effort: string) {
      set((state) =>
        updateCard(state, id, (card) => ({
          refinePass: {
            ...(card.refinePass ?? currentRefinePass(state)),
            visionEffort: effort,
          },
        })),
      );
    },

    setCardRefineEditModel(id: string, model: string) {
      set((state) =>
        updateCard(state, id, (card) => ({
          refinePass: {
            ...(card.refinePass ?? currentRefinePass(state)),
            editModel: model,
          },
        })),
      );
    },

    setCardRefineEditEffort(id: string, effort: string) {
      set((state) =>
        updateCard(state, id, (card) => ({
          refinePass: {
            ...(card.refinePass ?? currentRefinePass(state)),
            editEffort: effort,
          },
        })),
      );
    },

    setPreviewDebugTextBoxes(previewDebugTextBoxes: boolean) {
      set({ previewDebugTextBoxes });
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
