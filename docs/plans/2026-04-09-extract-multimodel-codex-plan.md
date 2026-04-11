# Extract Multi-Provider Refactor Plan (Claude Code + OpenAI Codex)

## Summary

Refactor the extract workbench so analyze and refine no longer depend directly on Claude-specific transport, auth, or model IDs.

Phase 1 adds a provider layer with three concrete providers:

1. `claude-code` using the existing `@anthropic-ai/claude-agent-sdk` flow
2. `openai-codex` using `@openai/codex-sdk` plus local `codex login` auth
3. `mock` for deterministic local testing

The goal is behavioral parity, not prompt redesign. Keep the current prompt builders, parsing logic, and SSE contract. Move only the model transport and auth details behind provider adapters.

This is the supported path for "use OpenAI models with ChatGPT Plus instead of API billing" in this repo: the OpenAI provider in scope is Codex CLI / Codex SDK, not the OpenAI API.

## Why This Refactor

The current extract stack is tightly coupled to Claude in several places:

- `package.json` depends only on `@anthropic-ai/claude-agent-sdk`
- `src/app/api/extract/analyze/route.ts` imports `query()` directly and hardcodes Claude model IDs plus `pathToClaudeCodeExecutable`
- `src/lib/extract/refine.ts` uses the same direct Claude transport for vision and edit passes
- `src/components/extract/AnalyzeForm.tsx` hardcodes Claude model lists and effort options
- `src/components/extract/store.ts` stores plain Claude model strings as the primary config surface
- `src/lib/extract/mock-claude.ts` bakes the mock path into Claude naming

That coupling blocks two things:

1. adding OpenAI Codex as a first-class local provider
2. evolving to a real multi-provider model catalog later without rewriting the extract UI again

## Product Constraints To Respect

- ChatGPT Plus does not cover standard OpenAI API billing.
- Codex CLI / Codex SDK with ChatGPT sign-in is the subscription-backed OpenAI path.
- Codex SDK does not currently expose a first-class per-turn `systemPrompt` field like the Claude agent SDK does.
- Codex SDK accepts text plus local image paths, not raw image buffers.
- Codex SDK returns structured thread events and token usage, but not the same event/cost shape as Claude.

These constraints mean the internal prompt model can stay `systemPrompt + userPrompt`, but the Codex provider must merge them into one turn input and adapt its own event stream back into the existing SSE contract.

## Locked Decisions

- Phase 1 supports `claude-code`, `openai-codex`, and `mock`. Do not add `openai-responses` in the same change.
- The extract and refine routes stay server-side Node routes.
- Provider selection becomes explicit state: `{ provider, model, effort }`, not "infer provider from model string".
- Existing prompt builder functions remain the source of truth:
  - `src/lib/extract/prompts.ts`
  - `src/lib/extract/refine-prompt.ts`
- Existing JSON parsing stays in place in Phase 1. Do not combine this transport refactor with a schema rewrite.
- Existing external SSE event names stay stable so the UI does not need a streaming rewrite.
- `openai-codex` is local-only in Phase 1. It should assume:
  - installed `codex` CLI
  - `codex login` already completed
  - local Git worktree
- Codex runs with:
  - `workingDirectory: process.cwd()`
  - `sandboxMode: "read-only"`
  - `approvalPolicy: "never"`
  - `networkAccessEnabled: false`
- Cost remains nullable. Do not fake dollar cost for Codex subscription-backed runs.
- Keep Claude as the default provider until Codex passes the benchmark set reliably.

## Scope

Included:

- provider abstraction for analyze + refine
- OpenAI Codex provider implementation
- provider-aware UI state and selectors
- provider-aware provenance and prompt history
- actionable error handling for missing Codex install/login
- tests for provider routing, prompt mapping, and store/UI updates

Explicitly out of scope:

- hosted multi-user OpenAI auth
- replacing the extract prompt content itself
- schema-first structured output migration
- non-extract LLM abstractions elsewhere in the repo
- removing Claude support
- changing benchmark logic or slide rendering behavior

