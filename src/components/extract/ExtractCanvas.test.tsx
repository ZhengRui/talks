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
    testCardId = testStore.getState().addCard(makeFile("test-slide.png"));
    testStore.getState().completeAnalysis(testCardId, {
      source: {
        image: "data:image/png;base64,abc",
        dimensions: { w: 1280, h: 720 },
      },
      provenance: {
        pass1: { model: "claude-opus-4-6", effort: "low" },
      },
      proposals: [
        makeProposal("extract-preview", "mode: scene\nchildren: []"),
      ],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url === "/api/extract/refine") {
          return makeSseResponse([
            {
              event: "refine:start",
              data: { maxIterations: 3 },
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
              data: { maxIterations: 3 },
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
                    data: { iteration: 0, maxIterations: 1 },
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
                    data: { iteration: 1, maxIterations: 2 },
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
    expect(refineRequests[1].get("maxIterations")).toBe("1");
    expect(refineRequests[1].get("iterationOffset")).toBe("1");
    expect(refineRequests[1].get("forceIterations")).toBe("1");
  });

  it("uses the card's snapped refine settings instead of the current global settings", async () => {
    testStore.getState().setRefineModel("claude-opus-4-6");
    testStore.getState().setRefineEffort("low");
    testStore.getState().startAnalysis(testCardId);
    testStore.getState().completeAnalysis(testCardId, {
      source: {
        image: "data:image/png;base64,abc",
        dimensions: { w: 1280, h: 720 },
      },
      provenance: {
        pass1: {
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

    expect(testStore.getState().cards.get(testCardId)?.refinePass).toEqual({
      model: "claude-opus-4-6",
      effort: "low",
    });

    testStore.getState().setRefineEffort("medium");

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
              data: { maxIterations: 1 },
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

    expect(refineRequests[0].get("model")).toBe("claude-opus-4-6");
    expect(refineRequests[0].get("effort")).toBe("low");
  });
});
