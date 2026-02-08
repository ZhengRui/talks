import { resolve } from "path";
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
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
import { buildTimingXml, type AnimationEntry } from "./pptx-animations";

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

/** Read the current object count from a PptxGenJS slide. */
function slideObjectCount(slide: Slide): number {
  return ((slide as Record<string, unknown>)._slideObjects as unknown[])
    .length;
}

/** Export a LayoutPresentation to a .pptx Buffer. */
export async function exportPptx(
  layout: LayoutPresentation,
): Promise<Buffer> {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  pres.title = layout.title;
  if (layout.author) pres.author = layout.author;

  // Phase 1: Render shapes, tracking spid-to-animation mapping per slide
  const slideAnimations: AnimationEntry[][] = [];

  for (const layoutSlide of layout.slides) {
    const slide = pres.addSlide();
    renderSlideBackground(slide, layoutSlide);

    const animations: AnimationEntry[] = [];
    for (const el of layoutSlide.elements) {
      const before = slideObjectCount(slide);
      renderElement(slide, el);
      const after = slideObjectCount(slide);

      if (el.animation && el.animation.type !== "none") {
        const spids: number[] = [];
        for (let i = before; i < after; i++) {
          spids.push(i + 2); // PptxGenJS: spid = idx + 2
        }
        if (spids.length > 0) {
          animations.push({ spids, animation: el.animation });
        }
      }
    }
    slideAnimations.push(animations);
  }

  // Phase 2: Generate PPTX buffer
  const output = (await pres.write({ outputType: "nodebuffer" })) as Buffer;

  // Phase 3: Post-process with JSZip to inject animation timing XML
  const hasAnimations = slideAnimations.some((a) => a.length > 0);
  if (!hasAnimations) {
    return Buffer.from(output);
  }

  const zip = await JSZip.loadAsync(output);

  for (let i = 0; i < slideAnimations.length; i++) {
    const animations = slideAnimations[i];
    const timingXml = buildTimingXml(animations);
    if (!timingXml) continue;

    const slidePath = `ppt/slides/slide${i + 1}.xml`;
    const slideXml = await zip.file(slidePath)?.async("string");
    if (!slideXml) continue;

    // Inject <p:timing> before closing </p:sld>
    const injected = slideXml.replace("</p:sld>", `${timingXml}</p:sld>`);
    zip.file(slidePath, injected);
  }

  const result = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(result);
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
    // Fully transparent fill → no fill at all
    const alpha = colorAlpha(style.fill);
    if (alpha !== undefined && alpha >= 100) return undefined;

    const fill: PptxGenJS.ShapeFillProps = { color: hexColor(style.fill) };
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
    // Skip nearly invisible borders — PowerPoint renders them more visibly than CSS
    const alpha = colorAlpha(border.color);
    if (alpha !== undefined && alpha >= 80) return undefined;

    const line: PptxGenJS.ShapeLineProps = {
      color: hexColor(border.color),
      width: pxToPoints(border.width),
    };
    if (alpha !== undefined) line.transparency = alpha;
    return line;
  }
  if (style.stroke) {
    const line: PptxGenJS.ShapeLineProps = {
      color: hexColor(style.stroke),
      width: pxToPoints(style.strokeWidth ?? 1),
    };
    const alpha = colorAlpha(style.stroke);
    if (alpha !== undefined) line.transparency = alpha;
    return line;
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
  // Render background shape if the group has visible fill or border
  const fillVisible = !!(el.style?.fill && colorAlpha(el.style.fill) !== 100)
    || !!el.style?.gradient;
  const borderVisible = !!(el.border && colorAlpha(el.border.color) !== 100);

  if (fillVisible || borderVisible) {
    const r = rectToInches(el.rect);
    const hasRadius = !!el.style?.borderRadius;
    const hasSideBorders = !!el.border?.sides?.length;

    // For visible side borders on rounded groups, use "backing shape" technique:
    // 1. Draw accent-colored rounded rect (full size) — the border color shows through
    // 2. Draw card fill rounded rect inset by border width — covers accent except at borders
    // This makes borders follow the rounded corners instead of overflowing.
    if (hasSideBorders && hasRadius && borderVisible && fillVisible) {
      const bw = pxToInchesY(el.border!.width);
      const radius = radiusToInches(el.style!.borderRadius!);
      const sides = el.border!.sides!;

      const shadow = el.style?.shadow ? makeShadow(el.style.shadow) : undefined;

      // Step 1: Accent-colored backing shape (full size)
      slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
        x: r.x, y: r.y, w: r.w, h: r.h,
        fill: { color: hexColor(el.border!.color) },
        rectRadius: radius,
        ...(shadow ? { shadow } : {}),
      });

      // Step 2: Card fill shape inset by border width on bordered sides
      // Extend slightly beyond outer rect on non-bordered sides to prevent
      // corner bleed where the two rounded rects don't perfectly align
      const extend = pxToInchesY(2);
      const inset = {
        top: sides.includes("top") ? bw : -extend,
        right: sides.includes("right") ? bw : -extend,
        bottom: sides.includes("bottom") ? bw : -extend,
        left: sides.includes("left") ? bw : -extend,
      };

      const fill = makeFill(el.style!);
      slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
        x: r.x + inset.left,
        y: r.y + inset.top,
        w: r.w - inset.left - inset.right,
        h: r.h - inset.top - inset.bottom,
        fill: fill ?? { color: "FFFFFF" },
        rectRadius: radius,
      });
    } else {
      // Standard rendering: single background shape
      const bgOpts: PptxGenJS.ShapeProps = {
        x: r.x, y: r.y, w: r.w, h: r.h,
      };

      const fill = el.style ? makeFill(el.style) : undefined;
      if (fill) bgOpts.fill = fill;

      // Handle borders: full-border uses line property
      if (el.border && !hasSideBorders) {
        const line = el.style ? makeLine(el.style, el.border) : undefined;
        if (line) bgOpts.line = line;
      }

      if (hasRadius) {
        bgOpts.rectRadius = radiusToInches(el.style!.borderRadius!);
      }

      const shadow = el.style?.shadow ? makeShadow(el.style.shadow) : undefined;
      if (shadow) bgOpts.shadow = shadow;

      const shapeType = hasRadius ? SHAPES.ROUNDED_RECTANGLE : SHAPES.RECTANGLE;
      slide.addShape(shapeType, bgOpts);

      // Flat side borders (no radius — plain overlay rectangles are fine)
      if (hasSideBorders) {
        renderSideBorders(slide, el.rect, el.border!);
      }
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

  // Row heights — proportional to template constants (72px header, 68px data)
  const nominalTotal = 72 + el.rows.length * 68;
  const headerH = r.h * (72 / nominalTotal);
  const dataRowH = el.rows.length > 0 ? (r.h - headerH) / el.rows.length : 0;
  const radius = radiusToInches(12);

  // Border transparency
  const borderAlpha = colorAlpha(el.borderColor);
  const borderVisible = borderAlpha === undefined || borderAlpha < 80;

  // --- Background layers (shapes instead of addTable) ---

  // Layer 1: Full-size rounded rect with header accent fill
  // Provides rounded outer corners + header background color
  slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
    x: r.x, y: r.y, w: r.w, h: r.h,
    fill: { color: hexColor(el.headerStyle.background) },
    rectRadius: radius,
  });

  // Layer 2: Data area rounded rect with default cell background
  // Rounded bottom corners match outer frame
  if (el.rows.length > 0) {
    slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
      x: r.x, y: r.y + headerH, w: r.w, h: r.h - headerH,
      fill: { color: hexColor(el.cellStyle.background) },
      rectRadius: radius,
    });

    // Layer 3: Alternating row backgrounds (match web: ri % 2 === 0 is alt)
    const lastRowIdx = el.rows.length - 1;
    el.rows.forEach((_, ri) => {
      if (ri % 2 === 0) {
        const y = r.y + headerH + ri * dataRowH;
        // Use rounded rect for last row to preserve bottom corners
        const shape = ri === lastRowIdx
          ? SHAPES.ROUNDED_RECTANGLE
          : SHAPES.RECTANGLE;
        const opts: PptxGenJS.ShapeProps = {
          x: r.x, y, w: r.w, h: dataRowH,
          fill: { color: hexColor(el.cellStyle.altBackground) },
        };
        if (ri === lastRowIdx) opts.rectRadius = radius;
        slide.addShape(shape, opts);
      }
    });
  }

  // --- Border lines between data rows (with transparency support) ---
  if (borderVisible) {
    const line: PptxGenJS.ShapeLineProps = {
      color: hexColor(el.borderColor),
      width: 0.75,
    };
    if (borderAlpha !== undefined) line.transparency = borderAlpha;

    el.rows.forEach((_, ri) => {
      const y = r.y + headerH + ri * dataRowH;
      slide.addShape(SHAPES.LINE, {
        x: r.x, y, w: r.w, h: 0,
        line,
      });
    });
  }

  // --- Header text ---
  el.headers.forEach((h, ci) => {
    slide.addText(h, {
      x: r.x + ci * colW, y: r.y, w: colW, h: headerH,
      fontSize: pxToPoints(el.headerStyle.fontSize),
      fontFace: parseFontFamily(el.headerStyle.fontFamily),
      color: hexColor(el.headerStyle.color),
      bold: isBold(el.headerStyle.fontWeight),
      align: el.headerStyle.textAlign ?? "left",
      valign: "middle",
      margin: [12, 18, 12, 18],
      isTextBox: true,
    });
  });

  // --- Data cell text ---
  el.rows.forEach((row, ri) => {
    const y = r.y + headerH + ri * dataRowH;
    row.forEach((cell, ci) => {
      slide.addText(cell, {
        x: r.x + ci * colW, y, w: colW, h: dataRowH,
        fontSize: pxToPoints(el.cellStyle.fontSize),
        fontFace: parseFontFamily(el.cellStyle.fontFamily),
        color: hexColor(el.cellStyle.color),
        bold: isBold(el.cellStyle.fontWeight),
        align: el.cellStyle.textAlign ?? "left",
        valign: "middle",
        margin: [11, 18, 11, 18],
        isTextBox: true,
      });
    });
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
