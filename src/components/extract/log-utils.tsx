"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { extractJsonPayload } from "@/lib/extract/json-payload";
import type { LogEntry } from "./store";
import type { AnalysisStage } from "./types";

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

function splitTextAndJson(content: string): { prose: string; json: unknown | null } {
  const trimmed = content.trim();
  if (!trimmed) return { prose: "", json: null };

  // Try parsing the entire content as JSON first
  try {
    return { prose: "", json: JSON.parse(trimmed) };
  } catch {
    // not pure JSON
  }

  // Look for a fenced ```json block or a bare JSON payload at the end
  const fenceMatch = trimmed.match(/^([\s\S]*?)```(?:json)?\s*\n([\s\S]*?)```\s*$/);
  if (fenceMatch) {
    try {
      return { prose: fenceMatch[1].trim(), json: JSON.parse(fenceMatch[2].trim()) };
    } catch {
      // invalid JSON inside fence
    }
  }

  // Look for a JSON array/object starting after prose
  const jsonStart = trimmed.search(/\n\s*[\[{]/);
  if (jsonStart >= 0) {
    const candidate = trimmed.slice(jsonStart).trim();
    try {
      return { prose: trimmed.slice(0, jsonStart).trim(), json: JSON.parse(candidate) };
    } catch {
      // not valid JSON
    }
  }

  return { prose: "", json: tryParseJsonContent(trimmed) };
}

function tryParseJsonContent(content: string): unknown | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Codex can emit an earlier draft message followed by a final JSON message.
    // The store merges text entries, so prefer the last blank-line-separated block
    // before falling back to scanning for an embedded JSON payload.
    const blocks = trimmed
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      const block = blocks[index];
      try {
        return JSON.parse(block) as unknown;
      } catch {
        const payload = extractJsonPayload(block);
        if (!payload) continue;
        try {
          return JSON.parse(payload) as unknown;
        } catch {
          continue;
        }
      }
    }

    const payload = extractJsonPayload(trimmed);
    if (!payload) return null;

    try {
      return JSON.parse(payload) as unknown;
    } catch {
      return null;
    }
  }
}

function HighlightedJsonBlock({ data }: { data: unknown }) {
  const json = JSON.stringify(data, null, 2);
  const parts = json.split(/("(?:[^"\\]|\\.)*"|\b\d+\.?\d*\b|\btrue\b|\bfalse\b|\bnull\b)/g);

  return (
    <pre className="my-1.5 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] leading-5">
      {parts.map((part, i) => {
        if (/^".*":?$/.test(part)) {
          const next = parts[i + 1];
          if (next && next.trimStart().startsWith(":")) {
            return <span key={i} className="text-sky-700">{part}</span>;
          }
          return <span key={i} className="text-emerald-700">{part}</span>;
        }
        if (/^\d/.test(part)) return <span key={i} className="text-amber-700">{part}</span>;
        if (/^(true|false|null)$/.test(part)) return <span key={i} className="text-violet-600">{part}</span>;
        return <span key={i} className="text-gray-500">{part}</span>;
      })}
    </pre>
  );
}

export function filterLogEntries(
  log: LogEntry[],
  stage: AnalysisStage,
): LogEntry[] {
  if (!log.some((entry) => entry.stage)) {
    return log;
  }
  return log.filter((entry) => entry.stage === stage);
}

// ---------------------------------------------------------------------------
// Log entry rendering
// ---------------------------------------------------------------------------

export const LOG_ICONS: Record<string, string> = {
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

export function LogEntryRow({ entry }: { entry: LogEntry }) {
  const icon = LOG_ICONS[entry.type] ?? "?";
  const color = LOG_COLORS[entry.type] ?? "text-gray-400";
  const textParts = entry.type === "text" ? splitTextAndJson(entry.content) : null;

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
            {textParts?.prose && (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{textParts.prose}</ReactMarkdown>
            )}
            {textParts?.json ? (
              <HighlightedJsonBlock data={textParts.json} />
            ) : !textParts?.prose ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{entry.content}</ReactMarkdown>
            ) : null}
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
