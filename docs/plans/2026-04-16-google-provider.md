# Google Provider (Gemma 4 + Gemini 2.5/3.x) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google as a third extract provider — accessible from all three pipeline phases (extract / vision / edit) — exposing Gemma 4 (free tier only) and Gemini 2.5/3.x models through the existing multimodel abstraction.

**Architecture:** Vendor-agnostic `ExtractModelProvider.run()` contract is already in place. This plan adds a Google implementation file, extracts the proxy-dispatcher + image-resize helpers into shared modules (so `/api/gemma-detect` and the new provider share logic), updates the catalog with 7 Google entries + a new `ModelStatus` field, and wires the provider into the registry. No UI, refine-loop, or prompt changes.

**Tech Stack:** `@google/genai@1.50.1` (already installed), `undici` (for `ProxyAgent`, already transitively present via Next.js), `sharp` (already used in extract pipeline), TypeScript strict, Vitest (colocated tests per project convention).

**Design Doc:** `docs/2026-04-16-design-google-provider.md` (approved by Codex review, v3)

## Revision Log

### v2 (post-plan review by Codex)

- **[P1] `elapsed` in seconds, not ms.** Claude and Codex providers both return `Math.round((Date.now() - startedAt) / 1000)`. The Google provider now matches — the UI renders elapsed with an `s` suffix, so raw ms would show up 1000× too long.
- **[P2] Abort handling restored.** Task 5's for-await loop now checks `input.signal?.aborted` per iteration. If the SDK's request options accept an `AbortSignal`, we pass it too. A dedicated test case covers pre-first-chunk abort behavior.
- **[P2] Error mapping expanded to match the approved design.** `RESOURCE_EXHAUSTED` 400s, token-limit 400s, and preview-model 404/deprecation cases all get specific messages + tests in Task 7.
- **[P3] Test-isolation hygiene.** The Google provider caches its `GoogleGenAI` singleton and reads env on first init. Every test in `google.test.ts` now runs inside a `beforeEach(() => vi.resetModules())` block so the singleton and env reads are re-evaluated — previously an earlier happy-path test would populate the singleton and cause the "missing API key" test to pass without exercising the env-check branch.

### v3 (post-plan review round 2 by Codex)

- **[P2] AbortSignal correct request level.** `@google/genai` reads `params.config?.abortSignal`, not a top-level field. v2 attached the signal to the top-level params object and silenced the type error with a cast — that cast was the signal I was papering over the real shape. Moved the signal into `config.abortSignal` and removed the cast. Loop-level abort check stays as a backstop.
- **[P3] Happy-path tests no longer share a stale singleton.** v2 documented the dynamic-import pattern for error-mapping tests only and left happy-path tests using a top-level `import { googleProvider } from "./google"`. That static import locks in the original module closure — `vi.resetModules()` has no effect on it, so the first test's singleton persisted through the rest of the file. Now every test that exercises `googleProvider.run()` re-imports `./google` after `vi.resetModules()`, and each test sets `process.env.GEMINI_API_KEY = "test-key"` explicitly when it needs a valid key. Pure-helper imports (buildSystemPrompt, buildThinkingConfig, preparePartsForGoogle, __testHelpers) stay as static imports — they have no singleton or env dependency.

---

## Commit Policy

Per user preference (`~/.claude/.../memory/feedback_no_commit.md`, `feedback_commit_structure.md`):

- **Do NOT commit per task.** Each task ends when tests are green and the tree is staged cleanly.
- The user will batch everything into a single squashed commit on `ablation/v13-vlm-gemma4` at the end.
- If the subagent auto-commits, it is doing the wrong thing — stop and ask.

## Test Convention

Tests colocate next to source (`src/foo.ts` → `src/foo.test.ts`). Do NOT put tests in `__tests__/` directories. Project uses Vitest (`bun run test`). Match the style of existing provider tests (`src/lib/extract/providers/openai-codex.test.ts`, `claude-code.test.ts`).

### Test-isolation rule for `google.test.ts`

The Google provider maintains a module-level `GoogleGenAI` singleton plus env-var reads that fire on first init. Without isolation, earlier tests populate the singleton and later tests (e.g. "missing API key") silently skip the env check. **Every describe block in `google.test.ts` must start with:**

```ts
beforeEach(() => {
  vi.resetModules();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
});
```

When a test needs a valid key, set `process.env.GEMINI_API_KEY = "test-key"` inside the test body. When it needs the key absent, leave it deleted. The dynamic `await import("./google")` pattern used in the test snippets already re-evaluates modules after `vi.resetModules()`.

---

## Task 1: Extend `ExtractProviderId` + add proxy helper

**Files:**
- Modify: `src/lib/extract/providers/shared.ts`
- Test: `src/lib/extract/providers/shared.test.ts` (new — check whether it exists first; if not, create)

**Step 1: Inspect current shared.ts**

Read `src/lib/extract/providers/shared.ts`. Confirm the union is `"claude-code" | "openai-codex" | "mock"`.

**Step 2: Write failing test for `installProxyDispatcherOnce`**

Create `src/lib/extract/providers/shared.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

describe("installProxyDispatcherOnce", () => {
  beforeEach(() => {
    // Reset the module registry so the idempotency flag resets between tests.
    vi.resetModules();
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    delete process.env.HTTP_PROXY;
    delete process.env.http_proxy;
  });

  it("is a no-op when no proxy env is set", async () => {
    const setGlobalDispatcher = vi.fn();
    vi.doMock("undici", () => ({ setGlobalDispatcher, ProxyAgent: vi.fn() }));
    const { installProxyDispatcherOnce } = await import("./shared");
    installProxyDispatcherOnce();
    expect(setGlobalDispatcher).not.toHaveBeenCalled();
  });

  it("installs a ProxyAgent when HTTPS_PROXY is set", async () => {
    process.env.HTTPS_PROXY = "http://127.0.0.1:7897";
    const setGlobalDispatcher = vi.fn();
    const ProxyAgent = vi.fn();
    vi.doMock("undici", () => ({ setGlobalDispatcher, ProxyAgent }));
    const { installProxyDispatcherOnce } = await import("./shared");
    installProxyDispatcherOnce();
    expect(ProxyAgent).toHaveBeenCalledWith("http://127.0.0.1:7897");
    expect(setGlobalDispatcher).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — second call does not re-install", async () => {
    process.env.HTTPS_PROXY = "http://127.0.0.1:7897";
    const setGlobalDispatcher = vi.fn();
    vi.doMock("undici", () => ({ setGlobalDispatcher, ProxyAgent: vi.fn() }));
    const { installProxyDispatcherOnce } = await import("./shared");
    installProxyDispatcherOnce();
    installProxyDispatcherOnce();
    expect(setGlobalDispatcher).toHaveBeenCalledTimes(1);
  });
});
```

