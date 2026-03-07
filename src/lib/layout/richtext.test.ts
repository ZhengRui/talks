import { describe, it, expect } from "vitest";
import { parseMarkdownToRuns, isRichText, toPlainText } from "./richtext";
import type { TextRun } from "./types";

describe("isRichText", () => {
  it("returns false for plain string", () => {
    expect(isRichText("hello")).toBe(false);
  });

  it("returns true for TextRun array", () => {
    expect(isRichText([{ text: "hello" }])).toBe(true);
  });

  it("returns true for empty array", () => {
    expect(isRichText([])).toBe(true);
  });
});

describe("toPlainText", () => {
  it("returns string as-is", () => {
    expect(toPlainText("hello")).toBe("hello");
  });

  it("concatenates TextRun texts", () => {
    const runs: TextRun[] = [
      { text: "hello " },
      { text: "world" },
    ];
    expect(toPlainText(runs)).toBe("hello world");
  });

  it("handles empty array", () => {
    expect(toPlainText([])).toBe("");
  });
});

describe("parseMarkdownToRuns", () => {
  it("returns plain text as single run", () => {
    const runs = parseMarkdownToRuns("hello world");
    expect(runs).toEqual([{ text: "hello world" }]);
  });

  it("parses **bold** markers", () => {
    const runs = parseMarkdownToRuns("hello **world**");
    expect(runs).toEqual([
      { text: "hello " },
      { text: "world", bold: true },
    ]);
  });

  it("parses *italic* markers", () => {
    const runs = parseMarkdownToRuns("hello *world*");
    expect(runs).toEqual([
      { text: "hello " },
      { text: "world", italic: true },
    ]);
  });

  it("parses mixed bold and italic", () => {
    const runs = parseMarkdownToRuns("The **Fall** of *Tang*");
    expect(runs).toEqual([
      { text: "The " },
      { text: "Fall", bold: true },
      { text: " of " },
      { text: "Tang", italic: true },
    ]);
  });

  it("handles bold at start of string", () => {
    const runs = parseMarkdownToRuns("**bold** text");
    expect(runs).toEqual([
      { text: "bold", bold: true },
      { text: " text" },
    ]);
  });

  it("handles multiple bold segments", () => {
    const runs = parseMarkdownToRuns("**a** and **b**");
    expect(runs).toEqual([
      { text: "a", bold: true },
      { text: " and " },
      { text: "b", bold: true },
    ]);
  });

  it("returns empty array for empty string", () => {
    const runs = parseMarkdownToRuns("");
    expect(runs).toEqual([]);
  });

  it("applies highlightColor to bold runs", () => {
    const runs = parseMarkdownToRuns("hello **world**", "#ff0000");
    expect(runs).toEqual([
      { text: "hello " },
      { text: "world", bold: true, color: "#ff0000" },
    ]);
  });

  it("does not apply highlightColor to italic runs", () => {
    const runs = parseMarkdownToRuns("hello *world*", "#ff0000");
    expect(runs).toEqual([
      { text: "hello " },
      { text: "world", italic: true },
    ]);
  });
});
