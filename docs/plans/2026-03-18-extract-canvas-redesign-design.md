# Extract Canvas Workspace — Design

**Date:** 2026-03-18
**Status:** Approved

## Overview

Redesign `/workbench/extract` from a linear single-slide workflow into a multi-slide canvas workspace. Users paste multiple slide screenshots onto a pannable/zoomable canvas, analyze them independently, and inspect results via a Figma-style right-side inspector panel.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Canvas rendering | HTML div + CSS transforms | Slide cards are DOM elements — need click handlers, hover states, image loading. No custom pixel rendering needed. |
| Region overlays | Absolutely positioned divs | Rectangular bounding boxes. Child of card element, so zoom/pan for free. Same approach as current OverlayPreview. |
| State management | Zustand | User preference. Clean selectors, no prop drilling, works well for single-page state. |
| Panel position | Fixed right side (Figma-style) | ~360px wide, full viewport height. |
| Paste behavior | Auto-layout (grid packing) | Place beside last card with gaps. Avoids overlap issues from blind cursor-position pasting. |

## Component Architecture

```
/workbench/extract (page.tsx)
  └─ <ExtractCanvas>                    ← new root component
       ├─ <CanvasViewport>              ← zoom/pan container (CSS transforms)
       │    └─ <SlideCard> × N          ← image card + region overlays
       │         ├─ <img>               ← slide screenshot
       │         └─ <RegionOverlay> × N ← colored bounding boxes (post-analysis)
       │
       ├─ <InspectorPanel>              ← floating right-side panel
       │    ├─ <ThumbnailStrip>         ← horizontal scrollable slide thumbnails
       │    └─ (content area — one of:)
       │         ├─ <EmptyState>        ← "Paste an image to start"
       │         ├─ <AnalyzeForm>       ← description textarea + analyze button
       │         ├─ <AnalyzingSpinner>  ← spinner + elapsed time
       │         └─ <TemplateInspector> ← tabs + params/styles
       │              ├─ <TemplateTabs> ← horizontal scrollable template tabs
       │              └─ <ParamsStyleView> ← two-column params/styles
       │
       ├─ <YamlModal>                   ← two-column popup (template | instance)
       └─ <LogModal>                    ← analysis log popup
```

## Zustand Store

```typescript
interface SlideCard {
  id: string                          // uuid
  file: File                          // original pasted image
  previewUrl: string                  // object URL
  position: { x: number, y: number }  // canvas coordinates
  size: { w: number, h: number }      // display size on canvas

  // analysis state
  status: "idle" | "analyzing" | "analyzed" | "error"
  description: string                 // user input before analyze
  analysis: AnalysisResult | null     // API response
  log: LogEntry[]                     // SSE stream entries
  elapsed: number                     // analysis timer
  error: string | null

  // selection within analyzed results
  selectedTemplateIndex: number       // which template tab is active
}

interface ExtractStore {
  // --- canvas state ---
  cards: Map<string, SlideCard>
  cardOrder: string[]                 // insertion order for auto-layout

  // --- viewport ---
  pan: { x: number, y: number }
  zoom: number                        // 0.25 – 2.0

  // --- selection ---
  selectedCardId: string | null

  // --- modals ---
  yamlModal: { open: boolean, cardId: string | null, templateIndex: number }
  logModal: { open: boolean, cardId: string | null }

  // --- actions ---
  addCard: (file: File) => string     // returns new card id
  removeCard: (id: string) => void
  selectCard: (id: string | null) => void

  updateDescription: (id: string, text: string) => void
  startAnalysis: (id: string) => void
  appendLog: (id: string, entry: LogEntry) => void
  completeAnalysis: (id: string, result: AnalysisResult) => void
  failAnalysis: (id: string, error: string) => void

  selectTemplate: (id: string, index: number) => void

  setPan: (pan: { x: number, y: number }) => void
  setZoom: (zoom: number) => void

  openYamlModal: (cardId: string, templateIndex: number) => void
  closeYamlModal: () => void
  openLogModal: (cardId: string) => void
  closeLogModal: () => void
}
```

## Canvas Viewport

Full-screen container. A single CSS `transform` div handles zoom/pan.

```
┌─ CanvasViewport ──────────────────────────────────────────┐
│  div.viewport (overflow: hidden, cursor: grab)            │
│    └─ div.canvas-transform                                │
│         style: transform: translate(panX, panY) scale(z)  │
│         transform-origin: 0 0                             │
│         ├─ <SlideCard id="1" />                           │
│         ├─ <SlideCard id="2" />                           │
│         └─ <SlideCard id="3" />                           │
└───────────────────────────────────────────────────────────┘
```