**Step 3: Run to verify failure**

Run: `bun run test -- src/lib/extract/providers/shared.test.ts`
Expected: FAIL — `installProxyDispatcherOnce` is not exported from `shared.ts`.

**Step 4: Update `shared.ts`**

Replace file contents with:

```ts
import { setGlobalDispatcher, ProxyAgent } from "undici";

export type ExtractProviderId = "claude-code" | "openai-codex" | "google" | "mock";

export interface ProviderSelection {
  provider: ExtractProviderId;
  model: string;
  effort: string;
}

export interface ProviderSelectionInput {
  provider?: string | null;
  model?: string | null;
  effort?: string | null;
}

let proxyInstalled = false;

export function installProxyDispatcherOnce(): void {
  if (proxyInstalled) return;
  proxyInstalled = true;
  const proxyUrl =
    process.env.HTTPS_PROXY ??
    process.env.https_proxy ??
    process.env.HTTP_PROXY ??
    process.env.http_proxy;
  if (!proxyUrl) return;
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}
```

**Step 5: Run to verify pass**

Run: `bun run test -- src/lib/extract/providers/shared.test.ts`
Expected: PASS, 3/3 green.

**Step 6: Run full test suite to check no regressions**

Run: `bun run test`
Expected: still green (nothing should have regressed from adding "google" to the union — downstream consumers use `ExtractProviderId` but don't enumerate variants yet).

**Do NOT commit. Leave changes staged.**

---

## Task 2: `google-image-prep.ts` — resize helper with mediaType

**Files:**
- Create: `src/lib/extract/google-image-prep.ts`
- Test: `src/lib/extract/google-image-prep.test.ts`

**Step 1: Write the failing test**

Create `src/lib/extract/google-image-prep.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { resizeForGoogle } from "./google-image-prep";

async function makeImage(width: number, height: number, format: "png" | "jpeg" = "png"): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    [format]()
    .toBuffer();
}

describe("resizeForGoogle", () => {
  it("passes small images through unchanged and preserves mediaType", async () => {
    const buffer = await makeImage(800, 600, "jpeg");
    const result = await resizeForGoogle(buffer, 800, 600, "image/jpeg");
    expect(result.buffer).toBe(buffer);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.mediaType).toBe("image/jpeg");
  });

  it("downscales wide images and switches mediaType to image/png", async () => {
    const buffer = await makeImage(3840, 2160, "jpeg");
    const result = await resizeForGoogle(buffer, 3840, 2160, "image/jpeg");
    expect(result.buffer).not.toBe(buffer);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.mediaType).toBe("image/png");
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1080);
    expect(meta.format).toBe("png");
  });

  it("downscales tall images with correct aspect ratio", async () => {
    const buffer = await makeImage(1080, 3840, "png");
    const result = await resizeForGoogle(buffer, 1080, 3840, "image/png");
    expect(result.height).toBe(1920);
    expect(result.width).toBe(540);
    expect(result.mediaType).toBe("image/png");
  });

  it("passes through when exactly at the 1920 edge", async () => {
    const buffer = await makeImage(1920, 1080, "png");
    const result = await resizeForGoogle(buffer, 1920, 1080, "image/png");
    expect(result.buffer).toBe(buffer);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
  });
});
```

**Step 2: Run to verify failure**

Run: `bun run test -- src/lib/extract/google-image-prep.test.ts`
Expected: FAIL — module doesn't exist.

**Step 3: Implement `google-image-prep.ts`**

Create `src/lib/extract/google-image-prep.ts`:

```ts
import sharp from "sharp";

const MAX_EDGE = 1920;

export interface PreparedImage {
  buffer: Buffer;
  width: number;
  height: number;
  mediaType: string;
}

export async function resizeForGoogle(
  buffer: Buffer,
  width: number,
  height: number,
  originalMediaType: string,
): Promise<PreparedImage> {
  const longerEdge = Math.max(width, height);
  if (longerEdge <= MAX_EDGE) {
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
    mediaType: "image/png",
  };
}
```

**Step 4: Run to verify pass**

Run: `bun run test -- src/lib/extract/google-image-prep.test.ts`
Expected: PASS, 4/4 green.

**Do NOT commit.**

---

## Task 3: Catalog — `ModelStatus` + 7 Google entries

**Files:**
- Modify: `src/lib/extract/providers/catalog.ts`
- Modify: `src/lib/extract/providers/catalog.test.ts`

**Step 1: Read existing catalog.test.ts**

Read the entire file to understand the testing conventions. Preserve existing test structure; add new tests for Google entries at the end.

**Step 2: Add failing tests for Google catalog entries**

Append to `src/lib/extract/providers/catalog.test.ts`:

```ts
import {
  MODEL_CATALOG,
  getDefaultCatalogEntry,
  getModelCatalogEntry,
  findCatalogEntryByModel,
  getProviderOptions,
} from "./catalog";

describe("google provider catalog", () => {
  it("has all 7 Google entries", () => {
    const googleEntries = MODEL_CATALOG.filter((e) => e.provider === "google");
    expect(googleEntries).toHaveLength(7);
    const ids = googleEntries.map((e) => e.model);
    expect(ids).toEqual([
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "gemini-3.1-pro-preview",
      "gemma-4-31b-it",
      "gemma-4-26b-a4b-it",
    ]);
  });

  it("uses gemini-2.5-flash as the default google model", () => {
    const entry = getDefaultCatalogEntry("google");
    expect(entry.model).toBe("gemini-2.5-flash");
  });

  it("assigns status to each google entry", () => {
    expect(getModelCatalogEntry("google", "gemini-2.5-flash")?.status).toBe("ga");
    expect(getModelCatalogEntry("google", "gemini-2.5-pro")?.status).toBe("ga");
    expect(getModelCatalogEntry("google", "gemini-3.1-pro-preview")?.status).toBe("preview");
    expect(getModelCatalogEntry("google", "gemini-3-flash-preview")?.status).toBe("preview");
    expect(getModelCatalogEntry("google", "gemini-3.1-flash-lite-preview")?.status).toBe("preview");
    expect(getModelCatalogEntry("google", "gemma-4-31b-it")?.status).toBe("free-only");
    expect(getModelCatalogEntry("google", "gemma-4-26b-a4b-it")?.status).toBe("free-only");
  });

  it("marks google entries as api-key auth and image-capable", () => {
    const googleEntries = MODEL_CATALOG.filter((e) => e.provider === "google");
    for (const entry of googleEntries) {
      expect(entry.auth).toBe("api-key");
      expect(entry.supportsImages).toBe(true);
    }
  });

  it("uses budget effort for gemini and none for gemma", () => {
    expect(getModelCatalogEntry("google", "gemini-2.5-flash")?.effortMode).toBe("budget");
    expect(getModelCatalogEntry("google", "gemini-2.5-pro")?.effortMode).toBe("budget");
    expect(getModelCatalogEntry("google", "gemini-3.1-pro-preview")?.effortMode).toBe("budget");
    expect(getModelCatalogEntry("google", "gemma-4-31b-it")?.effortMode).toBe("none");
  });

  it("lists Google as a selectable provider", () => {
    const options = getProviderOptions();
    expect(options).toContainEqual({ value: "google", label: "Google" });
  });

  it("can find new Google models by id", () => {
    expect(findCatalogEntryByModel("gemini-3.1-pro-preview")?.provider).toBe("google");
  });

  it("gives gemini-2.5-pro a 32k thinking budget option", () => {
    const entry = getModelCatalogEntry("google", "gemini-2.5-pro");
    expect(entry?.effortOptions.map((o) => o.value)).toContain("32000");
  });

  it("does not give gemini-2.5-flash a 32k thinking budget option", () => {
    const entry = getModelCatalogEntry("google", "gemini-2.5-flash");
    expect(entry?.effortOptions.map((o) => o.value)).not.toContain("32000");
  });
});
```

**Step 3: Run to verify failure**

Run: `bun run test -- src/lib/extract/providers/catalog.test.ts`
Expected: FAIL — Google entries don't exist, provider option missing, `status` field not defined, etc.

**Step 4: Update `catalog.ts`**

Add `ModelStatus` type definition (near the top of the types):

```ts
export type ModelStatus = "ga" | "preview" | "free-only";
```

Add `status?: ModelStatus` field to `ModelCatalogEntry`:

```ts
export interface ModelCatalogEntry {
  provider: ExtractProviderId;
  model: string;
  label: string;
  auth: "subscription" | "api-key" | "none";
  effortMode: "adaptive" | "budget" | "none";
  effortOptions: EffortOption[];
  defaultEffort: string;
  supportsImages: boolean;
  status?: ModelStatus;
}
```

Add Gemini/Gemma effort option tables near the other effort constants:

```ts
const GEMINI_BUDGET_OPTIONS: EffortOption[] = [
  { value: "0",     label: "No thinking" },
  { value: "8000",  label: "8k tokens" },
  { value: "24000", label: "24k tokens" },
];

const GEMINI_PRO_BUDGET_OPTIONS: EffortOption[] = [
  ...GEMINI_BUDGET_OPTIONS,
  { value: "32000", label: "32k tokens" },
];

const GEMMA_NONE_EFFORT: EffortOption[] = [{ value: "none", label: "None" }];
```

Update `PROVIDER_LABELS`:

```ts
const PROVIDER_LABELS: Record<ExtractProviderId, string> = {
  "claude-code": "Claude Code",
  "openai-codex": "OpenAI Codex",
  "google": "Google",
  mock: "Mock",
};
```

Append the 7 Google entries to `MODEL_CATALOG` (order matters — `gemini-2.5-flash` first):

```ts
  // Google entries — gemini-2.5-flash first so it's the default for getDefaultCatalogEntry("google").
  {
    provider: "google",
    model: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    status: "ga",
    auth: "api-key",
    effortMode: "budget",
    effortOptions: GEMINI_BUDGET_OPTIONS,
    defaultEffort: "0",
    supportsImages: true,
  },
  {
    provider: "google",
    model: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    status: "ga",
    auth: "api-key",
    effortMode: "budget",
    effortOptions: GEMINI_PRO_BUDGET_OPTIONS,
    defaultEffort: "0",
    supportsImages: true,
  },
  {
    provider: "google",
    model: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash-Lite (Preview)",
    status: "preview",
    auth: "api-key",
    effortMode: "budget",
    effortOptions: GEMINI_BUDGET_OPTIONS,
    defaultEffort: "0",
    supportsImages: true,
  },
  {
    provider: "google",
    model: "gemini-3-flash-preview",
    label: "Gemini 3 Flash (Preview)",
    status: "preview",
    auth: "api-key",
    effortMode: "budget",
    effortOptions: GEMINI_BUDGET_OPTIONS,
    defaultEffort: "0",
    supportsImages: true,
  },
  {
    provider: "google",
    model: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (Preview)",
    status: "preview",
    auth: "api-key",
    effortMode: "budget",
    effortOptions: GEMINI_PRO_BUDGET_OPTIONS,
    defaultEffort: "0",
    supportsImages: true,
  },
  {
    provider: "google",
    model: "gemma-4-31b-it",
    label: "Gemma 4 31B",
    status: "free-only",
    auth: "api-key",
    effortMode: "none",
    effortOptions: GEMMA_NONE_EFFORT,
    defaultEffort: "none",
    supportsImages: true,
  },
  {
    provider: "google",
    model: "gemma-4-26b-a4b-it",
    label: "Gemma 4 26B A4B",
    status: "free-only",
    auth: "api-key",
    effortMode: "none",
    effortOptions: GEMMA_NONE_EFFORT,
    defaultEffort: "none",
    supportsImages: true,
  },
```

**Step 5: Run to verify pass**

Run: `bun run test -- src/lib/extract/providers/catalog.test.ts`
Expected: PASS, all tests including new Google tests.

**Step 6: Run full test suite for regression check**

Run: `bun run test`
Expected: all green.

**Do NOT commit.**

---

## Task 4: `google.ts` — pure helper functions

This task establishes the `google.ts` module with the pure (non-SDK-calling) helper functions: system-prompt splitting, effort→thinking-budget mapping, and content-parts preparation that integrates the image resize helper. No actual SDK call yet.

**Files:**
- Create: `src/lib/extract/providers/google.ts`
- Create: `src/lib/extract/providers/google.test.ts`

**Step 1: Write failing tests for pure helpers**

Create `src/lib/extract/providers/google.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import {
  buildSystemPrompt,
  buildThinkingConfig,
  preparePartsForGoogle,
  __testHelpers,
} from "./google";
import type { ProviderContentPart } from "./types";

async function makePngBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 255 } },
  })
    .png()
    .toBuffer();
}

describe("buildSystemPrompt", () => {
  it("returns systemInstruction for gemini models", () => {
    const result = buildSystemPrompt("gemini-2.5-flash", "You are helpful.");
    expect(result).toEqual({ kind: "systemInstruction", value: "You are helpful." });
  });

  it("returns prepend for gemma models", () => {
    const result = buildSystemPrompt("gemma-4-31b-it", "You are helpful.");
    expect(result).toEqual({
      kind: "prepend",
      value: "System instructions:\nYou are helpful.\n\n",
    });
  });

  it("returns systemInstruction for gemini 3.x preview models", () => {
    const result = buildSystemPrompt("gemini-3.1-pro-preview", "sys");
    expect(result.kind).toBe("systemInstruction");
  });
});

describe("buildThinkingConfig", () => {
  it("returns undefined for gemma (effort 'none')", () => {
    expect(buildThinkingConfig("gemma-4-31b-it", "none")).toBeUndefined();
  });

  it("returns thinkingBudget 0 for gemini with effort '0'", () => {
    expect(buildThinkingConfig("gemini-2.5-flash", "0")).toEqual({ thinkingBudget: 0 });
  });

  it("returns thinkingBudget 8000 for gemini with effort '8000'", () => {
    expect(buildThinkingConfig("gemini-2.5-flash", "8000")).toEqual({ thinkingBudget: 8000 });
  });

  it("returns thinkingBudget 32000 for gemini 2.5 pro with effort '32000'", () => {
    expect(buildThinkingConfig("gemini-2.5-pro", "32000")).toEqual({ thinkingBudget: 32000 });
  });
});

describe("preparePartsForGoogle", () => {
  it("passes text parts through unchanged", async () => {
    const parts: ProviderContentPart[] = [{ type: "text", text: "hello" }];
    const out = await preparePartsForGoogle(parts);
    expect(out).toEqual([{ type: "text", text: "hello" }]);
  });

  it("resizes large images and updates mediaType", async () => {
    const buffer = await makePngBuffer(3840, 2160);
    const parts: ProviderContentPart[] = [
      { type: "image", buffer, mediaType: "image/png" },
    ];
    const out = await preparePartsForGoogle(parts);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("image");
    if (out[0].type !== "image") throw new Error("unreachable");
    expect(out[0].prepared.width).toBe(1920);
    expect(out[0].prepared.height).toBe(1080);
    expect(out[0].prepared.mediaType).toBe("image/png");
  });

  it("preserves small images and their mediaType", async () => {
    const buffer = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .jpeg()
      .toBuffer();
    const parts: ProviderContentPart[] = [
      { type: "image", buffer, mediaType: "image/jpeg" },
    ];
    const out = await preparePartsForGoogle(parts);
    if (out[0].type !== "image") throw new Error("unreachable");
    expect(out[0].prepared.buffer).toBe(buffer);
    expect(out[0].prepared.mediaType).toBe("image/jpeg");
  });
});

describe("internal helpers", () => {
  it("isGemma detects gemma- prefix only", () => {
    expect(__testHelpers.isGemma("gemma-4-31b-it")).toBe(true);
    expect(__testHelpers.isGemma("gemini-2.5-flash")).toBe(false);
  });
});
```

**Step 2: Run to verify failure**

Run: `bun run test -- src/lib/extract/providers/google.test.ts`
Expected: FAIL — module doesn't exist.

**Step 3: Implement pure helpers in `google.ts`**

Create `src/lib/extract/providers/google.ts`:

```ts
import sharp from "sharp";
import type { ExtractModelProvider, ProviderContentPart, ProviderTurnInput, ProviderTurnResult } from "./types";
import { resizeForGoogle, type PreparedImage } from "@/lib/extract/google-image-prep";

function isGemma(model: string): boolean {
  return model.startsWith("gemma-");
}

export type SystemPromptOutput =
  | { kind: "systemInstruction"; value: string }
  | { kind: "prepend"; value: string };

export function buildSystemPrompt(model: string, systemPrompt: string): SystemPromptOutput {
  if (isGemma(model)) {
    return { kind: "prepend", value: `System instructions:\n${systemPrompt}\n\n` };
  }
  return { kind: "systemInstruction", value: systemPrompt };
}

export function buildThinkingConfig(model: string, effort: string): { thinkingBudget: number } | undefined {
  if (isGemma(model)) return undefined;
  const budget = Number.parseInt(effort, 10);
  if (!Number.isFinite(budget)) return undefined;
  return { thinkingBudget: budget };
}

export type PreparedPart =
  | { type: "text"; text: string }
  | { type: "image"; prepared: PreparedImage };

export async function preparePartsForGoogle(
  parts: ProviderContentPart[],
): Promise<PreparedPart[]> {
  const out: PreparedPart[] = [];
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

// Placeholder — populated in a later task. Keeps the file exporting the provider shape.
export const googleProvider: ExtractModelProvider = {
  id: "google",
  async run(_input: ProviderTurnInput): Promise<ProviderTurnResult> {
    throw new Error("googleProvider.run not yet implemented");
  },
};

export const __testHelpers = { isGemma };
```

**Step 4: Run to verify pass**

Run: `bun run test -- src/lib/extract/providers/google.test.ts`
Expected: PASS, all pure-helper tests green.

**Do NOT commit.**

---

## Task 5: `google.ts` — streaming call + happy-path integration

This adds the actual `run()` logic that calls `@google/genai`, streams chunks via `onEvent`, assembles the system prompt output, builds `contents` parts, and returns the final `{ text, elapsed, cost, usage }`. Cost calculation is deferred to Task 6 — Task 5 just returns `cost: 0` so the integration test can focus on call shape.

**Files:**
- Modify: `src/lib/extract/providers/google.ts`
- Modify: `src/lib/extract/providers/google.test.ts`

**Step 1: Add failing integration tests**

Append to `src/lib/extract/providers/google.test.ts`. **Note the test-isolation pattern**: we deliberately do NOT import `googleProvider` statically at the top of the file. The top-level `beforeEach` resets the module graph; each test re-imports `./google` so the singleton and env reads are freshly evaluated.

```ts
import type { ProviderTurnInput } from "./types";

// Hoisted mock — see https://vitest.dev/api/vi.html#vi-mock
vi.mock("@google/genai", () => {
  const generateContentStream = vi.fn();
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: { generateContentStream },
    })),
    __streamFn: generateContentStream,
  };
});

vi.mock("./shared", async () => {
  const actual = await vi.importActual<typeof import("./shared")>("./shared");
  return { ...actual, installProxyDispatcherOnce: vi.fn() };
});

// Helper: fresh import of googleProvider after vi.resetModules(), plus a valid
// API key so the happy-path doesn't trip the env check.
async function loadGoogleProviderWithKey() {
  process.env.GEMINI_API_KEY = "test-key";
  const mod = await import("./google");
  return mod.googleProvider;
}

async function* yieldChunks(chunks: Array<{ text?: string; usageMetadata?: unknown }>) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

function baseInput(overrides: Partial<ProviderTurnInput> = {}): ProviderTurnInput {
  return {
    phase: "extract",
    systemPrompt: "You are helpful.",
    userPrompt: "Describe this slide.",
    content: [{ type: "text", text: "Describe this slide." }],
    selection: { provider: "google", model: "gemini-2.5-flash", effort: "0" },
    ...overrides,
  };
}

describe("googleProvider.run — happy path", () => {
  it("streams text chunks and accumulates the final result", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      yieldChunks([
        { text: "Hello " },
        { text: "world." },
        { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } },
      ]),
    );

    const googleProvider = await loadGoogleProviderWithKey();
    const events: Array<{ type: string; text?: string }> = [];
    const result = await googleProvider.run(
      baseInput({ onEvent: (e) => { events.push({ type: e.type, text: e.text }); } }),
    );

    expect(result.text).toBe("Hello world.");
    expect(events).toContainEqual({ type: "text", text: "Hello " });
    expect(events).toContainEqual({ type: "text", text: "world." });
    expect(typeof result.elapsed).toBe("number");
  });

  it("passes systemInstruction for gemini models", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(baseInput());

    expect(streamFn).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.5-flash",
        config: expect.objectContaining({ systemInstruction: "You are helpful." }),
      }),
    );
  });

  it("prepends system prompt into first user text for gemma models", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemma-4-31b-it", effort: "none" } }),
    );

    const call = streamFn.mock.calls[0][0];
    expect(call.config?.systemInstruction).toBeUndefined();
    const firstPart = call.contents[0].parts[0];
    expect(firstPart.text).toBe("System instructions:\nYou are helpful.\n\nDescribe this slide.");
  });

  it("includes thinkingConfig.thinkingBudget from effort for gemini", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemini-2.5-flash", effort: "8000" } }),
    );

    expect(streamFn).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          thinkingConfig: { thinkingBudget: 8000 },
        }),
      }),
    );
  });

  it("omits thinkingConfig for gemma", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemma-4-31b-it", effort: "none" } }),
    );

    const call = streamFn.mock.calls[0][0];
    expect(call.config?.thinkingConfig).toBeUndefined();
  });

  it("builds inlineData parts with the prepared mediaType", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const buffer = await sharp({
      create: { width: 3840, height: 2160, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({
        content: [
          { type: "text", text: "look at this" },
          { type: "image", buffer, mediaType: "image/jpeg" },
        ],
      }),
    );

    const call = streamFn.mock.calls[0][0];
    const imagePart = call.contents[0].parts.find((p: { inlineData?: unknown }) => p.inlineData);
    expect(imagePart.inlineData.mimeType).toBe("image/png"); // was jpeg, got re-encoded
  });

  it("attaches AbortSignal via config.abortSignal (not top-level)", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "ok" }]));

    const controller = new AbortController();
    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(baseInput({ signal: controller.signal }));

    const call = streamFn.mock.calls[0][0];
    expect(call.config?.abortSignal).toBe(controller.signal);
    // Must not be attached at the top level.
    expect((call as { abortSignal?: unknown }).abortSignal).toBeUndefined();
  });

  it("throws AbortError when signal is aborted before first chunk", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(yieldChunks([{ text: "late" }]));

    const controller = new AbortController();
    controller.abort();
    const events: Array<{ type: string; text?: string }> = [];

    const googleProvider = await loadGoogleProviderWithKey();
    await expect(
      googleProvider.run(
        baseInput({
          signal: controller.signal,
          onEvent: (e) => { events.push({ type: e.type, text: e.text }); },
        }),
      ),
    ).rejects.toThrow(/abort/i);

    // No text events should have been emitted.
    expect(events.filter((e) => e.type === "text")).toHaveLength(0);
  });

  it("throws AbortError mid-stream", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();

    const controller = new AbortController();
    async function* aborting() {
      yield { text: "part-1 " };
      controller.abort();
      yield { text: "part-2" };
    }
    streamFn.mockResolvedValue(aborting());

    const googleProvider = await loadGoogleProviderWithKey();
    await expect(
      googleProvider.run(baseInput({ signal: controller.signal })),
    ).rejects.toThrow(/abort/i);
  });
});
```

**Step 2: Run to verify failure**

Run: `bun run test -- src/lib/extract/providers/google.test.ts`
Expected: FAIL — `googleProvider.run not yet implemented`.

**Step 3: Implement `run()` in `google.ts`**

Replace the placeholder `googleProvider` in `google.ts` with:

```ts
import { GoogleGenAI } from "@google/genai";
import { installProxyDispatcherOnce } from "./shared";

let singleton: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (singleton) return singleton;
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set");
  installProxyDispatcherOnce();
  singleton = new GoogleGenAI({ apiKey });
  return singleton;
}

async function runGoogleTurn(input: ProviderTurnInput): Promise<ProviderTurnResult> {
  const { model } = input.selection;
  const client = getClient();

  const systemOut = buildSystemPrompt(model, input.systemPrompt);
  const thinkingConfig = buildThinkingConfig(model, input.selection.effort);
  const prepared = await preparePartsForGoogle(input.content);

  // Build parts for the Gemini content array. For gemma, inject prepend into first text.
  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
  let didPrepend = false;
  for (const part of prepared) {
    if (part.type === "text") {
      let text = part.text;
      if (!didPrepend && systemOut.kind === "prepend") {
        text = systemOut.value + text;
        didPrepend = true;
      }
      parts.push({ text });
    } else {
      parts.push({
        inlineData: {
          data: part.prepared.buffer.toString("base64"),
          mimeType: part.prepared.mediaType,
        },
      });
    }
  }
  // If gemma but no text part existed, prepend as its own first part.
  if (!didPrepend && systemOut.kind === "prepend") {
    parts.unshift({ text: systemOut.value });
  }

  const config: Record<string, unknown> = {};
  if (systemOut.kind === "systemInstruction") {
    config.systemInstruction = systemOut.value;
  }
  if (thinkingConfig) {
    config.thinkingConfig = thinkingConfig;
  }

  const startedAt = Date.now();
  if (input.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  // Attach abort signal via config.abortSignal — @google/genai reads it from
  // there, not from a top-level field. The loop-level check below is a backstop.
  if (input.signal) {
    config.abortSignal = input.signal;
  }
  const stream = await client.models.generateContentStream({
    model,
    contents: [{ role: "user", parts }],
    config: Object.keys(config).length > 0 ? config : undefined,
  });

  let text = "";
  for await (const chunk of stream) {
    if (input.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    const delta = chunk.text ?? "";
    if (!delta) continue;
    text += delta;
    await input.onEvent?.({ type: "text", text: delta });
  }

  return {
    text,
    elapsed: Math.round((Date.now() - startedAt) / 1000),
    cost: 0, // Filled in in Task 6.
    usage: null,
  };
}

export const googleProvider: ExtractModelProvider = {
  id: "google",
  run: runGoogleTurn,
};
```

Remove the old placeholder `googleProvider` constant.

**Step 4: Run to verify pass**

Run: `bun run test -- src/lib/extract/providers/google.test.ts`
Expected: PASS, all happy-path integration tests + the earlier pure-helper tests green.

**Do NOT commit.**

---

## Task 6: `google.ts` — cost calculation with thinking tokens + tiered warning

**Files:**
- Modify: `src/lib/extract/providers/google.ts`
- Modify: `src/lib/extract/providers/google.test.ts`

**Step 1: Add failing cost tests**

Append to `google.test.ts`:

```ts
describe("googleProvider.run — cost calculation", () => {
  function mockStreamWithUsage(usage: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  }) {
    return async function* () {
      yield { text: "answer" };
      yield { usageMetadata: usage };
    };
  }

  it("computes cost for gemini 2.5 flash with thinking tokens", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      mockStreamWithUsage({ promptTokenCount: 1_000_000, candidatesTokenCount: 500_000, thoughtsTokenCount: 200_000 })(),
    );
    const googleProvider = await loadGoogleProviderWithKey();
    const result = await googleProvider.run(baseInput());
    // input: 1M * 0.30 = 0.30; output: (0.5M + 0.2M) * 2.50 = 1.75
    expect(result.cost).toBeCloseTo(2.05, 2);
    expect(result.usage).toEqual({ inputTokens: 1_000_000, outputTokens: 700_000 });
  });

  it("returns zero cost for gemma regardless of usage", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      mockStreamWithUsage({ promptTokenCount: 1_000, candidatesTokenCount: 500, thoughtsTokenCount: 0 })(),
    );
    const googleProvider = await loadGoogleProviderWithKey();
    const result = await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemma-4-31b-it", effort: "none" } }),
    );
    expect(result.cost).toBe(0);
  });

  it("computes cost for gemini 3.1 pro preview", async () => {
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      mockStreamWithUsage({ promptTokenCount: 100_000, candidatesTokenCount: 50_000, thoughtsTokenCount: 20_000 })(),
    );
    const googleProvider = await loadGoogleProviderWithKey();
    const result = await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemini-3.1-pro-preview", effort: "0" } }),
    );
    // input: 0.1M * 2.00 = 0.20; output: (0.05M + 0.02M) * 12.00 = 0.84
    expect(result.cost).toBeCloseTo(1.04, 2);
  });

  it("warns when gemini 2.5 pro exceeds 200K tokens", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      mockStreamWithUsage({ promptTokenCount: 250_000, candidatesTokenCount: 100 })(),
    );
    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemini-2.5-pro", effort: "0" } }),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("gemini-2.5-pro"));
    warn.mockRestore();
  });

  it("warns when gemini 3.1 pro preview exceeds 200K tokens", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      mockStreamWithUsage({ promptTokenCount: 250_000, candidatesTokenCount: 100 })(),
    );
    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(
      baseInput({ selection: { provider: "google", model: "gemini-3.1-pro-preview", effort: "0" } }),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("gemini-3.1-pro-preview"));
    warn.mockRestore();
  });

  it("does not warn for gemini 2.5 flash over 200K tokens (not tiered)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockResolvedValue(
      mockStreamWithUsage({ promptTokenCount: 250_000, candidatesTokenCount: 100 })(),
    );
    const googleProvider = await loadGoogleProviderWithKey();
    await googleProvider.run(baseInput());
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

**Step 2: Run to verify failure**

Run: `bun run test -- src/lib/extract/providers/google.test.ts`
Expected: FAIL — cost is 0, no warnings emitted.

**Step 3: Implement cost calculation**

In `google.ts`, add the rates table at the top (after imports):

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

const TIERED_PRICING_MODELS = new Set<string>([
  "gemini-2.5-pro",
  "gemini-3.1-pro-preview",
]);
```

In `runGoogleTurn`, replace the loop + return with a version that tracks usage:

```ts
  let text = "";
  let lastUsage: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  } | undefined;
  for await (const chunk of stream) {
    const delta = chunk.text ?? "";
    if (delta) {
      text += delta;
      await input.onEvent?.({ type: "text", text: delta });
    }
    if ((chunk as { usageMetadata?: typeof lastUsage }).usageMetadata) {
      lastUsage = (chunk as { usageMetadata?: typeof lastUsage }).usageMetadata;
    }
  }

  const inputTokens = lastUsage?.promptTokenCount ?? 0;
  const outputTokens =
    (lastUsage?.candidatesTokenCount ?? 0) + (lastUsage?.thoughtsTokenCount ?? 0);
  const rate = COST_RATES[model] ?? { input: 0, output: 0 };
  const cost = (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;

  if (inputTokens > 200_000 && TIERED_PRICING_MODELS.has(model)) {
    console.warn(
      `[google-provider] ${model} request >200K context (${inputTokens} tokens). ` +
      `Cost under-reported at tier-1 rates.`,
    );
  }

  return {
    text,
    elapsed: Math.round((Date.now() - startedAt) / 1000),
    cost,
    usage: lastUsage
      ? { inputTokens, outputTokens }
      : null,
  };
```

**Step 4: Run to verify pass**

Run: `bun run test -- src/lib/extract/providers/google.test.ts`
Expected: PASS, all tests green.

**Do NOT commit.**

---

## Task 7: `google.ts` — error mapping

**Files:**
- Modify: `src/lib/extract/providers/google.ts`
- Modify: `src/lib/extract/providers/google.test.ts`

**Step 1: Add failing error-mapping tests**

Append to `google.test.ts`. Note: Each test relies on the `beforeEach(vi.resetModules())` at the top of the file resetting the `google.ts` module singleton so `getClient()` re-reads env (fixes the singleton test-isolation issue):

```ts
describe("googleProvider.run — error mapping", () => {
  it("surfaces missing API key clearly without calling SDK", async () => {
    // Env is deleted by the top-of-file beforeEach; singleton reset by resetModules.
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    const { googleProvider: freshProvider } = await import("./google");
    await expect(freshProvider.run(baseInput())).rejects.toThrow(
      /GEMINI_API_KEY/,
    );
    expect(streamFn).not.toHaveBeenCalled();
  });

  it("maps 429 rate-limit errors to a helpful message", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockRejectedValue(Object.assign(new Error("rate limit"), { status: 429 }));
    const { googleProvider: freshProvider } = await import("./google");
    await expect(freshProvider.run(baseInput())).rejects.toThrow(
      /rate limit|free-tier|paid model/i,
    );
  });

  it("maps RESOURCE_EXHAUSTED 400 to rate-limit message", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockRejectedValue(
      Object.assign(new Error("status 400: RESOURCE_EXHAUSTED: quota exceeded for model"), { status: 400 }),
    );
    const { googleProvider: freshProvider } = await import("./google");
    await expect(freshProvider.run(baseInput())).rejects.toThrow(
      /rate limit|free-tier|paid model/i,
    );
  });

  it("maps token-limit 400 errors to a context-limit message", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockRejectedValue(
      Object.assign(new Error("The input token count (2000000) exceeds the maximum number of tokens allowed"), { status: 400 }),
    );
    const { googleProvider: freshProvider } = await import("./google");
    await expect(freshProvider.run(baseInput())).rejects.toThrow(
      /context limit|token|too large/i,
    );
  });

  it("maps 404 / preview-model-not-found to a deprecation hint", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockRejectedValue(
      Object.assign(new Error("models/gemini-3-flash-preview is not found for API version v1beta"), { status: 404 }),
    );
    const { googleProvider: freshProvider } = await import("./google");
    await expect(
      freshProvider.run(
        baseInput({ selection: { provider: "google", model: "gemini-3-flash-preview", effort: "0" } }),
      ),
    ).rejects.toThrow(/deprecated|replaced|update the catalog/i);
  });

  it("maps connect-timeout errors to a proxy hint", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const mod = await import("@google/genai");
    const streamFn = (mod as unknown as { __streamFn: ReturnType<typeof vi.fn> }).__streamFn;
    streamFn.mockReset();
    streamFn.mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), {
        cause: Object.assign(new Error("Connect Timeout Error"), { code: "UND_ERR_CONNECT_TIMEOUT" }),
      }),
    );
    const { googleProvider: freshProvider } = await import("./google");
    await expect(freshProvider.run(baseInput())).rejects.toThrow(
      /proxy|HTTPS_PROXY/i,
    );
  });
});
```

**Step 2: Run to verify failure**

Run: `bun run test -- src/lib/extract/providers/google.test.ts`
Expected: FAIL — errors pass through unchanged.

**Step 3: Implement error mapping**

In `google.ts`, add a helper:

```ts
function normalizeGoogleError(error: unknown, model: string): Error {
  if (!(error instanceof Error)) {
    return new Error(String(error));
  }
  const status = (error as { status?: number }).status;
  const cause = (error as { cause?: { code?: string } }).cause;
  const msg = error.message;

  // Transport / proxy — check first so a wrapped network error doesn't get
  // misclassified by downstream message regexes.
  if (cause?.code === "UND_ERR_CONNECT_TIMEOUT" || cause?.code === "UND_ERR_SOCKET") {
    return new Error(
      "Cannot reach Google API. If you need a proxy, set HTTPS_PROXY and restart.",
    );
  }

  // 429 or 400 RESOURCE_EXHAUSTED — both surface as quota/rate-limit UX.
  if (status === 429 || /rate.?limit/i.test(msg) || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return new Error(
      "Google free-tier rate limit hit. Wait or switch to a Gemini 2.5/3.x paid model.",
    );
  }

  // 400 token-limit — context exceeded.
  if (status === 400 && /token count|maximum.*tokens|context length/i.test(msg)) {
    return new Error(
      `Request exceeds Google context limit for model ${model}. Reduce input size or switch models.`,
    );
  }

  // 404 or NOT_FOUND — typical for a preview model that was renamed or deprecated.
  if (status === 404 || /not.?found/i.test(msg)) {
    return new Error(
      `Gemini preview model ${model} appears deprecated or replaced. Update the catalog model id.`,
    );
  }

  return error;
}
```

Wrap the `generateContentStream` call in `try/catch` inside `runGoogleTurn` (keep the abort check and signal attachment added in Task 5; model is already in scope):

```ts
  const startedAt = Date.now();
  if (input.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  if (input.signal) {
    config.abortSignal = input.signal;
  }
  let stream;
  try {
    stream = await client.models.generateContentStream({
      model,
      contents: [{ role: "user", parts }],
      config: Object.keys(config).length > 0 ? config : undefined,
    });
  } catch (e) {
    throw normalizeGoogleError(e, model);
  }
```

Wrap the `for await` loop too so rejections inside streaming also go through normalization. AbortErrors should propagate unchanged (so callers can distinguish cancellation from other failures):

```ts
  try {
    for await (const chunk of stream) {
      if (input.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      // ... existing body
    }
  } catch (e) {
    // Let AbortError through untouched so callers can detect cancellation.
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw normalizeGoogleError(e, model);
  }
```

**Step 4: Run to verify pass**

Run: `bun run test -- src/lib/extract/providers/google.test.ts`
Expected: PASS, all tests including error-mapping green.

**Do NOT commit.**

---

## Task 8: Register `googleProvider` in `registry.ts`

**Files:**
- Modify: `src/lib/extract/providers/registry.ts`
- Modify: `src/lib/extract/providers/registry.test.ts`

**Step 1: Add failing test**

Append to `registry.test.ts` (read existing structure first):

```ts
describe("google provider registration", () => {
  it("returns googleProvider for the google selection", () => {
    const provider = getExtractModelProvider({
      provider: "google",
      model: "gemini-2.5-flash",
      effort: "0",
    });
    expect(provider.id).toBe("google");
  });

  it("throws helpful error for unknown google model", () => {
    expect(() =>
      getExtractModelProvider({
        provider: "google",
        model: "does-not-exist",
        effort: "0",
      }),
    ).toThrow(/does-not-exist.*google/);
  });
});
```

**Step 2: Run to verify failure**

Run: `bun run test -- src/lib/extract/providers/registry.test.ts`
Expected: FAIL — `google` not in the `PROVIDERS` map.

**Step 3: Update `registry.ts`**

```ts
import { getCatalogEntriesForProvider } from "./catalog";
import type { ProviderSelection } from "./shared";
import type { ExtractModelProvider } from "./types";
import { claudeCodeProvider } from "./claude-code";
import { openAICodexProvider } from "./openai-codex";
import { googleProvider } from "./google";
import { mockProvider } from "@/lib/extract/mock-provider";

const PROVIDERS: Record<ProviderSelection["provider"], ExtractModelProvider> = {
  "claude-code": claudeCodeProvider,
  "openai-codex": openAICodexProvider,
  "google": googleProvider,
  mock: mockProvider,
};

export function getExtractModelProvider(selection: ProviderSelection): ExtractModelProvider {
  const provider = PROVIDERS[selection.provider];
  if (!provider) {
    throw new Error(`Unknown extract provider: ${selection.provider}`);
  }
  const models = new Set(getCatalogEntriesForProvider(selection.provider).map((entry) => entry.model));
  if (!models.has(selection.model)) {
    throw new Error(`Model ${selection.model} is not available for provider ${selection.provider}`);
  }
  return provider;
}
```

**Step 4: Run to verify pass**

Run: `bun run test -- src/lib/extract/providers/registry.test.ts`
Expected: PASS.

**Step 5: Run full suite**

Run: `bun run test`
Expected: all green.

**Do NOT commit.**

---

## Task 9: Refactor `/api/gemma-detect/route.ts` to use shared helpers

**Files:**
- Modify: `src/app/api/gemma-detect/route.ts`

**Step 1: Read the current route file**

Read the full file. Note the inline `setGlobalDispatcher` + `ProxyAgent` block at the top and the inline 1920px resize block in the POST handler.

**Step 2: Replace inline proxy logic**

Delete this block:

```ts
import { setGlobalDispatcher, ProxyAgent } from "undici";

const proxyUrl =
  process.env.HTTPS_PROXY ??
  process.env.https_proxy ??
  process.env.HTTP_PROXY ??
  process.env.http_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}
```

Replace with:

```ts
import { installProxyDispatcherOnce } from "@/lib/extract/providers/shared";

installProxyDispatcherOnce();
```

**Step 3: Replace inline resize logic**

Delete the block:

```ts
  const MAX_EDGE = 1920;
  const longerEdge = Math.max(imageWidth, imageHeight);
  const sentBuffer =
    longerEdge > MAX_EDGE
      ? await sharp(buffer)
          .resize({
            width: imageWidth >= imageHeight ? MAX_EDGE : undefined,
            height: imageHeight > imageWidth ? MAX_EDGE : undefined,
            fit: "inside",
          })
          .png()
          .toBuffer()
      : buffer;
```

Replace with:

```ts
  const prepared = await resizeForGoogle(
    buffer,
    imageWidth,
    imageHeight,
    file.type || "image/png",
  );
```

Add the import:

```ts
import { resizeForGoogle } from "@/lib/extract/google-image-prep";
```

Update the `generateContentStream` call to use `prepared.buffer` and `prepared.mediaType`:

```ts
          { inlineData: { data: prepared.buffer.toString("base64"), mimeType: prepared.mediaType } },
```

**Step 4: Manual verification via dev server**

Start the dev server with the proxy (keep user env) and verify `/workbench/gemma-test` still works end-to-end:

Run: `HTTPS_PROXY=http://127.0.0.1:7897 bun run dev`
Open: `http://localhost:3000/workbench/gemma-test`
Paste a slide screenshot, click Run.
Expected: Bboxes render as before. No regressions.

If the server logs show any error related to the refactor, stop and fix.

**Step 5: Run unit tests for sanity**

Run: `bun run test`
Expected: all green.

**Do NOT commit.**

---

## Task 10: End-to-end refine loop verification

This task has no code changes — it's the acceptance check for the full provider integration.

**Step 1: Ensure dev server is running with env**

```bash
HTTPS_PROXY=http://127.0.0.1:7897 bun run dev
```

`GEMINI_API_KEY` must be in shell env. Verify with `echo $GEMINI_API_KEY`.

**Step 2: Visit `/workbench/extract`**

Open `http://localhost:3000/workbench/extract`. Upload a slide screenshot. The model selector should now include "Google" as a provider with 7 model entries.

**Step 3: Run analyze + refine with `gemini-2.5-flash`**

Select Google → Gemini 2.5 Flash → effort 0. Run analyze. Wait for the refine loop to iterate at least once.

Expected:
- Streaming text appears in the workbench log panel.
- Usage + cost appear in the result metadata (cost should be non-zero, reasonable — under $0.01 for a small slide).
- No errors.

**Step 4: Run again with `gemini-3.1-pro-preview`**

Same flow, but select Gemini 3.1 Pro Preview. Confirm it works end-to-end. Cost will be notably higher (~10-30× of Flash).

**Step 5: Run once with `gemma-4-31b-it`**

Select Gemma 4 31B. Expect either a successful run (if free-tier quota allows) or the "rate limit hit" message from our error mapper. Both are acceptable — we've verified the path works.

**Step 6: Report back**

Summarize:
- Which models actually succeeded end-to-end
- Any error messages encountered and whether they matched the error-mapping spec
- Cost numbers observed for a reference slide

**Do NOT commit.**

---

## Done when

- All 10 tasks executed, test suite green.
- `/workbench/gemma-test` behavior unchanged (refactor regression check passes).
- `/workbench/extract` end-to-end succeeds with at least `gemini-2.5-flash`.
- Working tree has:
  - Modified: `shared.ts`, `catalog.ts`, `catalog.test.ts`, `registry.ts`, `registry.test.ts`, `src/app/api/gemma-detect/route.ts`
  - Created: `shared.test.ts`, `google.ts`, `google.test.ts`, `google-image-prep.ts`, `google-image-prep.test.ts`
- No commits. User batches into one squashed commit.
