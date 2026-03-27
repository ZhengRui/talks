# Design: Self-Critique Pass for Slide Extraction (v11 Step 3)

Date: 2026-03-26
Status: Draft
Depends on: [2026-03-26-inventory-first-extraction-design.md](./2026-03-26-inventory-first-extraction-design.md)
Context: [docs/2026-03-26-discussion-v11.md](../2026-03-26-discussion-v11.md)

## Problem

The inventory-first extraction (step 2) fixed encoding drift — things the model noticed but dropped during YAML generation. But testing on the two reference slides revealed a different failure class: **perception errors in the inventory itself**.

**KEY PLAYERS**: the inventory's `mustPreserve` list was 14 items, mostly literal text content (names, roles, flags). The warm reddish atmospheric glow — the slide's dominant visual signature — was not captured at all. The `background.palette` used only cool navy tones. The model allocated its perceptual budget to obvious content and missed the fragile, high-value visual identity.

**IRAN WAR 2026**: the inventory correctly flagged a tricolor-vs-bicolor uncertainty in `uncertainties`, but then prematurely collapsed it into the wrong `mustPreserve` statement ("White-to-red bicolor title effect"). The proposal encoded the wrong interpretation consistently — 2-band instead of 3-band.

### Root causes

1. **`mustPreserve` is overloaded** — it mixes literal content, dominant visual effects, and special-case distinctions in one flat list. Text content (easiest to preserve) crowds out visual signatures (hardest and most valuable).

2. **No second look** — the model commits to its perception in a single pass. Uncertainties are logged but never resolved. A fresh reasoning pass against the original image could catch both the missing gradient and the wrong band count.

## Solution

Two parts, shipped together:

### Part A: Strengthen inventory with `signatureVisuals`

Add a new required inventory field that forces the model to identify the slide's dominant non-text visual identity separately from content.

### Part B: Two-phase server-side critique

After the first analysis pass, inject a second model pass that re-examines the original image against the first output, resolves uncertainties, and revises the inventory and proposal.

## Part A: `signatureVisuals`

### Schema

New required field on `Inventory`:

```typescript
export interface SignatureVisual {
  text: string;                        // human description of the visual signature
  ref?: string | null;                 // optional inventory id cross-reference
  importance: "high" | "medium";       // all should be high or medium
}
```

Added to `Inventory`:

```typescript
export interface Inventory {
  // ... existing fields ...
  signatureVisuals: SignatureVisual[];  // 1-5 items, non-text only (2-5 strongly preferred for visually rich slides)
  mustPreserve: Array<{ text: string; ref?: string | null }>;
  // ... rest unchanged ...
}
```

### Prompt rules

The analysis prompt adds these rules for `signatureVisuals`:

- 1-5 items, **non-text visual effects only** (no literal content like names, roles, or flags). Expect 2-5 for visually rich slides; allow 1 for minimal/text-heavy slides where only one dominant visual effect exists.
- At least 1 must come from **background/atmosphere** when the background is visually distinctive (gradients, glows, particles, textures)
- At least 1 must come from **dominant title/hero treatment** when the title has a strong visual effect (color bands, shadows, emboss, clip effects)
- If an `uncertainty` touches a `signatureVisual`, flag it as high-importance — it must be resolved before encoding
- Every `signatureVisual` must be faithfully encoded in the proposal body

The prompt also redefines `mustPreserve`:

> `mustPreserve` is for **content** that varies between slides — text values, data items, element presence/absence. `signatureVisuals` is for the **visual identity** that makes this slide look like itself — the things a human would notice first and that are hardest to get right in replication.

### Example

For KEY PLAYERS, the correct output would be:

```json
"signatureVisuals": [
  { "text": "warm reddish atmospheric glow in lower-left/bottom background area", "ref": null, "importance": "high" },
  { "text": "frosted semi-transparent card fill with warm red-brown tint over dark background", "ref": "player-cards", "importance": "high" },
  { "text": "gray vs red circle ring color distinction (deceased indicator)", "ref": "ring-2", "importance": "medium" }
],
"mustPreserve": [
  { "text": "KEY PLAYERS", "ref": "title" },
  { "text": "DONALD TRUMP / US President", "ref": "card-0" },
  { "text": "BENJAMIN NETANYAHU / Israeli PM", "ref": "card-1" },
  { "text": "ALI KHAMENEI / Supreme Leader / KILLED MAR 1", "ref": "card-2" },
  { "text": "MASOUD PEZESHKIAN / Iranian President", "ref": "card-3" }
]
```

