# Design: Inventory-First Slide Extraction (v11)

Date: 2026-03-26
Status: Draft
Context: [docs/2026-03-26-discussion-v11.md](../2026-03-26-discussion-v11.md)

## Problem

The current extraction prompt asks the model to simultaneously perceive visual details and encode them into scene YAML templates (including block-scope templates for repeating patterns). This causes:

1. **Perception-encoding interference** — the model notices visual details in thinking but drops them in the final YAML output because thinking budget is spent on template engineering (Nunjucks syntax, layout system choices, parameter passing)
2. **Block extraction burden** — forcing block template extraction adds a decomposition problem on top of the replication problem, competing for the same cognitive resources
3. **Fake decisiveness** — the current "make one pass, do not re-examine" instruction suppresses the coarse-to-fine refinement that produces better results

## Solution

Two changes to the extraction prompt (Approach A from discussion):

1. **Add a visual inventory phase** — the model must produce a structured `inventory` object capturing perception before writing any YAML proposals
2. **Drop block extraction** — only slide-scope proposals in first-pass extraction; repeating patterns are recorded as advisory `blockCandidates` in the inventory

### Inventory semantics

The inventory is a **normalized verification/debug contract**, not a second scene tree and not a raw perception dump.

- **Primary role:** normalized data in actual-image-pixel space, usable for overlays, scoring, and future automated verification
- **Secondary role:** human-inspectable record of what the model perceived, for debugging extraction quality
- **Not:** an executable representation — proposals remain the only executable output
- **Not:** a full scene tree — keep it compact, verification-oriented, and bounded in cardinality

Raw model perception is preserved only at the `source.reportedDimensions` level. All inventory geometry and spatial metrics are normalized to actual image space.

## Output Format

```json
{
  "source": {
    "image": "<filename>",
    "dimensions": { "w": 1474, "h": 828 }
  },
  "inventory": {
    "slideBounds": { "x": 0, "y": 0, "w": 1474, "h": 828 },
    "background": {
      "summary": "dark cinematic field with warm reddish glow concentrated lower-left",
      "base": "#111820",
      "palette": ["#111820", "#ffffff", "#c43030", "#666666", "#7a828a"],
      "layers": [
        {
          "kind": "gradient-or-glow",
          "bbox": { "x": 0, "y": 360, "w": 900, "h": 468 },
          "description": "warm radial glow rising from lower-left",
          "importance": "high"
        }
      ]
    },
    "typography": [
      {
        "id": "title",
        "text": "KEY PLAYERS",
        "bbox": { "x": 440, "y": 255, "w": 600, "h": 60 },
        "importance": "high",
        "style": {
          "color": "#ffffff",
          "fontSize": 52,
          "fontWeight": 700,
          "textAlign": "center",
          "textTransform": "uppercase",
          "letterSpacing": 4,
          "fontFamilyHint": "heading"
        }
      }
    ],
    "regions": [
      {
        "id": "badge",
        "kind": "group",
        "bbox": { "x": 1070, "y": 520, "w": 120, "h": 26 },
        "importance": "medium",
        "description": "red pill badge inside third card only"
      }
    ],
    "repeatGroups": [
      {
        "id": "player-cards",
        "bbox": { "x": 108, "y": 340, "w": 1260, "h": 225 },
        "count": 4,
        "itemSize": { "w": 300, "h": 225 },
        "orientation": "row",
        "gap": 20,
        "description": "equal-width frosted cards with ring, emoji, name, role, optional badge",
        "variationPoints": ["ringColor", "icon", "name", "role", "badge"]
      }
    ],
    "mustPreserve": [
      { "text": "warm reddish lower-left background glow", "ref": null },
      { "text": "frosted semi-transparent cards", "ref": "player-cards" },
      { "text": "gray ring on Khamenei card", "ref": "player-cards" },
      { "text": "red badge on one card only", "ref": "badge" }
    ],
    "uncertainties": [
      "exact font family unclear from screenshot"
    ],
    "blockCandidates": [
      {
        "name": "player-card-row",
        "sourceRepeatGroupId": "player-cards",
        "reason": "4 repeated cards",
        "defer": true
      }
    ]
  },
  "proposals": [
    {
      "scope": "slide",
      "name": "key-players",
      "description": "...",
      "region": { "x": 0, "y": 0, "w": 1474, "h": 828 },
      "params": { ... },
      "style": { ... },
      "body": "..."
    }
  ]
}
```

