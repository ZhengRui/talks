# Google Provider (Gemma 4 + Gemini 2.5/3.x) — Design

**Date:** 2026-04-16
**Revision:** v2 (post-Codex review)
**Status:** Design — to be reviewed before implementation
**Branch:** `ablation/v13-vlm-gemma4`
**Parent:** Multimodel Track 1 completion (Claude Code + OpenAI Codex); extends to a third vendor.
**Informed by:** `/workbench/gemma-test` showing Gemma 4 31B detects 26/26 elements on a complex slide with accurate bboxes.

## Changes from v1 (post-review)

- **[P1, Codex #1]** Cost formula now includes `thoughtsTokenCount` (billed as output).
- **[P1, Codex #2]** Image resize lives **inside the provider**, not upstream.
- **[P1 follow-up]** Resize helper deduped with `/api/gemma-detect` — moves to a shared module; the scratch route is refactored to call it.
- **[P2, Codex #3]** `MODEL_CATALOG` orders `gemini-2.5-flash` first in the Google section so `getDefaultCatalogEntry("google")` returns a reliable GA default, not a rate-limited free model.
- **[P3, Codex #4]** Scope is now explicit about the new env var and the out-of-`providers/` changes.
- **[New, user ask]** Added Gemini 3.x preview family (3.1 Pro, 3 Flash, 3.1 Flash-Lite) to catalog with `"preview"` status flag.

## Changes from v2 (post-review round 2)

- **[P2, Codex round 2 #1]** `resizeForGoogle` now returns `mediaType` alongside the buffer. When a resize happens the bytes are PNG and the helper returns `"image/png"`; when no resize is needed the caller's original `mediaType` is preserved. Provider uses the returned `mediaType` when building `inlineData`. Fixes silent MIME/byte mismatch on resized JPEG/WebP uploads.
- **[P3, Codex round 2 #2]** Tiered-pricing warning generalized from a string-equality check against `gemini-2.5-pro` to a `Set` membership. Both `gemini-2.5-pro` and `gemini-3.1-pro-preview` now trigger the >200K under-report warning.

## Goal

Add Google (Gemma 4 + Gemini 2.5 + Gemini 3.x preview) as a first-class extract provider, callable from all three pipeline phases (extract / vision / edit) identically to the existing `claude-code` and `openai-codex` providers. No phase-specific behavior; the refine loop and workbench select Google via the existing catalog.

## Non-Goals

- No new UI surface. The existing model selector picks up catalog entries automatically.
- No change to the refine loop, prompts, or adjudication logic.
- No removal or deprecation of `/workbench/gemma-test`.
- No batch-tier pricing support (always standard tier).
- No Vertex AI path. Google AI Studio / Gemini Developer API only.
- No thinking-trace surfacing in the UI. Thinking tokens are billed but not rendered. (Matches the "invisible but billed" tradeoff we already accept.)
- No Gemini 3 Deep Think (gated-access early program; not broadly available).

## Current State

The provider abstraction in `src/lib/extract/providers/` is vendor-agnostic:

- `types.ts` defines `ExtractModelProvider.run(ProviderTurnInput): Promise<ProviderTurnResult>`. Phase is carried on `ProviderTurnInput.phase` but never inspected by providers.
- `shared.ts::ExtractProviderId = "claude-code" | "openai-codex" | "mock"` — string union controlling the provider registry.
- `catalog.ts` lists `MODEL_CATALOG` entries; `getDefaultCatalogEntry(provider)` returns the first matching entry. Important: this makes catalog ordering semantically meaningful (fixes P2).
- `registry.ts` maps `ExtractProviderId` → provider instance. `getExtractModelProvider` validates model availability from the catalog.
- Each concrete provider handles its own streaming, prompt assembly, image injection, cost calc, and error mapping.

Outside `providers/`, the scratch route `src/app/api/gemma-detect/route.ts` already contains:
- Inline `setGlobalDispatcher(new ProxyAgent(...))` for proxy handling.
- Inline sharp-based downscale to 1920px before sending to Google.

Both pieces will be deduped into shared helpers so the new Google provider and the scratch route use the same code.

## Models in Scope

Seven catalog entries. All: `provider: "google"`, `auth: "api-key"`, `supportsImages: true`.

| `model` id | Label | Status | Effort mode | Default effort | Price $/M (in/out) | Notes |
|---|---|---|---|---|---|---|
| `gemini-2.5-flash` | Gemini 2.5 Flash | GA | budget | 0 | 0.30 / 2.50 | **Listed first → default for `"google"` provider.** Reliable cheap tier. |
| `gemini-2.5-pro` | Gemini 2.5 Pro | GA | budget | 0 | 1.25 / 10.00 (≤200K) | Reliable mid-tier. |
| `gemini-3.1-flash-lite-preview` | Gemini 3.1 Flash-Lite (Preview) | preview | budget | 0 | 0.25 / 1.50 | Absolute cheapest paid option. |
| `gemini-3-flash-preview` | Gemini 3 Flash (Preview) | preview | budget | 0 | 0.50 / 3.00 | Newer Flash tier. |
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro (Preview) | preview | budget | 0 | 2.00 / 12.00 | Flagship preview. MMMU Pro 83.9 — lead-critic candidate. |
| `gemma-4-31b-it` | Gemma 4 31B | free-only | none | none | 0 / 0 | Free tier only. Rate-limit-prone. |
| `gemma-4-26b-a4b-it` | Gemma 4 26B A4B | free-only | none | none | 0 / 0 | MoE variant, also free-tier-only. |

### New `status` field on `ModelCatalogEntry`

```ts
export type ModelStatus = "ga" | "preview" | "free-only";
```

Cheap to add (one optional field, UI can ignore if it wants). Surfaces reliability to anyone reading the catalog and lets us later gate or filter UI by status.

### Gemini 2.5 Pro >200K context pricing

Gemini 2.5 Pro charges $2.50/$15 for context over 200K. We do **not** implement tiered billing in v1; instead, we log a warning (`console.warn` server-side) when `usage.promptTokenCount > 200_000` with the note "cost under-reported." This is an explicit, acknowledged bug that's easy to fix later if it matters.

## Architecture

### File layout

```
src/lib/extract/providers/
├── google.ts              (new)  — provider implementation
├── google.test.ts         (new)  — unit tests, mocked @google/genai
├── shared.ts              (mod)  — add "google" to ExtractProviderId + proxy helper
├── catalog.ts             (mod)  — PROVIDER_LABELS.google + 7 entries + ModelStatus
├── catalog.test.ts        (mod)  — fixture updates
├── registry.ts            (mod)  — register googleProvider
└── registry.test.ts       (mod)  — fixture updates

src/lib/extract/
├── google-image-prep.ts   (new)  — sharp-based downscale helper (Google-specific)

src/app/api/gemma-detect/
└── route.ts               (mod)  — refactor to use shared proxy helper + google-image-prep
```

No UI changes. No changes to analyze or refine routes.

### `google-image-prep.ts` (new helper)

Extracted from `/api/gemma-detect/route.ts`. Returns a `mediaType` so the caller can't drift out of sync with the encoded bytes (Codex round 2 P2).

```ts
import sharp from "sharp";

const MAX_EDGE = 1920;

export interface PreparedImage {
  buffer: Buffer;
  width: number;
  height: number;
  mediaType: string;  // always accurate for `buffer`; "image/png" after resize
}

export async function resizeForGoogle(
  buffer: Buffer,
  width: number,
  height: number,
  originalMediaType: string,
): Promise<PreparedImage> {
  const longerEdge = Math.max(width, height);
  if (longerEdge <= MAX_EDGE) {
    // Pass-through: preserve caller's media type, bytes unchanged.
    return { buffer, width, height, mediaType: originalMediaType };
  }
  const scale = MAX_EDGE / longerEdge;
  const resized = await sharp(buffer)
    .resize({
      width: width >= height ? MAX_EDGE : undefined,
      height: height > width ? MAX_EDGE : undefined,
      fit: "inside",
    })
    .png()
    .toBuffer();
  return {
    buffer: resized,
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    mediaType: "image/png",  // we re-encoded via .png()
  };
}
```

Caller (provider and scratch route) **must** use the returned `mediaType`, not the original one. Tests below cover both pass-through and resized paths.

### Proxy dispatcher helper (`shared.ts`)

```ts
import { setGlobalDispatcher, ProxyAgent } from "undici";

let proxyInstalled = false;
export function installProxyDispatcherOnce(): void {
  if (proxyInstalled) return;
  const proxyUrl =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy;
  if (!proxyUrl) {
    proxyInstalled = true; // no-op, but don't keep re-checking
    return;
  }
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
  proxyInstalled = true;
}
```

Called:
- Once per process from `google.ts` on first client init.
- Once per process from `/api/gemma-detect/route.ts` top-level (replacing current inline block).

### `google.ts` provider

```ts
export const googleProvider: ExtractModelProvider = {
  id: "google",
  run: runGoogleTurn,
};
```

#### Client singleton

```ts
let singleton: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (singleton) return singleton;
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set");
  installProxyDispatcherOnce();
  singleton = new GoogleGenAI({ apiKey });
  return singleton;
}
```

#### Model family detection

```ts
function isGemma(model: string): boolean {
  return model.startsWith("gemma-");
}
function supportsThinking(model: string): boolean {
  // All Gemini 2.5+ / 3.x support thinking; Gemma does not.
  return model.startsWith("gemini-");
}
```

#### System prompt placement

- **Gemini (2.5, 3.x)**: `config.systemInstruction = input.systemPrompt`.
- **Gemma 4**: no system-instruction support; prepend `"System instructions:\n" + systemPrompt + "\n\n"` to the first text part. Mirrors `openai-codex.ts::renderCodexPrompt`.

#### Effort → thinking budget

- Gemma: `effort = "none"` → omit `thinkingConfig`.
- Gemini: `effort` is a stringified integer (`"0" | "8000" | "24000" | "32000"`) → `config.thinkingConfig.thinkingBudget = parseInt(effort, 10)`. Catalog defines valid options per model.

#### Image resize before send

Before building the `inlineData` part. Non-mutating — map into a new array so caller buffers aren't altered. Use the returned `mediaType` to avoid the resize/MIME mismatch bug (Codex round 2 P2):

```ts
async function preparePartsForGoogle(
  parts: ProviderContentPart[],
): Promise<Array<{ type: "text"; text: string } | { type: "image"; prepared: PreparedImage }>> {
  const out: Array<{ type: "text"; text: string } | { type: "image"; prepared: PreparedImage }> = [];
  for (const part of parts) {
    if (part.type === "text") {
      out.push({ type: "text", text: part.text });
      continue;
    }
    const meta = await sharp(part.buffer).metadata();
    const prepared = await resizeForGoogle(
      part.buffer,
      meta.width ?? 0,
      meta.height ?? 0,
      part.mediaType,
    );
    out.push({ type: "image", prepared });
  }
  return out;
}
```

When building `inlineData`, always use `prepared.mediaType`:

```ts
{ inlineData: { data: prepared.buffer.toString("base64"), mimeType: prepared.mediaType } }
```

#### Streaming

`models.generateContentStream`. Per-chunk `delta` → emit `onEvent({type: "text", text: delta})`. Accumulate into final `text`. Capture the last `usageMetadata` seen across chunks (typically in the final chunk; guard for earlier chunks not having it).

Abort: wire `input.signal`. If `@google/genai` accepts an `AbortSignal` via the request options, pass it through. If not, guard the for-await loop: `if (input.signal?.aborted) throw new AbortError()` each iteration.

#### Cost calculation (Codex P1 #1 fix)

```ts
const COST_RATES: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash":              { input: 0.30, output: 2.50 },
  "gemini-2.5-pro":                { input: 1.25, output: 10.00 },
  "gemini-3.1-flash-lite-preview": { input: 0.25, output: 1.50 },
  "gemini-3-flash-preview":        { input: 0.50, output: 3.00 },
  "gemini-3.1-pro-preview":        { input: 2.00, output: 12.00 },
  "gemma-4-31b-it":                { input: 0,    output: 0 },
  "gemma-4-26b-a4b-it":            { input: 0,    output: 0 },
};

const usage = lastUsageMetadata;
const inputTokens = usage?.promptTokenCount ?? 0;
// Thinking tokens are billed as output on Gemini 2.5+ / 3.x.
const outputTokens =
  (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
const rate = COST_RATES[model] ?? { input: 0, output: 0 };
const cost = (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;

// Models with separate >200K pricing tiers we don't implement yet.
// Warn instead of silently under-reporting. Covers both Pro tiers (Codex round 2 P3).
const TIERED_PRICING_MODELS = new Set<string>([
  "gemini-2.5-pro",
  "gemini-3.1-pro-preview",
]);
if (inputTokens > 200_000 && TIERED_PRICING_MODELS.has(model)) {
  console.warn(
    `[google-provider] ${model} request >200K context (${inputTokens} tokens). ` +
    `Cost under-reported at tier-1 rates.`
  );
}
```

Return `usage` on `ProviderTurnResult.usage` — the `thoughtsTokenCount` is rolled into `outputTokens` for user display consistency with other providers (Claude/Codex report a single output figure).

#### Error mapping

| Condition | Message |
|---|---|
| Missing API key | "GEMINI_API_KEY (or GOOGLE_API_KEY) is not set." |
| HTTP 429 / rate-limit | "Google free-tier rate limit hit. Wait or switch to a Gemini 2.5/3.x paid model." |
| HTTP 400 with `RESOURCE_EXHAUSTED` | Same as above. |
| HTTP 400 token-limit error | "Request exceeds Google context limit for model X (Y tokens)." |
| Preview-model deprecation / 404 | "Gemini preview model X was deprecated or replaced. Update the catalog model id." |
| Connect timeout / DNS | "Cannot reach Google API. If you need a proxy, set HTTPS_PROXY and restart." |
| Unknown | Pass through. |

### `shared.ts` changes

```ts
export type ExtractProviderId =
  | "claude-code"
  | "openai-codex"
  | "google"
  | "mock";

export function installProxyDispatcherOnce(): void { /* as above */ }
```

### `catalog.ts` changes

```ts
const GEMMA_NONE_EFFORT: EffortOption[] = [{ value: "none", label: "None" }];
const GEMINI_BUDGET_OPTIONS: EffortOption[] = [
  { value: "0",     label: "No thinking" },
  { value: "8000",  label: "8k tokens" },
  { value: "24000", label: "24k tokens" },
];
const GEMINI_PRO_BUDGET_OPTIONS: EffortOption[] = [
  ...GEMINI_BUDGET_OPTIONS,
  { value: "32000", label: "32k tokens" },
];

const PROVIDER_LABELS: Record<ExtractProviderId, string> = {
  "claude-code": "Claude Code",
  "openai-codex": "OpenAI Codex",
  "google": "Google",
  mock: "Mock",
};

export type ModelStatus = "ga" | "preview" | "free-only";

export interface ModelCatalogEntry {
  // ...existing...
  status?: ModelStatus;
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  // ... existing claude + codex entries unchanged ...

  // Google — default first (GA), then preview, then free-only.
  { provider: "google", model: "gemini-2.5-flash",              label: "Gemini 2.5 Flash",
    status: "ga",       auth: "api-key", effortMode: "budget",
    effortOptions: GEMINI_BUDGET_OPTIONS, defaultEffort: "0",
    supportsImages: true },

  { provider: "google", model: "gemini-2.5-pro",                label: "Gemini 2.5 Pro",
    status: "ga",       auth: "api-key", effortMode: "budget",
    effortOptions: GEMINI_PRO_BUDGET_OPTIONS, defaultEffort: "0",
    supportsImages: true },

  { provider: "google", model: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash-Lite (Preview)",
    status: "preview",  auth: "api-key", effortMode: "budget",
    effortOptions: GEMINI_BUDGET_OPTIONS, defaultEffort: "0",
    supportsImages: true },

  { provider: "google", model: "gemini-3-flash-preview",        label: "Gemini 3 Flash (Preview)",
    status: "preview",  auth: "api-key", effortMode: "budget",
    effortOptions: GEMINI_BUDGET_OPTIONS, defaultEffort: "0",
    supportsImages: true },

  { provider: "google", model: "gemini-3.1-pro-preview",        label: "Gemini 3.1 Pro (Preview)",
    status: "preview",  auth: "api-key", effortMode: "budget",
    effortOptions: GEMINI_PRO_BUDGET_OPTIONS, defaultEffort: "0",
    supportsImages: true },

  { provider: "google", model: "gemma-4-31b-it",                label: "Gemma 4 31B",
    status: "free-only", auth: "api-key", effortMode: "none",
    effortOptions: GEMMA_NONE_EFFORT, defaultEffort: "none",
    supportsImages: true },

  { provider: "google", model: "gemma-4-26b-a4b-it",            label: "Gemma 4 26B A4B",
    status: "free-only", auth: "api-key", effortMode: "none",
    effortOptions: GEMMA_NONE_EFFORT, defaultEffort: "none",
    supportsImages: true },
];
```

`DEFAULT_PROVIDER` stays `"openai-codex"` — we don't change global defaults in this PR.

### `registry.ts` changes

```ts
import { googleProvider } from "./google";

const PROVIDERS: Record<ProviderSelection["provider"], ExtractModelProvider> = {
  "claude-code": claudeCodeProvider,
  "openai-codex": openAICodexProvider,
  "google": googleProvider,
  mock: mockProvider,
};
```

### `/api/gemma-detect/route.ts` refactor

- Replace inline `setGlobalDispatcher(new ProxyAgent(...))` block with `installProxyDispatcherOnce()` from `shared.ts`.
- Replace inline 1920px resize block with `resizeForGoogle(buffer, width, height)` from `google-image-prep.ts`.

Functionally identical. Reduces duplication; keeps the scratch route aligned with provider behavior.

## Data Contract

Unchanged. `ProviderTurnInput` / `ProviderTurnResult` are sufficient. `ExtractProviderId` gains `"google"`. `ModelCatalogEntry` gains optional `status`.

## Auth & Env

- **New env vars** (Google only): `GEMINI_API_KEY` preferred, `GOOGLE_API_KEY` fallback. Required **only** when a Google model is selected; Claude-only / Codex-only users are unaffected.
- `HTTPS_PROXY` / `HTTP_PROXY` convention unchanged — applied once per process via `installProxyDispatcherOnce()`.
- No login flow.

## Testing Strategy

Unit tests in `google.test.ts`, all with mocked `@google/genai`:

1. **System prompt split**
   - Gemini 2.5 model → `config.systemInstruction` set, first user part untouched.
   - Gemini 3.1 Pro Preview → same, confirming the mechanism holds for 3.x.
   - Gemma 4 → `config.systemInstruction` absent, first user text part prepended with `"System instructions:\n<sys>\n\n"`.
2. **Effort → thinking budget**
   - Gemma with `"none"` → `thinkingConfig` absent.
   - Gemini with `"0"` → `thinkingConfig.thinkingBudget === 0`.
   - Gemini with `"8000"` → `thinkingConfig.thinkingBudget === 8000`.
   - Gemini 2.5 Pro with `"32000"` → `thinkingConfig.thinkingBudget === 32000`.
3. **Image part conversion**
   - Buffer + mediaType → `inlineData: { data: <base64>, mimeType }`.
4. **Image resize (Codex P1 #2 + round 2 P2 fix)**
   - Small image (800×600, `image/jpeg`) → passed through unchanged, returned `mediaType === "image/jpeg"`.
   - Large image (3840×2160, `image/jpeg`) → resized to longer edge 1920, returned `mediaType === "image/png"` (matches re-encoded bytes).
   - Large image (3840×2160, `image/webp`) → resized, returned `mediaType === "image/png"`.
   - Buffer bytes ≤ pre-resize bytes (cheap heuristic, not a strict size cap).
   - Provider uses `prepared.mediaType` (not the caller's original) when building `inlineData` — verified by asserting the SDK was called with the updated MIME.
5. **Streaming**
   - For-await yields 3 chunks `"a"`, `"b"`, `"c"` → `onEvent` called 3 times; `result.text === "abc"`.
6. **Cost calculation (Codex P1 #1 fix — thinking tokens)**
   - Gemini 2.5 Flash, `promptTokenCount = 1_000_000`, `candidatesTokenCount = 500_000`, `thoughtsTokenCount = 0` → `cost ≈ 1.55`.
   - Gemini 2.5 Flash with `thoughtsTokenCount = 200_000` → `cost ≈ 0.30 + (2.5 × 0.7) = 2.05`.
   - Gemini 3.1 Pro Preview, `prompt = 100_000`, `candidates = 50_000`, `thoughts = 20_000` → `cost ≈ 0.2 + (12 × 0.07) = 1.04`.
   - Gemma → `cost === 0` regardless of usage including non-zero thoughts (defensive).
7. **Cost over-200K warning**
   - Gemini 2.5 Pro, `promptTokenCount = 250_000` → `console.warn` called with model id in message.
   - Gemini 3.1 Pro Preview, `promptTokenCount = 250_000` → `console.warn` called with model id in message (round 2 P3 fix).
   - Gemini 2.5 Flash, `promptTokenCount = 250_000` → no warning (not tiered).
8. **Error mapping**
   - 429 → rate-limit message.
   - Missing API key → clear message, no SDK call attempted.
   - Connect timeout (simulated dispatcher error) → proxy hint message.
9. **Abort signal**
   - Abort before first chunk → throws AbortError equivalent, `onEvent` never called with text.

`catalog.test.ts`:
- 7 Google entries present.
- `getDefaultCatalogEntry("google").model === "gemini-2.5-flash"` (explicitly assert this to lock Codex P2 fix).
- `findCatalogEntryByModel("gemini-3.1-pro-preview").status === "preview"`.
- `getModelCatalogEntry("google", "gemma-4-31b-it").status === "free-only"`.

`registry.test.ts`:
- `getExtractModelProvider({ provider: "google", model: "gemini-2.5-flash", effort: "0" })` returns `googleProvider`.
- Unknown Google model id throws with helpful error.

`google-image-prep.test.ts` (new):
- Small image pass-through.
- Large image downscale with correct aspect ratio.
- Non-square edge-case (portrait vs landscape).

No integration test against the real API (rate limits / quota make CI fragile). Manual verification: `/workbench/extract` → select Gemini 2.5 Flash / Gemini 3.1 Pro Preview / Gemma 4 31B → run on a real slide.

## Scope Summary

| File | Change | Est. LOC |
|---|---|---|
| `src/lib/extract/providers/shared.ts` | + "google" in union, + `installProxyDispatcherOnce` | +40 |
| `src/lib/extract/providers/catalog.ts` | + `ModelStatus` type, + `PROVIDER_LABELS.google`, + effort-option tables, + 7 entries | +70 |
| `src/lib/extract/providers/catalog.test.ts` | + Google catalog coverage (entries, ordering, status) | +30 |
| `src/lib/extract/providers/registry.ts` | Import + register | +2 |
| `src/lib/extract/providers/registry.test.ts` | + Google lookup case | +8 |
| `src/lib/extract/providers/google.ts` | **New** provider | +220 |
| `src/lib/extract/providers/google.test.ts` | **New** tests | +320 |
| `src/lib/extract/google-image-prep.ts` | **New** shared resize helper | +30 |
| `src/lib/extract/google-image-prep.test.ts` | **New** resize tests | +50 |
| `src/app/api/gemma-detect/route.ts` | Refactor: use shared helpers | -20 net |

Total: ~10 files, ~750 LOC net. Dep already installed (`@google/genai@1.50.1`). Out-of-`providers/` changes are intentionally small and dedupe-only.

## Risks & Unknowns

- **Free-tier quota surprise.** Gemma 4 runs will hit 429s under workbench iteration. Mitigation: clear error + catalog `status: "free-only"` hint + suggestion to switch to Gemini 2.5 Flash.
- **Preview-model churn.** 3.x models are preview and may be deprecated/renamed. Mitigation: status flag in catalog, error mapping for 404/deprecation, update catalog as Google rolls GA.
- **Cost under-report at >200K context.** Known, logged, easy to fix later with tiered rates if a workload actually uses this.
- **Thinking-trace invisibility.** Gemini reasoning tokens cost money but aren't surfaced. Accepted tradeoff; matches how Codex's reasoning is handled today.
- **SDK signal propagation.** If `@google/genai` doesn't accept an `AbortSignal`, aborts are loop-level only (response completes naturally). Acceptable; documented.
- **Gemma system-instruction behavior.** We prepend to user text. If Google adds native Gemma system support via the Gemini API later, this branch can be removed.
- **Proxy helper refactor ripple.** Moving the proxy install out of `/api/gemma-detect/route.ts` is low-risk (pure extraction of an idempotent module-level call), but the scratch UI is exactly where we'll notice regressions first. Manual verification on `/workbench/gemma-test` is part of the acceptance check.

## Open Questions

1. **Should `ModelStatus` be surfaced in the UI?** The catalog carries it, but the model selector currently doesn't render it. Out of scope for this PR; a small follow-up lets users see a "Preview" badge next to preview models.
2. **Image resize placement for future providers.** If a second vendor also needs image preprocessing, the helper becomes `image-prep.ts` with provider-indexed options. Not now; YAGNI.
3. **Token accounting for images.** Google counts images as a fixed token cost (~258 tokens for small images, more for large). `usageMetadata.promptTokenCount` already reflects this, so our arithmetic is correct — but verify with a real call against a large image before relying on benchmark cost numbers.

## Handoff

After this revision passes review: write implementation plan at `docs/plans/2026-04-16-google-provider.md` via the writing-plans skill, then execute via subagent-driven-development. Acceptance criteria: unit tests green, `/workbench/gemma-test` unchanged behavior (regression check on the refactor), refine loop works end-to-end with `gemini-2.5-flash` selected on a real slide.
