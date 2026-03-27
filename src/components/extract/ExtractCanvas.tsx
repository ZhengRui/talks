"use client";

import { useCallback, useEffect, useRef } from "react";
import CanvasViewport from "./CanvasViewport";
import CanvasToolbar from "./CanvasToolbar";
import InspectorPanel from "./InspectorPanel";
import LogModal from "./LogModal";
import { useExtractStore, type LogEntry } from "./store";
import type { AnalysisResultPayload, AnalysisStage } from "./types";

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

  // Per-card elapsed timers
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );

  // Clean up all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearInterval(timer);
      }
      timers.clear();
    };
  }, []);

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
      const scaledImage = await downscaleImage(card.file);
      const formData = new FormData();
      formData.append("image", scaledImage);
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
    [startAnalysis, appendLog, completeAnalysis, failAnalysis, tickElapsed],
  );

  return (
    <div className="fixed inset-0 text-[#e6edf7]">
      <CanvasViewport />
      <CanvasToolbar />
      <InspectorPanel onAnalyze={handleAnalyze} />
      <LogModal />
    </div>
  );
}
