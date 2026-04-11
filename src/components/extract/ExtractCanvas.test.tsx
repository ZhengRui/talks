import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { StoreApi } from "zustand/vanilla";
import { createExtractStore, type ExtractState } from "./store";

let testStore: StoreApi<ExtractState>;
let testCardId = "";

const mockObjectUrl = vi.fn(() => "blob:mock-url");
const mockRevokeObjectUrl = vi.fn();

vi.mock("./CanvasViewport", () => ({
  default: () => <div data-testid="canvas-viewport">viewport</div>,
}));

vi.mock("./CanvasToolbar", () => ({
  default: () => <div data-testid="canvas-toolbar" />,
}));

vi.mock("./BenchmarkLauncher", () => ({
  default: ({
    onRun,
  }: {
    open: boolean;
    onClose: () => void;
    onRun: (slug: string, slideIndex: number) => Promise<void>;
  }) => (
    <button onClick={() => void onRun("demo", 1)}>Benchmark</button>
  ),
}));

vi.mock("./InspectorPanel", () => ({
  default: ({
    onAnalyze,
    onRefine,
  }: {
    onAnalyze: (id: string) => void;
    onRefine: (id: string, maxIterations?: number) => void;
    onCancelRefine: (id: string) => void;
  }) => (
    <div data-testid="inspector-panel">
      <button onClick={() => onAnalyze(testCardId)}>Analyze</button>
      <button onClick={() => onRefine(testCardId, 1)}>Refine</button>
    </div>
  ),
}));

vi.mock("./YamlModal", () => ({
  default: () => <div data-testid="yaml-modal" />,
}));


vi.mock("./store", async () => {
  const actual =
    await vi.importActual<typeof import("./store")>("./store");
  const hook = (selector?: (state: ExtractState) => unknown) => {
    const state = testStore.getState();
    return selector ? selector(state) : state;
  };
  hook.getState = () => testStore.getState();
  hook.store = () => ({ getState: () => testStore.getState() });
  return {
    ...actual,
    useExtractStore: hook,
  };
});

import ExtractCanvas from "./ExtractCanvas";

function makeFile(name = "slide.png"): File {
  return new File(["fake"], name, { type: "image/png" });
}

function makeProposal(name: string, body: string) {
  return {
    scope: "slide" as const,
    name,
    description: name,
    region: { x: 0, y: 0, w: 1280, h: 720 },
    params: {},
    style: {},
    body,
  };
}

function seedAnalyzedCard(): string {
  const id = testStore.getState().addCard(makeFile("test-slide.png"));
  testStore.getState().completeAnalysis(id, {
    source: {
      image: "data:image/png;base64,abc",
      dimensions: { w: 1280, h: 720 },
    },
    provenance: {
      pass1: { provider: "claude-code", model: "claude-opus-4-6", effort: "low" },
    },
    proposals: [
      makeProposal("extract-preview", "mode: scene\nchildren: []"),
    ],
  });
  return id;
}