### Inventory field rules

| Field | Required | Cardinality | Purpose |
|-------|----------|-------------|---------|
| `slideBounds` | yes | 1 | Slide crop region (equals full image if uncropped) |
| `background` | yes | 1 | Background layers, base color, palette |
| `typography` | yes | 0-8 | Key text elements only |
| `regions` | yes | 0-8 | Major one-off non-text groups (do not duplicate typography) |
| `repeatGroups` | yes | 0-4 | Repeated spatial structures with explicit `orientation` (row/column/grid) |
| `mustPreserve` | yes | 3-8 | Details most likely to be dropped during encoding. Each item has `text` (human description) and optional `ref` (inventory id for cross-referencing) |
| `uncertainties` | yes | 0+ | Acknowledged unknowns |
| `blockCandidates` | yes | 0+ | Advisory only in v1; no block proposals emitted |

### Proposal rules (changed from current)

- Always output exactly **one slide-scope proposal** for the whole slide
- **Do NOT output block-scope proposals** in v1
- Repeating structures go in `inventory.blockCandidates` only
- **Write repeated elements as literal explicit nodes.** First-pass extraction optimizes for replication fidelity, not reusable compactness. A 4-card hero row should be 4 explicit card groups, not a loop over an items array. Only use a `{% for %}` loop in exceptional cases where repetition is very dense (8+ identical items) and literal nodes would clearly harm readability without any fidelity benefit.
- Every item in `inventory.mustPreserve` must be represented in the proposal body
- All coordinates use the same source-pixel space as `source.dimensions`

## Prompt Contract

The prompt enforces two phases:

1. **Perceive** — analyze the image and write the inventory
2. **Encode** — generate proposals from the inventory as source of truth

Key wording (replaces "be decisive, one pass"):

> Generate proposals from the inventory as your source of truth. If you detect a contradiction while writing proposals, revise the inventory explicitly before continuing.

This avoids fake decisiveness while still separating perception from encoding.

### Preserved from current prompt

The following sections are retained unchanged because they target real YAML encoding bugs orthogonal to the perception problem:

- "Common mistakes to avoid" (style nesting, background object form, gradient positions, etc.)
- "How to write the body" (Nunjucks syntax rules)
- Pitfalls from reference.md

### Removed from current prompt

- Rule 5: "For repeating sub-regions, extract the ENTIRE group as one block template" — replaced by `blockCandidates`
- "Be decisive. Make one pass through the image, pick your coordinates, and commit. Do NOT re-examine dimensions or revisit layout decisions." — replaced by two-phase contract

## File Changes

### 1. `src/lib/extract/prompts.ts`

Rewrite `ANALYSIS_SYSTEM_PROMPT`:

- Add inventory schema and requirements as first output phase
- Add proposal requirements as second output phase (slide-only, no blocks)
- Add `mustPreserve` verification rule
- Replace "be decisive" with two-phase contract
- Keep common-mistakes and pitfalls sections
- Remove block extraction rule

Update `buildAnalysisPrompt` — no structural changes needed; the user prompt still provides the image and optional context.

### 2. `src/components/extract/types.ts`

Add types:

