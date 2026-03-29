"use client";

import { useCallback, useEffect, useRef } from "react";
import CanvasViewport from "./CanvasViewport";
import CanvasToolbar from "./CanvasToolbar";
import InspectorPanel from "./InspectorPanel";
import LogModal from "./LogModal";
import { useExtractStore, type LogEntry } from "./store";
import type {
  AnalysisResultPayload,
  AnalysisStage,
  Proposal,
  RefineIterationResult,
} from "./types";

const MAX_IMAGE_DIMENSION = 2000;

/**
 * Downscale an image File so its longest side is at most MAX_IMAGE_DIMENSION.
 * This prevents Claude Code's image dimension metadata from injecting
 * "original vs displayed" coordinate discrepancies that cause the model
 * to spiral on coordinate-space reconciliation.
 *
 * Returns the original file if already small enough.
 */
async function downscaleImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w <= MAX_IMAGE_DIMENSION && h <= MAX_IMAGE_DIMENSION) {
        URL.revokeObjectURL(img.src);
        resolve(file);
        return;
      }
      const scale = MAX_IMAGE_DIMENSION / Math.max(w, h);
      const newW = Math.round(w * scale);
      const newH = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, newW, newH);
      URL.revokeObjectURL(img.src);
      canvas.toBlob(
        (blob) => {
          resolve(
            blob
              ? new File([blob], file.name, { type: "image/png" })
              : file,
          );
        },
        "image/png",
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve(file);
    };
    img.src = URL.createObjectURL(file);
  });
}

