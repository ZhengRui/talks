# v8 Phase 1: Transform + Rich Text Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `TransformDef` (rotation, scale, flip) and `RichText` (styled text runs) to the IR, web renderer, and PPTX exporter — the two highest-impact v8 features.

**Architecture:** Both features add optional fields to existing element types. TransformDef maps to CSS `transform` for web and OOXML `<a:xfrm rot/flipH/flipV>` for PPTX. RichText is a union `string | TextRun[]` — backward compatible with plain strings, renders as styled `<span>` elements in web and `TextProps[]` in PptxGenJS.

**Tech Stack:** TypeScript, React, PptxGenJS, JSZip (OOXML post-processing), Vitest

---

## Task 1: Add TransformDef type and transform field to IR

**Files:**
- Modify: `src/lib/layout/types.ts`

**Step 1: Add TransformDef interface after GradientDef (line 15)**

After the `GradientDef` interface, add:

```typescript
export interface TransformDef {
  rotate?: number;      // degrees (positive = clockwise)
  scaleX?: number;      // default 1.0
  scaleY?: number;      // default 1.0
  flipH?: boolean;
  flipV?: boolean;
}
```

**Step 2: Add `transform?: TransformDef` to all 9 element types**

Add `transform?: TransformDef;` to: `TextElement`, `ImageElement`, `ShapeElement`, `GroupElement`, `CodeElement`, `TableElement`, `ListElement`, `VideoElement`, `IframeElement`.

Place it after `clipPath?` on each element (alongside the other shared optional fields: `entrance`, `animation`, `clipPath`).

Update the comment block at lines 108-115 to include `transform`:
```
//   transform? — rotation, scale, flip. Maps to CSS transform + OOXML <a:xfrm>.
```

**Step 3: Run type check**

