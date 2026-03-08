import { resolve } from "path";
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import sizeOf from "image-size";
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
  VideoElement,
  IframeElement,
  TextStyle,
  ShapeStyle,
  BoxShadow,
  BorderDef,
  GradientDef,
  TransformDef,
  TextRun,
  RichText,
  Rect,
} from "@/lib/layout/types";
import { toPlainText, parseMarkdownToRuns } from "@/lib/layout/richtext";
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
  parseCssGradients,
} from "./pptx-helpers";
import { buildTimingXml, type AnimationEntry } from "./pptx-animations";
import { applyEffectsToSlideXml, applyCoverImagesToSlideXml, applyFlipsToSlideXml, applyClipPolygonsToSlideXml, parsePolygon, type EffectsEntry, type CoverImageEntry, type FlipEntry, type ClipPolygonEntry } from "./pptx-effects";

/** Offset a child rect by the parent group's origin (children are relative to group). */
function offsetRect(child: Rect, parent: Rect): Rect {
  return {
    x: parent.x + child.x,
    y: parent.y + child.y,
    w: child.w,
    h: child.h,
  };
}

/** Rotate a point (x, y) around a center (cx, cy) by angleDeg degrees clockwise. */
function rotatePoint(x: number, y: number, cx: number, cy: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/** Offset an element's rect by a parent origin. Children are NOT recursively
 *  offset — each renderGroup() call handles its own children's offsetting. */
function offsetElement(el: LayoutElement, parent: Rect): LayoutElement {
  return { ...el, rect: offsetRect(el.rect, parent) };
}

type Slide = ReturnType<PptxGenJS["addSlide"]>;

// Shape constants — use string literals matching PptxGenJS internal values
const SHAPES = {
  RECTANGLE: "rect" as PptxGenJS.ShapeType,
  ROUNDED_RECTANGLE: "roundRect" as PptxGenJS.ShapeType,
  OVAL: "ellipse" as PptxGenJS.ShapeType,
  LINE: "line" as PptxGenJS.ShapeType,
  RIGHT_ARROW: "rightArrow" as PptxGenJS.ShapeType,
  TRIANGLE: "triangle" as PptxGenJS.ShapeType,
  CHEVRON: "chevron" as PptxGenJS.ShapeType,
  DIAMOND: "diamond" as PptxGenJS.ShapeType,
  STAR_5: "star5" as PptxGenJS.ShapeType,
  WEDGE_ROUND_RECT_CALLOUT: "wedgeRoundRectCallout" as PptxGenJS.ShapeType,
};

// Per-slide accumulators for OOXML post-processing (reset each slide in exportPptx)
let slideGradientEntries: { spid: number; gradient: GradientDef }[] = [];
let slideCssGradientEntries: { spid: number; gradient: import("./pptx-helpers").ParsedCssGradient }[] = [];
let slideTextAlphaEntries: { spid: number; alpha: number }[] = [];
let slideCoverImages: { spid: number; imagePath: string; containerW: number; containerH: number }[] = [];
let slideFlipEntries: FlipEntry[] = [];
let slideClipPolygonEntries: ClipPolygonEntry[] = [];
// Per-element animation/effects tracking — populated by renderElement, consumed by exportPptx
let slideElementAnimations: AnimationEntry[] = [];
let slideElementEffects: EffectsEntry[] = [];

/** Read the current object count from a PptxGenJS slide. */
function slideObjectCount(slide: Slide): number {
  return ((slide as unknown as Record<string, unknown>)._slideObjects as unknown[])
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

  // Phase 1: Render shapes, tracking spid-to-animation and spid-to-effects mappings
  const slideAnimations: AnimationEntry[][] = [];
  const slideEffects: EffectsEntry[][] = [];
  const slideCoverImageEntries: CoverImageEntry[][] = [];
  const slideFlips: FlipEntry[][] = [];
  const slideClipPolygons: ClipPolygonEntry[][] = [];

  for (const layoutSlide of layout.slides) {
    const slide = pres.addSlide();

    // Reset per-slide post-processing accumulators
    slideGradientEntries = [];
    slideCssGradientEntries = [];
    slideTextAlphaEntries = [];
    slideCoverImages = [];
    slideFlipEntries = [];
    slideClipPolygonEntries = [];
    slideElementAnimations = [];
    slideElementEffects = [];

    renderSlideBackground(slide, layoutSlide);

    for (const el of layoutSlide.elements) {
      renderElement(slide, el);
    }

    // Collect animations and effects tracked by renderElement (works for nested groups too)
    const animations = slideElementAnimations;
    const effects: EffectsEntry[] = [...slideElementEffects];

    // Fold render-time gradient and text alpha entries into effects
    for (const g of slideGradientEntries) {
      effects.push({ spids: [g.spid], gradient: g.gradient });
    }
    for (const g of slideCssGradientEntries) {
      effects.push({ spids: [g.spid], cssGradient: g.gradient });
    }
    for (const t of slideTextAlphaEntries) {
      effects.push({ spids: [t.spid], textAlpha: t.alpha });
    }

    // Calculate cover image srcRect from intrinsic image dimensions
    const coverImages: CoverImageEntry[] = [];
    for (const img of slideCoverImages) {
      try {
        const dims = sizeOf(img.imagePath);
        if (dims.width && dims.height) {
          const imgRatio = dims.height / dims.width;
          const boxRatio = img.containerH / img.containerW;
          let l = 0, r = 0, t = 0, b = 0;
          if (boxRatio > imgRatio) {
            // Box taller than image → fit by height, crop width
            const scaledW = img.containerH / imgRatio;
            const perc = Math.round(100000 * 0.5 * (1 - img.containerW / scaledW));
            l = perc;
            r = perc;
          } else {
            // Box wider than image → fit by width, crop height
            const scaledH = img.containerW * imgRatio;
            const perc = Math.round(100000 * 0.5 * (1 - img.containerH / scaledH));
            t = perc;
            b = perc;
          }
          if (l > 0 || r > 0 || t > 0 || b > 0) {
            coverImages.push({ spid: img.spid, l, r, t, b });
          }
        }
      } catch {
        // Skip if image dimensions can't be read
      }
    }

    slideAnimations.push(animations);
    slideEffects.push(effects);
    slideCoverImageEntries.push(coverImages);
    slideFlips.push([...slideFlipEntries]);
    slideClipPolygons.push([...slideClipPolygonEntries]);
  }

  // Phase 2: Generate PPTX buffer
  const output = (await pres.write({ outputType: "nodebuffer" })) as Buffer;

  // Phase 3: Post-process with JSZip to inject animation timing + effects + cover images
  const hasAnimations = slideAnimations.some((a) => a.length > 0);
  const hasEffects = slideEffects.some((e) => e.length > 0);
  const hasCoverImages = slideCoverImageEntries.some((c) => c.length > 0);
  const hasFlips = slideFlips.some((f) => f.length > 0);
  const hasClipPolygons = slideClipPolygons.some((c) => c.length > 0);
  if (!hasAnimations && !hasEffects && !hasCoverImages && !hasFlips && !hasClipPolygons) {
    return Buffer.from(output);
  }

  const zip = await JSZip.loadAsync(output);

  for (let i = 0; i < layout.slides.length; i++) {
    const slidePath = `ppt/slides/slide${i + 1}.xml`;
    let slideXml = await zip.file(slidePath)?.async("string");
    if (!slideXml) continue;

    let modified = false;

    // Fix cover image srcRect (PptxGenJS doesn't compute crop correctly)
    if (slideCoverImageEntries[i]?.length > 0) {
      slideXml = applyCoverImagesToSlideXml(slideXml, slideCoverImageEntries[i]);
      modified = true;
    }

    // Inject effects (glow, softEdge, blur, patternFill)
    if (slideEffects[i]?.length > 0) {
      slideXml = applyEffectsToSlideXml(slideXml, slideEffects[i]);
      modified = true;
    }

    // Apply flip transforms
    if (slideFlips[i]?.length > 0) {
      slideXml = applyFlipsToSlideXml(slideXml, slideFlips[i]);
      modified = true;
    }

    // Apply clipPath polygon geometry
    if (slideClipPolygons[i]?.length > 0) {
      slideXml = applyClipPolygonsToSlideXml(slideXml, slideClipPolygons[i]);
      modified = true;
    }

    // Inject animation timing XML
    const timingXml = buildTimingXml(slideAnimations[i] ?? []);
    if (timingXml) {
      slideXml = slideXml.replace("</p:sld>", `${timingXml}</p:sld>`);
      modified = true;
    }

    if (modified) {
      zip.file(slidePath, slideXml);
    }
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
    // Extract solid fallback from potential CSS gradient string
    slide.background = { color: hexColor(ls.background) };

    // Parse CSS gradient layers and create full-slide overlay shapes
    const cssGradients = parseCssGradients(ls.background);
    for (const g of cssGradients) {
      // Add a full-slide rectangle with placeholder fill; post-processor replaces with gradient
      const spid = slideObjectCount(slide) + 2;
      slide.addShape(SHAPES.RECTANGLE, {
        x: 0, y: 0, w: 13.3, h: 7.5,
        fill: { color: "000000", transparency: 100 }, // placeholder — replaced by OOXML post-processor
      });
      slideCssGradientEntries.push({ spid, gradient: g });
    }
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
  if (el.cssStyle) {
    console.warn(`[pptx] ${el.id}: cssStyle is web-only, skipped in PPTX`);
  }

  // Track spids for this element's entrance animation and effects
  const before = slideObjectCount(slide);

  switch (el.kind) {
    case "text":
      renderText(slide, el); break;
    case "image":
      renderImage(slide, el); break;
    case "shape":
      renderShape(slide, el); break;
    case "group":
      renderGroup(slide, el); break;
    case "code":
      renderCode(slide, el); break;
    case "table":
      renderTable(slide, el); break;
    case "list":
      renderList(slide, el); break;
    case "video":
      renderVideo(slide, el); break;
    case "iframe":
      renderIframe(slide, el); break;
  }

  // Collect spids produced by this element.
  // For non-groups: track entrance/effects on the element itself.
  // For groups: track the group's own entrance (applied to ALL child shapes).
  //   Individual children inside the group are tracked by their own renderElement
  //   calls within renderGroup().
  const after = slideObjectCount(slide);
  const spids: number[] = [];
  for (let i = before; i < after; i++) {
    spids.push(i + 2);
  }
  if (spids.length > 0) {
    // Track clipPath polygon for OOXML post-processing
    if (el.clipPath) {
      const vertices = parsePolygon(el.clipPath);
      if (vertices) {
        for (const spid of spids) {
          slideClipPolygonEntries.push({ spid, vertices });
        }
      }
    }

    if (el.entrance && el.entrance.type !== "none") {
      slideElementAnimations.push({ spids, entrance: el.entrance });
    }
    const elEffects = el.effects;
    const elPatternFill = "style" in el && el.kind === "shape"
      && el.style.patternFill
      && !SHAPE_RENDERED_PATTERNS.has(el.style.patternFill.preset)
      ? el.style.patternFill
      : undefined;
    if (elEffects || elPatternFill) {
      slideElementEffects.push({ spids, effects: elEffects, patternFill: elPatternFill });
    }
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

/** Convert RichText to PptxGenJS TextProps array for per-run styling. */
function richTextToProps(
  text: RichText,
  baseStyle: TextStyle,
): PptxGenJS.TextProps[] {
  let runs: TextRun[];
  if (typeof text === "string") {
    if (!text.includes("**") && !text.includes("*") && !baseStyle.highlightColor) {
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
    if (run.color) opts.color = hexColor(run.color);
    if (run.fontSize) opts.fontSize = pxToPoints(run.fontSize);
    if (run.fontFamily) opts.fontFace = parseFontFamily(run.fontFamily);
    if (run.letterSpacing) opts.charSpacing = pxToPoints(run.letterSpacing);
    if (run.underline) opts.underline = { style: "sng" };
    if (run.strikethrough) opts.strike = "sngStrike";
    if (run.superscript) opts.superscript = true;
    if (run.subscript) opts.subscript = true;
    return { text: run.text, options: opts };
  });
}

/** Track flip transform for OOXML post-processing. */
function trackTransform(spid: number, transform?: TransformDef): void {
  if (transform?.flipH || transform?.flipV) {
    slideFlipEntries.push({ spid, flipH: transform.flipH, flipV: transform.flipV });
  }
}

/** Apply scaleX/scaleY by adjusting rect dimensions, keeping the element centered. */
function applyScale(rect: Rect, transform?: TransformDef): Rect {
  const sx = transform?.scaleX ?? 1;
  const sy = transform?.scaleY ?? 1;
  if (sx === 1 && sy === 1) return rect;
  const newW = rect.w * sx;
  const newH = rect.h * sy;
  return {
    x: rect.x - (newW - rect.w) / 2,
    y: rect.y - (newH - rect.h) / 2,
    w: newW,
    h: newH,
  };
}

function renderText(slide: Slide, el: TextElement): void {
  const spid = slideObjectCount(slide) + 2;
  const rect = applyScale(el.rect, el.transform);
  const opts = textOpts(el.style, rect);
  if (el.transform?.rotate) opts.rotate = el.transform.rotate;

  // Use rich text props if text has runs or markdown formatting
  const props = richTextToProps(el.text, el.style);
  if (props.length === 1 && Object.keys(props[0].options ?? {}).length === 0) {
    slide.addText(toPlainText(el.text), opts);
  } else {
    slide.addText(props, opts);
  }

  trackTransform(spid, el.transform);

  // Track text color alpha for OOXML post-processing
  const alpha = colorAlpha(el.style.color);
  if (alpha !== undefined && alpha > 0) {
    slideTextAlphaEntries.push({
      spid,
      alpha: Math.round((100 - alpha) * 1000),
    });
  }
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
  const r = rectToInches(applyScale(el.rect, el.transform));
  const spid = slideObjectCount(slide) + 2;
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

  if (el.transform?.rotate) imgOpts.rotate = el.transform.rotate;
  slide.addImage(imgOpts);
  trackTransform(slideObjectCount(slide) + 1, el.transform);

  // Track cover images for OOXML post-processing (PptxGenJS doesn't compute
  // srcRect correctly — it uses box dimensions instead of intrinsic image dims)
  if (el.objectFit === "cover" && !resolved.startsWith("data:") && !resolved.startsWith("http")) {
    slideCoverImages.push({ spid, imagePath: resolved, containerW: r.w, containerH: r.h });
  }
}

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

function getShapeType(
  shape: ShapeElement["shape"],
  elementRadius?: number,
): PptxGenJS.ShapeType {
  switch (shape) {
    case "circle":
      return SHAPES.OVAL;
    case "line":
      return SHAPES.LINE;
    case "pill":
      return SHAPES.ROUNDED_RECTANGLE;
    case "arrow":
      return SHAPES.RIGHT_ARROW;
    case "triangle":
      return SHAPES.TRIANGLE;
    case "chevron":
      return SHAPES.CHEVRON;
    case "diamond":
      return SHAPES.DIAMOND;
    case "star":
      return SHAPES.STAR_5;
    case "callout":
      return SHAPES.WEDGE_ROUND_RECT_CALLOUT;
    case "rect":
    default:
      return elementRadius
        ? SHAPES.ROUNDED_RECTANGLE
        : SHAPES.RECTANGLE;
  }
}

function makeFill(
  style: ShapeStyle,
  elementOpacity?: number,
): PptxGenJS.ShapeFillProps | undefined {
  const opacity = elementOpacity;
  // Solid fill
  if (style.fill) {
    // Fully transparent fill → no fill at all
    const alpha = colorAlpha(style.fill);
    if (alpha !== undefined && alpha >= 100) return undefined;

    const fill: PptxGenJS.ShapeFillProps = { color: hexColor(style.fill) };
    if (alpha !== undefined) fill.transparency = alpha;
    if (opacity !== undefined && opacity < 1) {
      fill.transparency = Math.round((1 - opacity) * 100);
    }
    return fill;
  }
  // Gradient fallback — use last stop color (PptxGenJS doesn't support gradients)
  if (style.gradient?.stops?.length) {
    const lastStop = style.gradient.stops[style.gradient.stops.length - 1];
    const fill: PptxGenJS.ShapeFillProps = { color: hexColor(lastStop.color) };
    if (opacity !== undefined && opacity < 1) {
      fill.transparency = Math.round((1 - opacity) * 100);
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
    if (border.dash && border.dash !== "solid") {
      line.dashType = border.dash === "dash" ? "dash" : border.dash === "dot" ? "sysDot" : "dashDot";
    }
    return line;
  }
  if (style.stroke) {
    const line: PptxGenJS.ShapeLineProps = {
      color: hexColor(style.stroke),
      width: pxToPoints(style.strokeWidth ?? 1),
    };
    const alpha = colorAlpha(style.stroke);
    if (alpha !== undefined) line.transparency = alpha;
    if (style.strokeDash && style.strokeDash !== "solid") {
      line.dashType = style.strokeDash === "dash" ? "dash" : style.strokeDash === "dot" ? "sysDot" : "dashDot";
    }
    return line;
  }
  return undefined;
}

function makeShadow(
  shadow?: BoxShadow,
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

/** Pattern presets that are rendered as actual line/dot shapes instead of <a:pattFill>. */
const SHAPE_RENDERED_PATTERNS = new Set(["narHorz", "narVert", "smGrid", "lgGrid"]);

/**
 * Render a pattern fill as actual shapes (lines/grid) in PPTX.
 * OOXML pattern presets have fixed tiny cell sizes that can't be scaled,
 * so we draw actual shapes with spacing matching the CSS rendering.
 */
function renderPatternAsShapes(slide: Slide, el: ShapeElement): void {
  const pf = el.style.patternFill!;
  const color = hexColor(pf.fgColor === "transparent" ? "000000" : pf.fgColor);
  const transparency = pf.fgOpacity !== undefined
    ? Math.round((1 - pf.fgOpacity) * 100)
    : 0;
  const fill: PptxGenJS.ShapeFillProps = { color, transparency };

  switch (pf.preset) {
    case "narHorz": {
      // Horizontal scan lines — CSS uses 4px period with 2px lines
      // Use 6px spacing in PPTX for ~180 lines (balances fidelity vs shape count)
      const spacingPx = 6;
      const lineH = pxToInchesY(1);
      const count = Math.floor(el.rect.h / spacingPx);
      const r = rectToInches(el.rect);
      for (let i = 0; i < count; i++) {
        slide.addShape(SHAPES.RECTANGLE, {
          x: r.x,
          y: r.y + pxToInchesY(i * spacingPx),
          w: r.w,
          h: lineH,
          fill,
        });
      }
      break;
    }
    case "narVert": {
      const spacingPx = 6;
      const lineW = pxToInchesX(1);
      const count = Math.floor(el.rect.w / spacingPx);
      const r = rectToInches(el.rect);
      for (let i = 0; i < count; i++) {
        slide.addShape(SHAPES.RECTANGLE, {
          x: r.x + pxToInchesX(i * spacingPx),
          y: r.y,
          w: lineW,
          h: r.h,
          fill,
        });
      }
      break;
    }
    case "smGrid":
    case "lgGrid": {
      // Grid lines — CSS uses 40px period with 1px lines
      const spacingPx = pf.preset === "smGrid" ? 40 : 60;
      const lineW = pxToInchesX(1);
      const lineH = pxToInchesY(1);
      const r = rectToInches(el.rect);
      // Horizontal lines
      const hCount = Math.floor(el.rect.h / spacingPx);
      for (let i = 0; i < hCount; i++) {
        slide.addShape(SHAPES.RECTANGLE, {
          x: r.x,
          y: r.y + pxToInchesY(i * spacingPx),
          w: r.w,
          h: lineH,
          fill,
        });
      }
      // Vertical lines
      const vCount = Math.floor(el.rect.w / spacingPx);
      for (let i = 0; i < vCount; i++) {
        slide.addShape(SHAPES.RECTANGLE, {
          x: r.x + pxToInchesX(i * spacingPx),
          y: r.y,
          w: lineW,
          h: r.h,
          fill,
        });
      }
      break;
    }
  }
}

function renderShape(
  slide: Slide,
  el: ShapeElement,
): void {
  // Pattern fills with line/grid presets: render as actual shapes
  if (el.style.patternFill && SHAPE_RENDERED_PATTERNS.has(el.style.patternFill.preset)) {
    renderPatternAsShapes(slide, el);
    return;
  }

  const r = rectToInches(applyScale(el.rect, el.transform));
  const shapeType = getShapeType(el.shape, el.borderRadius);

  const opts: PptxGenJS.ShapeProps = {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
  };

  const fill = makeFill(el.style, el.opacity);
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

  if (el.borderRadius) {
    opts.rectRadius = radiusToInches(el.borderRadius);
  }

  const shadow = makeShadow(el.shadow);
  if (shadow) opts.shadow = shadow;

  if (el.transform?.rotate) opts.rotate = el.transform.rotate;

  const spid = slideObjectCount(slide) + 2;
  slide.addShape(shapeType, opts);
  trackTransform(spid, el.transform);

  // Track gradient for OOXML post-processing (replaces solid fill placeholder)
  if (el.style.gradient?.stops?.length) {
    slideGradientEntries.push({ spid, gradient: el.style.gradient });
  }

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
    const groupRadius = el.borderRadius;
    const hasRadius = !!groupRadius;
    const hasSideBorders = !!el.border?.sides?.length;

    // For visible side borders on rounded groups, use "backing shape" technique:
    // 1. Draw accent-colored rounded rect (full size) — the border color shows through
    // 2. Draw card fill rounded rect inset by border width — covers accent except at borders
    // This makes borders follow the rounded corners instead of overflowing.
    // Skip for semi-transparent fills: border color bleeds through the transparent inset.
    const fillAlpha = el.style?.fill ? (colorAlpha(el.style.fill) ?? 0) : 0;
    const fillMostlyOpaque = fillAlpha < 5;
    if (hasSideBorders && hasRadius && borderVisible && fillVisible && fillMostlyOpaque) {
      const bw = pxToInchesY(el.border!.width);
      const radius = radiusToInches(groupRadius!);
      const sides = el.border!.sides!;

      const shadow = el.shadow ? makeShadow(el.shadow) : undefined;

      const rotate = el.transform?.rotate;

      // Step 1: Accent-colored backing shape (full size)
      slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
        x: r.x, y: r.y, w: r.w, h: r.h,
        fill: { color: hexColor(el.border!.color) },
        rectRadius: radius,
        ...(shadow ? { shadow } : {}),
        ...(rotate ? { rotate } : {}),
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

      const fill = makeFill(el.style!, el.opacity);
      slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
        x: r.x + inset.left,
        y: r.y + inset.top,
        w: r.w - inset.left - inset.right,
        h: r.h - inset.top - inset.bottom,
        fill: fill ?? { color: "FFFFFF" },
        rectRadius: radius,
        ...(rotate ? { rotate } : {}),
      });
    } else {
      // Standard rendering: single background shape
      const bgOpts: PptxGenJS.ShapeProps = {
        x: r.x, y: r.y, w: r.w, h: r.h,
      };

      const fill = el.style ? makeFill(el.style, el.opacity) : undefined;
      if (fill) bgOpts.fill = fill;

      // Handle borders: full-border uses line property
      if (el.border && !hasSideBorders) {
        const line = el.style ? makeLine(el.style, el.border) : undefined;
        if (line) bgOpts.line = line;
      }

      if (hasRadius) {
        bgOpts.rectRadius = radiusToInches(groupRadius!);
      }

      const shadow = el.shadow ? makeShadow(el.shadow) : undefined;
      if (shadow) bgOpts.shadow = shadow;
      if (el.transform?.rotate) bgOpts.rotate = el.transform.rotate;

      const shapeType = hasRadius ? SHAPES.ROUNDED_RECTANGLE : SHAPES.RECTANGLE;
      const bgSpid = slideObjectCount(slide) + 2;
      slide.addShape(shapeType, bgOpts);

      // Track group background gradient for OOXML post-processing
      if (el.style?.gradient?.stops?.length) {
        slideGradientEntries.push({ spid: bgSpid, gradient: el.style.gradient });
      }

      // Flat side borders (no radius — plain overlay rectangles are fine)
      if (hasSideBorders) {
        renderSideBorders(slide, el.rect, el.border!);
      }
    }
  }

  // Render children — offset by group's origin since children use relative coords.
  // If the group itself has an entrance, suppress children's individual entrances
  // to avoid duplicate animation entries on the same spids.
  const groupHasEntrance = el.entrance && el.entrance.type !== "none";
  const groupRotate = el.transform?.rotate;

  for (const child of el.children) {
    let offsetChild = offsetElement(child, el.rect);

    // Group rotation: rotate each child's position around the group center
    // and add the group's rotation to each child's own rotation.
    if (groupRotate) {
      const cx = el.rect.x + el.rect.w / 2;
      const cy = el.rect.y + el.rect.h / 2;
      const childCx = offsetChild.rect.x + offsetChild.rect.w / 2;
      const childCy = offsetChild.rect.y + offsetChild.rect.h / 2;
      const rotated = rotatePoint(childCx, childCy, cx, cy, groupRotate);
      offsetChild = {
        ...offsetChild,
        rect: {
          ...offsetChild.rect,
          x: rotated.x - offsetChild.rect.w / 2,
          y: rotated.y - offsetChild.rect.h / 2,
        },
        transform: {
          ...offsetChild.transform,
          rotate: (offsetChild.transform?.rotate ?? 0) + groupRotate,
        },
      };
    }

    const renderedChild = groupHasEntrance && child.entrance
      ? { ...offsetChild, entrance: undefined }
      : offsetChild;
    renderElement(slide, renderedChild as LayoutElement);
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
  const codeRadius = el.borderRadius ?? el.style.borderRadius;
  slide.addShape(
    codeRadius
      ? SHAPES.ROUNDED_RECTANGLE
      : SHAPES.RECTANGLE,
    {
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      fill: { color: hexColor(el.style.background) },
      rectRadius: codeRadius
        ? radiusToInches(codeRadius)
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
    slide.addText(toPlainText(h), {
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
      slide.addText(toPlainText(cell), {
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
    text: toPlainText(item),
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

// ---------------------------------------------------------------------------
// Video — embed media or fallback to placeholder
// ---------------------------------------------------------------------------

/** Detect YouTube/Vimeo and return an embed URL, or null for direct files. */
function toEmbedUrl(src: string): string | null {
  const ytMatch = src.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/,
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  const vimeoMatch = src.match(
    /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([\d]+)/,
  );
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
}

function renderVideo(slide: Slide, el: VideoElement): void {
  const r = rectToInches(el.rect);
  const embedUrl = toEmbedUrl(el.src);

  if (embedUrl) {
    // YouTube/Vimeo → online media embed
    slide.addMedia({
      type: "online",
      link: embedUrl,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
    });
  } else if (
    el.src.startsWith("/") ||
    (!el.src.startsWith("http") && !el.src.startsWith("data:"))
  ) {
    // Local file → embed video
    const resolved = resolveImagePath(el.src);
    slide.addMedia({
      type: "video",
      path: resolved,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
    });
  } else {
    // Remote direct URL — render placeholder (PptxGenJS can't embed remote videos)
    renderMediaPlaceholder(slide, el.rect, "Video", el.src);
  }
}

// ---------------------------------------------------------------------------
// Iframe — always placeholder in PPTX (no equivalent)
// ---------------------------------------------------------------------------

function renderIframe(slide: Slide, el: IframeElement): void {
  renderMediaPlaceholder(slide, el.rect, "Embedded Content", el.src);
}

/** Render a rounded-rect placeholder with label + URL text for PPTX. */
function renderMediaPlaceholder(
  slide: Slide,
  rect: Rect,
  label: string,
  url: string,
): void {
  const r = rectToInches(rect);

  // Background rounded rect
  slide.addShape(SHAPES.ROUNDED_RECTANGLE, {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    fill: { color: "1e293b" },
    rectRadius: radiusToInches(12),
  });

  // Label text
  slide.addText(label, {
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h * 0.5,
    fontSize: 24,
    fontFace: "Arial",
    color: "e2e8f0",
    bold: true,
    align: "center",
    valign: "bottom",
    margin: 0,
    isTextBox: true,
  });

  // URL text
  slide.addText(url, {
    x: r.x,
    y: r.y + r.h * 0.5,
    w: r.w,
    h: r.h * 0.5,
    fontSize: 18,
    fontFace: "Arial",
    color: "94a3b8",
    align: "center",
    valign: "top",
    margin: [8, 0, 0, 0],
    isTextBox: true,
  });
}
