"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useExtractStore, type LogEntry } from "./store";

// ---------------------------------------------------------------------------
// Markdown styles for log entries (light theme)
// ---------------------------------------------------------------------------

const mdComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-gray-800">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-blue-600">{children}</code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-1.5 overflow-x-auto rounded-lg bg-gray-50 border border-gray-200 p-2 text-[11px]">{children}</pre>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-1.5 ml-4 list-disc">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-1.5 ml-4 list-decimal">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="mb-0.5">{children}</li>,
  h1: ({ children }: { children?: React.ReactNode }) => <h1 className="mb-1 text-[14px] font-bold text-gray-800">{children}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2 className="mb-1 text-[13px] font-bold text-gray-800">{children}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mb-1 text-[12px] font-bold text-gray-700">{children}</h3>,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-1.5 overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => <thead className="border-b border-gray-200">{children}</thead>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-2 py-1 text-left font-semibold text-gray-600">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-t border-gray-100 px-2 py-1 text-gray-500">{children}</td>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCatN(content: string): { isNumbered: boolean; lines: Array<{ num?: number; text: string }> } {
  const rawLines = content.split("\n");
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
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50">
        <div className="p-2 text-[11px] leading-4 font-mono">
          {displayLines.map((line, i) => (
            <div key={i} className="flex">
              {isNumbered && line.num != null && (
                <span className="mr-3 inline-block w-6 shrink-0 select-none text-right text-gray-400">
                  {line.num}
                </span>
              )}
              <span className="text-gray-600 whitespace-pre">{line.text}</span>
            </div>
          ))}
          {!expanded && isLong && (
            <div className="text-gray-400 mt-0.5">...</div>
          )}
        </div>
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[10px] text-gray-400 hover:text-gray-600"
        >
          {expanded ? "Show less" : `Show all (${lines.length} lines)`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Log entry rendering
// ---------------------------------------------------------------------------

const LOG_ICONS: Record<string, string> = {
  status: "\u25CF",
  thinking: "\uD83D\uDCAD",
  text: "\u2502",
  tool: "\u2699",
  tool_result: "\u21A9",
  error: "\u2717",
};

const LOG_COLORS: Record<string, string> = {
  status: "text-blue-500",
  thinking: "text-purple-500",
  text: "text-gray-400",
  tool: "text-amber-500",
  tool_result: "text-emerald-500",
  error: "text-red-500",
};

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const icon = LOG_ICONS[entry.type] ?? "?";
  const color = LOG_COLORS[entry.type] ?? "text-gray-400";

  return (
    <div className={`flex gap-2 ${entry.type === "status" || entry.type === "tool" ? "mt-2 first:mt-0" : "mt-0.5"}`}>
      <span className={`shrink-0 pt-0.5 text-[11px] font-mono ${color}`}>{icon}</span>
      <div className="min-w-0 flex-1 text-[12px] leading-5">
        {entry.type === "thinking" && (
          <div className="text-purple-600/70 italic">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{entry.content}</ReactMarkdown>
          </div>
        )}
        {entry.type === "text" && (
          <div className="text-gray-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{entry.content}</ReactMarkdown>
          </div>
        )}
        {entry.type === "tool" && (
          <span className="font-mono text-amber-700">{entry.content}</span>
        )}
        {entry.type === "tool_result" && (
          <ToolResultBlock content={entry.content} />
        )}
        {entry.type === "status" && (
          <span className="text-gray-600">{entry.content}</span>
        )}
        {entry.type === "error" && (
          <span className="text-red-600">{entry.content}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyLogButton({ log }: { log: LogEntry[] }) {
  const [copied, setCopied] = useState(false);
  const text = log.map((e) => `${LOG_ICONS[e.type] ?? ""} ${e.content}`).join("\n\n");
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      title={copied ? "Copied!" : "Copy log"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// LogModal
// ---------------------------------------------------------------------------

export default function LogModal() {
  const { open, cardId } = useExtractStore((s) => s.logModal);
  const cards = useExtractStore((s) => s.cards);
  const closeLogModal = useExtractStore((s) => s.closeLogModal);
  const scrollRef = useRef<HTMLDivElement>(null);

  const card = open && cardId ? cards.get(cardId) : undefined;
  const log = card?.log ?? [];

  const wasAtBottom = useRef(true);
  useEffect(() => {
    wasAtBottom.current = true;
  }, [open]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (wasAtBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [log.length, log[log.length - 1]?.timestamp]);
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    wasAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLogModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeLogModal]);

  if (!open || !cardId) return null;

  return (
    <div
      data-testid="log-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
      onClick={closeLogModal}
    >
      <div
        className="w-[1100px] max-w-[90vw] max-h-[80vh] rounded-xl border border-gray-200 bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800">Analysis Log</h2>
          <div className="flex items-center gap-2">
            {log.length > 0 && <CopyLogButton log={log} />}
            <button
              type="button"
              onClick={closeLogModal}
              className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 min-h-0">
          {log.length === 0 ? (
            <p className="text-[13px] text-gray-400">No log entries yet.</p>
          ) : (
            log.map((entry, i) => <LogEntryRow key={i} entry={entry} />)
          )}
        </div>
      </div>
    </div>
  );
}
