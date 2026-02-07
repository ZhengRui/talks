import { join, resolve } from "path";
import PptxGenJS from "pptxgenjs";
import type {
  LayoutPresentation,
  LayoutSlide,
  LayoutElement,
  TextElement,
  ImageElement,
  ShapeElement,
  GroupElement,
  CodeElement,
  TableElement,
  ListElement,
  TextStyle,
  ShapeStyle,
  BorderDef,
  Rect,
} from "@/lib/layout/types";
import {
  rectToInches,
  pxToInchesX,
  pxToInchesY,
  pxToPoints,
  radiusToInches,
  hexColor,
  colorAlpha,
  parseFontFamily,
  isBold,
} from "./pptx-helpers";

/** Offset a child rect by the parent group's origin (children are relative to group). */
function offsetRect(child: Rect, parent: Rect): Rect {
  return {
    x: parent.x + child.x,
    y: parent.y + child.y,
    w: child.w,
    h: child.h,
  };
}

/** Deep-clone an element with its rect offset by a parent origin. */
function offsetElement(el: LayoutElement, parent: Rect): LayoutElement {
  const offsetted = { ...el, rect: offsetRect(el.rect, parent) };
  // Recursively offset nested group children
  if (el.kind === "group") {
    return {
      ...offsetted,
      children: (el as GroupElement).children.map((child) =>
        offsetElement(child, offsetted.rect),
      ),
    } as LayoutElement;
  }
  return offsetted;
}

type Slide = ReturnType<PptxGenJS["addSlide"]>;

// Shape constants — use string literals matching PptxGenJS internal values
const SHAPES = {
  RECTANGLE: "rect" as PptxGenJS.ShapeType,
  ROUNDED_RECTANGLE: "roundRect" as PptxGenJS.ShapeType,
  OVAL: "ellipse" as PptxGenJS.ShapeType,
  LINE: "line" as PptxGenJS.ShapeType,
};

/** Export a LayoutPresentation to a .pptx Buffer. */
export async function exportPptx(
  layout: LayoutPresentation,
): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.title = layout.title;
  if (layout.author) pres.author = layout.author;

  for (const layoutSlide of layout.slides) {
    const slide = pres.addSlide();
    renderSlideBackground(slide, layoutSlide);
    for (const el of layoutSlide.elements) {
      renderElement(slide, el);
    }
  }

  const output = (await pres.write({ outputType: "nodebuffer" })) as Buffer;
  return Buffer.from(output);
}

// ---------------------------------------------------------------------------
// Slide background
// ---------------------------------------------------------------------------

