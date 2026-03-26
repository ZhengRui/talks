# Extract Canvas Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `/workbench/extract` from a linear single-slide workflow into a multi-slide canvas workspace with zoom/pan, auto-layout image cards, and a Figma-style right-side inspector panel.

**Architecture:** Zustand store manages all state (cards, viewport, selection, modals). A CSS-transform-based canvas viewport provides zoom/pan. Slide cards are DOM elements with region overlay divs. A fixed-position right inspector panel provides thumbnail navigation and contextual content (analyze form, spinner, or template inspector). API routes are unchanged.

**Tech Stack:** React 19, Zustand, CSS transforms (zoom/pan), Tailwind CSS 4, existing `/api/extract/analyze` SSE endpoint.

**Design doc:** `plans/2026-03-18-extract-canvas-redesign-design.md`

---

### Task 1: Install Zustand

**Files:**
- Modify: `package.json`

**Step 1: Install dependency**

Run: `bun add zustand`
Expected: zustand added to package.json dependencies

**Step 2: Verify install**

Run: `bun run build 2>&1 | tail -5`
Expected: Build succeeds (zustand doesn't affect existing code)

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "feat(extract): add zustand dependency for canvas state management"
```

---

### Task 2: Create Zustand Store

**Files:**
- Create: `src/components/extract/store.ts`
- Reference: `src/components/extract/types.ts` (existing `AnalysisResult`, `Proposal`)

**Step 1: Write the store test**

Create `src/components/extract/__tests__/store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";

// We'll import the store creator once implemented
// For now, test the store shape and actions

describe("ExtractStore", () => {
  // Use a fresh store per test to avoid state leakage
  let useStore: ReturnType<typeof import("../store").createExtractStore>;

  beforeEach(async () => {
    const { createExtractStore } = await import("../store");
    useStore = createExtractStore();
  });

  describe("addCard", () => {
    it("creates a card with idle status and auto-layout position", () => {
      const file = new File(["img"], "slide1.png", { type: "image/png" });
      const id = useStore.getState().addCard(file);

      const card = useStore.getState().cards.get(id);
      expect(card).toBeDefined();
      expect(card!.status).toBe("idle");
      expect(card!.file).toBe(file);
      expect(card!.position).toEqual({ x: 0, y: 0 });
      expect(useStore.getState().cardOrder).toContain(id);
    });

    it("places second card to the right of the first", () => {
      const file1 = new File(["a"], "s1.png", { type: "image/png" });
      const file2 = new File(["b"], "s2.png", { type: "image/png" });
      const id1 = useStore.getState().addCard(file1);
      const id2 = useStore.getState().addCard(file2);

      const card1 = useStore.getState().cards.get(id1)!;
      const card2 = useStore.getState().cards.get(id2)!;
      expect(card2.position.x).toBeGreaterThan(card1.position.x);
    });
  });

  describe("selectCard", () => {
    it("sets selectedCardId", () => {
      const file = new File(["img"], "s.png", { type: "image/png" });
      const id = useStore.getState().addCard(file);
      useStore.getState().selectCard(id);
      expect(useStore.getState().selectedCardId).toBe(id);
    });

    it("clears selection with null", () => {
      useStore.getState().selectCard(null);
      expect(useStore.getState().selectedCardId).toBeNull();
    });
  });

  describe("removeCard", () => {
    it("removes card and clears selection if it was selected", () => {
      const file = new File(["img"], "s.png", { type: "image/png" });
      const id = useStore.getState().addCard(file);
      useStore.getState().selectCard(id);
      useStore.getState().removeCard(id);

      expect(useStore.getState().cards.has(id)).toBe(false);
      expect(useStore.getState().cardOrder).not.toContain(id);
      expect(useStore.getState().selectedCardId).toBeNull();
    });
  });

  describe("analysis lifecycle", () => {
    it("startAnalysis sets status to analyzing", () => {
      const file = new File(["img"], "s.png", { type: "image/png" });
      const id = useStore.getState().addCard(file);
      useStore.getState().startAnalysis(id);
      expect(useStore.getState().cards.get(id)!.status).toBe("analyzing");
    });

    it("completeAnalysis sets status to analyzed with result", () => {
      const file = new File(["img"], "s.png", { type: "image/png" });
      const id = useStore.getState().addCard(file);
      useStore.getState().startAnalysis(id);

      const result = {
        source: { image: "test.png", dimensions: { w: 800, h: 600 }, imagePath: "/api/extract/image?path=test" },
        proposals: [],
      };
      useStore.getState().completeAnalysis(id, result);

      const card = useStore.getState().cards.get(id)!;
      expect(card.status).toBe("analyzed");
      expect(card.analysis).toBe(result);
      expect(card.selectedTemplateIndex).toBe(0);
    });

    it("failAnalysis sets status to error", () => {
      const file = new File(["img"], "s.png", { type: "image/png" });
      const id = useStore.getState().addCard(file);
      useStore.getState().startAnalysis(id);
      useStore.getState().failAnalysis(id, "API failed");

      const card = useStore.getState().cards.get(id)!;
      expect(card.status).toBe("error");
      expect(card.error).toBe("API failed");
    });

    it("appendLog adds entries to the card", () => {
      const file = new File(["img"], "s.png", { type: "image/png" });
      const id = useStore.getState().addCard(file);
      useStore.getState().appendLog(id, { type: "status", content: "Starting", timestamp: Date.now() });

      expect(useStore.getState().cards.get(id)!.log).toHaveLength(1);
    });

    it("appendLog merges streaming types", () => {
      const file = new File(["img"], "s.png", { type: "image/png" });
      const id = useStore.getState().addCard(file);
      useStore.getState().appendLog(id, { type: "text", content: "Hello ", timestamp: Date.now() });
      useStore.getState().appendLog(id, { type: "text", content: "world", timestamp: Date.now() });

      const log = useStore.getState().cards.get(id)!.log;
      expect(log).toHaveLength(1);
      expect(log[0].content).toBe("Hello world");
    });
  });

  describe("selectTemplate", () => {
    it("updates selectedTemplateIndex on the card", () => {
      const file = new File(["img"], "s.png", { type: "image/png" });
      const id = useStore.getState().addCard(file);
      useStore.getState().selectTemplate(id, 2);
      expect(useStore.getState().cards.get(id)!.selectedTemplateIndex).toBe(2);
    });
  });

  describe("viewport", () => {
    it("setPan updates pan", () => {
      useStore.getState().setPan({ x: 100, y: -50 });
      expect(useStore.getState().pan).toEqual({ x: 100, y: -50 });
    });

    it("setZoom clamps to 0.25-2.0", () => {
      useStore.getState().setZoom(0.1);
      expect(useStore.getState().zoom).toBe(0.25);
      useStore.getState().setZoom(5);
      expect(useStore.getState().zoom).toBe(2.0);
    });
  });

  describe("modals", () => {
    it("openYamlModal / closeYamlModal", () => {
      useStore.getState().openYamlModal("card1", 0);
      expect(useStore.getState().yamlModal).toEqual({ open: true, cardId: "card1", templateIndex: 0 });
      useStore.getState().closeYamlModal();
      expect(useStore.getState().yamlModal.open).toBe(false);
    });

    it("openLogModal / closeLogModal", () => {
      useStore.getState().openLogModal("card1");
      expect(useStore.getState().logModal).toEqual({ open: true, cardId: "card1" });
      useStore.getState().closeLogModal();
      expect(useStore.getState().logModal.open).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/components/extract/__tests__/store.test.ts`
Expected: FAIL — `../store` module not found

**Step 3: Implement the store**

Create `src/components/extract/store.ts`:

```typescript
import { createStore } from "zustand/vanilla";
import type { AnalysisResult } from "./types";

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
  cards: Map<string, SlideCard>;
  cardOrder: string[];

  pan: { x: number; y: number };
  zoom: number;

  selectedCardId: string | null;

  yamlModal: { open: boolean; cardId: string | null; templateIndex: number };
  logModal: { open: boolean; cardId: string | null };
}

// Card layout constants
const CARD_WIDTH = 480;
const CARD_HEIGHT = 270;
const CARD_GAP = 40;
const CARDS_PER_ROW = 4;

const STREAMING_TYPES = new Set(["text", "thinking"]);

export interface ExtractActions {
  addCard: (file: File) => string;
  removeCard: (id: string) => void;
  selectCard: (id: string | null) => void;

  updateDescription: (id: string, text: string) => void;
  startAnalysis: (id: string) => void;
  appendLog: (id: string, entry: LogEntry) => void;
  completeAnalysis: (id: string, result: AnalysisResult) => void;
  failAnalysis: (id: string, error: string) => void;

  selectTemplate: (id: string, index: number) => void;

  setPan: (pan: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;

  openYamlModal: (cardId: string, templateIndex: number) => void;
  closeYamlModal: () => void;
  openLogModal: (cardId: string) => void;
  closeLogModal: () => void;
}

export type ExtractStore = ExtractState & ExtractActions;

function autoLayoutPosition(index: number): { x: number; y: number } {
  const col = index % CARDS_PER_ROW;
  const row = Math.floor(index / CARDS_PER_ROW);
  return {
    x: col * (CARD_WIDTH + CARD_GAP),
    y: row * (CARD_HEIGHT + CARD_GAP),
  };
}

export function createExtractStore() {
  return createStore<ExtractStore>((set, get) => ({
    cards: new Map(),
    cardOrder: [],

    pan: { x: 0, y: 0 },
    zoom: 1,

    selectedCardId: null,

    yamlModal: { open: false, cardId: null, templateIndex: 0 },
    logModal: { open: false, cardId: null },

    addCard: (file: File) => {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      const { cardOrder, cards } = get();
      const position = autoLayoutPosition(cardOrder.length);

      const card: SlideCard = {
        id,
        file,
        previewUrl,
        position,
        size: { w: CARD_WIDTH, h: CARD_HEIGHT },
        status: "idle",
        description: "",
        analysis: null,
        log: [],
        elapsed: 0,
        error: null,
        selectedTemplateIndex: 0,
      };

      const newCards = new Map(cards);
      newCards.set(id, card);
      set({ cards: newCards, cardOrder: [...cardOrder, id] });
      return id;
    },

    removeCard: (id: string) => {
      const { cards, cardOrder, selectedCardId } = get();
      const newCards = new Map(cards);
      const removed = newCards.get(id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      newCards.delete(id);
      set({
        cards: newCards,
        cardOrder: cardOrder.filter((cid) => cid !== id),
        selectedCardId: selectedCardId === id ? null : selectedCardId,
      });
    },

    selectCard: (id: string | null) => {
      set({ selectedCardId: id });
    },

    updateDescription: (id: string, text: string) => {
      const { cards } = get();
      const card = cards.get(id);
      if (!card) return;
      const newCards = new Map(cards);
      newCards.set(id, { ...card, description: text });
      set({ cards: newCards });
    },

    startAnalysis: (id: string) => {
      const { cards } = get();
      const card = cards.get(id);
      if (!card) return;
      const newCards = new Map(cards);
      newCards.set(id, { ...card, status: "analyzing", log: [], elapsed: 0, error: null });
      set({ cards: newCards });
    },

    appendLog: (id: string, entry: LogEntry) => {
      const { cards } = get();
      const card = cards.get(id);
      if (!card) return;

      let newLog: LogEntry[];
      if (
        STREAMING_TYPES.has(entry.type) &&
        card.log.length > 0 &&
        card.log[card.log.length - 1].type === entry.type
      ) {
        newLog = [...card.log];
        const last = newLog[newLog.length - 1];
        newLog[newLog.length - 1] = { ...last, content: last.content + entry.content };
      } else {
        newLog = [...card.log, entry];
      }

      const newCards = new Map(cards);
      newCards.set(id, { ...card, log: newLog });
      set({ cards: newCards });
    },

    completeAnalysis: (id: string, result: AnalysisResult) => {
      const { cards } = get();
      const card = cards.get(id);
      if (!card) return;
      const newCards = new Map(cards);
      newCards.set(id, { ...card, status: "analyzed", analysis: result, selectedTemplateIndex: 0 });
      set({ cards: newCards });
    },

    failAnalysis: (id: string, error: string) => {
      const { cards } = get();
      const card = cards.get(id);
      if (!card) return;
      const newCards = new Map(cards);
      newCards.set(id, { ...card, status: "error", error });
      set({ cards: newCards });
    },

    selectTemplate: (id: string, index: number) => {
      const { cards } = get();
      const card = cards.get(id);
      if (!card) return;
      const newCards = new Map(cards);
      newCards.set(id, { ...card, selectedTemplateIndex: index });
      set({ cards: newCards });
    },

    setPan: (pan) => {
      set({ pan });
    },

    setZoom: (zoom) => {
      set({ zoom: Math.min(2.0, Math.max(0.25, zoom)) });
    },

    openYamlModal: (cardId, templateIndex) => {
      set({ yamlModal: { open: true, cardId, templateIndex } });
    },

    closeYamlModal: () => {
      set({ yamlModal: { open: false, cardId: null, templateIndex: 0 } });
    },

    openLogModal: (cardId) => {
      set({ logModal: { open: true, cardId } });
    },

    closeLogModal: () => {
      set({ logModal: { open: false, cardId: null } });
    },
  }));
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/components/extract/__tests__/store.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/extract/store.ts src/components/extract/__tests__/store.test.ts
git commit -m "feat(extract): add Zustand store for canvas workspace state"
```

---

### Task 3: Create CanvasViewport Component

**Files:**
- Create: `src/components/extract/CanvasViewport.tsx`

This component handles zoom/pan via CSS transforms, paste events, and click-to-deselect.

**Step 1: Write the component test**

Create `src/components/extract/__tests__/CanvasViewport.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CanvasViewport from "../CanvasViewport";

// Mock the store
const mockStore = {
  pan: { x: 0, y: 0 },
  zoom: 1,
  cards: new Map(),
  cardOrder: [] as string[],
  selectedCardId: null,
  setPan: vi.fn(),
  setZoom: vi.fn(),
  selectCard: vi.fn(),
  addCard: vi.fn(() => "test-id"),
};

vi.mock("../store", () => ({
  useExtractStore: (selector: (s: typeof mockStore) => unknown) => selector(mockStore),
}));

describe("CanvasViewport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the transform container with correct styles", () => {
    render(<CanvasViewport />);
    const transform = screen.getByTestId("canvas-transform");
    expect(transform.style.transform).toBe("translate(0px, 0px) scale(1)");
  });

  it("clicking empty area deselects", () => {
    render(<CanvasViewport />);
    const viewport = screen.getByTestId("canvas-viewport");
    fireEvent.mouseDown(viewport);
    fireEvent.mouseUp(viewport);
    expect(mockStore.selectCard).toHaveBeenCalledWith(null);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/components/extract/__tests__/CanvasViewport.test.tsx`
Expected: FAIL — module not found

**Step 3: Implement CanvasViewport**

Create `src/components/extract/CanvasViewport.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useExtractStore } from "./store";
import SlideCard from "./SlideCard";

export default function CanvasViewport() {
  const pan = useExtractStore((s) => s.pan);
  const zoom = useExtractStore((s) => s.zoom);
  const cardOrder = useExtractStore((s) => s.cardOrder);
  const selectedCardId = useExtractStore((s) => s.selectedCardId);
  const setPan = useExtractStore((s) => s.setPan);
  const setZoom = useExtractStore((s) => s.setZoom);
  const selectCard = useExtractStore((s) => s.selectCard);
  const addCard = useExtractStore((s) => s.addCard);

  const viewportRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  // Zoom toward cursor on wheel
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;

      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(2.0, Math.max(0.25, zoom * zoomFactor));

      const newPanX = cursorX - (cursorX - pan.x) * (newZoom / zoom);
      const newPanY = cursorY - (cursorY - pan.y) * (newZoom / zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [zoom, pan, setZoom, setPan],
  );

  // Attach wheel with passive: false
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Pan via middle-click or space+drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.currentTarget === e.target)) {
        isPanning.current = true;
        didDrag.current = false;
        panStart.current = { x: e.clientX, y: e.clientY };
        panOrigin.current = { ...pan };
      }
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
      setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
    },
    [setPan],
  );

  const handleMouseUp = useCallback(() => {
    if (isPanning.current && !didDrag.current) {
      selectCard(null);
    }
    isPanning.current = false;
  }, [selectCard]);

  // Paste handler
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const id = addCard(file);
            selectCard(id);
          }
        }
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [addCard, selectCard]);

  return (
    <div
      ref={viewportRef}
      data-testid="canvas-viewport"
      className="absolute inset-0 overflow-hidden bg-[#080c14] cursor-grab active:cursor-grabbing"
      style={{ right: 360 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div
        data-testid="canvas-transform"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {cardOrder.map((id) => (
          <SlideCard key={id} cardId={id} />
        ))}
      </div>

      {/* Empty state hint */}
      {cardOrder.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center text-[#3a4a60]">
            <p className="text-lg">Paste an image (Cmd+V)</p>
            <p className="mt-1 text-sm">to add slides to the canvas</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: This file imports `SlideCard` which doesn't exist yet. The test mocks the store so it won't render SlideCard. We'll create SlideCard in Task 4.

Also update `src/components/extract/store.ts` to export a React hook. Add at the bottom of the file:

```typescript
import { useStore } from "zustand";

// Singleton store instance for the app
let storeInstance: ReturnType<typeof createExtractStore> | null = null;

function getStore() {
  if (!storeInstance) storeInstance = createExtractStore();
  return storeInstance;
}

export function useExtractStore<T>(selector: (state: ExtractStore) => T): T {
  return useStore(getStore(), selector);
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/components/extract/__tests__/CanvasViewport.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/extract/CanvasViewport.tsx src/components/extract/__tests__/CanvasViewport.test.tsx src/components/extract/store.ts
git commit -m "feat(extract): add CanvasViewport with zoom/pan/paste"
```

---

### Task 4: Create SlideCard Component

**Files:**
- Create: `src/components/extract/SlideCard.tsx`
- Reference: `src/components/extract/OverlayPreview.tsx` (port region overlay logic)

**Step 1: Write the test**

Create `src/components/extract/__tests__/SlideCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SlideCard from "../SlideCard";

const mockCard = {
  id: "card-1",
  file: new File(["img"], "s.png", { type: "image/png" }),
  previewUrl: "blob:test",
  position: { x: 100, y: 50 },
  size: { w: 480, h: 270 },
  status: "idle" as const,
  description: "",
  analysis: null,
  log: [],
  elapsed: 0,
  error: null,
  selectedTemplateIndex: 0,
};

const mockSelectCard = vi.fn();
const mockSelectTemplate = vi.fn();

vi.mock("../store", () => ({
  useExtractStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      cards: new Map([["card-1", mockCard]]),
      selectedCardId: null,
      selectCard: mockSelectCard,
      selectTemplate: mockSelectTemplate,
    }),
}));

describe("SlideCard", () => {
  it("renders at the correct position", () => {
    render(<SlideCard cardId="card-1" />);
    const el = screen.getByTestId("slide-card-card-1");
    expect(el.style.left).toBe("100px");
    expect(el.style.top).toBe("50px");
  });

  it("clicking selects the card", () => {
    render(<SlideCard cardId="card-1" />);
    fireEvent.click(screen.getByTestId("slide-card-card-1"));
    expect(mockSelectCard).toHaveBeenCalledWith("card-1");
  });

  it("shows status label", () => {
    render(<SlideCard cardId="card-1" />);
    // idle cards show no special indicator — just the image
    expect(screen.getByRole("img")).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/components/extract/__tests__/SlideCard.test.tsx`
Expected: FAIL

**Step 3: Implement SlideCard**

Create `src/components/extract/SlideCard.tsx`:

```tsx
"use client";

import { useExtractStore } from "./store";
import { regionColor } from "./types";

interface SlideCardProps {
  cardId: string;
}

export default function SlideCard({ cardId }: SlideCardProps) {
  const card = useExtractStore((s) => s.cards.get(cardId));
  const isSelected = useExtractStore((s) => s.selectedCardId === cardId);
  const selectCard = useExtractStore((s) => s.selectCard);
  const selectTemplate = useExtractStore((s) => s.selectTemplate);

  if (!card) return null;

  const proposals = card.analysis?.proposals ?? [];
  const srcW = card.analysis?.source.dimensions.w ?? 0;
  const srcH = card.analysis?.source.dimensions.h ?? 0;

  return (
    <div
      data-testid={`slide-card-${cardId}`}
      className="absolute cursor-pointer rounded-lg transition-shadow"
      style={{
        left: card.position.x,
        top: card.position.y,
        width: card.size.w,
        height: card.size.h,
        border: isSelected ? "2px solid #22d3ee" : "2px solid transparent",
        boxShadow: isSelected ? "0 0 20px rgba(34, 211, 238, 0.15)" : "0 2px 8px rgba(0,0,0,0.3)",
      }}
      onClick={(e) => {
        e.stopPropagation();
        selectCard(cardId);
      }}
    >
      {/* Slide image */}
      <img
        src={card.status === "analyzed" ? card.analysis!.source.imagePath : card.previewUrl}
        alt=""
        className="pointer-events-none h-full w-full rounded-lg object-cover select-none"
      />

      {/* Region overlays — only when selected + analyzed */}
      {isSelected && card.status === "analyzed" && srcW > 0 && (
        <div
          className="absolute inset-0 rounded-lg overflow-hidden"
        >
          {proposals.map((p, i) => {
            const color = regionColor(i);
            const isActiveTemplate = i === card.selectedTemplateIndex;
            const coversFullSlide = p.region.w > srcW * 0.9 && p.region.h > srcH * 0.9;
            if (coversFullSlide) return null;

            // Scale region coords to card display size
            const scaleX = card.size.w / srcW;
            const scaleY = card.size.h / srcH;

            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                className="absolute cursor-pointer"
                style={{
                  left: p.region.x * scaleX,
                  top: p.region.y * scaleY,
                  width: p.region.w * scaleX,
                  height: p.region.h * scaleY,
                  border: `${isActiveTemplate ? 3 : 2}px solid ${color}`,
                  borderRadius: 4,
                  opacity: isActiveTemplate ? 1 : 0.5,
                  background: isActiveTemplate ? `${color}15` : "transparent",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  selectTemplate(cardId, i);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectTemplate(cardId, i);
                  }
                }}
              >
                <span
                  className="absolute -top-4 left-0 whitespace-nowrap rounded px-1 py-0.5 text-[9px] font-semibold"
                  style={{ backgroundColor: color, color: "#0a0f18" }}
                >
                  {p.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Status indicator */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between rounded-b-lg bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
        <span className="text-[10px] text-white/60 truncate max-w-[70%]">
          {card.file.name}
        </span>
        {card.status === "analyzing" && (
          <span className="flex items-center gap-1 text-[10px] text-cyan-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            {card.elapsed}s
          </span>
        )}
        {card.status === "analyzed" && (
          <span className="text-[10px] text-emerald-400">
            {proposals.length} templates
          </span>
        )}
        {card.status === "error" && (
          <span className="text-[10px] text-red-400">Error</span>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/components/extract/__tests__/SlideCard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/extract/SlideCard.tsx src/components/extract/__tests__/SlideCard.test.tsx
git commit -m "feat(extract): add SlideCard with region overlays"
```

---

### Task 5: Create InspectorPanel + Subcomponents

**Files:**
- Create: `src/components/extract/InspectorPanel.tsx`
- Create: `src/components/extract/ThumbnailStrip.tsx`
- Create: `src/components/extract/AnalyzeForm.tsx`
- Create: `src/components/extract/AnalyzingSpinner.tsx`
- Create: `src/components/extract/TemplateInspector.tsx`
- Create: `src/components/extract/TemplateTabs.tsx`
- Create: `src/components/extract/ParamsStyleView.tsx`

This is a larger task since these components are tightly related. They're mostly presentational — the logic lives in the store.

**Step 1: Write the InspectorPanel integration test**

Create `src/components/extract/__tests__/InspectorPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import InspectorPanel from "../InspectorPanel";

let mockState: Record<string, unknown>;

vi.mock("../store", () => ({
  useExtractStore: (selector: (s: Record<string, unknown>) => unknown) => selector(mockState),
}));

describe("InspectorPanel", () => {
  beforeEach(() => {
    mockState = {
      cards: new Map(),
      cardOrder: [],
      selectedCardId: null,
      selectCard: vi.fn(),
      updateDescription: vi.fn(),
      startAnalysis: vi.fn(),
      selectTemplate: vi.fn(),
      openYamlModal: vi.fn(),
      openLogModal: vi.fn(),
    };
  });

  it("shows empty state when no card selected", () => {
    render(<InspectorPanel />);
    expect(screen.getByText(/paste an image/i)).toBeDefined();
  });

  it("shows analyze form when idle card selected", () => {
    const card = {
      id: "c1",
      status: "idle",
      description: "",
      file: new File(["x"], "s.png", { type: "image/png" }),
      previewUrl: "blob:x",
      analysis: null,
      log: [],
      elapsed: 0,
      error: null,
      selectedTemplateIndex: 0,
    };
    mockState.cards = new Map([["c1", card]]);
    mockState.cardOrder = ["c1"];
    mockState.selectedCardId = "c1";

    render(<InspectorPanel />);
    expect(screen.getByText(/analyze/i)).toBeDefined();
  });

  it("shows spinner when analyzing", () => {
    const card = {
      id: "c1",
      status: "analyzing",
      description: "",
      file: new File(["x"], "s.png", { type: "image/png" }),
      previewUrl: "blob:x",
      analysis: null,
      log: [],
      elapsed: 5,
      error: null,
      selectedTemplateIndex: 0,
    };
    mockState.cards = new Map([["c1", card]]);
    mockState.cardOrder = ["c1"];
    mockState.selectedCardId = "c1";

    render(<InspectorPanel />);
    expect(screen.getByText(/analyzing/i)).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/components/extract/__tests__/InspectorPanel.test.tsx`
Expected: FAIL

**Step 3: Implement all subcomponents**

Create each file. The implementations extract presentational logic from the existing `ProposalPanel.tsx` and `ExtractWorkbench.tsx`.

`src/components/extract/ThumbnailStrip.tsx`:

```tsx
"use client";

import { useExtractStore } from "./store";

export default function ThumbnailStrip() {
  const cardOrder = useExtractStore((s) => s.cardOrder);
  const cards = useExtractStore((s) => s.cards);
  const selectedCardId = useExtractStore((s) => s.selectedCardId);
  const selectCard = useExtractStore((s) => s.selectCard);

  if (cardOrder.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto p-2 border-b border-[#253044]">
      {cardOrder.map((id) => {
        const card = cards.get(id);
        if (!card) return null;
        const isSelected = id === selectedCardId;
        return (
          <button
            key={id}
            type="button"
            onClick={() => selectCard(id)}
            className="shrink-0 rounded-md overflow-hidden transition-all"
            style={{
              width: 64,
              height: 36,
              border: isSelected ? "2px solid #22d3ee" : "2px solid transparent",
              opacity: isSelected ? 1 : 0.6,
            }}
          >
            <img
              src={card.previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </button>
        );
      })}
    </div>
  );
}
```

`src/components/extract/AnalyzeForm.tsx`:

```tsx
"use client";

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
      <label className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8ca8]">
        Description (optional)
      </label>
      <textarea
        value={card.description}
        onChange={(e) => updateDescription(card.id, e.target.value)}
        placeholder="Describe the slide or what to extract..."
        rows={3}
        className="w-full rounded-lg border border-[#2b3648] bg-[#0d1421] px-3 py-2 text-[13px] text-[#e6edf7] placeholder-[#5a6a80] focus:border-cyan-400/50 focus:outline-none"
      />
      {card.error && (
        <p className="text-[12px] text-red-400">{card.error}</p>
      )}
      <button
        type="button"
        onClick={() => onAnalyze(card.id)}
        className="w-full rounded-lg bg-[#2e5fbf] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#3a6fd4]"
      >
        Analyze
      </button>
    </div>
  );
}
```

`src/components/extract/AnalyzingSpinner.tsx`:

```tsx
"use client";

import type { SlideCard } from "./store";
import { useExtractStore } from "./store";

interface AnalyzingSpinnerProps {
  card: SlideCard;
}

export default function AnalyzingSpinner({ card }: AnalyzingSpinnerProps) {
  const openLogModal = useExtractStore((s) => s.openLogModal);

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      <p className="text-[13px] text-[#8899b0]">
        Analyzing... {card.elapsed}s
      </p>
      <button
        type="button"
        onClick={() => openLogModal(card.id)}
        className="flex items-center gap-2 text-[12px] text-[#5a6a80] hover:text-slate-300 animate-pulse"
      >
        <span>View log</span>
      </button>
    </div>
  );
}
```

`src/components/extract/TemplateTabs.tsx`:

```tsx
"use client";

import { regionColor, type Proposal } from "./types";

interface TemplateTabsProps {
  proposals: Proposal[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export default function TemplateTabs({ proposals, selectedIndex, onSelect }: TemplateTabsProps) {
  return (
    <div className="flex overflow-x-auto border-b border-[#253044] bg-[#0d1421]">
      {proposals.map((p, i) => {
        const active = i === selectedIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-medium transition-colors ${
              active
                ? "border-cyan-400 bg-[#121a28] text-white"
                : "border-transparent text-[#7c8ca8] hover:bg-[#162030] hover:text-slate-300"
            }`}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: regionColor(i) }}
            />
            <span className="max-w-[120px] truncate">{p.name}</span>
            <span
              className={`rounded px-1 py-px text-[8px] font-semibold uppercase tracking-wide ${
                p.scope === "slide"
                  ? "bg-blue-500/20 text-blue-300"
                  : "bg-emerald-500/20 text-emerald-300"
              }`}
            >
              {p.scope}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

`src/components/extract/ParamsStyleView.tsx`:

```tsx
"use client";

import type { Proposal } from "./types";

interface ParamsStyleViewProps {
  proposal: Proposal;
}

export default function ParamsStyleView({ proposal }: ParamsStyleViewProps) {
  const params = Object.entries(proposal.params);
  const styles = Object.entries(proposal.style);

  return (
    <div className="p-3">
      <p className="mb-3 text-[12px] text-[#8899b0]">{proposal.description}</p>

      <div className="flex gap-3">
        {params.length > 0 && (
          <div className="flex-1 min-w-0">
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#7c8ca8]">Params</h4>
            <div className="space-y-1">
              {params.map(([name, field]) => (
                <div key={name} className="flex items-center gap-1.5 rounded-md bg-[#0b111c] px-2 py-1">
                  <span className="text-[12px] font-medium text-[#c8d4e2] truncate">{name}</span>
                  <span className="text-[9px] text-[#5a6a80]">{field.type}</span>
                  <span className="ml-auto max-w-[100px] truncate text-[11px] text-[#8899b0]">
                    {typeof field.value === "string" ? field.value : JSON.stringify(field.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {styles.length > 0 && (
          <div className="flex-1 min-w-0">
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#7c8ca8]">Style</h4>
            <div className="space-y-1">
              {styles.map(([name, field]) => (
                <div key={name} className="flex items-center gap-1.5 rounded-md bg-[#0b111c] px-2 py-1">
                  <span className="text-[12px] font-medium text-[#c8d4e2] truncate">{name}</span>
                  {typeof field.value === "string" && field.value.startsWith("#") && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm border border-[#364152]"
                      style={{ backgroundColor: field.value }}
                    />
                  )}
                  <span className="ml-auto text-[11px] text-[#8899b0]">
                    {String(field.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

`src/components/extract/TemplateInspector.tsx`:

```tsx
"use client";

import type { SlideCard } from "./store";
import { useExtractStore } from "./store";
import TemplateTabs from "./TemplateTabs";
import ParamsStyleView from "./ParamsStyleView";

interface TemplateInspectorProps {
  card: SlideCard;
}

export default function TemplateInspector({ card }: TemplateInspectorProps) {
  const selectTemplate = useExtractStore((s) => s.selectTemplate);
  const openYamlModal = useExtractStore((s) => s.openYamlModal);
  const openLogModal = useExtractStore((s) => s.openLogModal);

  const proposals = card.analysis?.proposals ?? [];
  const selected = proposals[card.selectedTemplateIndex];

  if (proposals.length === 0) {
    return (
      <div className="p-3 text-[12px] text-[#5a6a80]">
        No templates extracted.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <TemplateTabs
        proposals={proposals}
        selectedIndex={card.selectedTemplateIndex}
        onSelect={(i) => selectTemplate(card.id, i)}
      />
      {selected && <ParamsStyleView proposal={selected} />}
      <div className="flex items-center justify-end gap-2 border-t border-[#253044] px-3 py-2">
        <button
          type="button"
          onClick={() => openYamlModal(card.id, card.selectedTemplateIndex)}
          className="rounded-md px-2 py-1 text-[11px] text-[#7c8ca8] hover:bg-[#1a2232] hover:text-slate-300"
          title="View YAML"
        >
          YAML
        </button>
        <button
          type="button"
          onClick={() => openLogModal(card.id)}
          className="rounded-md px-2 py-1 text-[11px] text-[#7c8ca8] hover:bg-[#1a2232] hover:text-slate-300"
          title="View log"
        >
          Log
        </button>
      </div>
    </div>
  );
}
```

`src/components/extract/InspectorPanel.tsx`:

```tsx
"use client";

import { useExtractStore } from "./store";
import ThumbnailStrip from "./ThumbnailStrip";
import AnalyzeForm from "./AnalyzeForm";
import AnalyzingSpinner from "./AnalyzingSpinner";
import TemplateInspector from "./TemplateInspector";

interface InspectorPanelProps {
  onAnalyze: (cardId: string) => void;
}

export default function InspectorPanel({ onAnalyze }: InspectorPanelProps) {
  const selectedCardId = useExtractStore((s) => s.selectedCardId);
  const cards = useExtractStore((s) => s.cards);

  const card = selectedCardId ? cards.get(selectedCardId) : undefined;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[360px] z-20 flex flex-col border-l border-[#253044] bg-[#0d1421]">
      <ThumbnailStrip />

      <div className="flex-1 overflow-y-auto">
        {!card && (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-center text-[13px] text-[#3a4a60]">
              Paste an image (Cmd+V) to add slides,<br />
              then click a slide to inspect it
            </p>
          </div>
        )}

        {card?.status === "idle" && (
          <AnalyzeForm card={card} onAnalyze={onAnalyze} />
        )}

        {card?.status === "error" && (
          <AnalyzeForm card={card} onAnalyze={onAnalyze} />
        )}

        {card?.status === "analyzing" && (
          <AnalyzingSpinner card={card} />
        )}

        {card?.status === "analyzed" && (
          <TemplateInspector card={card} />
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/components/extract/__tests__/InspectorPanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/extract/InspectorPanel.tsx src/components/extract/ThumbnailStrip.tsx src/components/extract/AnalyzeForm.tsx src/components/extract/AnalyzingSpinner.tsx src/components/extract/TemplateInspector.tsx src/components/extract/TemplateTabs.tsx src/components/extract/ParamsStyleView.tsx src/components/extract/__tests__/InspectorPanel.test.tsx
git commit -m "feat(extract): add InspectorPanel with thumbnail strip and contextual content"
```

---

### Task 6: Create YamlModal and LogModal

**Files:**
- Create: `src/components/extract/YamlModal.tsx`
- Create: `src/components/extract/LogModal.tsx`
- Reference: `src/components/extract/yaml-gen.ts` (reuse)
- Reference: `src/components/extract/ExtractWorkbench.tsx:72-165` (port LogEntryRow, mdComponents)

**Step 1: Write the YamlModal test**

Create `src/components/extract/__tests__/YamlModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import YamlModal from "../YamlModal";

const mockProposal = {
  scope: "block" as const,
  name: "test-card",
  description: "A test card",
  region: { x: 0, y: 0, w: 100, h: 100 },
  params: { title: { type: "string", value: "Hello" } },
  style: { bg: { type: "string", value: "#000" } },
  body: "text:\n  content: {{ title }}",
};

const mockCloseYamlModal = vi.fn();

vi.mock("../store", () => ({
  useExtractStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      yamlModal: { open: true, cardId: "c1", templateIndex: 0 },
      cards: new Map([
        ["c1", { analysis: { proposals: [mockProposal] } }],
      ]),
      closeYamlModal: mockCloseYamlModal,
    }),
}));

describe("YamlModal", () => {
  it("renders template and instance YAML", () => {
    render(<YamlModal />);
    expect(screen.getByText(/template yaml/i)).toBeDefined();
    expect(screen.getByText(/instance yaml/i)).toBeDefined();
  });

  it("closes on backdrop click", () => {
    render(<YamlModal />);
    fireEvent.click(screen.getByTestId("yaml-modal-backdrop"));
    expect(mockCloseYamlModal).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/components/extract/__tests__/YamlModal.test.tsx`
Expected: FAIL

**Step 3: Implement YamlModal**

Create `src/components/extract/YamlModal.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useExtractStore } from "./store";
import { generateTemplateYaml, generateInstanceYaml } from "./yaml-gen";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md border border-[#364152] px-2 py-0.5 text-[11px] text-slate-300 hover:bg-[#222c3f]"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function YamlModal() {
  const { open, cardId, templateIndex } = useExtractStore((s) => s.yamlModal);
  const cards = useExtractStore((s) => s.cards);
  const closeYamlModal = useExtractStore((s) => s.closeYamlModal);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeYamlModal();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, closeYamlModal]);

  if (!open || !cardId) return null;

  const card = cards.get(cardId);
  const proposal = card?.analysis?.proposals[templateIndex];
  if (!proposal) return null;

  const templateYaml = generateTemplateYaml(proposal);
  const instanceYaml = generateInstanceYaml(proposal);

  return (
    <div
      data-testid="yaml-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={closeYamlModal}
    >
      <div
        className="max-h-[80vh] w-[900px] max-w-[90vw] overflow-hidden rounded-xl border border-[#253044] bg-[#0d1421]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#253044] px-4 py-3">
          <h3 className="text-[14px] font-semibold text-white">{proposal.name}</h3>
          <button
            type="button"
            onClick={closeYamlModal}
            className="text-[#5a6a80] hover:text-slate-300"
          >
            &times;
          </button>
        </div>

        <div className="flex gap-4 overflow-auto p-4">
          <div className="flex-1 min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8ca8]">Template YAML</span>
              <CopyButton text={templateYaml} />
            </div>
            <pre className="max-h-[60vh] overflow-auto rounded-lg border border-[#2b3648] bg-[#0b111c] p-3 text-[12px] leading-5 text-slate-200">
              {templateYaml}
            </pre>
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8ca8]">Instance YAML</span>
              <CopyButton text={instanceYaml} />
            </div>
            <pre className="max-h-[60vh] overflow-auto rounded-lg border border-[#2b3648] bg-[#0b111c] p-3 text-[12px] leading-5 text-slate-200">
              {instanceYaml}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Implement LogModal**

Create `src/components/extract/LogModal.tsx`. Port `LogEntryRow`, `mdComponents`, `parseCatN`, `ToolResultBlock` from `ExtractWorkbench.tsx:17-165`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useExtractStore, type LogEntry } from "./store";

// --- Markdown styles (ported from ExtractWorkbench) ---
const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-[#e6edf7]">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-[#1a2438] px-1 py-0.5 text-[11px] text-cyan-300">{children}</code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-1.5 overflow-x-auto rounded-lg bg-[#0a0f18] border border-[#1e2a3a] p-2 text-[11px]">{children}</pre>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-1.5 ml-4 list-disc">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-1.5 ml-4 list-decimal">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="mb-0.5">{children}</li>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const LOG_ICONS: Record<string, string> = {
  status: "●", thinking: "💭", text: "│", tool: "⚙", tool_result: "↩", error: "✗",
};

const LOG_COLORS: Record<string, string> = {
  status: "text-cyan-400", thinking: "text-purple-400", text: "text-[#3a4a60]",
  tool: "text-amber-400", tool_result: "text-emerald-400", error: "text-red-400",
};

function parseCatN(content: string) {
  const rawLines = content.split("\n");
  const catNPattern = /^\s*(\d+)[→\t](.*)$/;
  const firstFew = rawLines.slice(0, 3);
  const isNumbered = firstFew.filter((l) => l.trim()).every((l) => catNPattern.test(l));
  if (isNumbered) {
    return {
      isNumbered: true,
      lines: rawLines.map((line) => {
        const m = line.match(catNPattern);
        return m ? { num: parseInt(m[1], 10), text: m[2] } : { text: line };
      }),
    };
  }
  return { isNumbered: false, lines: rawLines.map((text) => ({ text })) };
}

function ToolResultBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const { isNumbered, lines } = parseCatN(content);
  const isLong = lines.length > 8;
  const displayLines = !expanded && isLong ? lines.slice(0, 8) : lines;

  return (
    <div className="mt-0.5">
      <div className="overflow-x-auto rounded-lg border border-[#1e2a3a] bg-[#0a0f18]">
        <div className="p-2 text-[11px] leading-4 font-mono">
          {displayLines.map((line, i) => (
            <div key={i} className="flex">
              {isNumbered && line.num != null && (
                <span className="mr-3 inline-block w-6 shrink-0 select-none text-right text-[#3a4a60]">{line.num}</span>
              )}
              <span className="text-emerald-300/80 whitespace-pre">{line.text}</span>
            </div>
          ))}
          {!expanded && isLong && <div className="text-[#3a4a60] mt-0.5">...</div>}
        </div>
      </div>
      {isLong && (
        <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 text-[10px] text-[#5a6a80] hover:text-slate-400">
          {expanded ? "Show less" : `Show all (${lines.length} lines)`}
        </button>
      )}
    </div>
  );
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const icon = LOG_ICONS[entry.type] ?? "?";
  const color = LOG_COLORS[entry.type] ?? "text-[#5a6a80]";
  return (
    <div className={`flex gap-2 ${entry.type === "status" || entry.type === "tool" ? "mt-2 first:mt-0" : "mt-0.5"}`}>
      <span className={`shrink-0 pt-0.5 text-[11px] font-mono ${color}`}>{icon}</span>
      <div className="min-w-0 flex-1 text-[12px] leading-5">
        {entry.type === "thinking" && (
          <div className="text-purple-300/70 italic">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{entry.content}</ReactMarkdown>
          </div>
        )}
        {entry.type === "text" && (
          <div className="text-[#c8d4e2]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{entry.content}</ReactMarkdown>
          </div>
        )}
        {entry.type === "tool" && <span className="font-mono text-amber-200">{entry.content}</span>}
        {entry.type === "tool_result" && <ToolResultBlock content={entry.content} />}
        {entry.type === "status" && <span className="text-[#c8d4e2]">{entry.content}</span>}
        {entry.type === "error" && <span className="text-red-300">{entry.content}</span>}
      </div>
    </div>
  );
}

export default function LogModal() {
  const { open, cardId } = useExtractStore((s) => s.logModal);
  const cards = useExtractStore((s) => s.cards);
  const closeLogModal = useExtractStore((s) => s.closeLogModal);
  const logRef = useRef<HTMLDivElement>(null);

  const card = cardId ? cards.get(cardId) : undefined;
  const log = card?.log ?? [];

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLogModal();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, closeLogModal]);

  // Auto-scroll when new entries arrive
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [log.length]);

  if (!open || !cardId) return null;

  return (
    <div
      data-testid="log-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={closeLogModal}
    >
      <div
        className="max-h-[80vh] w-[700px] max-w-[90vw] overflow-hidden rounded-xl border border-[#253044] bg-[#0b111c]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1e2a3a] px-4 py-3">
          <h3 className="text-[14px] font-semibold text-white">Analysis Log</h3>
          <button type="button" onClick={closeLogModal} className="text-[#5a6a80] hover:text-slate-300">
            &times;
          </button>
        </div>
        <div ref={logRef} className="max-h-[70vh] overflow-y-auto p-3">
          {log.length === 0 && (
            <p className="text-[12px] text-[#5a6a80]">No log entries yet.</p>
          )}
          {log.map((entry, i) => (
            <LogEntryRow key={i} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 5: Run tests**

Run: `bun run test -- src/components/extract/__tests__/YamlModal.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/extract/YamlModal.tsx src/components/extract/LogModal.tsx src/components/extract/__tests__/YamlModal.test.tsx
git commit -m "feat(extract): add YamlModal and LogModal"
```

---

### Task 7: Create ExtractCanvas Root + Wire SSE Analysis

**Files:**
- Create: `src/components/extract/ExtractCanvas.tsx`
- Modify: `src/app/workbench/extract/page.tsx` — swap `ExtractWorkbench` for `ExtractCanvas`

This wires everything together: the canvas, inspector, modals, and the SSE analysis handler (ported from `ExtractWorkbench.tsx:255-341`).

**Step 1: Write the integration test**

Create `src/components/extract/__tests__/ExtractCanvas.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ExtractCanvas from "../ExtractCanvas";

describe("ExtractCanvas", () => {
  it("renders viewport and inspector panel", () => {
    render(<ExtractCanvas />);
    expect(screen.getByTestId("canvas-viewport")).toBeDefined();
    expect(screen.getByText(/paste an image/i)).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/components/extract/__tests__/ExtractCanvas.test.tsx`
Expected: FAIL

**Step 3: Implement ExtractCanvas**

Create `src/components/extract/ExtractCanvas.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useExtractStore, type LogEntry } from "./store";
import CanvasViewport from "./CanvasViewport";
import InspectorPanel from "./InspectorPanel";
import YamlModal from "./YamlModal";
import LogModal from "./LogModal";

export default function ExtractCanvas() {
  const startAnalysis = useExtractStore((s) => s.startAnalysis);
  const appendLog = useExtractStore((s) => s.appendLog);
  const completeAnalysis = useExtractStore((s) => s.completeAnalysis);
  const failAnalysis = useExtractStore((s) => s.failAnalysis);
  const cards = useExtractStore((s) => s.cards);

  // Elapsed timer management per card
  const timers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) clearInterval(timer);
    };
  }, []);

  const handleAnalyze = useCallback(
    async (cardId: string) => {
      const card = cards.get(cardId);
      if (!card) return;

      startAnalysis(cardId);

      // Start elapsed timer
      const timer = setInterval(() => {
        const store = useExtractStore.getState?.();
        // We can't easily call getState from a hook-based store.
        // Instead, we update elapsed via a dedicated action or just use the log length as proxy.
        // For simplicity, we'll track elapsed in the component.
      }, 1000);
      timers.current.set(cardId, timer);

      const formData = new FormData();
      formData.append("image", card.file);
      if (card.description.trim()) formData.append("text", card.description.trim());

      try {
        const response = await fetch("/api/extract/analyze", {
          method: "POST",
          body: formData,
        });

        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? `Analysis failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7);
            } else if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6));
              const entry = (type: LogEntry["type"], content: string) =>
                appendLog(cardId, { type, content, timestamp: Date.now() });

              switch (currentEvent) {
                case "status": {
                  let msg = data.message ?? "";
                  if (data.inputTokens || data.outputTokens) {
                    msg += ` (${data.inputTokens ?? 0} in / ${data.outputTokens ?? 0} out)`;
                  }
                  if (data.cost != null) msg += ` $${Number(data.cost).toFixed(4)}`;
                  entry("status", msg);
                  break;
                }
                case "thinking": entry("thinking", data.text); break;
                case "text": entry("text", data.text); break;
                case "tool":
                  entry("tool", `${data.name}(${typeof data.input === "string" ? data.input : JSON.stringify(data.input).slice(0, 200)})`);
                  break;
                case "tool_result": entry("tool_result", data.preview); break;
                case "error":
                  failAnalysis(cardId, data.error + (data.raw ? `\nRaw: ${data.raw}` : ""));
                  clearInterval(timers.current.get(cardId));
                  timers.current.delete(cardId);
                  return;
                case "result":
                  completeAnalysis(cardId, data);
                  entry("status", `Analysis complete — ${data.proposals?.length ?? 0} proposals`);
                  break;
              }
              currentEvent = "";
            }
          }
        }
      } catch (err) {
        failAnalysis(cardId, err instanceof Error ? err.message : String(err));
      } finally {
        clearInterval(timers.current.get(cardId));
        timers.current.delete(cardId);
      }
    },
    [cards, startAnalysis, appendLog, completeAnalysis, failAnalysis],
  );

  return (
    <div className="fixed inset-0 bg-[#080c14] text-[#e6edf7]">
      <CanvasViewport />
      <InspectorPanel onAnalyze={handleAnalyze} />
      <YamlModal />
      <LogModal />
    </div>
  );
}
```

**Step 4: Update the page route**

Modify `src/app/workbench/extract/page.tsx` to use `ExtractCanvas` instead of `ExtractWorkbench`:

```tsx
import ExtractCanvas from "@/components/extract/ExtractCanvas";

export const metadata = { title: "Extract Templates" };

export default function ExtractPage() {
  return <ExtractCanvas />;
}
```

**Step 5: Run test**

Run: `bun run test -- src/components/extract/__tests__/ExtractCanvas.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/extract/ExtractCanvas.tsx src/app/workbench/extract/page.tsx src/components/extract/__tests__/ExtractCanvas.test.tsx
git commit -m "feat(extract): wire ExtractCanvas root with SSE analysis + page route"
```

---

### Task 8: Add Elapsed Timer to Store + AnalyzingSpinner

The current elapsed timer needs to update per-card in the store so the AnalyzingSpinner can display it.

**Files:**
- Modify: `src/components/extract/store.ts` — add `tickElapsed` action
- Modify: `src/components/extract/ExtractCanvas.tsx` — call `tickElapsed` in the timer interval

**Step 1: Write the test**

Add to `src/components/extract/__tests__/store.test.ts`:

```typescript
describe("tickElapsed", () => {
  it("increments elapsed for analyzing cards", () => {
    const file = new File(["img"], "s.png", { type: "image/png" });
    const id = useStore.getState().addCard(file);
    useStore.getState().startAnalysis(id);
    useStore.getState().tickElapsed(id);
    expect(useStore.getState().cards.get(id)!.elapsed).toBe(1);
    useStore.getState().tickElapsed(id);
    expect(useStore.getState().cards.get(id)!.elapsed).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/components/extract/__tests__/store.test.ts`
Expected: FAIL — tickElapsed not defined

**Step 3: Add tickElapsed to store**

In `store.ts`, add to the `ExtractActions` interface and implementation:

```typescript
// In interface:
tickElapsed: (id: string) => void;

// In createStore:
tickElapsed: (id: string) => {
  const { cards } = get();
  const card = cards.get(id);
  if (!card || card.status !== "analyzing") return;
  const newCards = new Map(cards);
  newCards.set(id, { ...card, elapsed: card.elapsed + 1 });
  set({ cards: newCards });
},
```

Update `ExtractCanvas.tsx` timer to call `tickElapsed`:

```typescript
const tickElapsed = useExtractStore((s) => s.tickElapsed);

// In handleAnalyze, replace the timer:
const timer = setInterval(() => tickElapsed(cardId), 1000);
```

**Step 4: Run test**

Run: `bun run test -- src/components/extract/__tests__/store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/extract/store.ts src/components/extract/ExtractCanvas.tsx
git commit -m "feat(extract): add elapsed timer ticking via store action"
```

---

### Task 9: Delete Old Components + Build Verification

**Files:**
- Delete: `src/components/extract/ExtractWorkbench.tsx`
- Delete: `src/components/extract/ImageUpload.tsx`
- Delete: `src/components/extract/OverlayPreview.tsx`
- Delete: `src/components/extract/ProposalPanel.tsx`

**Step 1: Verify no other files import the old components**

Run: `grep -r "ExtractWorkbench\|ImageUpload\|OverlayPreview\|ProposalPanel" src/ --include="*.tsx" --include="*.ts" -l`

Expected: Only the old files themselves (and possibly old tests). The page route was already updated in Task 7.

**Step 2: Delete old files**

```bash
rm src/components/extract/ExtractWorkbench.tsx
rm src/components/extract/ImageUpload.tsx
rm src/components/extract/OverlayPreview.tsx
rm src/components/extract/ProposalPanel.tsx
```

**Step 3: Run build**

Run: `bun run build`
Expected: Build succeeds with no import errors

**Step 4: Run all extract tests**

Run: `bun run test -- src/components/extract/`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add -A src/components/extract/
git commit -m "refactor(extract): remove old single-slide components"
```

---

### Task 10: Manual Smoke Test + Polish

**Step 1: Start dev server**

Run: `bun run dev`

**Step 2: Open `/workbench/extract` and verify:**

- [ ] Empty canvas with hint text
- [ ] Cmd+V pastes image → card appears on canvas + thumbnail strip
- [ ] Paste 3 images → cards auto-layout in a row
- [ ] Wheel to zoom in/out (toward cursor)
- [ ] Click-drag empty space to pan
- [ ] Click card → selected (cyan border on card + thumbnail)
- [ ] Inspector shows analyze form for idle card
- [ ] Click Analyze → spinner shown, log icon pulses
- [ ] Analysis completes → template tabs appear, region overlays on card
- [ ] Click template tab → params/styles update, region highlight changes
- [ ] Click YAML icon → two-column modal with template + instance YAML
- [ ] Click Log icon → log modal with entries
- [ ] Esc closes modals
- [ ] Click different thumbnail → switches selected card

**Step 3: Fix any visual issues found during smoke test**

This is expected — adjust spacing, colors, z-index as needed.

**Step 4: Commit**

```bash
git add -A src/components/extract/
git commit -m "fix(extract): polish canvas workspace after smoke test"
```

---

### Task 11: Update Existing Tests

**Step 1: Check for broken tests referencing old components**

Run: `bun run test`

If any tests reference `ExtractWorkbench`, `ImageUpload`, `OverlayPreview`, or `ProposalPanel` — update or delete them.

**Step 2: Ensure all tests pass**

Run: `bun run test`
Expected: All PASS

**Step 3: Commit if needed**

```bash
git add -A
git commit -m "test(extract): update tests for canvas workspace redesign"
```
