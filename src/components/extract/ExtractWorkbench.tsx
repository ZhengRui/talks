"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AnalysisResult } from "./types";
import ImageUpload from "./ImageUpload";
import OverlayPreview from "./OverlayPreview";
import ProposalPanel from "./ProposalPanel";

interface LogEntry {
  type: "status" | "thinking" | "text" | "tool" | "tool_result" | "error";
  content: string;
  timestamp: number;
}

// --- Markdown styles for log entries ---
const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-[#e6edf7]">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-[#1a2438] px-1 py-0.5 text-[11px] text-cyan-300">{children}</code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-1.5 overflow-x-auto rounded-lg bg-[#0a0f18] border border-[#1e2a3a] p-2 text-[11px]">{children}</pre>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-1.5 ml-4 list-disc">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-1.5 ml-4 list-decimal">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="mb-0.5">{children}</li>,
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-1 text-[14px] font-bold text-white">{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-1 text-[13px] font-bold text-white">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 text-[12px] font-bold text-slate-200">{children}</h3>,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-1.5 overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead className="border-b border-[#253044]">{children}</thead>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-2 py-1 text-left font-semibold text-[#c8d4e2]">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-t border-[#1e2a3a] px-2 py-1 text-[#8899b0]">{children}</td>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

/**
 * Parse cat -n formatted content (e.g., "  1→content" or "  1\tcontent")
 * into structured lines with line numbers.
 */
function parseCatN(content: string): { isNumbered: boolean; lines: Array<{ num?: number; text: string }> } {
  const rawLines = content.split("\n");
  // Check if content looks like cat -n output (line starts with spaces + number + arrow/tab)
  const catNPattern = /^\s*(\d+)[→\t](.*)$/;
  const firstFew = rawLines.slice(0, 3);
  const isNumbered = firstFew.filter((l) => l.trim()).every((l) => catNPattern.test(l));

  if (isNumbered) {
    return {
      isNumbered: true,
      lines: rawLines.map((line) => {
        const m = line.match(catNPattern);
        return m ? { num: parseInt(m[1], 10), text: m[2] } : { text: line };
      }),
    };
  }
  return { isNumbered: false, lines: rawLines.map((text) => ({ text })) };
}

function ToolResultBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const { isNumbered, lines } = parseCatN(content);
  const isLong = lines.length > 8;
  const displayLines = !expanded && isLong ? lines.slice(0, 8) : lines;

  return (
    <div className="mt-0.5">
      <div className="overflow-x-auto rounded-lg border border-[#1e2a3a] bg-[#0a0f18]">
        <div className="p-2 text-[11px] leading-4 font-mono">
          {displayLines.map((line, i) => (
            <div key={i} className="flex">
              {isNumbered && line.num != null && (
                <span className="mr-3 inline-block w-6 shrink-0 select-none text-right text-[#3a4a60]">
                  {line.num}
                </span>
              )}
              <span className="text-emerald-300/80 whitespace-pre">{line.text}</span>
            </div>
          ))}
          {!expanded && isLong && (
            <div className="text-[#3a4a60] mt-0.5">...</div>
          )}
        </div>
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[10px] text-[#5a6a80] hover:text-slate-400"
        >
          {expanded ? "Show less" : `Show all (${lines.length} lines)`}
        </button>
      )}
    </div>
  );
}

// Shared icon symbols — used by both rendering and markdown export
const LOG_ICONS: Record<string, string> = {
  status: "●",
  thinking: "💭",
  text: "│",
  tool: "⚙",
  tool_result: "↩",
  error: "✗",
};

const LOG_COLORS: Record<string, string> = {
  status: "text-cyan-400",
  thinking: "text-purple-400",
  text: "text-[#3a4a60]",
  tool: "text-amber-400",
  tool_result: "text-emerald-400",
  error: "text-red-400",
};

// Streaming types get appended to the last entry of the same type
const STREAMING_TYPES = new Set(["text", "thinking"]);

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const icon = LOG_ICONS[entry.type] ?? "?";
  const color = LOG_COLORS[entry.type] ?? "text-[#5a6a80]";

  return (
    <div className={`flex gap-2 ${entry.type === "status" || entry.type === "tool" ? "mt-2 first:mt-0" : "mt-0.5"}`}>
      <span className={`shrink-0 pt-0.5 text-[11px] font-mono ${color}`}>{icon}</span>
      <div className="min-w-0 flex-1 text-[12px] leading-5">
        {entry.type === "thinking" && (
          <div className="text-purple-300/70 italic">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{entry.content}</ReactMarkdown>
          </div>
        )}
        {entry.type === "text" && (
          <div className="text-[#c8d4e2]">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{entry.content}</ReactMarkdown>
          </div>
        )}
        {entry.type === "tool" && (
          <span className="font-mono text-amber-200">{entry.content}</span>
        )}
        {entry.type === "tool_result" && (
          <ToolResultBlock content={entry.content} />
        )}
        {entry.type === "status" && (
          <span className="text-[#c8d4e2]">{entry.content}</span>
        )}
        {entry.type === "error" && (
          <span className="text-red-300">{entry.content}</span>
        )}
      </div>
    </div>
  );
}

function logToMarkdown(log: LogEntry[]): string {
  return log.map((entry) => {
    const icon = LOG_ICONS[entry.type] ?? "";
    return `${icon} ${entry.content}`;
  }).join("\n\n");
}