**Interactions:**
- Wheel → zoom toward cursor (clamped 0.25–2.0)
- Middle-click drag or Space+drag → pan
- Cmd+V → paste image, create card at next auto-layout slot
- Click card → select (syncs with inspector)
- Click empty canvas → deselect

**Zoom-to-cursor:** `newPan = cursor - (cursor - oldPan) * (newZoom / oldZoom)`

## SlideCard

Absolutely positioned within canvas-transform div.

```
┌─ SlideCard ─────────────────────┐
│  position: absolute             │
│  left/top from card.position    │
│  border: 2px solid transparent  │
│  border when selected: cyan     │
│  ┌─────────────────────────┐    │
│  │         <img>           │    │
│  │  ┌─ RegionOverlay ──┐  │    │  ← only when analyzed + selected
│  │  │  cyan border      │  │    │
│  │  │  10% alpha fill   │  │    │
│  │  └───────────────────┘  │    │
│  └─────────────────────────┘    │
│  "Slide 1"  [analyzing ◠◡]     │  ← status label
└─────────────────────────────────┘
```

Region overlays show when the card is selected and analyzed. Clicking a region → `selectTemplate(cardId, index)`.

## Inspector Panel

Fixed-position, right: 0, 360px wide, full height. Four content states:

**No selection:** Empty state message — "Paste an image (Cmd+V) to add slides"

**Selected, idle:** Description textarea + [Analyze] button

**Selected, analyzing:** Spinner + elapsed timer. Log icon pulses with animation to guide user.

**Selected, analyzed:** Template tabs (h-scroll, slide template first) + params/styles two-column view. YAML and Log icons in footer.

## Modals

**YamlModal:** Centered overlay ~900px wide. Left column: template YAML. Right column: instance YAML. Copy buttons per column. Esc/click-outside to close.

**LogModal:** Panel overlay showing `log[]` entries for the selected card's analysis. Auto-scrolls. Close button.

## Data Flow

```
Cmd+V → addCard(file) → SlideCard in store (status: idle)
                       → auto-layout position
                       → appears in ThumbnailStrip

Click card → selectCard(id) → inspector shows AnalyzeForm

[Analyze] → startAnalysis(id) → status: analyzing
           → POST /api/extract/analyze (SSE)
              ├─ events → appendLog(id, entry)
              └─ result → completeAnalysis(id, result)
                            status: analyzed
                            selectedTemplateIndex: 0

Inspector → TemplateInspector (tabs + params)
Canvas card → region overlays visible
```

**API routes unchanged.** Existing `/api/extract/analyze` and `/api/extract/image` work as-is.

## Migration: What Changes

| Current File | Fate |
|-------------|------|
| `ExtractWorkbench.tsx` | **Rewrite** → `ExtractCanvas.tsx` |
| `ImageUpload.tsx` | **Delete** — paste at canvas level |
| `OverlayPreview.tsx` | **Delete** — inlined into `SlideCard` |
| `ProposalPanel.tsx` | **Delete** → split into `TemplateInspector`, `TemplateTabs`, `ParamsStyleView` |
| `types.ts` | **Keep** — `Proposal`, `AnalysisResult`, `regionColor()` |
| `yaml-gen.ts` | **Keep** — `generateTemplateYaml()`, `generateInstanceYaml()` |
| `/api/extract/analyze` | **Keep** |
| `/api/extract/image` | **Keep** |
| `prompts.ts` | **Keep** |
| `normalize-analysis.ts` | **Keep** |

## New Files

```
src/components/extract/
  ExtractCanvas.tsx        ← root (replaces ExtractWorkbench)
  store.ts                 ← Zustand store
  CanvasViewport.tsx       ← zoom/pan + paste handler
  SlideCard.tsx            ← image card + region overlays
  InspectorPanel.tsx       ← right-side floating panel
  ThumbnailStrip.tsx       ← horizontal scrollable thumbnails
  AnalyzeForm.tsx          ← description + analyze button
  AnalyzingSpinner.tsx     ← spinner + elapsed timer
  TemplateInspector.tsx    ← tabs + params/styles wrapper
  TemplateTabs.tsx         ← horizontal scrollable template tabs
  ParamsStyleView.tsx      ← two-column params + styles
  YamlModal.tsx            ← two-column yaml popup
  LogModal.tsx             ← analysis log popup
```