function renderSlideBackground(slide: Slide, ls: LayoutSlide): void {
  // Background image
  if (ls.backgroundImage) {
    slide.background = { path: resolveImagePath(ls.backgroundImage) };
  } else {
    slide.background = { color: hexColor(ls.background) };
  }

  // Overlay (semi-transparent rectangle over background image)
  if (ls.overlay) {
    slide.addShape(SHAPES.RECTANGLE, {
      x: 0,
      y: 0,
      w: 13.3,
      h: 7.5,
      fill: {
        color: hexColor(ls.overlay),
        transparency: colorAlpha(ls.overlay) ?? 0,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Element dispatcher
// ---------------------------------------------------------------------------

function renderElement(
  slide: Slide,
  el: LayoutElement,
): void {
  switch (el.kind) {
    case "text":
      return renderText(slide, el);
    case "image":
      return renderImage(slide, el);
    case "shape":
      return renderShape(slide, el);
    case "group":
      return renderGroup(slide, el);
    case "code":
      return renderCode(slide, el);
    case "table":
      return renderTable(slide, el);
    case "list":
      return renderList(slide, el);
  }
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function textOpts(
  style: TextStyle,
  rect: { x: number; y: number; w: number; h: number },
): PptxGenJS.TextPropsOptions {
  const r = rectToInches(rect);
  return {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    fontSize: pxToPoints(style.fontSize),
    fontFace: parseFontFamily(style.fontFamily),
    color: hexColor(style.color),
    bold: isBold(style.fontWeight),
    italic: style.fontStyle === "italic",
    align: style.textAlign ?? "left",
    valign: style.verticalAlign ?? "top",
    margin: 0,
    charSpacing: style.letterSpacing
      ? pxToPoints(style.letterSpacing)
      : undefined,
    isTextBox: true,
  };
}

function renderText(slide: Slide, el: TextElement): void {
  const opts = textOpts(el.style, el.rect);
  slide.addText(el.text, opts);
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

/** Resolve an image src to an absolute filesystem path or URL. */
function resolveImagePath(src: string): string {
  if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  // Resolve and validate the path stays within public/
  const publicDir = resolve(process.cwd(), "public");
  const resolved = resolve(publicDir, src.replace(/^\/+/, ""));
  if (!resolved.startsWith(publicDir)) {
    throw new Error(`Image path escapes public directory: ${src}`);
  }
  return resolved;
}

function renderImage(slide: Slide, el: ImageElement): void {
  const r = rectToInches(el.rect);
  const imgOpts: PptxGenJS.ImageProps = {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    sizing: { type: el.objectFit, w: r.w, h: r.h },
  };

  const resolved = resolveImagePath(el.src);
  if (resolved.startsWith("data:")) {
    imgOpts.data = resolved;
  } else {
    imgOpts.path = resolved;
  }

  if (el.clipCircle) {
    imgOpts.rounding = true;
  }

  if (el.opacity !== undefined && el.opacity < 1) {
    imgOpts.transparency = Math.round((1 - el.opacity) * 100);
  }

  slide.addImage(imgOpts);
}

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

function getShapeType(
  shape: ShapeElement["shape"],
  style: ShapeStyle,
): PptxGenJS.ShapeType {
  switch (shape) {
    case "circle":
      return SHAPES.OVAL;
    case "line":
      return SHAPES.LINE;
    case "pill":
      return SHAPES.ROUNDED_RECTANGLE;
    case "rect":
    default:
      return style.borderRadius
        ? SHAPES.ROUNDED_RECTANGLE
        : SHAPES.RECTANGLE;
  }
}

function makeFill(
  style: ShapeStyle,
): PptxGenJS.ShapeFillProps | undefined {
  // Solid fill
  if (style.fill) {
    const fill: PptxGenJS.ShapeFillProps = { color: hexColor(style.fill) };
    const alpha = colorAlpha(style.fill);
    if (alpha !== undefined) fill.transparency = alpha;
    if (style.opacity !== undefined && style.opacity < 1) {
      fill.transparency = Math.round((1 - style.opacity) * 100);
    }
    return fill;
  }
  // Gradient fallback — use last stop color (PptxGenJS doesn't support gradients)
  if (style.gradient?.stops?.length) {
    const lastStop = style.gradient.stops[style.gradient.stops.length - 1];
    const fill: PptxGenJS.ShapeFillProps = { color: hexColor(lastStop.color) };
    if (style.opacity !== undefined && style.opacity < 1) {
      fill.transparency = Math.round((1 - style.opacity) * 100);
    }
    return fill;
  }
  return undefined;
}

function makeLine(
  style: ShapeStyle,
  border?: BorderDef,
): PptxGenJS.ShapeLineProps | undefined {
  if (border) {
    return {
      color: hexColor(border.color),
      width: pxToPoints(border.width),
    };
  }
  if (style.stroke) {
    return {
      color: hexColor(style.stroke),
      width: pxToPoints(style.strokeWidth ?? 1),
    };
  }
  return undefined;
}

function makeShadow(
  shadow: ShapeStyle["shadow"],
): PptxGenJS.ShadowProps | undefined {
  if (!shadow) return undefined;
  return {
    type: "outer",
    color: hexColor(shadow.color),
    blur: shadow.blur,
    offset: Math.max(0, Math.sqrt(shadow.offsetX ** 2 + shadow.offsetY ** 2)),
    angle: Math.round(
      (Math.atan2(shadow.offsetY, shadow.offsetX) * 180) / Math.PI,
    ),
    opacity: colorAlpha(shadow.color)
      ? (100 - (colorAlpha(shadow.color) ?? 0)) / 100
      : 0.3,
  };
}

/** Render single-side borders as thin overlay rectangles. */
function renderSideBorders(
  slide: Slide,
  rect: Rect,
  border: BorderDef,
): void {
  const r = rectToInches(rect);
  const bw = pxToInchesX(border.width);
  const color = hexColor(border.color);
  const sides = border.sides ?? ["top", "right", "bottom", "left"];

  for (const side of sides) {
    let sx = r.x, sy = r.y, sw = r.w, sh = r.h;
    switch (side) {
      case "top":    sh = bw; break;
      case "bottom": sy = r.y + r.h - bw; sh = bw; break;
      case "left":   sw = bw; break;
      case "right":  sx = r.x + r.w - bw; sw = bw; break;
    }
    slide.addShape(SHAPES.RECTANGLE, {
      x: sx, y: sy, w: sw, h: sh,
      fill: { color },
    });
  }
}

function renderShape(
  slide: Slide,
  el: ShapeElement,
): void {
  const r = rectToInches(el.rect);
  const shapeType = getShapeType(el.shape, el.style);

  const opts: PptxGenJS.ShapeProps = {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
  };

  const fill = makeFill(el.style);
  if (fill) opts.fill = fill;

  // Handle borders: if sides are specified, render as overlay rects instead of line
  if (el.border?.sides?.length) {
    // Don't add border as line — render as thin rects after main shape
    if (el.style.stroke) {
      opts.line = {
        color: hexColor(el.style.stroke),
        width: pxToPoints(el.style.strokeWidth ?? 1),
      };
    }
  } else {
    const line = makeLine(el.style, el.border);
    if (line) opts.line = line;
  }

  if (el.style.borderRadius) {
    opts.rectRadius = radiusToInches(el.style.borderRadius);
  }

  const shadow = makeShadow(el.style.shadow);
  if (shadow) opts.shadow = shadow;

  slide.addShape(shapeType, opts);

  // Render side borders as thin overlay rectangles
  if (el.border?.sides?.length) {
    renderSideBorders(slide, el.rect, el.border);
  }
}

// ---------------------------------------------------------------------------
// Group — flatten to background shape + offset children
// ---------------------------------------------------------------------------

function renderGroup(
  slide: Slide,
  el: GroupElement,
): void {
  // Render background shape if the group has fill or border
  if (el.style?.fill || el.style?.gradient || el.border) {
    const r = rectToInches(el.rect);
    const bgOpts: PptxGenJS.ShapeProps = {
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
    };

    const fill = el.style ? makeFill(el.style) : undefined;
    if (fill) bgOpts.fill = fill;

    // Handle borders: side-specific borders rendered separately
    if (el.border && !el.border.sides?.length) {
      const line = el.style ? makeLine(el.style, el.border) : undefined;
      if (line) bgOpts.line = line;
    }

    if (el.style?.borderRadius) {
      bgOpts.rectRadius = radiusToInches(el.style.borderRadius);
    }

    const shadow = el.style?.shadow ? makeShadow(el.style.shadow) : undefined;
    if (shadow) bgOpts.shadow = shadow;

    const shapeType =
      el.style?.borderRadius
        ? SHAPES.ROUNDED_RECTANGLE
        : SHAPES.RECTANGLE;
    slide.addShape(shapeType, bgOpts);

    // Render side borders as thin overlay rectangles
    if (el.border?.sides?.length) {
      renderSideBorders(slide, el.rect, el.border);
    }
  }

  // Render children — offset by group's origin since children use relative coords
  for (const child of el.children) {
    const offsetChild = offsetElement(child, el.rect);
    renderElement(slide, offsetChild);
  }
}

// ---------------------------------------------------------------------------
// Code — background rect + monospace text
// ---------------------------------------------------------------------------

function renderCode(
  slide: Slide,
  el: CodeElement,
): void {
  const r = rectToInches(el.rect);
  const paddingInches = pxToInchesX(el.style.padding);

  // Background shape
  slide.addShape(
    el.style.borderRadius
      ? SHAPES.ROUNDED_RECTANGLE
      : SHAPES.RECTANGLE,
    {
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      fill: { color: hexColor(el.style.background) },
      rectRadius: el.style.borderRadius
        ? radiusToInches(el.style.borderRadius)
        : undefined,
    },
  );

  // Code text
  slide.addText(el.code, {
    x: r.x + paddingInches,
    y: r.y + paddingInches,
    w: r.w - paddingInches * 2,
    h: r.h - paddingInches * 2,
    fontSize: pxToPoints(el.style.fontSize),
    fontFace: parseFontFamily(el.style.fontFamily),
    color: hexColor(el.style.color),
    align: "left",
    valign: "top",
    margin: 0,
    isTextBox: true,
  });
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function renderTable(slide: Slide, el: TableElement): void {
  const r = rectToInches(el.rect);
  const colCount = el.headers.length || (el.rows[0]?.length ?? 1);
  const colW = r.w / colCount;

  // Build rows: header row + data rows
  const headerRow: PptxGenJS.TableCell[] = el.headers.map((h) => ({
    text: h,
    options: {
      bold: true,
      fontSize: pxToPoints(el.headerStyle.fontSize),
      fontFace: parseFontFamily(el.headerStyle.fontFamily),
      color: hexColor(el.headerStyle.color),
      fill: { color: hexColor(el.headerStyle.background) },
      align: el.headerStyle.textAlign ?? "left",
      valign: "middle" as const,
      margin: [2, 4, 2, 4] as [number, number, number, number],
    },
  }));

  const dataRows: PptxGenJS.TableCell[][] = el.rows.map((row, rowIdx) =>
    row.map((cell) => ({
      text: cell,
      options: {
        fontSize: pxToPoints(el.cellStyle.fontSize),
        fontFace: parseFontFamily(el.cellStyle.fontFamily),
        color: hexColor(el.cellStyle.color),
        fill: {
          color: hexColor(
            rowIdx % 2 === 1
              ? el.cellStyle.altBackground
              : el.cellStyle.background,
          ),
        },
        align: el.cellStyle.textAlign ?? "left",
        valign: "middle" as const,
        margin: [2, 4, 2, 4] as [number, number, number, number],
      },
    })),
  );

  const allRows = [headerRow, ...dataRows];

  slide.addTable(allRows, {
    x: r.x,
    y: r.y,
    w: r.w,
    colW: Array(colCount).fill(colW),
    border: { pt: 1, color: hexColor(el.borderColor) },
    autoPage: false,
  });
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function renderList(slide: Slide, el: ListElement): void {
  const r = rectToInches(el.rect);

  const items: PptxGenJS.TextProps[] = el.items.map((item, i) => ({
    text: item,
    options: {
      bullet: el.ordered ? { type: "number" as const } : true,
      breakLine: i < el.items.length - 1,
      fontSize: pxToPoints(el.itemStyle.fontSize),
      fontFace: parseFontFamily(el.itemStyle.fontFamily),
      color: hexColor(el.itemStyle.color),
      bold: isBold(el.itemStyle.fontWeight),
      italic: el.itemStyle.fontStyle === "italic",
      paraSpaceAfter: pxToPoints(el.itemSpacing),
    },
  }));

  slide.addText(items, {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    margin: 0,
    valign: "top",
  });
}