For IRAN WAR 2026:

```json
"signatureVisuals": [
  { "text": "tricolor flag-band effect on title text (white top, blue/navy middle, red bottom — 3 bands via clipPath)", "ref": "title", "importance": "high" },
  { "text": "dark-to-warm-red atmospheric gradient with radial glow at bottom", "ref": null, "importance": "high" },
  { "text": "scattered glowing particle dots (red + one blue accent) in lower half", "ref": "particle-cluster-left", "importance": "medium" },
  { "text": "3D embossed shadow effect on title text", "ref": "title", "importance": "medium" }
],
"mustPreserve": [
  { "text": "IRAN WAR 2026", "ref": "title" },
  { "text": "LIVE CONFLICT — DAY 6", "ref": "badge-text" },
  { "text": "The Conflict That Reshaped the Middle East", "ref": "subtitle" },
  { "text": "FEBRUARY 28 — PRESENT, 2026", "ref": "date-line" }
]
```

### Inventory field rules (updated)

| Field | Required | Cardinality | Purpose |
|-------|----------|-------------|---------|
| `signatureVisuals` | yes | 1-5 | Non-text visual identity: gradients, glows, color effects, textures, atmospheric treatments. 2-5 for visually rich slides, 1 for minimal slides. At least 1 background, 1 title/hero when applicable |
| `mustPreserve` | yes | 3-8 | Content items that vary: text values, data presence, element visibility |

All other inventory fields unchanged from the step 2 design.

## Part B: Two-Phase Critique

### Architecture

Single frontend API call, two internal model passes. The route handler orchestrates both passes and returns the final result.

```
Client POST /api/extract/analyze
  → Pass 1: image + analysis prompt → inventory + proposal (JSON)
  → Server parses pass 1 result
  → Pass 2: image + pass 1 result + critique prompt → revised inventory + proposal (JSON)
  → Server normalizes final result
  → SSE stream to client (both passes visible in log)
```

### Implementation

The route handler currently uses `query()` from the agent SDK with `maxTurns: 5`. For the two-phase approach, we run two separate `query()` calls:

**Pass 1** — identical to current flow:
- System prompt: `ANALYSIS_SYSTEM_PROMPT`
- User message: image + analysis prompt
- Model outputs: JSON with `{ source, inventory, proposals }`

**Pass 2** — critique and revision:
- System prompt: `ANALYSIS_SYSTEM_PROMPT` + `CRITIQUE_ADDENDUM` (inherits the full authoring contract, with critique rules layered on top)
- User message: image + pass 1 JSON + critique prompt
- Model outputs: revised JSON with `{ source, inventory, proposals }`

Two separate `query()` calls rather than injecting turns into one conversation, because:
- The critique prompt can reference the full pass 1 output as structured data
- Avoids complexities of mid-conversation message injection

**Critical: pass 2 inherits the full pass-1 authoring contract.** The critique is additive, not a replacement. Pass 2 must still obey all pass-1 rules:
- Exactly one slide-scope proposal, no block-scope proposals
- Same source-pixel coordinate space
- Valid scene YAML syntax (style nesting, background object form, etc.)
- No `fit`/`align` in template body
- First-pass fidelity bias against unnecessary abstraction
- All "Common mistakes to avoid" rules

The system prompt for pass 2 is `ANALYSIS_SYSTEM_PROMPT + CRITIQUE_ADDENDUM`, not a separate prompt. This ensures the authoring contract cannot drift between passes.

### Critique prompt

