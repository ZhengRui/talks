import type {
  CodeElement,
  GroupElement,
  LayoutElement,
  LayoutSlide,
  ListElement,
  RichText,
  TableElement,
  TextRun,
} from "@/lib/layout/types";
import type { GeometryHintElement, GeometryHints } from "@/components/extract/types";

const MAX_PREVIEW_LENGTH = 120;

function truncatePreview(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= MAX_PREVIEW_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_PREVIEW_LENGTH - 1)}…`;
}

function richTextToPlainText(text: RichText): string {
  if (typeof text === "string") return text;
  return text.map((run: TextRun) => run.text).join("");
}

function summarizeTable(el: TableElement): string {
  const header = el.headers.map(richTextToPlainText).join(" | ");
  const firstRow = el.rows[0]?.map(richTextToPlainText).join(" | ");
  return [header, firstRow].filter(Boolean).join(" || ");
}

function summarizeList(el: ListElement): string {
  return el.items
    .slice(0, 3)
    .map(richTextToPlainText)
    .join(" | ");
}

function summarizeCode(el: CodeElement): string {
  return el.code
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? "";
}

function summarizeElementText(element: LayoutElement): string | undefined {
  switch (element.kind) {
    case "text":
      return truncatePreview(richTextToPlainText(element.text));
    case "list":
      return truncatePreview(summarizeList(element));
    case "table":
      return truncatePreview(summarizeTable(element));
    case "code":
      return truncatePreview(summarizeCode(element));
    default:
      return undefined;
  }
}

function toHintElement(
  element: LayoutElement,
  parentId: string | undefined,
  depth: number,
  absX: number,
  absY: number,
): GeometryHintElement {
  const text = summarizeElementText(element);
  return {
    id: element.id,
    kind: element.kind,
    ...(parentId ? { parentId } : {}),
    depth,
    rect: {
      x: absX + element.rect.x,
      y: absY + element.rect.y,
      w: element.rect.w,
      h: element.rect.h,
    },
    ...(text ? { text } : {}),
  };
}

function flattenElement(
  element: LayoutElement,
  parentId: string | undefined,
  depth: number,
  absX: number,
  absY: number,
  out: GeometryHintElement[],
): void {
  const hint = toHintElement(element, parentId, depth, absX, absY);
  out.push(hint);

  if (element.kind !== "group") return;

  const group = element as GroupElement;
  const nextAbsX = absX + element.rect.x;
  const nextAbsY = absY + element.rect.y;
  for (const child of group.children) {
    flattenElement(child, element.id, depth + 1, nextAbsX, nextAbsY, out);
  }
}

export function buildGeometryHints(slide: LayoutSlide): GeometryHints {
  const elements: GeometryHintElement[] = [];
  for (const element of slide.elements) {
    flattenElement(element, undefined, 0, 0, 0, elements);
  }

  return {
    source: "layout",
    canvas: { w: slide.width, h: slide.height },
    elements,
  };
}