## Target Architecture

### 1. Shared provider surface

Create a focused provider layer under `src/lib/extract/providers/`:

```ts
export type ExtractProviderId = "claude-code" | "openai-codex" | "mock";

export interface ProviderSelection {
  provider: ExtractProviderId;
  model: string;
  effort: string;
}

export interface ProviderContentText {
  type: "text";
  text: string;
}

export interface ProviderContentImage {
  type: "image";
  buffer: Buffer;
  mediaType: string;
  fileName?: string;
}

export type ProviderContentPart = ProviderContentText | ProviderContentImage;

export interface ProviderTurnInput {
  phase: "extract" | "vision" | "edit";
  // Logical prompt text preserved for prompt-history UI and debugging.
  systemPrompt: string;
  // Logical user prompt preserved separately for prompt inspection.
  userPrompt: string;
  // Complete ordered model payload. This already includes the user-prompt text
  // as its final text part when the prompt design requires that.
  // Providers must not append `userPrompt` a second time after rendering `content`.
  content: ProviderContentPart[];
  selection: ProviderSelection;
  signal?: AbortSignal;
  onEvent?: (event: ProviderStreamEvent) => Promise<void> | void;
}

export interface ProviderStreamEvent {
  type: "status" | "thinking" | "text" | "tool" | "tool_result";
  message?: string;
  text?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  cost?: number | null;
}

export interface ProviderTurnResult {
  text: string;
  elapsed: number;
  cost: number | null;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  } | null;
}

export interface ExtractModelProvider {
  id: ExtractProviderId;
  run(input: ProviderTurnInput): Promise<ProviderTurnResult>;
}
```

Files:

- Create: `src/lib/extract/providers/shared.ts`
- Create: `src/lib/extract/providers/types.ts`
- Create: `src/lib/extract/providers/index.ts`

### 2. Central model catalog

Move all model lists and effort options out of React components and into one provider catalog:

```ts
export interface ModelCatalogEntry {
  provider: ExtractProviderId;
  model: string;
  label: string;
  auth: "subscription" | "api-key" | "none";
  effortMode: "adaptive" | "budget" | "none";
  effortOptions: Array<{ value: string; label: string }>;
  defaultEffort: string;
  supportsImages: boolean;
}
```

Initial catalog:

- Claude:
  - `claude-opus-4-6`
  - `claude-sonnet-4-6`
  - `claude-haiku-4-5-20251001`
- Codex:
  - current Codex-supported OpenAI coding models from the official docs, stored in one file only
- Mock:
  - `mock`

Files:

- Create: `src/lib/extract/providers/catalog.ts`

Important:

- The catalog must be data-driven because current Codex docs and help pages do not present a perfectly stable model list.
- Do not scatter OpenAI model IDs across UI, store, and routes.
- Claude adaptive-vs-budget effort behavior should come from this catalog metadata, not repeated hardcoded model checks.

## Data Model Changes

### 3. Canonicalize shared provider types and replace model-only state with provider selections

Use `src/lib/extract/providers/shared.ts` as the one canonical shared types module.

It should own:

```ts
export type ExtractProviderId = "claude-code" | "openai-codex" | "mock";

export interface ProviderSelection {
  provider: ExtractProviderId;
  model: string;
  effort: string;
}
```

Then import or re-export those types where needed. Do not define parallel copies in:

- `src/lib/extract/providers/types.ts`
- `src/components/extract/types.ts`

Update provenance types:

```ts
export interface AnalysisProvenance {
  provider: ExtractProviderId;
  model: string;
  effort: string;
}

export interface StageAnalysisProvenance extends AnalysisProvenance {
  elapsed?: number;
  cost?: number | null;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
  } | null;
}

export interface RefineProvenance {
  vision: ProviderSelection;
  edit: ProviderSelection;
}
```

Update `PromptRecord` to keep provider identity:

```ts
provider?: ExtractProviderId;
```