Run: `bunx tsc --noEmit`
Expected: PASS (new optional fields don't break anything)

**Step 4: Commit**

```
feat(types): add TransformDef and transform field to all element types
```

---

## Task 2: Add RichText and TextRun types to IR

**Files:**
- Modify: `src/lib/layout/types.ts`

**Step 1: Add TextRun and RichText types after TextStyle (line 39)**

```typescript
/** A styled run of text within a rich text block. */
export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  letterSpacing?: number;
  highlight?: string;     // background color on this run
  superscript?: boolean;
  subscript?: boolean;
}

/**
 * Rich text content: plain string (backward compat) or array of styled runs.
 * Markdown shorthand: "The **Fall** of *Tang*" is parsed by renderers.
 */
export type RichText = string | TextRun[];
```

**Step 2: Update TextElement.text from `string` to `RichText`**

In `TextElement` (line 121): change `text: string;` → `text: RichText;`

**Step 3: Update ListElement.items from `string[]` to `RichText[]`**

In `ListElement`: change `items: string[];` → `items: RichText[];`

**Step 4: Update TableElement to use RichText**

In `TableElement`: change `headers: string[];` → `headers: RichText[];` and `rows: string[][];` → `rows: RichText[][];`

**Step 5: Run type check**

Run: `bunx tsc --noEmit`
Expected: FAIL — downstream code expects `string` but now gets `RichText`. This is expected; we'll fix the consumers in subsequent tasks.

Note the list of errors — they tell us exactly which files need updates.

**Step 6: Commit**

```
feat(types): add TextRun, RichText types and update element text fields
```

---

## Task 3: Write tests for transform CSS rendering

**Files:**
- Create: `src/lib/layout/transform.test.ts`
- Create: `src/lib/layout/transform.ts`

**Step 1: Write failing tests**

Create `src/lib/layout/transform.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { transformToCSS } from "./transform";
import type { TransformDef } from "./types";

describe("transformToCSS", () => {
  it("returns empty object when transform is undefined", () => {
    expect(transformToCSS(undefined)).toEqual({});
  });

  it("returns empty object when transform has no properties", () => {
    expect(transformToCSS({})).toEqual({});
  });

  it("converts rotation to CSS transform", () => {
    const result = transformToCSS({ rotate: 45 });
    expect(result.transform).toBe("rotate(45deg)");
  });

  it("converts negative rotation", () => {
    const result = transformToCSS({ rotate: -15 });
    expect(result.transform).toBe("rotate(-15deg)");
  });

  it("converts scale", () => {
    const result = transformToCSS({ scaleX: 1.5, scaleY: 0.8 });
    expect(result.transform).toBe("scale(1.5, 0.8)");
  });

  it("converts flipH to scaleX(-1)", () => {
    const result = transformToCSS({ flipH: true });
    expect(result.transform).toBe("scaleX(-1)");
  });

  it("converts flipV to scaleY(-1)", () => {
    const result = transformToCSS({ flipV: true });
    expect(result.transform).toBe("scaleY(-1)");
  });

  it("combines rotation and flip", () => {
    const result = transformToCSS({ rotate: 45, flipH: true });
    expect(result.transform).toBe("rotate(45deg) scaleX(-1)");
  });

  it("combines all transforms", () => {
    const result = transformToCSS({ rotate: 90, scaleX: 2, scaleY: 0.5, flipH: true });
    // scale() includes scaleX, flip multiplies into it
    expect(result.transform).toBe("rotate(90deg) scale(-2, 0.5)");
  });

  it("ignores default scale values (1.0)", () => {
    const result = transformToCSS({ scaleX: 1, scaleY: 1 });
    expect(transformToCSS({ scaleX: 1, scaleY: 1 })).toEqual({});
  });

  it("handles scaleX only (no scaleY)", () => {
    const result = transformToCSS({ scaleX: 2 });
    expect(result.transform).toBe("scale(2, 1)");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/lib/layout/transform.test.ts`
Expected: FAIL — `transform.ts` doesn't exist yet

**Step 3: Implement transformToCSS**

Create `src/lib/layout/transform.ts`:

```typescript
import type { TransformDef } from "./types";

/**
 * Convert a TransformDef to CSS properties.
 * Returns an object with `transform` string (if any transforms are specified).
 */
export function transformToCSS(t: TransformDef | undefined): { transform?: string } {
  if (!t) return {};

  const parts: string[] = [];

  if (t.rotate) {
    parts.push(`rotate(${t.rotate}deg)`);
  }

  const sx = (t.scaleX ?? 1) * (t.flipH ? -1 : 1);
  const sy = (t.scaleY ?? 1) * (t.flipV ? -1 : 1);
  const hasScale = t.scaleX !== undefined || t.scaleY !== undefined;
  const hasFlip = t.flipH || t.flipV;

  if (hasScale || hasFlip) {
    if (sx !== 1 || sy !== 1) {
      if (sy === 1 && !hasScale) {
        parts.push(`scaleX(${sx})`);
      } else if (sx === 1 && !hasScale) {
        parts.push(`scaleY(${sy})`);
      } else {
        parts.push(`scale(${sx}, ${sy})`);
      }
    }
  }

  if (parts.length === 0) return {};
  return { transform: parts.join(" ") };
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/lib/layout/transform.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(layout): add transformToCSS helper with tests
```

---

## Task 4: Write tests for rich text parsing

**Files:**
- Create: `src/lib/layout/richtext.test.ts`
- Create: `src/lib/layout/richtext.ts`

**Step 1: Write failing tests**

Create `src/lib/layout/richtext.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseMarkdownToRuns, isRichText, toPlainText } from "./richtext";
import type { TextRun, RichText } from "./types";

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
});
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/lib/layout/richtext.test.ts`
Expected: FAIL — `richtext.ts` doesn't exist

**Step 3: Implement rich text utilities**

Create `src/lib/layout/richtext.ts`:

```typescript
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

  // Match **bold** and *italic* (bold takes priority via ordering)
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const runs: TextRun[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const idx = match.index!;
    // Add preceding plain text
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

  // Add remaining text
  if (lastIndex < text.length) {
    runs.push({ text: text.slice(lastIndex) });
  }

  // If no formatting found, return single run
  if (runs.length === 0) {
    return [{ text }];
  }

  return runs;
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/lib/layout/richtext.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(layout): add rich text utilities (parseMarkdownToRuns, isRichText, toPlainText)
```

---

## Task 5: Integrate transform into web renderer (LayoutRenderer.tsx)

**Files:**
- Modify: `src/components/LayoutRenderer.tsx`

**Step 1: Import transformToCSS**

Add to imports (line 1):
```typescript
import { transformToCSS } from "@/lib/layout/transform";
```

Also add `TransformDef` to the type imports from `@/lib/layout/types`.

**Step 2: Update animProps to accept and apply transform**

Modify the `animProps` function (line 43) to also accept a `TransformDef`:

```typescript
function animProps(
  entrance?: EntranceDef,
  animation?: string,
  clipPath?: string,
  transform?: TransformDef,
): {
  className?: string;
  style?: React.CSSProperties;
} {
  // ... existing logic unchanged ...

  // Apply transform
  if (transform) {
    const txCSS = transformToCSS(transform);
    if (txCSS.transform) {
      const existingTransform = result.style?.transform;
      result.style = {
        ...result.style,
        transform: existingTransform
          ? `${existingTransform} ${txCSS.transform}`
          : txCSS.transform,
      };
    }
  }

  return result;
}
```

**Step 3: Pass transform through all 9 render functions**

In every render function (renderText, renderImage, renderShape, renderGroup, renderCode, renderTable, renderList, renderVideo, renderIframe), update the `animProps` call to pass `el.transform`:

```typescript
// Before:
const anim = animProps(el.entrance, el.animation, el.clipPath);
// After:
const anim = animProps(el.entrance, el.animation, el.clipPath, el.transform);
```

**Step 4: Run type check**

Run: `bunx tsc --noEmit`
Expected: PASS (or only RichText-related errors remain)

**Step 5: Commit**

```
feat(renderer): apply CSS transform from TransformDef on all elements
```

---

## Task 6: Integrate RichText into web renderer (LayoutRenderer.tsx)

**Files:**
- Modify: `src/components/LayoutRenderer.tsx`

**Step 1: Import rich text utilities**

Add to imports:
```typescript
import { isRichText, parseMarkdownToRuns } from "@/lib/layout/richtext";
import type { TextRun, RichText } from "@/lib/layout/types";
```

**Step 2: Create renderRichText helper**

Replace the existing `renderInlineHighlight` and `renderInlineMarkdown` functions with a unified `renderRichText`:

```typescript
/** Render a TextRun as a styled <span>. */
function renderTextRun(run: TextRun, index: number): React.ReactNode {
  const style: React.CSSProperties = {};
  if (run.bold) style.fontWeight = 700;
  if (run.italic) style.fontStyle = "italic";
  if (run.underline) style.textDecoration = "underline";
  if (run.strikethrough) style.textDecoration = (style.textDecoration ? style.textDecoration + " " : "") + "line-through";
  if (run.color) style.color = run.color;
  if (run.fontSize) style.fontSize = run.fontSize;
  if (run.fontFamily) style.fontFamily = run.fontFamily;
  if (run.letterSpacing) style.letterSpacing = run.letterSpacing;
  if (run.highlight) style.backgroundColor = run.highlight;
  if (run.superscript) { style.verticalAlign = "super"; style.fontSize = "0.7em"; }
  if (run.subscript) { style.verticalAlign = "sub"; style.fontSize = "0.7em"; }

  const hasStyle = Object.keys(style).length > 0;
  if (!hasStyle) return run.text;
  return <span key={index} style={style}>{run.text}</span>;
}

/**
 * Render RichText content (string or TextRun[]).
 * For strings: parse **bold** and *italic* markdown, apply highlightColor if set.
 * For TextRun[]: render each run with its inline styles.
 */
function renderRichText(text: RichText, highlightColor?: string): React.ReactNode {
  if (typeof text === "string") {
    // No formatting markers and no highlight → return plain string
    if (!highlightColor && !text.includes("**") && !text.includes("*")) {
      return text;
    }
    const runs = parseMarkdownToRuns(text, highlightColor);
    if (runs.length === 1 && !runs[0].bold && !runs[0].italic) return text;
    return runs.map((run, i) => renderTextRun(run, i));
  }
  // TextRun array
  return text.map((run, i) => renderTextRun(run, i));
}
```

**Step 3: Update renderText to use renderRichText**

In `renderText` (line 212), replace:
```typescript
{hc ? renderInlineHighlight(el.text, hc) : el.text}
```
with:
```typescript
{renderRichText(el.text, hc)}
```

**Step 4: Update renderList to use renderRichText**

In the `renderList` function, replace `renderInlineMarkdown(item)` with `renderRichText(item)`.

**Step 5: Update renderTable to use renderRichText**

In `renderTable`, headers and cell content should use `renderRichText(cell)` instead of raw string rendering.

**Step 6: Remove old renderInlineHighlight and renderInlineMarkdown**

Delete the two old functions (they're replaced by `renderRichText`).

**Step 7: Run type check and tests**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: PASS

**Step 8: Commit**

```
feat(renderer): unified renderRichText replacing inline markdown helpers
```

---

## Task 7: Integrate transform into PPTX exporter

**Files:**
- Modify: `src/lib/export/pptx.ts`
- Modify: `src/lib/export/pptx-effects.ts`

Transform in PPTX requires OOXML post-processing. PptxGenJS `addShape`/`addText` accept `rotate` natively, but `flipH`/`flipV` require XML manipulation.

**Step 1: Import TransformDef**

In `pptx.ts`, add `TransformDef` to the type imports from `@/lib/layout/types`.

**Step 2: Apply rotation via PptxGenJS options**

PptxGenJS supports `rotate` natively on shapes and text. For each `renderElement` function that calls `slide.addShape()` or `slide.addText()`, pass the rotation angle if present:

In `renderText` — add `rotate` to opts:
```typescript
function renderText(slide: Slide, el: TextElement): void {
  const spid = slideObjectCount(slide) + 2;
  const opts = textOpts(el.style, el.rect);
  if (el.transform?.rotate) opts.rotate = el.transform.rotate;
  slide.addText(toPlainText(el.text), opts);
  // ... existing alpha tracking ...
}
```

In `renderShape` — add `rotate` to shape opts:
```typescript
if (el.transform?.rotate) {
  shapeOpts.rotate = el.transform.rotate;
}
```

In `renderImage` — PptxGenJS `addImage` also accepts `rotate`:
```typescript
if (el.transform?.rotate) {
  imageOpts.rotate = el.transform.rotate;
}
```

**Step 3: Track flip transforms for OOXML post-processing**

Add a per-slide accumulator for flip transforms (alongside existing gradient/alpha accumulators):

```typescript
let slideFlipEntries: { spid: number; flipH?: boolean; flipV?: boolean }[] = [];
```

In each render function, after the `slide.addShape`/`addText` call, track flips:
```typescript
if (el.transform?.flipH || el.transform?.flipV) {
  slideFlipEntries.push({
    spid,
    flipH: el.transform.flipH,
    flipV: el.transform.flipV,
  });
}
```

**Step 4: Add flip post-processor to pptx-effects.ts**

Add a new exported function:

```typescript
export interface FlipEntry {
  spid: number;
  flipH?: boolean;
  flipV?: boolean;
}

export function applyFlipsToSlideXml(
  slideXml: string,
  entries: FlipEntry[],
): string {
  let xml = slideXml;
  for (const entry of entries) {
    // Find <a:xfrm> for this spid and add flipH/flipV attributes
    const pattern = new RegExp(
      `(<p:cNvPr\\s+id="${entry.spid}"[\\s\\S]*?<a:xfrm)(\\s*[^>]*>)`,
    );
    const match = xml.match(pattern);
    if (!match) continue;

    let xfrmAttrs = match[2];
    if (entry.flipH) {
      xfrmAttrs = ` flipH="1"` + xfrmAttrs;
    }
    if (entry.flipV) {
      xfrmAttrs = ` flipV="1"` + xfrmAttrs;
    }
    xml = xml.replace(match[0], match[1] + xfrmAttrs);
  }
  return xml;
}
```

**Step 5: Call flip post-processor in exportPptx**

In the Phase 3 post-processing loop in `exportPptx`, apply flips:
```typescript
if (slideFlipEntries.length > 0) {
  slideXml = applyFlipsToSlideXml(slideXml, slideFlipEntries);
  modified = true;
}
```

**Step 6: Run type check**

Run: `bunx tsc --noEmit`
Expected: PASS (or only RichText-related errors remain from other files)

**Step 7: Commit**

```
feat(pptx): support rotation and flip transforms in PPTX export
```

---

## Task 8: Integrate RichText into PPTX exporter

**Files:**
- Modify: `src/lib/export/pptx.ts`

**Step 1: Import rich text utilities**

Add imports:
```typescript
import { isRichText, toPlainText, parseMarkdownToRuns } from "@/lib/layout/richtext";
import type { TextRun, RichText } from "@/lib/layout/types";
```

**Step 2: Create richTextToProps helper**

Add a function that converts `RichText` to PptxGenJS `TextProps[]`:

```typescript
/** Convert RichText to PptxGenJS TextProps array. */
function richTextToProps(
  text: RichText,
  baseStyle: TextStyle,
): PptxGenJS.TextProps[] {
  // Parse markdown if plain string
  let runs: TextRun[];
  if (typeof text === "string") {
    if (!text.includes("**") && !text.includes("*") && !baseStyle.highlightColor) {
      // Plain text, no formatting — use single-run shortcut
      return [{ text, options: {} }];
    }
    runs = parseMarkdownToRuns(text, baseStyle.highlightColor);
  } else {
    runs = text;
  }

  return runs.map((run) => {
    const opts: PptxGenJS.TextPropsOptions = {};
    if (run.bold) opts.bold = true;
    if (run.italic) opts.italic = true;
    if (run.underline) opts.underline = { style: "sng" } as PptxGenJS.TextPropsOptions["underline"];
    if (run.strikethrough) opts.strike = "sngStrike" as PptxGenJS.TextPropsOptions["strike"];
    if (run.color) opts.color = hexColor(run.color);
    if (run.fontSize) opts.fontSize = pxToPoints(run.fontSize);
    if (run.fontFamily) opts.fontFace = parseFontFamily(run.fontFamily);
    if (run.letterSpacing) opts.charSpacing = pxToPoints(run.letterSpacing);
    if (run.highlight) opts.highlight = hexColor(run.highlight);
    if (run.superscript) opts.superscript = true;
    if (run.subscript) opts.subscript = true;
    return { text: run.text, options: opts };
  });
}
```

**Step 3: Update renderText to use richTextToProps**

Replace the current `renderText`:

```typescript
function renderText(slide: Slide, el: TextElement): void {
  const spid = slideObjectCount(slide) + 2;
  const opts = textOpts(el.style, el.rect);
  if (el.transform?.rotate) opts.rotate = el.transform.rotate;

  // Use rich text props if text has runs or markdown formatting
  const props = richTextToProps(el.text, el.style);
  if (props.length === 1 && Object.keys(props[0].options ?? {}).length === 0) {
    // Simple text — use flat string for cleaner output
    slide.addText(toPlainText(el.text), opts);
  } else {
    slide.addText(props, opts);
  }

  // Track text color alpha for OOXML post-processing
  const alpha = colorAlpha(el.style.color);
  if (alpha !== undefined && alpha > 0) {
    slideTextAlphaEntries.push({
      spid,
      alpha: Math.round((100 - alpha) * 1000),
    });
  }
}
```

**Step 4: Update renderList to handle RichText items**

Update the list rendering to use `toPlainText` for PptxGenJS (rich text in list items requires `TextProps[]` per item):

```typescript
const items: PptxGenJS.TextProps[] = el.items.map((item, i) => ({
  text: toPlainText(item),
  options: { ... }
}));
```

(Full rich text in list items is a stretch — for now, use plain text extraction.)

**Step 5: Update renderTable similarly**

Use `toPlainText()` for table headers and cells.

**Step 6: Run type check and tests**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: PASS

**Step 7: Commit**

```
feat(pptx): support RichText with styled runs in PPTX text export
```

---

## Task 9: Fix remaining type errors from RichText change

**Files:**
- Modify: Various files that reference `TextElement.text` as `string`

After changing `TextElement.text` to `RichText`, some downstream code may need `toPlainText()` calls. Common locations:

- `src/lib/layout/helpers.ts` — `estimateTextHeight` may receive `RichText`, needs `toPlainText()` wrapper
- `src/lib/layout/components/resolvers.ts` — resolvers create `TextElement` with `text: string` — these are fine since `string` is assignable to `RichText`
- `src/lib/layout/components/stacker.ts` — may read `.text` for height estimation — wrap with `toPlainText()`
- `src/lib/dsl/` — DSL engine produces strings from templates — these are fine since `string` is assignable to `RichText`

**Step 1: Run tsc and catalog errors**

Run: `bunx tsc --noEmit 2>&1 | head -100`
Fix each error by adding `toPlainText()` where code reads `el.text` expecting a `string`.

**Step 2: Fix each error**

For each location that reads `el.text` as a `string`:
- If it's for display/rendering: use `renderRichText` or `richTextToProps`
- If it's for measurement/comparison: wrap with `toPlainText()`
- If it's creating a TextElement with `text: someString`: no change needed (string is assignable to RichText)

**Step 3: Run type check and all tests**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: PASS

**Step 4: Commit**

```
fix: resolve remaining RichText type errors across codebase
```

---

## Task 10: Write integration tests for transform + RichText in PPTX

**Files:**
- Modify: `src/lib/export/pptx.test.ts`

**Step 1: Add transform test**

```typescript
it("handles elements with transform (rotation)", async () => {
  const layout: LayoutPresentation = {
    title: "Transform Test",
    slides: [{
      width: 1920,
      height: 1080,
      background: "#ffffff",
      elements: [{
        kind: "shape",
        id: "rotated",
        rect: { x: 100, y: 100, w: 200, h: 50 },
        shape: "rect",
        style: { fill: "#ff0000" },
        transform: { rotate: 45 },
      }],
    }],
  };
  const buffer = await exportPptx(layout);
  expect(buffer).toBeInstanceOf(Buffer);
  expect(buffer.length).toBeGreaterThan(0);

  // Verify the PPTX XML contains rotation
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");
  expect(slideXml).toBeDefined();
  // PptxGenJS writes rotation as rot attribute in degrees * 60000
  // 45 degrees = 2700000
  expect(slideXml).toContain("2700000");
});
```

**Step 2: Add rich text test**

```typescript
it("handles TextElement with RichText runs", async () => {
  const layout: LayoutPresentation = {
    title: "RichText Test",
    slides: [{
      width: 1920,
      height: 1080,
      background: "#ffffff",
      elements: [{
        kind: "text",
        id: "rich",
        rect: { x: 100, y: 100, w: 600, h: 80 },
        text: [
          { text: "Hello " },
          { text: "World", bold: true, color: "#ff0000" },
        ],
        style: {
          fontFamily: "Inter",
          fontSize: 32,
          fontWeight: 400,
          color: "#000000",
          lineHeight: 1.2,
        },
      }],
    }],
  };
  const buffer = await exportPptx(layout);
  expect(buffer).toBeInstanceOf(Buffer);

  // Verify PPTX contains both text runs
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");
  expect(slideXml).toContain("Hello ");
  expect(slideXml).toContain("World");
});
```

**Step 3: Add markdown-to-rich-text PPTX test**

```typescript
it("handles TextElement with markdown bold", async () => {
  const layout: LayoutPresentation = {
    title: "Markdown Test",
    slides: [{
      width: 1920,
      height: 1080,
      background: "#ffffff",
      elements: [{
        kind: "text",
        id: "md",
        rect: { x: 100, y: 100, w: 600, h: 80 },
        text: "The **Fall** of Tang",
        style: {
          fontFamily: "Inter",
          fontSize: 32,
          fontWeight: 400,
          color: "#000000",
          lineHeight: 1.2,
          highlightColor: "#ff6b35",
        },
      }],
    }],
  };
  const buffer = await exportPptx(layout);
  expect(buffer).toBeInstanceOf(Buffer);

  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file("ppt/slides/slide1.xml")?.async("string");
  expect(slideXml).toContain("The ");
  expect(slideXml).toContain("Fall");
  expect(slideXml).toContain(" of Tang");
});
```

**Step 4: Run all tests**

Run: `bunx vitest run`
Expected: ALL PASS

**Step 5: Commit**

```
test(pptx): add integration tests for transform and RichText export
```

---

## Task 11: Run full build and test suite

**Step 1: Full type check**

Run: `bunx tsc --noEmit`
Expected: PASS — no errors

**Step 2: Full test suite**

Run: `bunx vitest run`
Expected: ALL PASS

**Step 3: Production build**

Run: `bun run build`
Expected: PASS — no build errors

**Step 4: Final commit (if any fixups needed)**

```
chore: fix any remaining issues from v8 phase 1
```

---

## Summary

| Task | Feature | Files | Estimated Steps |
|------|---------|-------|-----------------|
| 1 | TransformDef type | types.ts | 4 |
| 2 | RichText/TextRun types | types.ts | 6 |
| 3 | transformToCSS helper + tests | transform.ts, transform.test.ts | 5 |
| 4 | richtext utilities + tests | richtext.ts, richtext.test.ts | 5 |
| 5 | Transform in web renderer | LayoutRenderer.tsx | 5 |
| 6 | RichText in web renderer | LayoutRenderer.tsx | 8 |
| 7 | Transform in PPTX exporter | pptx.ts, pptx-effects.ts | 7 |
| 8 | RichText in PPTX exporter | pptx.ts | 7 |
| 9 | Fix remaining type errors | Various | 4 |
| 10 | Integration tests | pptx.test.ts | 5 |
| 11 | Full build verification | — | 4 |

**Total: 11 tasks, ~60 steps**

All changes are backward compatible — existing presentations with `text: "string"` and no `transform` continue working identically.
