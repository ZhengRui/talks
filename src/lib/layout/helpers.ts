import type {
  Rect,
  TextStyle,
  AnimationDef,
  AnimationType,
  LayoutElement,
  TextElement,
  ShapeElement,
  GroupElement,
  ResolvedTheme,
} from "./types";

// --- Canvas constants ---

export const CANVAS_W = 1920;
export const CANVAS_H = 1080;
export const PADDING_X = 160; // 80px each side in the .sl-section (centered within 1600px max-width)
export const PADDING_Y = 60;
export const CONTENT_W = 1600; // max-width of .sl-section
export const CONTENT_X = (CANVAS_W - CONTENT_W) / 2; // 160

// --- Text height estimation ---

const AVG_CHAR_WIDTH_RATIO = 0.52; // average character width as fraction of fontSize
const CJK_CHAR_WIDTH_RATIO = 1.0; // CJK characters are full-width
// CJK Unified Ideographs, Radicals, Symbols/Punctuation, Hiragana, Katakana, Fullwidth Forms
const CJK_RE = /[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF01-\uFF60\uFFE0-\uFFEF]/;

export function estimateTextHeight(
  text: string,
  fontSize: number,
  lineHeight: number,
  containerWidth: number,
): number {
  // Calculate total text width accounting for CJK full-width characters
  let totalTextWidth = 0;
  for (const ch of text) {
    totalTextWidth += fontSize * (CJK_RE.test(ch) ? CJK_CHAR_WIDTH_RATIO : AVG_CHAR_WIDTH_RATIO);
  }
  const lineCount = containerWidth > 0 ? Math.max(1, Math.ceil(totalTextWidth / containerWidth)) : 1;
  // Extra space for descenders (g, y, p, q, j) — needed with tight lineHeight
  const descenderPad = lineHeight < 1.3 ? fontSize * 0.15 : 0;
  return lineCount * fontSize * lineHeight + descenderPad;
}

// --- Animation helpers ---

export function makeAnimation(
  type: AnimationType,
  delay: number,
  duration = 600,
): AnimationDef {
  return { type, delay, duration };
}

export function staggerDelay(index: number, base = 0, step = 100): number {
  return base + index * step;
}

// --- Text style builders ---

export function headingStyle(
  theme: ResolvedTheme,
  fontSize: number,
  opts: Partial<TextStyle> = {},
): TextStyle {
  return {
    fontFamily: theme.fontHeading,
    fontSize,
    fontWeight: 700,
    color: theme.heading,
    lineHeight: 1.1,
    textAlign: "center",
    ...opts,
  };
}

export function bodyStyle(
  theme: ResolvedTheme,
  fontSize = 30,
  opts: Partial<TextStyle> = {},
): TextStyle {
  return {
    fontFamily: theme.fontBody,
    fontSize,
    fontWeight: 400,
    color: theme.text,
    lineHeight: 1.6,
    textAlign: "left",
    ...opts,
  };
}

export function mutedStyle(
  theme: ResolvedTheme,
  fontSize = 26,
  opts: Partial<TextStyle> = {},
): TextStyle {
  return {
    fontFamily: theme.fontBody,
    fontSize,
    fontWeight: 400,
    color: theme.textMuted,
    lineHeight: 1.5,
    textAlign: "center",
    ...opts,
  };
}

// --- Title block (title + accent line, used by ~25 templates) ---

export interface TitleBlockOpts {
  align?: "center" | "left";
  fontSize?: number;
  accentWidth?: number;
  startY?: number;
  maxWidth?: number;
  color?: string;
  textShadow?: string;
}

export interface TitleBlockResult {
  elements: LayoutElement[];
  bottomY: number; // Y position after the title block (for stacking below)
}

export function titleBlock(
  title: string,
  theme: ResolvedTheme,
  opts: TitleBlockOpts = {},
): TitleBlockResult {
  const {
    align = "center",
    fontSize = 56,
    accentWidth = 80,
    startY = PADDING_Y,
    maxWidth = CONTENT_W,
    color,
    textShadow,
  } = opts;

  const x = align === "center" ? (CANVAS_W - maxWidth) / 2 : CONTENT_X;
  const textAlign = align;
  const titleHeight = estimateTextHeight(title, fontSize, 1.1, maxWidth);

  const titleEl: TextElement = {
    kind: "text",
    id: "title",
    rect: { x, y: startY, w: maxWidth, h: titleHeight },
    text: title,
    style: headingStyle(theme, fontSize, {
      textAlign,
      ...(color !== undefined ? { color } : {}),
      ...(textShadow !== undefined ? { textShadow } : {}),
    }),
    animation: makeAnimation("fade-up", 0),
  };

  const lineX = align === "center" ? (CANVAS_W - accentWidth) / 2 : CONTENT_X;
  const lineY = startY + titleHeight + 16;

  const accentLine: ShapeElement = {
    kind: "shape",
    id: "accent-line",
    rect: { x: lineX, y: lineY, w: accentWidth, h: 4 },
    shape: "rect",
    style: { gradient: theme.accentGradient, borderRadius: 2 },
    animation: makeAnimation("fade-up", 100),
  };

  return {
    elements: [titleEl, accentLine],
    bottomY: lineY + 4 + 40, // 40px gap after accent line
  };
}

