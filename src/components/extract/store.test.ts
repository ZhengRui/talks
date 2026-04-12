import { describe, it, expect, beforeEach } from "vitest";
import { createExtractStore } from "./store";
import type { StoreApi } from "zustand/vanilla";
import type { ExtractState } from "./store";

function makeFile(name = "slide.png"): File {
  return new File(["fake"], name, { type: "image/png" });
}

describe("ExtractStore", () => {
  let store: StoreApi<ExtractState>;

  beforeEach(() => {
    store = createExtractStore();
  });

  // --- addCard ---

  describe("addCard", () => {
    it("creates a card with idle status", () => {
      const id = store.getState().addCard(makeFile());
      const card = store.getState().cards.get(id);
      expect(card).toBeDefined();
      expect(card!.status).toBe("idle");
      expect(card!.description).toBe("");
      expect(card!.analysis).toBeNull();
      expect(card!.pass1Analysis).toBeNull();
      expect(card!.log).toEqual([]);
      expect(card!.elapsed).toBe(0);
      expect(card!.pass1).toBeNull();
      expect(card!.pass1Elapsed).toBe(0);
      expect(card!.pass1Cost).toBeNull();
      expect(card!.refinePass).toMatchObject({
        vision: {
          provider: "openai-codex",
          model: "gpt-5.4",
          effort: "low",
        },
        edit: {
          provider: "openai-codex",
          model: "gpt-5.4",
          effort: "low",
        },
        visionModel: "gpt-5.4",
        visionEffort: "low",
        editModel: "gpt-5.4",
        editEffort: "low",
      });
      expect(card!.refineSettingsLocked).toBe(false);
      expect(card!.error).toBeNull();
      expect(card!.activeStage).toBe("extract");
      expect(card!.selectedTemplateIndex).toEqual({
        extract: 0,
        refine: 0,
      });
      expect(card!.viewMode).toBe("original");
      expect(card!.refineAnalysis).toBeNull();
      expect(card!.refineStatus).toBe("idle");
      expect(card!.refineIteration).toBe(0);
      expect(card!.refineResult).toBeNull();
      expect(card!.refineHistory).toEqual([]);
      expect(card!.refineError).toBeNull();
      expect(card!.autoRefine).toBe(false);
      expect(card!.normalizedImage).toBeNull();
      expect(card!.diffObjectUrl).toBeNull();
      expect(card!.promptHistory).toEqual([]);
    });

    it("positions first card at (40, 40)", () => {
      const id = store.getState().addCard(makeFile());
      const card = store.getState().cards.get(id)!;
      expect(card.position).toEqual({ x: 40, y: 40 });
    });

    it("auto-layouts second card to the right", () => {
      store.getState().addCard(makeFile("a.png"));
      const id2 = store.getState().addCard(makeFile("b.png"));
      const card2 = store.getState().cards.get(id2)!;
      // Second card: column 1, row 0 → x = 40 + (480+40)*1
      expect(card2.position).toEqual({ x: 40 + 520, y: 40 });
    });

    it("accepts benchmark metadata and explicit positions", () => {
      const id = store.getState().addCard(makeFile("bench.png"), {
        label: "demo slide 2 · coords",
        position: { x: 200, y: 300 },
        benchmarkGroupId: "group-1",
        benchmarkVariant: "coords",
        benchmarkSlug: "demo",
        benchmarkSlideIndex: 2,
        geometryHints: {
          source: "layout",
          canvas: { w: 1920, h: 1080 },
          elements: [],
        },
      });
      const card = store.getState().cards.get(id)!;

      expect(card.label).toBe("demo slide 2 · coords");
      expect(card.position).toEqual({ x: 200, y: 300 });
      expect(card.benchmarkGroupId).toBe("group-1");
      expect(card.benchmarkVariant).toBe("coords");
      expect(card.benchmarkSlug).toBe("demo");
      expect(card.benchmarkSlideIndex).toBe(2);
      expect(card.geometryHints?.source).toBe("layout");
    });

    it("wraps to next row after 3 cards", () => {
      for (let i = 0; i < 3; i++) {
        store.getState().addCard(makeFile(`${i}.png`));
      }
      const id4 = store.getState().addCard(makeFile("3.png"));
      const card4 = store.getState().cards.get(id4)!;
      // Fourth card: column 0, row 1 → x = 40, y = 40 + (480+40)*1
      expect(card4.position).toEqual({ x: 40, y: 40 + 520 });
    });

    it("sets card size to 480x270", () => {
      const id = store.getState().addCard(makeFile());
      const card = store.getState().cards.get(id)!;
      expect(card.size).toEqual({ w: 480, h: 270 });
    });

    it("adds id to cardOrder", () => {
      const id = store.getState().addCard(makeFile());
      expect(store.getState().cardOrder).toContain(id);
    });

    it("captures global autoRefine setting", () => {
      store.getState().setAutoRefine(false);
      const id = store.getState().addCard(makeFile());
      expect(store.getState().cards.get(id)!.autoRefine).toBe(false);
    });
  });

  // --- selectCard ---

  describe("selectCard", () => {
    it("sets selectedCardId", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().selectCard(id);
      expect(store.getState().selectedCardId).toBe(id);
    });

    it("clears selection with null", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().selectCard(id);
      store.getState().selectCard(null);
      expect(store.getState().selectedCardId).toBeNull();
    });
  });

  // --- removeCard ---

  describe("removeCard", () => {
    it("removes the card from cards map", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().removeCard(id);
      expect(store.getState().cards.has(id)).toBe(false);
    });

    it("removes the id from cardOrder", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().removeCard(id);
      expect(store.getState().cardOrder).not.toContain(id);
    });

    it("clears selection if removed card was selected", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().selectCard(id);
      store.getState().removeCard(id);
      expect(store.getState().selectedCardId).toBeNull();
    });

    it("does not clear selection if a different card was selected", () => {
      const id1 = store.getState().addCard(makeFile("a.png"));
      const id2 = store.getState().addCard(makeFile("b.png"));
      store.getState().selectCard(id2);
      store.getState().removeCard(id1);
      expect(store.getState().selectedCardId).toBe(id2);
    });
  });

  // --- updateDescription ---

  describe("updateDescription", () => {
    it("updates card description", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().updateDescription(id, "A chart slide");
      expect(store.getState().cards.get(id)!.description).toBe("A chart slide");
    });
  });

  // --- Analysis lifecycle ---

  describe("analysis lifecycle", () => {
    let id: string;

    beforeEach(() => {
      id = store.getState().addCard(makeFile());
    });

    it("startAnalysis sets status to analyzing and clears log/error/elapsed", () => {
      // Add some pre-existing state
      store.getState().appendLog(id, {
        type: "text",
        content: "old",
        timestamp: 1,
      });
      store.getState().appendPrompt(id, {
        stage: "extract",
        phase: "extract",
        iteration: null,
        systemPrompt: "old system",
        userPrompt: "old user",
        timestamp: 1,
      });
      store.getState().startAnalysis(id);
      const card = store.getState().cards.get(id)!;
      expect(card.status).toBe("analyzing");
      expect(card.log).toEqual([]);
      expect(card.error).toBeNull();
      expect(card.elapsed).toBe(0);
      expect(card.promptHistory).toEqual([]);
    });

    it("appends prompt history entries", () => {
      store.getState().appendPrompt(id, {
        stage: "extract",
        phase: "extract",
        iteration: null,
        systemPrompt: "system",
        userPrompt: "user",
        model: "claude-opus-4-6",
        effort: "medium",
        timestamp: 123,
      });

      expect(store.getState().cards.get(id)!.promptHistory).toEqual([
        {
          stage: "extract",
          phase: "extract",
          iteration: null,
          systemPrompt: "system",
          userPrompt: "user",
          model: "claude-opus-4-6",
          effort: "medium",
          timestamp: 123,
        },
      ]);
    });

    it("deduplicates identical prompt history entries", () => {
      const entry = {
        stage: "extract" as const,
        phase: "extract" as const,
        iteration: null,
        systemPrompt: "system",
        userPrompt: "user",
        model: "claude-opus-4-6",
        effort: "medium",
        timestamp: 123,
      };

      store.getState().appendPrompt(id, entry);
      store.getState().appendPrompt(id, { ...entry, timestamp: 456 });

      expect(store.getState().cards.get(id)!.promptHistory).toEqual([entry]);
    });

    it("startAnalysis captures pass1 provenance and autoRefine setting", () => {
      store.getState().setModel("claude-sonnet-4-6");
      store.getState().setEffort("max");
      store.getState().setRefineVisionModel("claude-opus-4-6");
      store.getState().setRefineVisionEffort("low");
      store.getState().setRefineEditModel("claude-sonnet-4-6");
      store.getState().setRefineEditEffort("high");
      store.getState().setAutoRefine(false);

      store.getState().startAnalysis(id);

      const card = store.getState().cards.get(id)!;
      expect(card.pass1).toEqual({
        provider: "claude-code",
        model: "claude-sonnet-4-6",
        effort: "max",
      });
      expect(card.activeStage).toBe("extract");
      expect(card.viewMode).toBe("original");
      expect(card.autoRefine).toBe(false);
      expect(card.refinePass).toMatchObject({
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
    });

    it("completeAnalysis stores analysis and provenance", () => {
      store.getState().startAnalysis(id);
      const result = {
        source: {
          image: "base64...",
          dimensions: { w: 1920, h: 1080 },
        },
        provenance: {
          pass1: {
            provider: "claude-code" as const,
            model: "claude-opus-4-6",
            effort: "low",
            elapsed: 5,
            cost: 0.12,
          },
        },
        proposals: [
          {
            scope: "slide" as const,
            name: "extract-slide",
            description: "extract",
            region: { x: 0, y: 0, w: 1920, h: 1080 },
            params: {},
            style: {},
            body: "children: []",
          },
        ],
      };
      store.getState().completeAnalysis(id, result);
      const card = store.getState().cards.get(id)!;
      expect(card.status).toBe("analyzed");
      expect(card.analysis).toEqual({
        source: result.source,
        provenance: result.provenance,
        proposals: result.proposals,
      });
      expect(card.pass1Analysis).toEqual({
        source: result.source,
        provenance: result.provenance,
        proposals: result.proposals,
      });
      expect(card.pass1).toEqual({
        provider: "claude-code",
        model: "claude-opus-4-6",
        effort: "low",
        elapsed: 5,
        cost: 0.12,
      });
      expect(card.pass1Elapsed).toBe(5);
      expect(card.pass1Cost).toBe(0.12);
      expect(card.selectedTemplateIndex).toEqual({
        extract: 0,
        refine: 0,
      });
    });

    it("preserves raw extract analysis while storing normalized render analysis separately", () => {
      const rawResult = {
        source: {
          image: "base64...",
          dimensions: { w: 1456, h: 818 },
          contentBounds: { x: 0, y: 0, w: 1456, h: 818 },
        },
        provenance: {
          pass1: {
            provider: "claude-code" as const,
            model: "claude-opus-4-6",
            effort: "low",
          },
        },
        proposals: [
          {
            scope: "slide" as const,
            name: "extract-slide",
            description: "extract",
            region: { x: 0, y: 0, w: 1456, h: 818 },
            params: {
              proxies: {
                type: "array",
                value: [{ x: 648, y: 248 }],
              },
            },
            style: {},
            body: "sourceSize: { w: 1456, h: 818 }",
          },
        ],
        normalizedAnalysis: {
          source: {
            image: "base64...",
            dimensions: { w: 1920, h: 1080 },
            reportedDimensions: { w: 1456, h: 818 },
            contentBounds: { x: 0, y: 0, w: 1920, h: 1080 },
          },
          provenance: {
            pass1: {
              provider: "claude-code" as const,
              model: "claude-opus-4-6",
              effort: "low",
            },
          },
          proposals: [
            {
              scope: "slide" as const,
              name: "extract-slide",
              description: "extract",
              region: { x: 0, y: 0, w: 1920, h: 1080 },
              params: {
                proxies: {
                  type: "array",
                  value: [{ x: 648, y: 248 }],
                },
              },
              style: {},
              body: "sourceSize: { w: 1456, h: 818 }",
            },
          ],
        },
      };

      store.getState().completeAnalysis(id, rawResult);
      const card = store.getState().cards.get(id)!;

      expect(card.analysis?.source.dimensions).toEqual({ w: 1456, h: 818 });
      expect(card.analysis?.proposals[0]?.region).toEqual({ x: 0, y: 0, w: 1456, h: 818 });
      expect(card.pass1Analysis?.source.dimensions).toEqual({ w: 1920, h: 1080 });
      expect(card.pass1Analysis?.source.reportedDimensions).toEqual({ w: 1456, h: 818 });
      expect(card.pass1Analysis?.proposals[0]?.region).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
      expect(card.analysis?.proposals[0]?.body).toContain("1456");
      expect(card.pass1Analysis?.proposals[0]?.body).toContain("1456");
    });

    it("failAnalysis sets status to error and stores error message", () => {
      store.getState().startAnalysis(id);
      store.getState().failAnalysis(id, "API timeout");
      const card = store.getState().cards.get(id)!;
      expect(card.status).toBe("error");
      expect(card.error).toBe("API timeout");
    });

    it("resetAnalysis clears provenance fields", () => {
      store.getState().startAnalysis(id);
      store.getState().completeAnalysis(id, {
        source: {
          image: "base64...",
          dimensions: { w: 1920, h: 1080 },
        },
        provenance: {
          pass1: {
            provider: "claude-code",
            model: "claude-opus-4-6",
            effort: "low",
            elapsed: 3,
            cost: 0.1,
          },
        },
        proposals: [],
      });

      store.getState().resetAnalysis(id);

      const card = store.getState().cards.get(id)!;
      expect(card.pass1).toBeNull();
      expect(card.pass1Analysis).toBeNull();
      expect(card.analysis).toBeNull();
      expect(card.pass1Elapsed).toBe(0);
      expect(card.pass1Cost).toBeNull();
      expect(card.activeStage).toBe("extract");
      expect(card.selectedTemplateIndex).toEqual({
        extract: 0,
        refine: 0,
      });
      expect(card.status).toBe("idle");
    });
  });

  // --- appendLog ---

  describe("appendLog", () => {
    let id: string;

    beforeEach(() => {
      id = store.getState().addCard(makeFile());
    });

    it("adds a log entry", () => {
      store.getState().appendLog(id, {
        type: "status",
        content: "Starting analysis...",
        timestamp: 100,
        stage: "extract",
      });
      const card = store.getState().cards.get(id)!;
      expect(card.log).toHaveLength(1);
      expect(card.log[0].content).toBe("Starting analysis...");
      expect(card.log[0].stage).toBe("extract");
    });

    it("merges streaming text entries by appending content", () => {
      store.getState().appendLog(id, {
        type: "text",
        content: "Hello ",
        timestamp: 100,
        stage: "extract",
      });
      store.getState().appendLog(id, {
        type: "text",
        content: "world",
        timestamp: 101,
        stage: "extract",
      });
      const card = store.getState().cards.get(id)!;
      expect(card.log).toHaveLength(1);
      expect(card.log[0].content).toBe("Hello world");
    });

    it("merges streaming thinking entries by appending content", () => {
      store.getState().appendLog(id, {
        type: "thinking",
        content: "Let me ",
        timestamp: 100,
        stage: "extract",
      });
      store.getState().appendLog(id, {
        type: "thinking",
        content: "think...",
        timestamp: 101,
        stage: "extract",
      });
      const card = store.getState().cards.get(id)!;
      expect(card.log).toHaveLength(1);
      expect(card.log[0].content).toBe("Let me think...");
    });

    it("does not merge different streaming types", () => {
      store.getState().appendLog(id, {
        type: "text",
        content: "Hello",
        timestamp: 100,
        stage: "extract",
      });
      store.getState().appendLog(id, {
        type: "thinking",
        content: "hmm",
        timestamp: 101,
        stage: "extract",
      });
      const card = store.getState().cards.get(id)!;
      expect(card.log).toHaveLength(2);
    });

    it("does not merge non-streaming types", () => {
      store.getState().appendLog(id, {
        type: "status",
        content: "Step 1",
        timestamp: 100,
        stage: "extract",
      });
      store.getState().appendLog(id, {
        type: "status",
        content: "Step 2",
        timestamp: 101,
        stage: "extract",
      });
      const card = store.getState().cards.get(id)!;
      expect(card.log).toHaveLength(2);
    });

    it("does not merge streaming entries across stages", () => {
      store.getState().appendLog(id, {
        type: "text",
        content: "Extract",
        timestamp: 100,
        stage: "extract",
      });
      store.getState().appendLog(id, {
        type: "text",
        content: "Refine",
        timestamp: 101,
        stage: "refine",
      });
      const card = store.getState().cards.get(id)!;
      expect(card.log).toHaveLength(2);
    });

    it("does not merge streaming entries with different stream keys", () => {
      store.getState().appendLog(id, {
        type: "text",
        content: "Draft message",
        timestamp: 100,
        stage: "extract",
        streamKey: "agent_message:item_0",
      });
      store.getState().appendLog(id, {
        type: "text",
        content: "{\"ok\":true}",
        timestamp: 101,
        stage: "extract",
        streamKey: "agent_message:item_1",
      });
      const card = store.getState().cards.get(id)!;
      expect(card.log).toHaveLength(2);
      expect(card.log[0].content).toBe("Draft message");
      expect(card.log[1].content).toBe("{\"ok\":true}");
    });
  });

  // --- selectTemplate ---

  describe("selectTemplate", () => {
    it("updates selectedTemplateIndex for the active stage", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().selectTemplate(id, 2);
      expect(store.getState().cards.get(id)!.selectedTemplateIndex).toEqual({
        extract: 2,
        refine: 0,
      });

      store.getState().setActiveStage(id, "refine");
      store.getState().selectTemplate(id, 3);
      expect(store.getState().cards.get(id)!.selectedTemplateIndex).toEqual({
        extract: 2,
        refine: 3,
      });
    });
  });

  describe("stage state", () => {
    it("setViewMode does not sync activeStage", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().setActiveStage(id, "extract");

      store.getState().setViewMode(id, "iter");
      expect(store.getState().cards.get(id)!.viewMode).toBe("iter");
      expect(store.getState().cards.get(id)!.activeStage).toBe("extract");

      store.getState().setViewMode(id, "diff");
      expect(store.getState().cards.get(id)!.viewMode).toBe("diff");
      expect(store.getState().cards.get(id)!.activeStage).toBe("extract");
    });

    it("startAnalysis resets activeStage to extract", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().setActiveStage(id, "refine");

      store.getState().startAnalysis(id);

      const card = store.getState().cards.get(id)!;
      expect(card.activeStage).toBe("extract");
      expect(card.viewMode).toBe("original");
    });
  });

  describe("autoRefine global setting", () => {
    it("defaults to false and can be toggled", () => {
      expect(store.getState().autoRefine).toBe(false);

      store.getState().setAutoRefine(true);
      expect(store.getState().autoRefine).toBe(true);

      store.getState().setAutoRefine(false);
      expect(store.getState().autoRefine).toBe(false);
    });

    it("is captured on card at startAnalysis time", () => {
      store.getState().setAutoRefine(false);
      const id = store.getState().addCard(makeFile());
      store.getState().startAnalysis(id);
      expect(store.getState().cards.get(id)!.autoRefine).toBe(false);

      // Change global after start — card retains old value
      store.getState().setAutoRefine(true);
      expect(store.getState().cards.get(id)!.autoRefine).toBe(false);
    });

    it("updates unlocked cards when the global default changes", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().setAutoRefine(false);
      expect(store.getState().cards.get(id)!.autoRefine).toBe(false);
    });
  });

  describe("refine defaults", () => {
    it("updates unlocked cards when refine defaults change", () => {
      const id1 = store.getState().addCard(makeFile("a.png"));
      const id2 = store.getState().addCard(makeFile("b.png"));

      store.getState().setRefineVisionModel("claude-sonnet-4-6");
      store.getState().setRefineVisionEffort("high");
      store.getState().setRefineEditModel("claude-opus-4-6");
      store.getState().setRefineEditEffort("low");
      store.getState().setRefineMaxIterations(id1, 7);
      store.getState().setRefineMismatchThreshold(id1, 0.12);

      expect(store.getState().cards.get(id1)!.refinePass).toMatchObject({
        vision: {
          provider: "claude-code",
          model: "claude-sonnet-4-6",
          effort: "high",
        },
        edit: {
          provider: "claude-code",
          model: "claude-opus-4-6",
          effort: "low",
        },
        visionModel: "claude-sonnet-4-6",
        visionEffort: "high",
        editModel: "claude-opus-4-6",
        editEffort: "low",
      });
      expect(store.getState().cards.get(id2)!.refinePass).toMatchObject({
        vision: {
          provider: "claude-code",
          model: "claude-sonnet-4-6",
          effort: "high",
        },
        edit: {
          provider: "claude-code",
          model: "claude-opus-4-6",
          effort: "low",
        },
        visionModel: "claude-sonnet-4-6",
        visionEffort: "high",
        editModel: "claude-opus-4-6",
        editEffort: "low",
      });
      expect(store.getState().cards.get(id1)!.refineMaxIterations).toBe(7);
      expect(store.getState().cards.get(id2)!.refineMaxIterations).toBe(7);
      expect(store.getState().cards.get(id1)!.refineMismatchThreshold).toBe(0.12);
      expect(store.getState().cards.get(id2)!.refineMismatchThreshold).toBe(0.12);
    });

    it("keeps started cards on their snapped refine defaults", () => {
      const id = store.getState().addCard(makeFile("started.png"));
      const idleId = store.getState().addCard(makeFile("idle.png"));
      store.getState().setRefineVisionModel("claude-opus-4-6");
      store.getState().setRefineVisionEffort("low");
      store.getState().setRefineEditModel("claude-sonnet-4-6");
      store.getState().setRefineEditEffort("high");
      store.getState().setRefineMaxIterations(id, 2);
      store.getState().setRefineMismatchThreshold(id, 0.08);

      store.getState().startAnalysis(id);

      store.getState().setRefineVisionModel("claude-sonnet-4-6");
      store.getState().setRefineVisionEffort("high");
      store.getState().setRefineEditModel("claude-opus-4-6");
      store.getState().setRefineEditEffort("low");
      store.getState().setRefineMaxIterations(idleId, 9);
      store.getState().setRefineMismatchThreshold(idleId, 0.2);

      const card = store.getState().cards.get(id)!;
      expect(card.refinePass).toMatchObject({
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
      expect(card.refineMaxIterations).toBe(2);
      expect(card.refineMismatchThreshold).toBe(0.08);
    });

    it("preserves locked refine settings when retrying after an error", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().startAnalysis(id);
      store.getState().failAnalysis(id, "boom");

      store.getState().setCardAutoRefine(id, false);
      store.getState().setCardRefineVisionModel(id, "claude-sonnet-4-6");
      store.getState().setCardRefineVisionEffort(id, "high");
      store.getState().setCardRefineEditModel(id, "claude-opus-4-6");
      store.getState().setCardRefineEditEffort(id, "low");
      store.getState().setRefineMaxIterations(id, 6);
      store.getState().setRefineMismatchThreshold(id, 0.14);

      store.getState().setAutoRefine(true);
      store.getState().setRefineVisionModel("claude-opus-4-6");
      store.getState().setRefineVisionEffort("low");
      store.getState().setRefineEditModel("claude-sonnet-4-6");
      store.getState().setRefineEditEffort("high");

      const idleId = store.getState().addCard(makeFile("idle.png"));
      store.getState().setRefineMaxIterations(idleId, 3);
      store.getState().setRefineMismatchThreshold(idleId, 0.09);

      store.getState().startAnalysis(id);

      const card = store.getState().cards.get(id)!;
      expect(card.autoRefine).toBe(false);
      expect(card.refinePass).toMatchObject({
        vision: {
          provider: "claude-code",
          model: "claude-sonnet-4-6",
          effort: "high",
        },
        edit: {
          provider: "claude-code",
          model: "claude-opus-4-6",
          effort: "low",
        },
        visionModel: "claude-sonnet-4-6",
        visionEffort: "high",
        editModel: "claude-opus-4-6",
        editEffort: "low",
      });
      expect(card.refineMaxIterations).toBe(6);
      expect(card.refineMismatchThreshold).toBe(0.14);
    });
  });

  describe("refinement lifecycle", () => {
    let id: string;

    beforeEach(() => {
      id = store.getState().addCard(makeFile());
      store.getState().completeAnalysis(id, {
        source: {
          image: "base64...",
          dimensions: { w: 1920, h: 1080 },
          contentBounds: { x: 10, y: 20, w: 1800, h: 1000 },
        },
        provenance: {
          pass1: { provider: "claude-code", model: "claude-opus-4-6", effort: "low" },
        },
        proposals: [
          {
            scope: "slide" as const,
            name: "extract-preview",
            description: "extract",
            region: { x: 0, y: 0, w: 1920, h: 1080 },
            params: {},
            style: {},
            body: "children: []",
          },
        ],
      });
    });

    it("startRefinement clears old refine prompts but keeps extract prompts", () => {
      store.getState().appendPrompt(id, {
        stage: "extract",
        phase: "extract",
        iteration: null,
        systemPrompt: "extract system",
        userPrompt: "extract user",
        timestamp: 1,
      });
      store.getState().appendPrompt(id, {
        stage: "refine",
        phase: "vision",
        iteration: 1,
        systemPrompt: "refine system",
        userPrompt: "refine user",
        timestamp: 2,
      });

      store.getState().startRefinement(id);

      expect(store.getState().cards.get(id)!.promptHistory).toEqual([
        {
          stage: "extract",
          phase: "extract",
          iteration: null,
          systemPrompt: "extract system",
          userPrompt: "extract user",
          timestamp: 1,
        },
      ]);
    });

    it("startRefinement resets refine state and activates the refine stage", () => {
      store.getState().setRefineIterationRecords(
        id,
        [{ iteration: 1, issuesFound: [{ issueId: "i1", category: "text", summary: "too big" }], issuesEdited: ["i1"], editApplied: true, issuesResolved: [], issuesUnresolved: [] }],
        [{ priority: 1, issueId: "i1", category: "text", area: "title", issue: "too big", fixType: "nudge", observed: "big", desired: "small", confidence: 0.9 }],
      );
      store.getState().startRefinement(id);

      const card = store.getState().cards.get(id)!;
      expect(card.refineStatus).toBe("running");
      expect(card.activeStage).toBe("refine");
      expect(card.refineIteration).toBe(0);
      expect(card.refineResult).toBeNull();
      expect(card.refineHistory).toEqual([]);
      expect(card.diffObjectUrl).toBeNull();
      expect(card.refineIterationRecords).toEqual([]);
      expect(card.refineLastIssues).toEqual([]);
    });

    it("updateRefinement stores refineAnalysis and history", () => {
      store.getState().startRefinement(id);
      store.getState().updateRefinement(id, {
        iteration: 1,
        mismatchRatio: 0.23,
        diffArtifactUrl: "/api/extract/refine/artifacts/a1",
        regions: [{ x: 10, y: 20, w: 100, h: 50, mismatchRatio: 0.47 }],
        proposals: [
          {
            scope: "slide",
            name: "refined-preview",
            description: "refined",
            region: { x: 0, y: 0, w: 1920, h: 1080 },
            params: {},
            style: {},
            body: "children: []",
          },
        ],
      });

      // completeRefineIteration pushes to history with post-patch score
      store.getState().completeRefineIteration(id, 0.19);

      const card = store.getState().cards.get(id)!;
      expect(card.refineIteration).toBe(1);
      expect(card.refineResult?.mismatchRatio).toBe(0.19);
      expect(card.refineHistory).toHaveLength(1);
      expect(card.refineHistory[0].mismatchRatio).toBe(0.19);
      expect(card.refineAnalysis?.proposals[0]?.name).toBe("refined-preview");
      expect(card.refineAnalysis?.source.contentBounds).toEqual({
        x: 10,
        y: 20,
        w: 1800,
        h: 1000,
      });
    });

    it("completeRefinement marks refineStatus done", () => {
      store.getState().startRefinement(id);
      store.getState().completeRefinement(id);
      expect(store.getState().cards.get(id)!.refineStatus).toBe("done");
    });

    it("setRefineIterationRecords stores iteration history and last issues for continuation", () => {
      const records = [
        { iteration: 1, issuesFound: [{ issueId: "i1", category: "text", summary: "title too large" }], issuesEdited: ["i1"], editApplied: true, issuesResolved: [], issuesUnresolved: [] },
      ];
      const lastIssues = [
        { priority: 1, issueId: "i1", category: "text", area: "title", issue: "title too large", fixType: "nudge", observed: "big", desired: "small", confidence: 0.9 },
      ];
      store.getState().setRefineIterationRecords(id, records, lastIssues);
      const card = store.getState().cards.get(id)!;
      expect(card.refineIterationRecords).toEqual(records);
      expect(card.refineLastIssues).toEqual(lastIssues);
    });

    it("failRefinement stores the error message", () => {
      store.getState().startRefinement(id);
      store.getState().failRefinement(id, "Refine failed");
      const card = store.getState().cards.get(id)!;
      expect(card.refineStatus).toBe("error");
      expect(card.refineError).toBe("Refine failed");
    });

    it("setNormalizedImage stores the processed upload for reuse", () => {
      const normalized = makeFile("normalized.png");
      store.getState().setNormalizedImage(id, normalized);
      expect(store.getState().cards.get(id)!.normalizedImage).toBe(normalized);
    });
  });

  // --- tickElapsed ---

  describe("tickElapsed", () => {
    it("increments elapsed for analyzing cards", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().startAnalysis(id);
      store.getState().tickElapsed(id);
      store.getState().tickElapsed(id);
      expect(store.getState().cards.get(id)!.elapsed).toBe(2);
    });

    it("does not increment elapsed for non-analyzing cards", () => {
      const id = store.getState().addCard(makeFile());
      // Card is idle
      store.getState().tickElapsed(id);
      expect(store.getState().cards.get(id)!.elapsed).toBe(0);
    });
  });

  // --- Viewport ---

  describe("viewport", () => {
    it("setPan updates pan", () => {
      store.getState().setPan({ x: 100, y: -50 });
      expect(store.getState().pan).toEqual({ x: 100, y: -50 });
    });

    it("setZoom updates zoom", () => {
      store.getState().setZoom(1.5);
      expect(store.getState().zoom).toBe(1.5);
    });

    it("setZoom clamps to minimum 0.25", () => {
      store.getState().setZoom(0.1);
      expect(store.getState().zoom).toBe(0.25);
    });

    it("setZoom clamps to maximum 2.5", () => {
      store.getState().setZoom(5.0);
      expect(store.getState().zoom).toBe(2.5);
    });

    it("preview text box guides are off by default and can be toggled", () => {
      expect(store.getState().previewDebugTextBoxes).toBe(false);

      store.getState().setPreviewDebugTextBoxes(true);
      expect(store.getState().previewDebugTextBoxes).toBe(true);

      store.getState().setPreviewDebugTextBoxes(false);
      expect(store.getState().previewDebugTextBoxes).toBe(false);
    });
  });

  // --- Modals ---

  describe("modals", () => {
    it("openYamlModal sets modal state", () => {
      store.getState().openYamlModal("card-1", 2);
      expect(store.getState().yamlModal).toEqual({
        open: true,
        cardId: "card-1",
        templateIndex: 2,
      });
    });

    it("closeYamlModal resets modal state", () => {
      store.getState().openYamlModal("card-1", 2);
      store.getState().closeYamlModal();
      expect(store.getState().yamlModal.open).toBe(false);
    });

  });
});