### 4. Update store state and actions

In `src/components/extract/store.ts`:

- replace top-level `model` + `effort` with `analyzeSelection`
- replace `refineVisionModel` + `refineVisionEffort` with `refineVisionSelection`
- replace `refineEditModel` + `refineEditEffort` with `refineEditSelection`
- update `currentRefinePass()` to return selections, not plain strings
- update store actions accordingly:
  - `setAnalyzeProvider()`
  - `setAnalyzeModel()`
  - `setAnalyzeEffort()`
  - `setRefineVisionProvider()` / `setRefineVisionModel()` / `setRefineVisionEffort()`
  - `setRefineEditProvider()` / `setRefineEditModel()` / `setRefineEditEffort()`

Keep the state normalized so each pass always has a valid `{ provider, model, effort }` triple.

## Backend Plan

### 5. Extract the existing Claude transport into its own provider

Move the current direct SDK logic out of:

- `src/app/api/extract/analyze/route.ts`
- `src/lib/extract/refine.ts`

into:

- Create: `src/lib/extract/providers/claude-code.ts`

Responsibilities:

- preserve the current `query()` behavior
- preserve Claude image prompt construction from raw `Buffer`
- preserve adaptive vs token-budget effort handling
- preserve current streaming behavior and cost extraction
- consolidate the duplicated `buildQueryOptions()` logic into one Claude-only helper
- resolve the Claude executable path centrally instead of carrying forward the current hardcoded machine path

Executable resolution order:

1. explicit env var such as `CLAUDE_CODE_EXECUTABLE`
2. `claude` resolved from `PATH`
3. optional fallback like `$HOME/.local/bin/claude`

If no executable is found, return an actionable local setup error.

This step should be nearly mechanical. The provider adapter is allowed to call the exact same SDK APIs the routes call today.

### 6. Add a mock provider

Generalize the mock path so it is provider-based rather than model-name-based.

Recommended changes:

- Rename `src/lib/extract/mock-claude.ts` to `src/lib/extract/mock-provider.ts`
- Replace `MOCK_CLAUDE_MODEL` with `MOCK_PROVIDER_MODEL = "mock"`
- Replace `isMockClaudeModel(model)` with a selection/provider-based check

### 7. Implement the OpenAI Codex provider

Create:

- `src/lib/extract/providers/openai-codex.ts`

Add dependency:

- `bun add @openai/codex-sdk`

Implementation requirements:

1. Instantiate the SDK once per process or module:

```ts
const codex = new Codex();
```

2. Start a fresh thread per analyze / vision / edit call:

```ts
const thread = codex.startThread({
  model,
  workingDirectory: process.cwd(),
  sandboxMode: "read-only",
  approvalPolicy: "never",
  networkAccessEnabled: false,
});
```

3. Convert in-memory image buffers to temp files because Codex SDK needs `local_image` inputs.

Suggested helper:

- Create: `src/lib/extract/providers/codex-temp-images.ts`

Behavior:

- write images under `os.tmpdir()`
- unique file names per turn
- delete them in `finally`

4. Convert ordered `content` parts into Codex turn input without losing text/image interleaving.

Because the current refine flow depends on the order:

- `ORIGINAL slide:`
- original image
- `REPLICA slide:`
- replica image
- task text

the provider input must preserve an ordered text/image sequence. Do not flatten this to `images[]`.

5. Merge `systemPrompt` + `userPrompt` into a single Codex text input with explicit delimiters:

```txt
System instructions:
<systemPrompt>

Then process the following ordered content exactly in sequence:
<content blocks rendered into text + local images>
```

Do not attempt to move dynamic extract/refine prompts into `AGENTS.md`. They are request-specific, not repo-static.

6. Use `runStreamed()` and map Codex events back into the existing provider stream contract:

- `thread.started` -> `status`
- `item.completed.reasoning` -> `thinking`
- `item.completed.agent_message` -> `text`
- `turn.completed.usage` -> attach token usage to the final status/result