```
CRITIQUE_ADDENDUM (appended to ANALYSIS_SYSTEM_PROMPT):

You are now in critique mode. You will receive the original screenshot and a first-pass analysis (inventory + proposal). Your job is to find and fix perception errors and encoding gaps. All pass-1 authoring rules still apply — revise only what is needed to improve fidelity or remove unnecessary complexity. Do not re-read `reference.md` unless the first-pass output appears structurally invalid or you are genuinely uncertain about scene YAML syntax.

## Review checklist

1. **Signature visuals**: Re-examine the original image. For each signatureVisual in the inventory:
   - Is it actually present in the source image? Is the description accurate?
   - Is it faithfully encoded in the proposal body?
   - Are the colors, positions, and effects correct?

2. **Missing signatures**: Are there dominant visual features in the image that are NOT in signatureVisuals? Common misses:
   - Warm/cool background gradients and atmospheric glows
   - Title text effects (color bands, shadows, outlines)
   - Card/panel translucency and tint color
   - Decorative elements (particles, lines, borders)

3. **Uncertainty resolution**: For each item in uncertainties:
   - Re-examine the image. Can you now resolve the uncertainty?
   - If it affects a signatureVisual or high-importance element, resolve it.
   - Update the inventory description and proposal encoding accordingly.

4. **Unnecessary abstraction**: Check if the proposal body contains:
   - Arrays or indexed access (e.g., `players[0]`) where literal values would be simpler
   - Conditional blocks (`{% if %}`) that add complexity without fidelity benefit
   - If found, replace with literal explicit values for first-pass fidelity.

5. **Content verification**: Confirm all mustPreserve items appear in the proposal body with correct text values.

## Output

Output the complete revised JSON in the same format as the input:

{
  "source": { ... },
  "inventory": { ... },
  "proposals": [ ... ]
}

Revise the inventory first (fix signatureVisuals, resolve uncertainties, correct descriptions), then revise the proposal to match.

If no changes are needed, output the original JSON unchanged.
```

The user-facing critique prompt (sent with the image + pass 1 output):

```
Here is the first-pass analysis of this screenshot. Review it against the original image and fix any perception errors, missing visual signatures, unresolved uncertainties, or unnecessary abstraction. Output the complete revised JSON.

First-pass analysis:
<pass 1 JSON>
```

### SSE streaming

The route handler streams events for both passes:

- `status: "Starting analysis (pass 1)..."`
- Pass 1 thinking/text/tool events (existing)
- `status: "Pass 1 complete. Starting critique (pass 2)..."`
- Pass 2 thinking/text events
- `status: "Done (pass 1 + critique)"`
- `result: <final normalized JSON>`

The log modal shows both passes, so the user can see what changed.

### Cost and latency

Pass 2 is typically cheaper than pass 1 because:
- Usually no tool calls (the pass 1 output already encodes the correct YAML patterns, so reference.md re-read is skipped by default — but allowed as a fallback for risky structural edits)
- Smaller output if few changes needed

Pass 2 uses the same model and effort as pass 1 by default. Both are stored in per-pass provenance for debugging.

Estimated: ~50-70% additional cost and latency vs pass 1 alone. For Opus at high effort, pass 1 costs ~$0.50-0.70, so pass 2 adds ~$0.25-0.50.

The UI should make critique optional — add a "Critique" toggle or button so users can skip it when iterating quickly.

### Opt-in critique

Add a `critique` boolean to the analysis form (default: off for fast iteration, on for quality).

When off: single pass, identical to current behavior.
When on: two passes, revised result returned.

The store tracks per-pass provenance on each card:

```typescript
interface AnalysisProvenance {
  model: string;
  effort: string;
}

// On SlideCard:
usedCritique: boolean;
pass1: AnalysisProvenance | null;
pass2: AnalysisProvenance | null;  // null when critique is off
```

This enables debugging quality differences when pass 2 uses different settings, and honest provenance when comparing cards.

## File Changes

### `src/lib/extract/prompts.ts`

- Add `signatureVisuals` rules to `ANALYSIS_SYSTEM_PROMPT`
- Redefine `mustPreserve` vs `signatureVisuals` distinction
- Add `CRITIQUE_ADDENDUM` constant (appended to `ANALYSIS_SYSTEM_PROMPT` for pass 2)
- Add `buildCritiquePrompt(passOneResult: string)` function