// --- Positioning helpers ---

export interface StackItem {
  height: number;
  element: LayoutElement;
}

export function stackVertical(
  items: StackItem[],
  startY: number,
  gap: number,
  x: number,
  w: number,
): LayoutElement[] {
  let y = startY;
  return items.map((item) => {
    const el = { ...item.element, rect: { x, y, w, h: item.height } };
    y += item.height + gap;
    return el;
  });
}

export interface DistributedRect {
  rect: Rect;
  index: number;
}

export function distributeHorizontal(
  count: number,
  totalW: number,
  gap: number,
  startX: number,
  y: number,
  h: number,
): DistributedRect[] {
  const itemW = (totalW - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => ({
    rect: { x: startX + i * (itemW + gap), y, w: itemW, h },
    index: i,
  }));
}

export function columnLayout(
  columnCount: number,
  gap: number,
  startX: number,
  totalW: number,
): { x: number; w: number }[] {
  const colW = (totalW - gap * (columnCount - 1)) / columnCount;
  return Array.from({ length: columnCount }, (_, i) => ({
    x: startX + i * (colW + gap),
    w: colW,
  }));
}

// --- Card element (themed group with background, border, shadow) ---

export function cardElement(
  id: string,
  rect: Rect,
  children: LayoutElement[],
  theme: ResolvedTheme,
  opts: {
    accentTop?: boolean;
    accentColor?: string;
    padding?: number;
  } = {},
): GroupElement {
  const { accentTop = false, accentColor, padding = 32 } = opts;

  // Offset children by padding
  const offsetChildren = children.map((child) => ({
    ...child,
    rect: {
      x: child.rect.x + padding,
      y: child.rect.y + padding + (accentTop ? 3 : 0),
      w: child.rect.w - padding * 2,
      h: child.rect.h,
    },
  }));

  return {
    kind: "group",
    id,
    rect,
    children: offsetChildren,
    style: {
      fill: theme.cardBg,
      borderRadius: theme.radius,
      shadow: theme.shadow,
    },
    border: accentTop
      ? { width: 3, color: accentColor ?? theme.accent, sides: ["top"] }
      : theme.cardBorder,
    clipContent: true,
  };
}

// --- Background image + overlay ---

export function backgroundImage(
  src: string,
  imageBase: string,
  overlay?: string,
): LayoutElement[] {
  const elements: LayoutElement[] = [];

  elements.push({
    kind: "image",
    id: "bg-image",
    rect: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H },
    src: `${imageBase}/${src}`,
    objectFit: "cover",
    opacity: 1,
  });

  if (overlay === "dark" || overlay === undefined) {
    elements.push({
      kind: "shape",
      id: "bg-overlay",
      rect: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H },
      shape: "rect",
      style: { fill: "rgba(0, 0, 0, 0.6)" },
    });
  } else if (overlay === "light") {
    elements.push({
      kind: "shape",
      id: "bg-overlay",
      rect: { x: 0, y: 0, w: CANVAS_W, h: CANVAS_H },
      shape: "rect",
      style: { fill: "rgba(255, 255, 255, 0.7)" },
    });
  }

  return elements;
}

// --- Slide base ---

export function makeSlide(
  theme: ResolvedTheme,
  elements: LayoutElement[],
  opts: { backgroundImage?: string; overlay?: string } = {},
): {
  width: 1920;
  height: 1080;
  background: string;
  backgroundImage?: string;
  overlay?: string;
  elements: LayoutElement[];
} {
  return {
    width: 1920,
    height: 1080,
    background: theme.bg,
    backgroundImage: opts.backgroundImage,
    overlay: opts.overlay,
    elements,
  };
}

// --- Pill element ---

export function pillElement(
  id: string,
  text: string,
  theme: ResolvedTheme,
  rect: Rect,
  opts: { color?: string; background?: string; borderColor?: string } = {},
): GroupElement {
  return {
    kind: "group",
    id,
    rect,
    children: [
      {
        kind: "text",
        id: `${id}-text`,
        rect: { x: 0, y: 0, w: rect.w, h: rect.h },
        text,
        style: {
          fontFamily: theme.fontBody,
          fontSize: 22,
          fontWeight: 400,
          color: opts.color ?? theme.textMuted,
          lineHeight: 1.4,
          textAlign: "center",
          verticalAlign: "middle",
        },
      },
    ],
    style: {
      fill: opts.background ?? theme.bgTertiary,
      borderRadius: 100,
    },
    border: { width: 1, color: opts.borderColor ?? theme.border.color },
  };
}