7. Surface actionable errors:

- missing `codex` binary
- not logged in
- auth expired
- CLI spawn failure

Return messages that tell the user exactly what to do:

- install `@openai/codex`
- run `codex login`
- restart the dev server if env or auth changed

Important difference from Claude:

- Codex may not stream the same fine-grained "thinking delta" flow the current Claude path emits.
- The UI must tolerate fewer or chunkier `thinking` events.

### 8. Add a provider registry and selection resolver

Create:

- `src/lib/extract/providers/registry.ts`

Responsibilities:

- resolve a `ProviderSelection` to the correct provider
- validate that the selected model belongs to the selected provider
- expose catalog lookup helpers for the UI

This avoids route-level `if (model.startsWith("claude-"))` logic.

### 9. Keep route contracts stable while making them provider-aware

Update `src/app/api/extract/analyze/route.ts`:

- add `runtime = "nodejs"`
- accept:
  - `provider`
  - `model`
  - `effort`
- build the same prompt payload as today
- resolve the provider via the registry
- emit the same SSE events as today
- include `provider` in prompt history and provenance

Update `src/app/api/extract/refine/route.ts`:

- accept:
  - `visionProvider`
  - `visionModel`
  - `visionEffort`
  - `editProvider`
  - `editModel`
  - `editEffort`
- keep the outer SSE route unchanged
- pass full `ProviderSelection` objects into `runRefinementLoop()`

### 10. Update `runRefinementLoop()` to be transport-agnostic

Refactor `src/lib/extract/refine.ts` so the orchestration stays here but the model calls move out.

Keep:

- prompt construction
- image diff flow
- issue parsing
- patch parsing
- convergence logic

Replace:

- `streamClaudeText()`
- direct Claude prompt generators as the transport boundary

With:

- provider turn calls for:
  - vision critique
  - proposal edit

The refine module should build ordered provider content parts that preserve the current label/image/task sequencing.

The refine module should still emit the same events:

- `refine:vision:prompt`
- `refine:vision:thinking`
- `refine:vision:text`
- `refine:edit:prompt`
- `refine:edit:thinking`
- `refine:edit:text`

Only the provider adapter should know whether the underlying SDK is Claude or Codex.

## Frontend Plan

### 11. Make model selectors provider-aware

Update `src/components/extract/AnalyzeForm.tsx`:

- replace the single model dropdown with provider + model + effort selectors
- read options from the shared catalog
- when provider changes, snap model and effort to the first valid default for that provider
- do this independently for:
  - analyze
  - refine vision
  - refine edit

UI labels should distinguish billing/auth mode clearly:

- `Claude Code (subscription)`
- `OpenAI Codex (ChatGPT login)`
- `Mock`

This is important because "OpenAI Codex" and "OpenAI API" are not interchangeable in billing terms.

### 12. Update request construction in `ExtractCanvas.tsx`

Update analyze submission:

- append `provider`, `model`, `effort`

Update refine submission:

- append `visionProvider`, `visionModel`, `visionEffort`
- append `editProvider`, `editModel`, `editEffort`

Update status formatting helpers so logs read correctly for both providers.

Also remove Claude-specific label formatting such as stripping `"claude-"` by string replacement. Display labels should come from the catalog where possible, with a safe raw-model fallback.

Example:

- `Session started (extract) — openai-codex / gpt-5.4 · medium`
- `Refinement started — vision: openai-codex / gpt-5.4 · medium / edit: claude-code / claude-sonnet-4-6 · high`

### 13. Preserve prompt inspection without pretending transport parity

Keep storing:

- `systemPrompt`
- `userPrompt`
- `provider`
- `model`
- `effort`

Even though Codex sends a merged turn input internally, the UI should continue to show the logical prompt split the user authored. That keeps prompt debugging consistent across providers.

## Testing Plan

### 14. Provider unit tests

Add focused tests for:

- `catalog.ts`
  - valid provider/model combinations
  - correct effort options
  - correct `effortMode` / capability metadata