function CopyLogButton({ log }: { log: LogEntry[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(logToMarkdown(log));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md border border-[#364152] px-2 py-0.5 text-[10px] text-[#7c8ca8] hover:bg-[#222c3f] hover:text-slate-300"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function ExtractWorkbench() {
  // Phase 1 state
  const [imageFile, setImageFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [text, setText] = useState("");
  const [slug, setSlug] = useState("");

  // Analysis state
  const [analysis, setAnalysis] = useState<AnalysisResult>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  // Stream log
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Elapsed timer
  useEffect(() => {
    if (loading) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading]);

  // Smart auto-scroll: only scroll if user is near the bottom
  const isNearBottom = useCallback(() => {
    const el = logRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  function addLog(type: LogEntry["type"], content: string) {
    const shouldScroll = isNearBottom();
    setLog((prev) => {
      if (STREAMING_TYPES.has(type) && prev.length > 0 && prev[prev.length - 1].type === type) {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: updated[updated.length - 1].content + content,
        };
        return updated;
      }
      return [...prev, { type, content, timestamp: Date.now() }];
    });
    if (shouldScroll) {
      requestAnimationFrame(() => {
        logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }

  function handleImageSelected(file: File, url: string) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(url);
  }

  async function handleAnalyze() {
    if (!imageFile) return;
    setLoading(true);
    setError(undefined);
    setLog([]);
    setShowLog(true);

    const formData = new FormData();
    formData.append("image", imageFile);
    if (text.trim()) formData.append("text", text.trim());
    if (slug.trim()) formData.append("slug", slug.trim());

    try {
      const response = await fetch("/api/extract/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Analysis failed (${response.status})`);
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
                addLog("status", msg);
                break;
              }
              case "thinking":
                addLog("thinking", data.text);
                break;
              case "text":
                addLog("text", data.text);
                break;
              case "tool":
                addLog("tool", `${data.name}(${typeof data.input === "string" ? data.input : JSON.stringify(data.input).slice(0, 200)})`);
                break;
              case "tool_result":
                addLog("tool_result", data.preview);
                break;
              case "error":
                setError(data.error + (data.raw ? `\nRaw: ${data.raw}` : ""));
                setLoading(false);
                return;
              case "result":
                setAnalysis(data as AnalysisResult);
                setSelectedIndex(0);
                addLog("status", `Analysis complete — ${(data as AnalysisResult).proposals?.length ?? 0} proposals`);
                break;
            }
            currentEvent = "";
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // ---- Shared log panel component ----
  const logPanel = log.length > 0 && (
    <div className="rounded-xl border border-[#253044] bg-[#0b111c]">
      <div className="flex items-center justify-between border-b border-[#1e2a3a] px-3 py-2">
        <button
          type="button"
          onClick={() => setShowLog(!showLog)}
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8ca8] hover:text-slate-300"
        >
          <span className={`transition-transform ${showLog ? "rotate-90" : ""}`}>▶</span>
          Log ({log.length})
        </button>
        <div className="flex items-center gap-3">
          {loading && (
            <span className="flex items-center gap-2 text-[11px] text-cyan-400">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
              {elapsed}s
            </span>
          )}
          <CopyLogButton log={log} />
        </div>
      </div>
      {showLog && (
        <div
          ref={logRef}
          className="max-h-[400px] overflow-y-auto p-3"
        >
          {log.map((entry, i) => (
            <LogEntryRow key={i} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );

  // ---- Phase 2: visualization ----
  if (analysis) {
    return (
      <main className="min-h-screen bg-[#0a0f18] text-[#e6edf7]">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">
              Extracted Templates ({analysis.proposals.length})
            </h1>
            <button
              type="button"
              onClick={() => setAnalysis(undefined)}
              className="rounded-lg border border-[#364152] bg-[#1a2232] px-4 py-2 text-[13px] text-slate-200 hover:bg-[#222c3f]"
            >
              Back
            </button>
          </div>

          <OverlayPreview
            screenshotUrl={analysis.source.imagePath}
            sourceDimensions={analysis.source.dimensions}
            proposals={analysis.proposals}
            selectedIndex={selectedIndex}
            onSelectProposal={setSelectedIndex}
          />

          <ProposalPanel
            proposals={analysis.proposals}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />

          {logPanel}
        </div>
      </main>
    );
  }

  // ---- Phase 1: input ----
  return (
    <main className="min-h-screen bg-[#0a0f18] text-[#e6edf7]">
      <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8">
        <h1 className="text-2xl font-semibold text-white">Extract Templates</h1>

        <div className="flex gap-6">
          <div className="flex-1">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8899b0]">
              Slide Screenshot
            </label>
            <ImageUpload onImageSelected={handleImageSelected} previewUrl={previewUrl} />
          </div>

          <div className="flex w-[360px] shrink-0 flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8899b0]">
                Description (optional)
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Describe the slide or what to extract..."
                rows={4}
                className="w-full rounded-xl border border-[#2b3648] bg-[#0d1421] px-4 py-3 text-[#e6edf7] placeholder-[#5a6a80] focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8899b0]">
                Target Slug (optional)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-talk"
                className="w-full rounded-xl border border-[#2b3648] bg-[#0d1421] px-4 py-3 text-[#e6edf7] placeholder-[#5a6a80] focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <pre className="whitespace-pre-wrap rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
            {error}
          </pre>
        )}

        <button
          onClick={handleAnalyze}
          disabled={!imageFile || loading}
          className="w-full rounded-xl bg-[#2e5fbf] px-6 py-3 font-medium text-white transition-colors hover:bg-[#3a6fd4] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? `Analyzing... (${elapsed}s)` : "Analyze"}
        </button>

        {logPanel}
      </div>
    </main>
  );
}