```typescript
export interface InventoryBbox {
  x: number; y: number; w: number; h: number;
}

export interface InventoryBackgroundLayer {
  kind: string;
  bbox?: InventoryBbox;
  description: string;
  importance: "high" | "medium" | "low";
}

export interface InventoryBackground {
  summary: string;
  base: string;
  palette: string[];
  layers: InventoryBackgroundLayer[];
}

export interface InventoryTypographyStyle {
  color: string;
  fontSize: number;
  fontWeight: number;
  textAlign?: "left" | "center" | "right";
  textTransform?: "uppercase" | "lowercase" | "none";
  letterSpacing?: number;
  fontFamilyHint?: "heading" | "body" | "mono" | string;
  fontStyle?: "normal" | "italic";
  lineHeight?: number;
}

export interface InventoryTypography {
  id: string;
  text: string;
  bbox: InventoryBbox;
  importance: "high" | "medium" | "low";
  style: InventoryTypographyStyle;
}

export interface InventoryRegion {
  id: string;
  kind: string;
  bbox: InventoryBbox;
  importance: "high" | "medium" | "low";
  description: string;
}

export interface InventoryRepeatGroup {
  id: string;
  bbox: InventoryBbox;
  count: number;
  orientation: "row" | "column" | "grid";
  itemSize?: { w: number; h: number };
  gap?: number;       // for row/column orientation
  gapX?: number;      // for grid orientation
  gapY?: number;      // for grid orientation
  description: string;
  variationPoints?: string[];
}

export interface InventoryBlockCandidate {
  name: string;
  sourceRepeatGroupId: string;
  reason: string;
  defer: boolean;
}

export interface Inventory {
  slideBounds: InventoryBbox;
  background: InventoryBackground;
  typography: InventoryTypography[];
  regions: InventoryRegion[];
  repeatGroups: InventoryRepeatGroup[];
  mustPreserve: Array<{ text: string; ref?: string | null }>;
  uncertainties: string[];
  blockCandidates: InventoryBlockCandidate[];
}
```

Update `AnalysisResult`:

```typescript
export interface AnalysisResult {
  source: {
    image: string;
    dimensions: { w: number; h: number };
    reportedDimensions?: { w: number; h: number };  // raw model perception
  };
  inventory?: Inventory;
  proposals: Proposal[];
}
```

### 3. `src/lib/extract/normalize-analysis.ts`

Extend `normalizeAnalysisRegions` to:

- Preserve original reported dimensions as `source.reportedDimensions`
- Normalize all inventory spatial metrics when rescaling is needed:
  - **Bboxes:** `inventory.slideBounds`, `inventory.background.layers[].bbox`, `inventory.typography[].bbox`, `inventory.regions[].bbox`, `inventory.repeatGroups[].bbox`
  - **Sizes:** `inventory.repeatGroups[].itemSize` (w scaled by ratioX, h scaled by ratioY)
  - **Gaps (orientation-aware):**
    - `orientation: "row"` — scale `gap` by `ratioX`
    - `orientation: "column"` — scale `gap` by `ratioY`
    - `orientation: "grid"` — scale `gapX` by `ratioX`, `gapY` by `ratioY`
  - **Typography spatial styles:** `inventory.typography[].style.fontSize` scaled by ratioY, `inventory.typography[].style.letterSpacing` scaled by ratioX. `lineHeight` is a unitless multiplier (not a pixel measurement) and is **not normalized**.

The rule: **every numeric value in inventory that represents a spatial measurement in source-pixel space gets scaled.** Non-spatial values (`fontWeight`, `count`, `importance`, `orientation`, `lineHeight`) are left alone. `lineHeight` is a unitless multiplier (like CSS `line-height: 1.4`), not a pixel measurement.

### 4. `src/components/extract/TemplateInspector.tsx`

Add a collapsible "Inventory" section when `card.analysis?.inventory` exists:

- `mustPreserve` displayed as a checklist
- `uncertainties` as a note/warning
- `blockCandidates` as advisory tags
- Collapsible raw JSON for full inspection

Minimal styling — this is a debug/verification panel, not a polished UI.