function makeSseResponse(
  events: Array<{ event: string; data: Record<string, unknown> }>,
): Response {
  const encoder = new TextEncoder();
  const payload = events
    .map(
      ({ event, data }) =>
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
    )
    .join("");
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

describe("ExtractCanvas", () => {
  beforeEach(() => {
    testStore = createExtractStore();
    testCardId = seedAnalyzedCard();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "/api/extract/refine") {
          return makeSseResponse([
            {
              event: "refine:start",
              data: {
                iteration: 0,
                maxIterations: 3,
                visionModel: "claude-opus-4-6",
                visionEffort: "medium",
                editModel: "claude-opus-4-6",
                editEffort: "medium",
                mismatchThreshold: 0.05,
              },
            },
            {
              event: "refine:diff",
              data: {
                iteration: 0,
                mismatchRatio: 0.69,
                diffArtifactUrl: "/api/extract/refine/artifacts/initial",
                regions: [],
              },
            },
            {
              event: "refine:vision:start",
              data: { iteration: 1 },
            },
            {
              event: "refine:vision:prompt",
              data: {
                iteration: 1,
                phase: "vision",
                systemPrompt: "vision system prompt",
                userPrompt: "vision user prompt",
                model: "claude-opus-4-6",
                effort: "medium",
              },
            },
            {
              event: "refine:vision:text",
              data: { text: "1. Title is too large." },
            },
            {
              event: "refine:vision:done",
              data: { differences: "1. Title is too large.", cost: 0, elapsed: 0 },
            },
            {
              event: "refine:edit:start",
              data: { iteration: 1 },
            },
            {
              event: "refine:edit:prompt",
              data: {
                iteration: 1,
                phase: "edit",
                systemPrompt: "edit system prompt",
                userPrompt: "edit user prompt",
                model: "claude-opus-4-6",
                effort: "medium",
              },
            },
            {
              event: "refine:edit:text",
              data: { text: "[{\"scope\":\"slide\"}]" },
            },
            {
              event: "refine:edit:done",
              data: { cost: 0, elapsed: 0 },
            },
            {
              event: "refine:diff",
              data: {
                iteration: 1,
                mismatchRatio: 0.67,
                diffArtifactUrl: "/api/extract/refine/artifacts/iter-1",
                regions: [],
              },
            },
            {
              event: "refine:patch",
              data: {
                iteration: 1,
                accepted: true,
                proposals: [
                  makeProposal(
                    "refined-preview",
                    "mode: scene\nchildren:\n  - kind: text\n    text: changed",
                  ),
                ],
              },
            },
            {
              event: "refine:complete",
              data: {
                iteration: 1,
                mismatchRatio: 0.67,
                accepted: true,
              },
            },
            {
              event: "refine:done",
              data: {
                finalIteration: 1,
                mismatchRatio: 0.67,
                converged: false,
                proposals: [
                  makeProposal(
                    "refined-preview",
                    "mode: scene\nchildren:\n  - kind: text\n    text: changed",
                  ),
                ],
              },
            },
          ]);
        }
        if (url.startsWith("/api/extract/refine/artifacts/")) {
          return new Response(new Blob(["artifact"], { type: "image/png" }), {
            status: 200,
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    Object.defineProperty(URL, "createObjectURL", {
      value: mockObjectUrl,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: mockRevokeObjectUrl,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders viewport and inspector panel", () => {
    const { getByTestId } = render(<ExtractCanvas />);

    expect(getByTestId("canvas-viewport")).toBeDefined();
    expect(getByTestId("inspector-panel")).toBeDefined();
  });

  it("has the correct root layout class", () => {
    const { container } = render(<ExtractCanvas />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain("fixed");
    expect(root.className).toContain("inset-0");
  });

  it("creates benchmark cards without auto-starting analysis", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "/api/extract/benchmark/load") {
          return new Response(
            JSON.stringify({
              slug: "demo",
              title: "Demo Deck",
              slideIndex: 1,
              label: "demo slide 1",
              fileName: "demo-slide-1.png",
              mimeType: "image/png",
              width: 1280,
              height: 720,
              imageDataUrl: "data:image/png;base64,ZmFrZQ==",
              geometryHints: {
                source: "layout",
                canvas: { w: 1280, h: 720 },
                elements: [],
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { getByText } = render(<ExtractCanvas />);

    fireEvent.click(getByText("Benchmark"));

    await waitFor(() => {
      expect(testStore.getState().cards.size).toBe(3);
    });

    const cards = Array.from(testStore.getState().cards.values());
    const controlCard = cards.find((card) => card.label.includes("control"));
    const coordsCard = cards.find((card) => card.label.includes("coords"));

    expect(controlCard?.status).toBe("idle");
    expect(coordsCard?.status).toBe("idle");
    expect(controlCard?.geometryHints).toBeNull();
    expect(coordsCard?.geometryHints?.source).toBe("layout");
  });

  it("captures the extract system and user prompts from the analyze result fallback", async () => {
    testStore.getState().setAutoRefine(false);

    class MockImage {
      naturalWidth = 1280;
      naturalHeight = 720;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      _src = "";

      get src() {
        return this._src;
      }

      set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal("Image", MockImage);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "/api/extract/analyze") {
          return makeSseResponse([
            {
              event: "result",
              data: {
                source: {
                  image: "data:image/png;base64,abc",
                  dimensions: { w: 1280, h: 720 },
                },
                prompt: {
                  phase: "extract",
                  systemPrompt: "extract system prompt",
                  userPrompt: "extract user prompt",
                  model: "claude-opus-4-6",
                  effort: "medium",
                },
                provenance: {
                  pass1: {
                    provider: "claude-code",
                    model: "claude-opus-4-6",
                    effort: "medium",
                    elapsed: 1,
                    cost: 0.01,
                  },
                },
                proposals: [
                  makeProposal("extract-preview", "mode: scene\nchildren: []"),
                ],
              },
            },
          ]);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { getByText } = render(<ExtractCanvas />);

    fireEvent.click(getByText("Analyze"));

    await waitFor(() => {
      expect(testStore.getState().cards.get(testCardId)?.promptHistory).toEqual([
        {
          stage: "extract",
          phase: "extract",
          iteration: null,
          systemPrompt: "extract system prompt",
          userPrompt: "extract user prompt",
          model: "claude-opus-4-6",
          effort: "medium",
          timestamp: expect.any(Number),
        },
      ]);
    });
  });

  it("surfaces an error when the analyze stream ends without a result event", async () => {
    testStore.getState().setAutoRefine(false);

    class MockImage {
      naturalWidth = 1280;
      naturalHeight = 720;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      _src = "";

      get src() {
        return this._src;
      }

      set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal("Image", MockImage);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "/api/extract/analyze") {
          return makeSseResponse([]);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { getByText } = render(<ExtractCanvas />);

    fireEvent.click(getByText("Analyze"));

    await waitFor(() => {
      const card = testStore.getState().cards.get(testCardId)!;
      expect(card.status).toBe("error");
      expect(card.error).toBe("Analysis stream ended before a result or error was returned.");
      expect(card.log).toContainEqual(
        expect.objectContaining({
          type: "error",
          content: "Analysis stream ended before a result or error was returned.",
          stage: "extract",
        }),
      );
    });
  });

  it("keeps the visible analyze error short and logs raw model output separately", async () => {
    testStore.getState().setAutoRefine(false);

    class MockImage {
      naturalWidth = 1280;
      naturalHeight = 720;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      _src = "";

      get src() {
        return this._src;
      }

      set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal("Image", MockImage);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "/api/extract/analyze") {
          return makeSseResponse([
            {
              event: "error",
              data: {
                error: "Model returned invalid JSON.",
                raw: "{\"ok\":true}\nTrailing explanation",
                stage: "extract",
              },
            },
          ]);
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { getByText } = render(<ExtractCanvas />);

    fireEvent.click(getByText("Analyze"));

    await waitFor(() => {
      const card = testStore.getState().cards.get(testCardId)!;
      expect(card.status).toBe("error");
      expect(card.error).toBe("Model returned invalid JSON.");
      expect(card.log).toContainEqual(
        expect.objectContaining({
          type: "tool_result",
          content: expect.stringContaining("Raw model output preview:"),
          stage: "extract",
        }),
      );
    });
  });

  it("applies an accepted refine iteration to store state", async () => {
    const { getByText } = render(<ExtractCanvas />);

    fireEvent.click(getByText("Refine"));

    await waitFor(() => {
      const card = testStore.getState().cards.get(testCardId)!;
      expect(card.refineAnalysis?.proposals[0]?.name).toBe("refined-preview");
      expect(card.refineStartMismatch).toBe(0.69);
      expect(card.refineResult?.iteration).toBe(1);
      expect(card.refineResult?.mismatchRatio).toBe(0.67);
      expect(card.refineHistory).toHaveLength(1);
      expect(card.refineStatus).toBe("done");
      expect(card.promptHistory).toEqual([
        {
          stage: "refine",
          phase: "vision",
          iteration: 1,
          systemPrompt: "vision system prompt",
          userPrompt: "vision user prompt",
          model: "claude-opus-4-6",
          effort: "medium",
          timestamp: expect.any(Number),
        },
        {
          stage: "refine",
          phase: "edit",
          iteration: 1,
          systemPrompt: "edit system prompt",
          userPrompt: "edit user prompt",
          model: "claude-opus-4-6",
          effort: "medium",
          timestamp: expect.any(Number),
        },
      ]);
    });
  });

  it("still applies accepted proposals when the iteration diff event is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "/api/extract/refine") {
          return makeSseResponse([
            {
              event: "refine:start",
              data: {
                iteration: 0,
                maxIterations: 3,
                visionModel: "claude-opus-4-6",
                visionEffort: "medium",
                editModel: "claude-opus-4-6",
                editEffort: "medium",
                mismatchThreshold: 0.05,
              },
            },
            {
              event: "refine:diff",
              data: {
                iteration: 0,
                mismatchRatio: 0.69,
                diffArtifactUrl: "/api/extract/refine/artifacts/initial",
                regions: [],
              },
            },
            {
              event: "refine:vision:start",
              data: { iteration: 1 },
            },
            {
              event: "refine:vision:text",
              data: { text: "1. Title is too large." },
            },
            {
              event: "refine:vision:done",
              data: { differences: "1. Title is too large.", cost: 0, elapsed: 0 },
            },
            {
              event: "refine:edit:start",
              data: { iteration: 1 },
            },
            {
              event: "refine:edit:text",
              data: { text: "[{\"scope\":\"slide\"}]" },
            },
            {
              event: "refine:edit:done",
              data: { cost: 0, elapsed: 0 },
            },
            {
              event: "refine:patch",
              data: {
                iteration: 1,
                accepted: true,
                proposals: [
                  makeProposal(
                    "refined-preview",
                    "mode: scene\nchildren:\n  - kind: text\n    text: changed",
                  ),
                ],
              },
            },
            {
              event: "refine:complete",
              data: {
                iteration: 1,
                mismatchRatio: 0.67,
                accepted: true,
              },
            },
            {
              event: "refine:done",
              data: {
                finalIteration: 1,
                mismatchRatio: 0.67,
                converged: false,
                proposals: [
                  makeProposal(
                    "refined-preview",
                    "mode: scene\nchildren:\n  - kind: text\n    text: changed",
                  ),
                ],
              },
            },
          ]);
        }
        if (url.startsWith("/api/extract/refine/artifacts/")) {
          return new Response(new Blob(["artifact"], { type: "image/png" }), {
            status: 200,
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { getByText } = render(<ExtractCanvas />);

    fireEvent.click(getByText("Refine"));

    await waitFor(() => {
      const card = testStore.getState().cards.get(testCardId)!;
      expect(card.refineAnalysis?.proposals[0]?.name).toBe("refined-preview");
      expect(card.refineStartMismatch).toBe(0.69);
      expect(card.refineResult?.iteration).toBe(1);
      expect(card.refineResult?.mismatchRatio).toBe(0.67);
      expect(card.refineHistory).toHaveLength(1);
    });
  });

  it("continues manual refinement with cumulative iteration state", async () => {
    const refineRequests: FormData[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/extract/refine") {
          refineRequests.push(init?.body as FormData);
          const refineCall = refineRequests.length;

          return makeSseResponse(
            refineCall === 1
              ? [
                  {
                    event: "refine:start",
                    data: {
                      iteration: 0,
                      maxIterations: 1,
                      visionModel: "claude-opus-4-6",
                      visionEffort: "medium",
                      editModel: "claude-opus-4-6",
                      editEffort: "medium",
                      mismatchThreshold: 0.05,
                    },
                  },
                  {
                    event: "refine:diff",
                    data: {
                      iteration: 0,
                      mismatchRatio: 0.69,
                      diffArtifactUrl: "/api/extract/refine/artifacts/initial",
                      regions: [],
                    },
                  },
                  {
                    event: "refine:vision:start",
                    data: { iteration: 1 },
                  },
                  {
                    event: "refine:vision:text",
                    data: { text: "1. Title is too large." },
                  },
                  {
                    event: "refine:vision:done",
                    data: {
                      differences: "1. Title is too large.",
                      fidelityIssuesJson: '[{"priority":1,"issueId":"title.scale","category":"layout","ref":"title","area":"title","issue":"title is too large","fixType":"style_adjustment","observed":"Replica title feels oversized.","desired":"Original title should feel smaller.","confidence":0.9,"salience":"important"}]',
                      designQualityIssuesJson: "[]",
                      watchlistIssuesJson: '{"fidelityWatchlist":[{"priority":1,"issueId":"title.scale","category":"layout","ref":"title","area":"title","issue":"title is too large","fixType":"style_adjustment","observed":"Replica title feels oversized.","desired":"Original title should feel smaller.","confidence":0.9,"salience":"important"}],"designQualityWatchlist":[]}',
                      cost: 0,
                      elapsed: 0,
                    },
                  },
                  {
                    event: "refine:edit:start",
                    data: { iteration: 1 },
                  },
                  {
                    event: "refine:edit:text",
                    data: { text: "[{\"scope\":\"slide\"}]" },
                  },
                  {
                    event: "refine:edit:done",
                    data: { cost: 0, elapsed: 0 },
                  },
                  {
                    event: "refine:diff",
                    data: {
                      iteration: 1,
                      mismatchRatio: 0.67,
                      diffArtifactUrl: "/api/extract/refine/artifacts/iter-1",
                      regions: [],
                    },
                  },
                  {
                    event: "refine:patch",
                    data: {
                      iteration: 1,
                      proposals: [
                        makeProposal(
                          "refined-preview-1",
                          "mode: scene\nchildren:\n  - kind: text\n    text: changed once",
                        ),
                      ],
                    },
                  },
                  {
                    event: "refine:complete",
                    data: {
                      iteration: 1,
                      mismatchRatio: 0.67,
                    },
                  },
                  {
                    event: "refine:done",
                    data: {
                      finalIteration: 1,
                      mismatchRatio: 0.67,
                      converged: false,
                      proposals: [
                        makeProposal(
                          "refined-preview-1",
                          "mode: scene\nchildren:\n  - kind: text\n    text: changed once",
                        ),
                      ],
                    },
                  },
                ]
              : [
                  {
                    event: "refine:start",
                    data: {
                      iteration: 1,
                      maxIterations: 2,
                      visionModel: "claude-opus-4-6",
                      visionEffort: "medium",
                      editModel: "claude-opus-4-6",
                      editEffort: "medium",
                      mismatchThreshold: 0.05,
                    },
                  },
                  {
                    event: "refine:diff",
                    data: {
                      iteration: 1,
                      mismatchRatio: 0.67,
                      diffArtifactUrl: "/api/extract/refine/artifacts/iter-1-baseline",
                      regions: [],
                    },
                  },
                  {
                    event: "refine:vision:start",
                    data: { iteration: 2 },
                  },
                  {
                    event: "refine:vision:text",
                    data: { text: "1. Title is too large." },
                  },
                  {
                    event: "refine:vision:done",
                    data: {
                      differences: "1. Title is too large.",
                      fidelityIssuesJson: '[{"priority":1,"issueId":"title.scale","category":"layout","ref":"title","area":"title","issue":"title is too large","fixType":"style_adjustment","observed":"Replica title feels oversized.","desired":"Original title should feel smaller.","confidence":0.9,"salience":"important"}]',
                      designQualityIssuesJson: "[]",
                      cost: 0,
                      elapsed: 0,
                    },
                  },
                  {
                    event: "refine:edit:start",
                    data: { iteration: 2 },
                  },
                  {
                    event: "refine:edit:text",
                    data: { text: "[{\"scope\":\"slide\"}]" },
                  },
                  {
                    event: "refine:edit:done",
                    data: { cost: 0, elapsed: 0 },
                  },
                  {
                    event: "refine:diff",
                    data: {
                      iteration: 2,
                      mismatchRatio: 0.61,
                      diffArtifactUrl: "/api/extract/refine/artifacts/iter-2",
                      regions: [],
                    },
                  },
                  {
                    event: "refine:patch",
                    data: {
                      iteration: 2,
                      proposals: [
                        makeProposal(
                          "refined-preview-2",
                          "mode: scene\nchildren:\n  - kind: text\n    text: changed twice",
                        ),
                      ],
                    },
                  },
                  {
                    event: "refine:complete",
                    data: {
                      iteration: 2,
                      mismatchRatio: 0.61,
                    },
                  },
                  {
                    event: "refine:done",
                    data: {
                      finalIteration: 2,
                      mismatchRatio: 0.61,
                      converged: false,
                      proposals: [
                        makeProposal(
                          "refined-preview-2",
                          "mode: scene\nchildren:\n  - kind: text\n    text: changed twice",
                        ),
                      ],
                    },
                  },
                ],
          );
        }
        if (url.startsWith("/api/extract/refine/artifacts/")) {
          return new Response(new Blob(["artifact"], { type: "image/png" }), {
            status: 200,
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { getByText } = render(<ExtractCanvas />);

    fireEvent.click(getByText("Refine"));

    await waitFor(() => {
      const card = testStore.getState().cards.get(testCardId)!;
      expect(card.refineIteration).toBe(1);
      expect(card.refineMaxIterations).toBe(1);
      expect(card.refineAnalysis?.proposals[0]?.name).toBe("refined-preview-1");
    });

    fireEvent.click(getByText("Refine"));

    await waitFor(() => {
      const card = testStore.getState().cards.get(testCardId)!;
      expect(card.refineIteration).toBe(2);
      expect(card.refineMaxIterations).toBe(2);
      expect(card.refineAnalysis?.proposals[0]?.name).toBe("refined-preview-2");
      expect(card.refineHistory).toHaveLength(2);
      expect(card.log.some((entry) => entry.content.includes("Iter 2"))).toBe(true);
    });

    expect(refineRequests).toHaveLength(2);
    expect(refineRequests[0].get("maxIterations")).toBe("1");
    expect(refineRequests[0].get("iterationOffset")).toBe("0");
    expect(refineRequests[0].get("forceIterations")).toBe("1");
    expect(refineRequests[0].get("watchlistIssuesJson")).toBeNull();
    expect(refineRequests[1].get("maxIterations")).toBe("1");
    expect(refineRequests[1].get("iterationOffset")).toBe("1");
    expect(refineRequests[1].get("forceIterations")).toBe("1");
    expect(refineRequests[1].get("watchlistIssuesJson")).toBe(
      '{"fidelityWatchlist":[{"priority":1,"issueId":"title.scale","category":"layout","ref":"title","area":"title","issue":"title is too large","fixType":"style_adjustment","observed":"Replica title feels oversized.","desired":"Original title should feel smaller.","confidence":0.9,"salience":"important"}],"designQualityWatchlist":[]}',
    );
  });

  it("sends raw proposals to refine while keeping baseAnalysis and contentBounds in normalized image space", async () => {
    testStore.getState().startAnalysis(testCardId);
    testStore.getState().completeAnalysis(testCardId, {
      source: {
        image: "data:image/png;base64,abc",
        dimensions: { w: 1456, h: 818 },
        contentBounds: { x: 0, y: 0, w: 1456, h: 818 },
      },
      provenance: {
        pass1: { provider: "claude-code", model: "claude-opus-4-6", effort: "low" },
      },
      proposals: [
        {
          ...makeProposal("extract-preview", "sourceSize: { w: 1456, h: 818 }\nchildren: []"),
          region: { x: 0, y: 0, w: 1456, h: 818 },
          params: {
            proxies: {
              type: "array",
              value: [{ x: 648, y: 248, lineEndX: 728, lineEndY: 378 }],
            },
          },
        },
      ],
      normalizedAnalysis: {
        source: {
          image: "data:image/png;base64,abc",
          dimensions: { w: 1920, h: 1080 },
          reportedDimensions: { w: 1456, h: 818 },
          contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
        },
        proposals: [
          {
            ...makeProposal("extract-preview", "sourceSize: { w: 1456, h: 818 }\nchildren: []"),
            region: { x: 0, y: 0, w: 1920, h: 1080 },
            params: {
              proxies: {
                type: "array",
                value: [{ x: 648, y: 248, lineEndX: 728, lineEndY: 378 }],
              },
            },
          },
        ],
      },
    });

    const refineRequests: FormData[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/extract/refine") {
          refineRequests.push(init?.body as FormData);
          return makeSseResponse([
            {
              event: "refine:start",
              data: {
                iteration: 0,
                maxIterations: 1,
                visionModel: "claude-opus-4-6",
                visionEffort: "medium",
                editModel: "claude-opus-4-6",
                editEffort: "medium",
                mismatchThreshold: 0.05,
              },
            },
            {
              event: "refine:diff",
              data: {
                iteration: 0,
                mismatchRatio: 0.11,
                diffArtifactUrl: "/api/extract/refine/artifacts/initial",
                regions: [],
              },
            },
            {
              event: "refine:done",
              data: {
                finalIteration: 0,
                mismatchRatio: 0.11,
                converged: false,
                proposals: [],
              },
            },
          ]);
        }
        if (url.startsWith("/api/extract/refine/artifacts/")) {
          return new Response(new Blob(["artifact"], { type: "image/png" }), {
            status: 200,
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { getByText } = render(<ExtractCanvas />);

    fireEvent.click(getByText("Refine"));

    await waitFor(() => {
      expect(refineRequests).toHaveLength(1);
    });

    const request = refineRequests[0]!;
    const sentProposals = JSON.parse(request.get("proposals") as string) as Array<{
      region: { w: number; h: number };
      params: { proxies: { value: Array<{ x: number; y: number }> } };
      body: string;
    }>;
    const sentBaseAnalysis = JSON.parse(request.get("baseAnalysis") as string) as {
      source: {
        dimensions: { w: number; h: number };
        reportedDimensions?: { w: number; h: number };
        contentBounds?: { w: number; h: number };
      };
    };
    const sentContentBounds = JSON.parse(request.get("contentBounds") as string) as {
      w: number;
      h: number;
    };

    expect(sentProposals[0]?.region).toEqual({ x: 0, y: 0, w: 1456, h: 818 });
    expect(sentProposals[0]?.params.proxies.value[0]).toMatchObject({ x: 648, y: 248 });
    expect(sentProposals[0]?.body).toContain("1456");
    expect(sentBaseAnalysis.source.dimensions).toEqual({ w: 1920, h: 1080 });
    expect(sentBaseAnalysis.source.reportedDimensions).toEqual({ w: 1456, h: 818 });
    expect(sentBaseAnalysis.source.contentBounds).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
    expect(sentContentBounds).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  });

  it("uses the card's snapped refine settings instead of the current global settings", async () => {
    testStore.getState().setRefineVisionModel("claude-opus-4-6");
    testStore.getState().setRefineVisionEffort("low");
    testStore.getState().setRefineEditModel("claude-sonnet-4-6");
    testStore.getState().setRefineEditEffort("high");
    testStore.getState().startAnalysis(testCardId);
    testStore.getState().completeAnalysis(testCardId, {
      source: {
        image: "data:image/png;base64,abc",
        dimensions: { w: 1280, h: 720 },
      },
      provenance: {
        pass1: {
          provider: "claude-code",
          model: "claude-opus-4-6",
          effort: "low",
          elapsed: 1,
          cost: 0.01,
        },
      },
      proposals: [
        makeProposal("extract-preview", "mode: scene\nchildren: []"),
      ],
    });

    expect(testStore.getState().cards.get(testCardId)?.refinePass).toMatchObject({
      vision: {
        provider: "claude-code",
        model: "claude-opus-4-6",
        effort: "low",
      },
      edit: {
        provider: "claude-code",
        model: "claude-sonnet-4-6",
        effort: "high",
      },
      visionModel: "claude-opus-4-6",
      visionEffort: "low",
      editModel: "claude-sonnet-4-6",
      editEffort: "high",
    });

    testStore.getState().setRefineEditEffort("medium");

    const refineRequests: FormData[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/extract/refine") {
          refineRequests.push(init?.body as FormData);
          return makeSseResponse([
            {
              event: "refine:start",
              data: {
                iteration: 0,
                maxIterations: 1,
                visionModel: "claude-opus-4-6",
                visionEffort: "low",
                editModel: "claude-sonnet-4-6",
                editEffort: "high",
                mismatchThreshold: 0.05,
              },
            },
            {
              event: "refine:diff",
              data: {
                iteration: 0,
                mismatchRatio: 0.69,
                diffArtifactUrl: "/api/extract/refine/artifacts/initial",
                regions: [],
              },
            },
            {
              event: "refine:vision:start",
              data: { iteration: 1 },
            },
            {
              event: "refine:vision:text",
              data: { text: "1. Title is too large." },
            },
            {
              event: "refine:vision:done",
              data: { differences: "1. Title is too large.", cost: 0, elapsed: 0 },
            },
            {
              event: "refine:edit:start",
              data: { iteration: 1 },
            },
            {
              event: "refine:edit:text",
              data: { text: "[{\"scope\":\"slide\"}]" },
            },
            {
              event: "refine:edit:done",
              data: { cost: 0, elapsed: 0 },
            },
            {
              event: "refine:diff",
              data: {
                iteration: 1,
                mismatchRatio: 0.67,
                diffArtifactUrl: "/api/extract/refine/artifacts/iter-1",
                regions: [],
              },
            },
            {
              event: "refine:patch",
              data: {
                iteration: 1,
                proposals: [
                  makeProposal(
                    "refined-preview",
                    "mode: scene\nchildren:\n  - kind: text\n    text: changed",
                  ),
                ],
              },
            },
            {
              event: "refine:complete",
              data: {
                iteration: 1,
                mismatchRatio: 0.67,
              },
            },
            {
              event: "refine:done",
              data: {
                finalIteration: 1,
                mismatchRatio: 0.67,
                converged: false,
                proposals: [
                  makeProposal(
                    "refined-preview",
                    "mode: scene\nchildren:\n  - kind: text\n    text: changed",
                  ),
                ],
              },
            },
          ]);
        }
        if (url.startsWith("/api/extract/refine/artifacts/")) {
          return new Response(new Blob(["artifact"], { type: "image/png" }), {
            status: 200,
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    const { getByText } = render(<ExtractCanvas />);

    fireEvent.click(getByText("Refine"));

    await waitFor(() => {
      expect(refineRequests).toHaveLength(1);
    });

    expect(refineRequests[0].get("visionModel")).toBe("claude-opus-4-6");
    expect(refineRequests[0].get("visionEffort")).toBe("low");
    expect(refineRequests[0].get("editModel")).toBe("claude-sonnet-4-6");
    expect(refineRequests[0].get("editEffort")).toBe("high");
  });
});