export default function ExtractCanvas() {
  const startAnalysis = useExtractStore((s) => s.startAnalysis);
  const appendLog = useExtractStore((s) => s.appendLog);
  const completeAnalysis = useExtractStore((s) => s.completeAnalysis);
  const failAnalysis = useExtractStore((s) => s.failAnalysis);
  const tickElapsed = useExtractStore((s) => s.tickElapsed);
  const setNormalizedImage = useExtractStore((s) => s.setNormalizedImage);
  const startRefinement = useExtractStore((s) => s.startRefinement);
  const updateRefineDiff = useExtractStore((s) => s.updateRefineDiff);
  const updateRefinement = useExtractStore((s) => s.updateRefinement);
  const completeRefineIteration = useExtractStore((s) => s.completeRefineIteration);
  const setDiffObjectUrl = useExtractStore((s) => s.setDiffObjectUrl);
  const completeRefinement = useExtractStore((s) => s.completeRefinement);
  const failRefinement = useExtractStore((s) => s.failRefinement);
  const abortRefinement = useExtractStore((s) => s.abortRefinement);

  // Per-card elapsed timers
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );
  const refineAbortControllersRef = useRef<Map<string, AbortController>>(
    new Map(),
  );

  // Clean up all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    const abortControllers = refineAbortControllersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearInterval(timer);
      }
      timers.clear();
      for (const controller of abortControllers.values()) {
        controller.abort();
      }
      abortControllers.clear();
    };
  }, []);

  const handleRefine = useCallback(
    async (cardId: string) => {
      const { cards, refineModel, refineEffort } = useExtractStore.getState();
      const card = cards.get(cardId);
      if (!card?.analysis) return;

      refineAbortControllersRef.current.get(cardId)?.abort();

      startRefinement(cardId);

      const formData = new FormData();
      formData.append("image", card.normalizedImage ?? card.file);
      formData.append(
        "proposals",
        JSON.stringify(card.refineAnalysis?.proposals ?? card.analysis.proposals),
      );
      formData.append("baseAnalysis", JSON.stringify(card.analysis));
      if (card.analysis.source.contentBounds) {
        formData.append(
          "contentBounds",
          JSON.stringify(card.analysis.source.contentBounds),
        );
      }
      formData.append("model", refineModel);
      formData.append("effort", refineEffort);
      formData.append("maxIterations", String(card.refineMaxIterations));
      formData.append(
        "mismatchThreshold",
        String(card.refineMismatchThreshold),
      );

      const abortController = new AbortController();
      refineAbortControllersRef.current.set(cardId, abortController);

      try {
        const response = await fetch("/api/extract/refine", {
          method: "POST",
          body: formData,
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? `Refine failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "";

        // Latest diff metrics — used by refine:patch to fill updateRefinement
        let latestDiff: {
          mismatchRatio: number;
          regions: RefineIterationResult["regions"];
          diffArtifactUrl: string;
        } | null = null;

        const fetchDiffArtifact = async (url: string) => {
          const res = await fetch(url, { signal: abortController.signal });
          if (!res.ok) throw new Error(`Failed to fetch diff artifact (${res.status})`);
          const blob = await res.blob();
          if (abortController.signal.aborted) return;
          setDiffObjectUrl(cardId, URL.createObjectURL(blob));
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7);
              continue;
            }
            if (!line.startsWith("data: ")) continue;

            let data: Record<string, unknown>;
            try {
              data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            } catch {
              currentEvent = "";
              continue;
            }

            switch (currentEvent) {
              case "refine:start": {
                appendLog(cardId, {
                  type: "status",
                  content: `Refinement started — up to ${data.maxIterations ?? "?"} iterations`,
                  timestamp: Date.now(),
                  stage: "refine",
                });
                break;
              }
              case "refine:thinking": {
                appendLog(cardId, {
                  type: "thinking",
                  content: typeof data.text === "string" ? data.text : "",
                  timestamp: Date.now(),
                  stage: "refine",
                });
                break;
              }
              case "refine:text": {
                appendLog(cardId, {
                  type: "text",
                  content: typeof data.text === "string" ? data.text : "",
                  timestamp: Date.now(),
                  stage: "refine",
                });
                break;
              }

              // --- Diff: update store metrics + fetch artifact. Log only for initial (iter 0). ---
              case "refine:diff": {
                const iteration = typeof data.iteration === "number" ? data.iteration : 0;
                const mismatchRatio = typeof data.mismatchRatio === "number" ? data.mismatchRatio : 0;
                const diffArtifactUrl = typeof data.diffArtifactUrl === "string" ? data.diffArtifactUrl : "";
                const regions = Array.isArray(data.regions) ? (data.regions as RefineIterationResult["regions"]) : [];

                latestDiff = { mismatchRatio, regions, diffArtifactUrl };
                updateRefineDiff(cardId, iteration, mismatchRatio, diffArtifactUrl);

                if (iteration === 0) {
                  appendLog(cardId, {
                    type: "status",
                    content: `Starting — ${Math.round(mismatchRatio * 100)}% mismatch`,
                    timestamp: Date.now(),
                    stage: "refine",
                  });
                }

                if (diffArtifactUrl) {
                  try {
                    await fetchDiffArtifact(diffArtifactUrl);
                  } catch (error) {
                    if (!abortController.signal.aborted) {
                      appendLog(cardId, {
                        type: "error",
                        content: error instanceof Error ? error.message : String(error),
                        timestamp: Date.now(),
                        stage: "refine",
                      });
                    }
                  }
                }
                break;
              }

              // --- Patch: update proposals in store. No log (complete logs the result). ---
              case "refine:patch": {
                const iteration = typeof data.iteration === "number" ? data.iteration : 0;
                const proposals = Array.isArray(data.proposals) ? (data.proposals as Proposal[]) : [];
                updateRefinement(cardId, {
                  iteration,
                  proposals,
                  mismatchRatio: latestDiff?.mismatchRatio ?? 0,
                  regions: latestDiff?.regions ?? [],
                  diffArtifactUrl: latestDiff?.diffArtifactUrl ?? "",
                });
                break;
              }

              // --- Complete: push to history + single log line per iteration. ---
              case "refine:complete": {
                const iteration = typeof data.iteration === "number" ? data.iteration : 0;
                const mismatchRatio = typeof data.mismatchRatio === "number" ? data.mismatchRatio : 0;
                completeRefineIteration(cardId, mismatchRatio);
                appendLog(cardId, {
                  type: "status",
                  content: `Iter ${iteration} — ${Math.round(mismatchRatio * 100)}% mismatch`,
                  timestamp: Date.now(),
                  stage: "refine",
                });
                break;
              }

              // --- Done: finalize. No duplicate store update. ---
              case "refine:done": {
                const finalIteration = typeof data.finalIteration === "number" ? data.finalIteration : 0;
                const mismatchRatio = typeof data.mismatchRatio === "number" ? data.mismatchRatio : 0;
                const converged = data.converged === true;
                completeRefinement(cardId);
                appendLog(cardId, {
                  type: "status",
                  content: converged
                    ? `Converged — ${Math.round(mismatchRatio * 100)}% after ${finalIteration} iteration${finalIteration === 1 ? "" : "s"}`
                    : `Stopped — ${Math.round(mismatchRatio * 100)}% after ${finalIteration} iteration${finalIteration === 1 ? "" : "s"}`,
                  timestamp: Date.now(),
                  stage: "refine",
                });
                return;
              }

              case "refine:error": {
                const error = typeof data.error === "string" ? data.error : "Refinement failed";
                appendLog(cardId, { type: "error", content: error, timestamp: Date.now(), stage: "refine" });
                failRefinement(cardId, error);
                return;
              }
              case "refine:aborted": {
                appendLog(cardId, { type: "status", content: "Refinement cancelled", timestamp: Date.now(), stage: "refine" });
                abortRefinement(cardId);
                return;
              }
            }

            currentEvent = "";
          }
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          abortRefinement(cardId);
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        appendLog(cardId, {
          type: "error",
          content: message,
          timestamp: Date.now(),
          stage: "refine",
        });
        failRefinement(cardId, message);
      } finally {
        const currentController = refineAbortControllersRef.current.get(cardId);
        if (currentController === abortController) {
          refineAbortControllersRef.current.delete(cardId);
        }
      }
    },
    [
      abortRefinement,
      appendLog,
      completeRefinement,
      completeRefineIteration,
      failRefinement,
      setDiffObjectUrl,
      startRefinement,
      updateRefineDiff,
      updateRefinement,
    ],
  );

  const handleCancelRefine = useCallback(
    (cardId: string) => {
      const controller = refineAbortControllersRef.current.get(cardId);
      if (!controller) return;
      controller.abort();
    },
    [],
  );

  const handleAnalyze = useCallback(
    async (cardId: string) => {
      // Read current card data directly from the store to avoid stale closures
      const { cards } = useExtractStore.getState();
      const card = cards.get(cardId);
      if (!card) return;

      startAnalysis(cardId);

      // Start elapsed timer for this card
      const timer = setInterval(() => tickElapsed(cardId), 1000);
      timersRef.current.set(cardId, timer);

      const { model, effort, critique, critiqueModel, critiqueEffort } = useExtractStore.getState();
      const normalizedImage = await downscaleImage(card.file);
      setNormalizedImage(cardId, normalizedImage);
      const formData = new FormData();
      formData.append("image", normalizedImage);
      if (card.description.trim()) {
        formData.append("text", card.description.trim());
      }
      formData.append("model", model);
      formData.append("effort", effort);
      if (critique) {
        formData.append("critique", "true");
        formData.append("critiqueModel", critiqueModel);
        formData.append("critiqueEffort", critiqueEffort);
      }

      try {
        const response = await fetch("/api/extract/analyze", {
          method: "POST",
          body: formData,
        });

        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => null);
          throw new Error(
            body?.error ?? `Analysis failed (${response.status})`,
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let analysisCompleted = false;

        const getStage = (value: unknown): AnalysisStage | undefined =>
          value === "extract" || value === "critique" ? value : undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7);
            } else if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6));
              const stage = getStage(data.stage);

              switch (currentEvent) {
                case "status": {
                  let msg = data.message ?? "";
                  if (data.inputTokens || data.outputTokens) {
                    msg += ` (${data.inputTokens ?? 0} in / ${data.outputTokens ?? 0} out)`;
                  }
                  if (data.cost != null) {
                    msg += ` $${Number(data.cost).toFixed(4)}`;
                  }
                  const statusEntry: LogEntry = {
                    type: "status",
                    content: msg,
                    timestamp: Date.now(),
                    stage,
                  };
                  appendLog(cardId, statusEntry);
                  break;
                }
                case "thinking": {
                  const thinkingEntry: LogEntry = {
                    type: "thinking",
                    content: data.text,
                    timestamp: Date.now(),
                    stage,
                  };
                  appendLog(cardId, thinkingEntry);
                  break;
                }
                case "text": {
                  const textEntry: LogEntry = {
                    type: "text",
                    content: data.text,
                    timestamp: Date.now(),
                    stage,
                  };
                  appendLog(cardId, textEntry);
                  break;
                }
                case "tool": {
                  const toolEntry: LogEntry = {
                    type: "tool",
                    content: `${data.name}(${typeof data.input === "string" ? data.input : JSON.stringify(data.input).slice(0, 200)})`,
                    timestamp: Date.now(),
                    stage,
                  };
                  appendLog(cardId, toolEntry);
                  break;
                }
                case "tool_result": {
                  const toolResultEntry: LogEntry = {
                    type: "tool_result",
                    content: data.preview,
                    timestamp: Date.now(),
                    stage,
                  };
                  appendLog(cardId, toolResultEntry);
                  break;
                }
                case "error": {
                  const errorMsg =
                    data.error + (data.raw ? `\nRaw: ${data.raw}` : "");
                  appendLog(cardId, {
                    type: "error",
                    content: errorMsg,
                    timestamp: Date.now(),
                    stage,
                  });
                  failAnalysis(cardId, errorMsg);
                  // Clear timer on error
                  const errorTimer = timersRef.current.get(cardId);
                  if (errorTimer) {
                    clearInterval(errorTimer);
                    timersRef.current.delete(cardId);
                  }
                  return;
                }
                case "result": {
                  completeAnalysis(cardId, data as AnalysisResultPayload);
                  analysisCompleted = true;
                  const resultEntry: LogEntry = {
                    type: "status",
                    content: `Analysis complete — ${(data as AnalysisResultPayload).proposals?.length ?? 0} proposals`,
                    timestamp: Date.now(),
                    stage,
                  };
                  appendLog(cardId, resultEntry);
                  break;
                }
              }
              currentEvent = "";
            }
          }
        }

        if (analysisCompleted) {
          const updatedCard = useExtractStore.getState().cards.get(cardId);
          if (updatedCard?.autoRefine) {
            void handleRefine(cardId);
          }
        }
      } catch (err) {
        failAnalysis(
          cardId,
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        // Clear elapsed timer
        const finalTimer = timersRef.current.get(cardId);
        if (finalTimer) {
          clearInterval(finalTimer);
          timersRef.current.delete(cardId);
        }
      }
    },
    [
      startAnalysis,
      appendLog,
      completeAnalysis,
      failAnalysis,
      handleRefine,
      setNormalizedImage,
      tickElapsed,
    ],
  );

  return (
    <div className="fixed inset-0 text-[#e6edf7]">
      <CanvasViewport />
      <CanvasToolbar />
      <InspectorPanel
        onAnalyze={handleAnalyze}
        onRefine={handleRefine}
        onCancelRefine={handleCancelRefine}
      />
      <LogModal />
    </div>
  );
}