### `src/components/extract/types.ts`

- Add `SignatureVisual` interface
- Add `signatureVisuals: SignatureVisual[]` to `Inventory`

### `src/lib/extract/normalize-analysis.ts`

- No geometry in `signatureVisuals` (they're text descriptions with refs), so no normalization changes needed

### `src/app/api/extract/analyze/route.ts`

- After pass 1 completes and JSON is parsed, conditionally run pass 2 if `critique` form field is truthy
- Pass 2: new `query()` call with `ANALYSIS_SYSTEM_PROMPT + CRITIQUE_ADDENDUM`, image + pass 1 JSON
- Stream pass 2 events with appropriate status messages
- Return pass 2 result (or pass 1 if critique is off)

### `src/components/extract/AnalyzeForm.tsx`

- Add "Critique" toggle (default off)
- Send `critique` field in form data

### `src/components/extract/store.ts`

- Add `usedCritique: boolean`, `pass1: AnalysisProvenance | null`, `pass2: AnalysisProvenance | null` to `SlideCard`
- Track in `startAnalysis` and `completeAnalysis`

### `src/components/extract/TemplateInspector.tsx`

- Display `signatureVisuals` in inventory panel (above mustPreserve, visually distinct)

## Test Plan

### `src/lib/extract/prompts.test.ts` (extend)

- **signatureVisuals in prompt**: verify `ANALYSIS_SYSTEM_PROMPT` mentions `signatureVisuals` as required
- **signatureVisuals rules**: verify prompt requires at least 1 background signature and 1 title/hero signature
- **mustPreserve redefined**: verify prompt distinguishes content (mustPreserve) from visual identity (signatureVisuals)
- **Critique addendum exists**: verify `CRITIQUE_ADDENDUM` is non-empty
- **Critique checklist**: verify `CRITIQUE_ADDENDUM` mentions signature visuals, uncertainty resolution, unnecessary abstraction
- **Critique inherits contract**: verify pass 2 system prompt is `ANALYSIS_SYSTEM_PROMPT + CRITIQUE_ADDENDUM` (not a separate prompt)
- **buildCritiquePrompt**: verify it includes the pass 1 JSON in the output

### `src/lib/extract/normalize-analysis.test.ts` (extend)

- **signatureVisuals preserved**: verify normalization does not modify signatureVisuals (no geometry to normalize)
- **Full v11-step3 response shape**: fixture with signatureVisuals parses and normalizes correctly

### `src/components/extract/TemplateInspector.test.tsx` (extend)

- **signatureVisuals displayed**: verify signatureVisuals render in inventory panel
- **signatureVisuals visually distinct**: verify they appear before/separate from mustPreserve

## Success Criteria

1. Inventory contains `signatureVisuals` with 1-5 non-text items (2-5 for visually rich slides)
2. At least 1 signatureVisual captures background/atmosphere when present
3. At least 1 signatureVisual captures title/hero treatment when present
4. Critique pass (when enabled) resolves at least 1 uncertainty or corrects at least 1 signatureVisual
5. KEY PLAYERS: warm reddish background glow appears in signatureVisuals and is encoded in the proposal
6. IRAN WAR: tricolor band effect appears in signatureVisuals and is faithfully encoded as a 3-band title treatment
7. Backwards compatibility: analysis without critique toggle works as before

## What Does NOT Change

| Component | Why unchanged |
|-----------|---------------|
| `compileProposalPreview` | Reads only `proposals` |
| `LayoutRenderer` | No knowledge of extraction |
| `SlideCard` rendering | Region overlays use `proposals[].region` |
| `YamlModal` | Generates YAML from proposals |
| `normalizeAnalysisRegions` logic | signatureVisuals have no geometry |

## Future Work (not in this change)

- Render-and-diff feedback loop (steps 4-6) — catches render-time artifacts (clip-path rectangles, text overflow) that symbolic critique cannot
- Automatic critique triggering based on confidence score
- Critique diff view in UI (highlight what changed between pass 1 and pass 2)