- `registry.ts`
  - selection resolution
  - invalid model/provider combinations
- `claude-code.ts`
  - current query options preserved
  - executable resolution behavior
  - single consolidated options helper behavior
- `openai-codex.ts`
  - merges `systemPrompt` + `userPrompt`
  - preserves ordered text/image content
  - writes temp image files
  - maps Codex SDK events to provider events
  - returns usage with null cost

### 15. Route and orchestration tests

Update existing tests in:

- `src/lib/extract/refine.test.ts`
- `src/components/extract/ExtractCanvas.test.tsx`
- `src/components/extract/AnalyzeForm.test.tsx`
- `src/components/extract/store.test.ts`
- `src/lib/extract/mock-claude.test.ts`

Add:

- analyze route test covering a non-Claude provider
- refine route test covering mixed providers between vision and edit
- prompt history assertions that provider is stored
- error-path tests for missing Codex install/login

### 16. Manual verification

Run at minimum:

- `bun x vitest run src/lib/extract/refine.test.ts`
- `bun x vitest run src/components/extract/store.test.ts`
- `bun x vitest run src/components/extract/AnalyzeForm.test.tsx`
- `bun x vitest run src/components/extract/ExtractCanvas.test.tsx`

Manual smoke checks:

1. analyze with `claude-code`
2. analyze with `openai-codex`
3. refine with `claude-code` for both passes
4. refine with `openai-codex` for both passes
5. mixed refine:
   - vision on Codex
   - edit on Claude

## Rollout Order

### Phase A: No-behavior-change extraction

- create provider types, catalog, registry
- move existing Claude logic into `claude-code.ts`
- rename `mock-claude` to `mock`
- keep UI defaults on Claude
- confirm all existing tests still pass

### Phase B: Add Codex provider behind explicit opt-in

- add `@openai/codex-sdk`
- implement `openai-codex.ts`
- expose provider selector in UI
- keep Claude as default
- validate local install/login failure paths

### Phase C: Benchmark and tune

- run the existing benchmark slides across Claude and Codex
- compare:
  - JSON validity rate
  - extract quality
  - refine convergence rate
  - latency

Only after this phase should the default provider be reconsidered.

### Phase D: Optional follow-up hardening

Out of this refactor, but now enabled cleanly:

- add an `openai-responses` provider for API-billed hosted usage
- move some passes to `outputSchema`
- add provider-specific prompt shaping if Codex needs different wording for best quality

## Risks And Mitigations

### Risk: Codex prompt semantics differ from Claude

Mitigation:

- keep prompt builders unchanged
- merge prompts mechanically in the provider
- do not redesign prompts and transport in one step

### Risk: Codex image input requires temp files

Mitigation:

- isolate file handling in one helper
- always clean up in `finally`

### Risk: missing subscription/auth causes confusing failures

Mitigation:

- catch and rewrite provider startup errors into explicit local-action messages

### Risk: event streaming differs enough to break the UI

Mitigation:

- normalize everything through provider events
- keep the external SSE contract unchanged
- let `thinking` be optional

### Risk: model catalog drifts as OpenAI updates Codex offerings

Mitigation:

- one centralized catalog file
- no model IDs hardcoded in components

## Implementation Checklist

1. Add provider selection types and provenance updates.
2. Create provider catalog and registry.
3. Move Claude transport into `claude-code.ts`, including one consolidated options helper and configurable executable resolution.
4. Generalize mock into `mock`.
5. Add `@openai/codex-sdk` and implement `openai-codex.ts`.
6. Refactor analyze route to use the registry.
7. Refactor refine orchestration to use ordered provider content parts and provider turns.
8. Update store and AnalyzeForm to use `{ provider, model, effort }`.
9. Update ExtractCanvas request payloads and log formatting.
10. Add targeted unit tests and run the focused Vitest suite.
11. Validate local Codex login flow manually.
12. Benchmark Claude vs Codex before changing defaults.
