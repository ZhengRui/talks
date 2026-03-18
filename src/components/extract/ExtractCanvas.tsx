"use client";

import { useCallback, useEffect, useRef } from "react";
import CanvasViewport from "./CanvasViewport";
import CanvasToolbar from "./CanvasToolbar";
import InspectorPanel from "./InspectorPanel";
import YamlModal from "./YamlModal";
import LogModal from "./LogModal";
import { useExtractStore, type LogEntry } from "./store";
import type { AnalysisResult } from "./types";

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
    return () => {
      for (const timer of timersRef.current.values()) {
        clearInterval(timer);
      }
      timersRef.current.clear();
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

      const formData = new FormData();
      formData.append("image", card.file);
      if (card.description.trim()) {
        formData.append("text", card.description.trim());
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
                  };
                  appendLog(cardId, statusEntry);
                  break;
                }
                case "thinking": {
                  const thinkingEntry: LogEntry = {
                    type: "thinking",
                    content: data.text,
                    timestamp: Date.now(),
                  };
                  appendLog(cardId, thinkingEntry);
                  break;
                }
                case "text": {
                  const textEntry: LogEntry = {
                    type: "text",
                    content: data.text,
                    timestamp: Date.now(),
                  };
                  appendLog(cardId, textEntry);
                  break;
                }
                case "tool": {
                  const toolEntry: LogEntry = {
                    type: "tool",
                    content: `${data.name}(${typeof data.input === "string" ? data.input : JSON.stringify(data.input).slice(0, 200)})`,
                    timestamp: Date.now(),
                  };
                  appendLog(cardId, toolEntry);
                  break;
                }
                case "tool_result": {
                  const toolResultEntry: LogEntry = {
                    type: "tool_result",
                    content: data.preview,
                    timestamp: Date.now(),
                  };
                  appendLog(cardId, toolResultEntry);
                  break;
                }
                case "error": {
                  const errorMsg =
                    data.error + (data.raw ? `\nRaw: ${data.raw}` : "");
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
                  completeAnalysis(cardId, data as AnalysisResult);
                  const resultEntry: LogEntry = {
                    type: "status",
                    content: `Analysis complete — ${(data as AnalysisResult).proposals?.length ?? 0} proposals`,
                    timestamp: Date.now(),
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
      <YamlModal />
      <LogModal />
    </div>
  );
}
