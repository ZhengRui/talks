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

function splitLeadingProseAndJsonCandidate(content: string): { prose: string; candidate: string | null } {
  const trimmed = content.trim();
  if (!trimmed) return { prose: "", candidate: null };

  const completeFenceMatch = trimmed.match(/^([\s\S]*?)```(?:json)?\s*\n([\s\S]*?)```\s*$/);
  if (completeFenceMatch) {
    return {
      prose: completeFenceMatch[1].trim(),
      candidate: completeFenceMatch[2].trim(),
    };
  }

  const openFenceMatch = trimmed.match(/^([\s\S]*?)```(?:json)?\s*\n([\s\S]*)$/);
  if (openFenceMatch) {
    return {
      prose: openFenceMatch[1].trim(),
      candidate: openFenceMatch[2].trim(),
    };
  }

  if (/^[\[{]/.test(trimmed)) {
    return { prose: "", candidate: trimmed };
  }

  const jsonStart = trimmed.search(/\n\s*[\[{]/);
  if (jsonStart >= 0) {
    return {
      prose: trimmed.slice(0, jsonStart).trim(),
      candidate: trimmed.slice(jsonStart).trim(),
    };
  }

  return { prose: "", candidate: null };
}

function looksLikeJsonFragment(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  if (!/^[\[{]/.test(trimmed)) return false;

  const keyValueLike = /"\s*:\s*|[{}\[\],]/.test(trimmed);
  return keyValueLike;
}

function splitTextAndJson(content: string): { prose: string; json: unknown | null; rawJson: string | null } {
  const trimmed = content.trim();
  if (!trimmed) return { prose: "", json: null, rawJson: null };

  // Try parsing the entire content as JSON first
  try {
    return { prose: "", json: JSON.parse(trimmed), rawJson: null };
  } catch {
    // not pure JSON
  }

  const { prose, candidate } = splitLeadingProseAndJsonCandidate(trimmed);
  if (candidate) {
    try {
      return { prose, json: JSON.parse(candidate), rawJson: null };
    } catch {
      if (looksLikeJsonFragment(candidate)) {
        return { prose, json: null, rawJson: candidate };
      }
    }
  }

  return { prose: "", json: tryParseJsonContent(trimmed), rawJson: null };
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

type JsonLikeTokenKind =
  | "braceOpen"
  | "braceClose"
  | "bracketOpen"
  | "bracketClose"
  | "colon"
  | "comma"
  | "string"
  | "number"
  | "literal"
  | "unknown";

interface JsonLikeToken {
  kind: JsonLikeTokenKind;
  text: string;
}

type JsonLikeNode =
  | { kind: "primitive"; text: string }
  | { kind: "object"; entries: Array<{ key: string; value?: JsonLikeNode }>; complete: boolean }
  | { kind: "array"; items: JsonLikeNode[]; complete: boolean };

const INLINE_JSON_MAX_WIDTH = 120;

function tokenizeJsonLikeText(text: string): JsonLikeToken[] {
  const tokens: JsonLikeToken[] = [];

  for (let index = 0; index < text.length;) {
    const char = text[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "{") {
      tokens.push({ kind: "braceOpen", text: char });
      index += 1;
      continue;
    }
    if (char === "}") {
      tokens.push({ kind: "braceClose", text: char });
      index += 1;
      continue;
    }
    if (char === "[") {
      tokens.push({ kind: "bracketOpen", text: char });
      index += 1;
      continue;
    }
    if (char === "]") {
      tokens.push({ kind: "bracketClose", text: char });
      index += 1;
      continue;
    }
    if (char === ":") {
      tokens.push({ kind: "colon", text: char });
      index += 1;
      continue;
    }
    if (char === ",") {
      tokens.push({ kind: "comma", text: char });
      index += 1;
      continue;
    }

    if (char === "\"") {
      let end = index + 1;
      let escaped = false;
      while (end < text.length) {
        const next = text[end];
        if (escaped) {
          escaped = false;
          end += 1;
          continue;
        }
        if (next === "\\") {
          escaped = true;
          end += 1;
          continue;
        }
        if (next === "\"") {
          end += 1;
          break;
        }
        end += 1;
      }
      tokens.push({ kind: "string", text: text.slice(index, end) });
      index = end;
      continue;
    }

    const numberMatch = text.slice(index).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numberMatch) {
      tokens.push({ kind: "number", text: numberMatch[0] });
      index += numberMatch[0].length;
      continue;
    }

    const literalMatch = text.slice(index).match(/^(?:true|false|null)\b/);
    if (literalMatch) {
      tokens.push({ kind: "literal", text: literalMatch[0] });
      index += literalMatch[0].length;
      continue;
    }

    let end = index + 1;
    while (
      end < text.length &&
      !/\s/.test(text[end]) &&
      !"{}[]:,".includes(text[end])
    ) {
      end += 1;
    }
    tokens.push({ kind: "unknown", text: text.slice(index, end) });
    index = end;
  }

  return tokens;
}

function parseJsonLikeValue(tokens: JsonLikeToken[], start: number): [JsonLikeNode | null, number] {
  const token = tokens[start];
  if (!token) return [null, start];

  if (token.kind === "braceOpen") {
    return parseJsonLikeObject(tokens, start + 1);
  }

  if (token.kind === "bracketOpen") {
    return parseJsonLikeArray(tokens, start + 1);
  }

  return [{ kind: "primitive", text: token.text }, start + 1];
}

function parseJsonLikeObject(tokens: JsonLikeToken[], start: number): [JsonLikeNode, number] {
  const entries: Array<{ key: string; value?: JsonLikeNode }> = [];
  let index = start;
  let complete = false;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.kind === "braceClose") {
      complete = true;
      index += 1;
      break;
    }

    if (token.kind === "comma") {
      index += 1;
      continue;
    }

    if (token.kind !== "string") {
      break;
    }

    const key = token.text;
    index += 1;

    if (tokens[index]?.kind !== "colon") {
      entries.push({ key });
      break;
    }
    index += 1;

    const [value, nextIndex] = parseJsonLikeValue(tokens, index);
    if (!value) {
      entries.push({ key });
      break;
    }

    entries.push({ key, value });
    index = nextIndex;

    if (tokens[index]?.kind === "comma") {
      index += 1;
    }
  }

  return [{ kind: "object", entries, complete }, index];
}

function parseJsonLikeArray(tokens: JsonLikeToken[], start: number): [JsonLikeNode, number] {
  const items: JsonLikeNode[] = [];
  let index = start;
  let complete = false;

  while (index < tokens.length) {
    const token = tokens[index];

    if (token.kind === "bracketClose") {
      complete = true;
      index += 1;
      break;
    }

    if (token.kind === "comma") {
      index += 1;
      continue;
    }

    const [value, nextIndex] = parseJsonLikeValue(tokens, index);
    if (!value) break;
    items.push(value);
    index = nextIndex;

    if (tokens[index]?.kind === "comma") {
      index += 1;
    }
  }

  return [{ kind: "array", items, complete }, index];
}

function formatJsonLikeText(text: string): string {
  const tokens = tokenizeJsonLikeText(text);
  const [node] = parseJsonLikeValue(tokens, 0);
  if (!node) return text;
  return formatJsonLikeNode(node);
}

function tryInlineJsonLikeNode(node: JsonLikeNode): string | null {
  if (node.kind === "primitive") {
    return node.text;
  }

  if (!node.complete) return null;

  if (node.kind === "array") {
    if (node.items.length === 0) return "[]";
    const inlineItems = node.items.map((item) => tryInlineJsonLikeNode(item));
    if (inlineItems.some((item) => item == null)) return null;
    const inline = `[ ${inlineItems.join(", ")} ]`;
    return inline.length <= INLINE_JSON_MAX_WIDTH ? inline : null;
  }

  if (node.entries.length === 0) return "{}";
  const inlineEntries = node.entries.map((entry) => {
    if (!entry.value) return null;
    const value = tryInlineJsonLikeNode(entry.value);
    return value ? `${entry.key}: ${value}` : null;
  });
  if (inlineEntries.some((entry) => entry == null)) return null;
  const inline = `{ ${inlineEntries.join(", ")} }`;
  return inline.length <= INLINE_JSON_MAX_WIDTH ? inline : null;
}

function formatJsonLikeNode(node: JsonLikeNode, indent: number = 0): string {
  const inline = tryInlineJsonLikeNode(node);
  if (inline) return inline;

  if (node.kind === "primitive") {
    return node.text;
  }

  const prefix = " ".repeat(indent);
  const childPrefix = " ".repeat(indent + 2);

  if (node.kind === "array") {
    if (node.items.length === 0) {
      return node.complete ? "[]" : "[";
    }

    const lines = node.items.map((item) => `${childPrefix}${formatJsonLikeNode(item, indent + 2)}`);
    return node.complete
      ? `[\n${lines.join(",\n")}\n${prefix}]`
      : `[\n${lines.join(",\n")}`;
  }

  if (node.entries.length === 0) {
    return node.complete ? "{}" : "{";
  }

  const lines = node.entries.map((entry) => {
    const key = `${childPrefix}${entry.key}:`;
    if (!entry.value) return key;
    return `${key} ${formatJsonLikeNode(entry.value, indent + 2)}`;
  });
  return node.complete
    ? `{\n${lines.join(",\n")}\n${prefix}}`
    : `{\n${lines.join(",\n")}`;
}

function HighlightedJsonBlock({ data }: { data: unknown }) {
  const json = JSON.stringify(data);
  return <HighlightedJsonTextBlock text={formatJsonLikeText(json)} />;
}

function HighlightedJsonTextBlock({ text }: { text: string }) {
  const tokens = text.split(/("(?:[^"\\]|\\.)*"|\b-?\d+(?:\.\d+)?\b|\btrue\b|\bfalse\b|\bnull\b|[{}\[\]:,])/g);

  const nextNonWhitespaceToken = (index: number): string | undefined => {
    for (let cursor = index; cursor < tokens.length; cursor += 1) {
      const candidate = tokens[cursor];
      if (candidate && candidate.trim()) return candidate;
    }
    return undefined;
  };

  return (
    <pre className="my-1.5 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] leading-5">
      {tokens.map((token, i) => {
        if (/^"(?:[^"\\]|\\.)*"$/.test(token)) {
          const next = nextNonWhitespaceToken(i + 1);
          if (next === ":") {
            return <span key={i} className="text-sky-700">{token}</span>;
          }
          return <span key={i} className="text-emerald-700">{token}</span>;
        }
        if (/^-?\d/.test(token)) return <span key={i} className="text-amber-700">{token}</span>;
        if (/^(true|false|null)$/.test(token)) return <span key={i} className="text-violet-600">{token}</span>;
        return <span key={i} className="text-gray-500">{token}</span>;
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
            ) : textParts?.rawJson ? (
              <HighlightedJsonTextBlock text={formatJsonLikeText(textParts.rawJson)} />
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