## What Does NOT Change

| Component | Why unchanged |
|-----------|---------------|
| `compileProposalPreview` | Reads only `proposals` — inventory is not an executable format |
| `LayoutRenderer` | Renders layout IR, no knowledge of extraction |
| `SlideCard` rendering | Region overlays still use `proposals[].region` |
| `YamlModal` | Generates YAML from proposals only |
| Route handler (`route.ts`) | Already parses arbitrary JSON; inventory flows through automatically |
| `normalizeAnalysisRegions` return type | Extended but backwards-compatible (inventory is optional) |

## Success Criteria

1. Output JSON contains a non-empty `inventory` field with all required sub-fields populated
2. `mustPreserve` items are reflected in the proposal body (verifiable by inspection)
3. No block-scope proposals are emitted
4. First-pass visual fidelity improves on the two reference slides (KEY PLAYERS, IRAN WAR 2026)
5. Existing analysis flow continues to work for slides analyzed before this change (backwards compat via optional `inventory`)

## Test Plan

### `src/lib/extract/normalize-analysis.test.ts` (extend existing)

- **Inventory bbox normalization:** given reported 1474x828, actual 1466x824, verify all inventory bboxes are rescaled (slideBounds, typography, regions, repeatGroups, background layers)
- **Inventory spatial metrics:** verify `itemSize` and typography spatial styles (`fontSize`, `letterSpacing`) are scaled; `lineHeight` is NOT scaled
- **Orientation-aware gap scaling:** verify row gap scales by ratioX, column gap scales by ratioY, grid gapX/gapY scale by ratioX/ratioY respectively
- **Non-spatial values preserved:** verify `fontWeight`, `count`, `importance`, `palette` are not modified
- **reportedDimensions preserved:** verify `source.reportedDimensions` contains the original model-reported values
- **No inventory (backwards compat):** verify analysis without `inventory` field normalizes proposals as before
- **No rescale needed:** verify inventory is untouched when reported matches actual

### `src/lib/extract/prompts.test.ts` (new — prompt-contract regression)

- **Contains inventory phase:** verify `ANALYSIS_SYSTEM_PROMPT` includes `inventory` as a required output field
- **Contains two-phase contract:** verify prompt includes phrasing about producing inventory first, then proposals
- **No block proposals rule:** verify prompt says no block-scope proposals in v1
- **Literal nodes bias:** verify prompt says to prefer explicit repeated nodes over loops
- **mustPreserve rule:** verify prompt says every mustPreserve item must appear in the proposal body
- **Common mistakes preserved:** verify prompt still includes the "Common mistakes to avoid" section

These are static string checks on the prompt text — no model calls needed. They catch accidental prompt regressions during future edits.

### `src/lib/extract/normalize-analysis.test.ts` — analysis-shape compatibility (extend existing)

- **Full v11 response shape:** given a fixture matching the new `{ source, inventory, proposals }` format, verify it parses and normalizes without errors
- **Inventory-less response (backwards compat):** given a fixture with `{ source, proposals }` only, verify it normalizes as before
- **No block proposals:** given a fixture with only slide-scope proposals, verify normalization and downstream type compatibility

### `src/components/extract/TemplateInspector.test.tsx` (new or extend)

- **Inventory panel renders:** given a card with `analysis.inventory`, verify the collapsible section appears
- **mustPreserve displayed:** verify all mustPreserve items render as checklist entries
- **No inventory (backwards compat):** given a card with `analysis` but no `inventory`, verify no inventory section renders
- **Collapsed by default:** verify inventory panel starts collapsed

## Future Work (not in this change)

- Self-critique pass using inventory + original image (step 3 from discussion)
- Render-and-diff feedback loop (steps 4-6 from discussion)
- Second-pass block extraction with regression gate (step 7 from discussion)
- Hard phase separation via two-turn conversation (Approach B) if Approach A proves insufficient
