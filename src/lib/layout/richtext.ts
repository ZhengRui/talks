import type { TextRun, RichText } from "./types";

/** Check if a RichText value is a TextRun array (not a plain string). */
export function isRichText(text: RichText): text is TextRun[] {
  return Array.isArray(text);
}

/** Extract plain text from a RichText value. */
export function toPlainText(text: RichText): string {
  if (typeof text === "string") return text;
  return text.map((r) => r.text).join("");
}

/**
 * Parse markdown-style inline formatting to TextRun[].
 * Supports **bold** and *italic*.
 * If highlightColor is provided, bold runs get that color applied.
 */
export function parseMarkdownToRuns(text: string, highlightColor?: string): TextRun[] {
  if (!text) return [];

  // Match **bold** and *italic* (bold first via ordering)
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const runs: TextRun[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const idx = match.index!;
    if (idx > lastIndex) {
      runs.push({ text: text.slice(lastIndex, idx) });
    }

    const segment = match[0];
    if (segment.startsWith("**") && segment.endsWith("**")) {
      const run: TextRun = { text: segment.slice(2, -2), bold: true };
      if (highlightColor) run.color = highlightColor;
      runs.push(run);
    } else if (segment.startsWith("*") && segment.endsWith("*")) {
      runs.push({ text: segment.slice(1, -1), italic: true });
    }

    lastIndex = idx + segment.length;
  }

  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex) });
  }

  if (runs.length === 0) {
    return [{ text }];
  }

  return runs;
}
