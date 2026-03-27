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
      expect(card!.usedCritique).toBe(false);
      expect(card!.pass1).toBeNull();
      expect(card!.pass2).toBeNull();
      expect(card!.pass1Elapsed).toBe(0);
      expect(card!.pass2Elapsed).toBe(0);
      expect(card!.pass1Cost).toBeNull();
      expect(card!.pass2Cost).toBeNull();
      expect(card!.error).toBeNull();
      expect(card!.activeStage).toBe("extract");
      expect(card!.selectedTemplateIndex).toEqual({
        extract: 0,
        critique: 0,
      });
      expect(card!.viewMode).toBe("original");
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
      store.getState().startAnalysis(id);
      const card = store.getState().cards.get(id)!;
      expect(card.status).toBe("analyzing");
      expect(card.log).toEqual([]);
      expect(card.error).toBeNull();
      expect(card.elapsed).toBe(0);
    });

    it("startAnalysis captures pass1 provenance and critique toggle", () => {
      store.getState().setModel("claude-sonnet-4-6");
      store.getState().setEffort("max");
      store.getState().setCritique(true);

      store.getState().startAnalysis(id);

      const card = store.getState().cards.get(id)!;
      expect(card.usedCritique).toBe(true);
      expect(card.pass1).toEqual({
        model: "claude-sonnet-4-6",
        effort: "max",
      });
      expect(card.pass2).toBeNull();
      expect(card.activeStage).toBe("extract");
      expect(card.viewMode).toBe("original");
    });

    it("completeAnalysis stores pass1 and final stage data separately", () => {
      store.getState().startAnalysis(id);
      const pass1Analysis = {
        source: {
          image: "base64...",
          dimensions: { w: 1920, h: 1080 },
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
      const result = {
        source: {
          image: "base64...",
          dimensions: { w: 1920, h: 1080 },
        },
        pass1Analysis,
        provenance: {
          usedCritique: true,
          pass1: {
            model: "claude-opus-4-6",
            effort: "low",
            elapsed: 5,
            cost: 0.12,
          },
          pass2: {
            model: "claude-opus-4-6",
            effort: "low",
            elapsed: 7,
            cost: 0.34,
          },
        },
        proposals: [
          {
            scope: "slide" as const,
            name: "critique-slide",
            description: "critique",
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
      expect(card.pass1Analysis).toEqual(pass1Analysis);
      expect(card.usedCritique).toBe(true);
      expect(card.pass1).toEqual({
        model: "claude-opus-4-6",
        effort: "low",
        elapsed: 5,
        cost: 0.12,
      });
      expect(card.pass2).toEqual({
        model: "claude-opus-4-6",
        effort: "low",
        elapsed: 7,
        cost: 0.34,
      });
      expect(card.pass1Elapsed).toBe(5);
      expect(card.pass2Elapsed).toBe(7);
      expect(card.pass1Cost).toBe(0.12);
      expect(card.pass2Cost).toBe(0.34);
      expect(card.selectedTemplateIndex).toEqual({ extract: 0, critique: 0 });
    });

    it("failAnalysis sets status to error and stores error message", () => {
      store.getState().startAnalysis(id);
      store.getState().failAnalysis(id, "API timeout");
      const card = store.getState().cards.get(id)!;
      expect(card.status).toBe("error");
      expect(card.error).toBe("API timeout");
    });

    it("resetAnalysis clears critique provenance fields", () => {
      store.getState().setCritique(true);
      store.getState().startAnalysis(id);
      store.getState().completeAnalysis(id, {
        source: {
          image: "base64...",
          dimensions: { w: 1920, h: 1080 },
        },
        pass1Analysis: {
          source: {
            image: "base64...",
            dimensions: { w: 1920, h: 1080 },
          },
          proposals: [],
        },
        provenance: {
          usedCritique: true,
          pass1: {
            model: "claude-opus-4-6",
            effort: "low",
            elapsed: 3,
            cost: 0.1,
          },
          pass2: null,
        },
        proposals: [],
      });

      store.getState().resetAnalysis(id);

      const card = store.getState().cards.get(id)!;
      expect(card.usedCritique).toBe(false);
      expect(card.pass1).toBeNull();
      expect(card.pass2).toBeNull();
      expect(card.pass1Analysis).toBeNull();
      expect(card.analysis).toBeNull();
      expect(card.pass1Elapsed).toBe(0);
      expect(card.pass2Elapsed).toBe(0);
      expect(card.pass1Cost).toBeNull();
      expect(card.pass2Cost).toBeNull();
      expect(card.activeStage).toBe("extract");
      expect(card.selectedTemplateIndex).toEqual({ extract: 0, critique: 0 });
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
        stage: "critique",
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
        content: "Critique",
        timestamp: 101,
        stage: "critique",
      });
      const card = store.getState().cards.get(id)!;
      expect(card.log).toHaveLength(2);
    });
  });

  // --- selectTemplate ---

  describe("selectTemplate", () => {
    it("updates selectedTemplateIndex for the active stage", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().selectTemplate(id, 2);
      expect(store.getState().cards.get(id)!.selectedTemplateIndex).toEqual({
        extract: 2,
        critique: 0,
      });

      store.getState().setActiveStage(id, "critique");
      store.getState().selectTemplate(id, 1);
      expect(store.getState().cards.get(id)!.selectedTemplateIndex).toEqual({
        extract: 2,
        critique: 1,
      });
    });
  });

  describe("stage state", () => {
    it("setViewMode syncs activeStage for extract and critique", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().setViewMode(id, "extract");
      expect(store.getState().cards.get(id)!.activeStage).toBe("extract");

      store.getState().setViewMode(id, "critique");
      expect(store.getState().cards.get(id)!.activeStage).toBe("critique");
    });

    it("startAnalysis resets activeStage to extract", () => {
      const id = store.getState().addCard(makeFile());
      store.getState().setActiveStage(id, "critique");
      store.getState().setViewMode(id, "critique");

      store.getState().startAnalysis(id);

      const card = store.getState().cards.get(id)!;
      expect(card.activeStage).toBe("extract");
      expect(card.viewMode).toBe("original");
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

    it("openLogModal sets modal state", () => {
      store.getState().openLogModal("card-1");
      expect(store.getState().logModal).toEqual({
        open: true,
        cardId: "card-1",
      });
    });

    it("closeLogModal resets modal state", () => {
      store.getState().openLogModal("card-1");
      store.getState().closeLogModal();
      expect(store.getState().logModal.open).toBe(false);
    });
  });
});
