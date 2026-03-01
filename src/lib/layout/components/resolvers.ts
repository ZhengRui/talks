import type {
  LayoutElement,
  ListElement,
  ResolvedTheme,
  Rect,
  TextElement,
  ShapeElement,
  GroupElement,
} from "../types";
import type {
  SlideComponent,
  TextComponent,
  HeadingComponent,
  BodyComponent,
  BulletsComponent,
  StatComponent,
  TagComponent,
  DividerComponent,
  QuoteComponent,
  CardComponent,
  ImageComponent,
  CodeComponent,
  SpacerComponent,
  RawComponent,
  ColumnsComponent,
  BoxComponent,
  GridComponent,
  TableComponent,
  StepsComponent,
  TimelineComponent,
} from "./types";
import { estimateTextHeight, bodyStyle, makeAnimation, staggerDelay } from "../helpers";
import { resolveColor, resolveThemeToken } from "./theme-tokens";

// --- Resolver result ---

export interface ResolveResult {
  elements: LayoutElement[];
  height: number;
  /** Override stacker gap before this component */
  gapBefore?: number;
  /** Override stacker gap after this component */
  gapAfter?: number;
  /** Flex spacer — height determined by stacker from remaining space */
  flex?: boolean;
}

// --- Context passed to each resolver ---

export interface ResolveContext {
  theme: ResolvedTheme;
  /** Bounding box within which elements are positioned (absolute canvas coords) */
  panel: Rect;
  /** Override text color for the panel (e.g. light text on dark background) */
  textColor?: string;
  /** Override text shadow for the panel (e.g. drop shadow on dark background) */
  textShadow?: string;
  /** Unique prefix for element IDs (e.g. "left-0") */
  idPrefix: string;
  /** Image base path for relative src resolution */
  imageBase: string;
  /** Whether staggered entrance animations are enabled */
  animate?: boolean;
  /** Base delay (ms) for this component's animation stagger */
  animationDelay?: number;
}

// --- Text (generic primitive) ---

const FONT_FAMILY_MAP = {
  heading: (t: ResolvedTheme) => t.fontHeading,
  body: (t: ResolvedTheme) => t.fontBody,
  mono: (t: ResolvedTheme) => t.fontMono,
};

function resolveText(c: TextComponent, ctx: ResolveContext): ResolveResult {
  const fontSize = c.fontSize ?? 28;
  const fontWeight = c.fontWeight === "bold" ? 700 : 400;
  const lineHeight = c.lineHeight ?? 1.6;
  const fontFamily = FONT_FAMILY_MAP[c.fontFamily ?? "body"](ctx.theme);
  const color = c.color
    ? resolveColor(c.color, ctx.theme, ctx.theme.text)
    : (ctx.textColor ?? ctx.theme.text);
  const textW = c.maxWidth ? Math.min(c.maxWidth, ctx.panel.w) : ctx.panel.w;
  const textX = c.maxWidth ? (ctx.panel.w - textW) / 2 : 0;
  const h = estimateTextHeight(c.text, fontSize, lineHeight, textW, fontWeight);

  const el: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-text`,
    rect: { x: textX, y: 0, w: textW, h },
    text: c.text,
    style: {
      fontFamily,
      fontSize,
      fontWeight,
      color,
      lineHeight,
      textAlign: c.textAlign ?? "left",
      ...(c.fontStyle ? { fontStyle: c.fontStyle } : {}),
      ...(ctx.textShadow ? { textShadow: ctx.textShadow } : {}),
    },
  };

  return {
    elements: [el],
    height: h,
    gapBefore: c.marginTop,
    gapAfter: c.marginBottom,
  };
}

// --- Heading (sugar for text with heading defaults) ---

const HEADING_SIZES: Record<number, number> = { 1: 54, 2: 42, 3: 34 };

function resolveHeading(c: HeadingComponent, ctx: ResolveContext): ResolveResult {
  const fontSize = c.fontSize ?? HEADING_SIZES[c.level ?? 1] ?? 54;
  const color = c.color
    ? resolveColor(c.color, ctx.theme, ctx.theme.heading)
    : (ctx.textColor ?? ctx.theme.heading);
  return resolveText(
    {
      type: "text",
      text: c.text,
      fontSize,
      fontWeight: "bold",
      fontFamily: "heading",
      color,
      textAlign: c.textAlign,
      lineHeight: 1.15,
    },
    { ...ctx, idPrefix: `${ctx.idPrefix}-heading` },
  );
}

// --- Body (sugar for text with body defaults) ---

function resolveBody(c: BodyComponent, ctx: ResolveContext): ResolveResult {
  const color = c.color
    ? resolveColor(c.color, ctx.theme, ctx.theme.text)
    : undefined; // let resolveText use ctx.textColor ?? theme.text
  return resolveText(
    {
      type: "text",
      text: c.text,
      fontSize: c.fontSize ?? 28,
      fontFamily: "body",
      ...(color ? { color } : {}),
      textAlign: c.textAlign,
      ...(c.lineHeight !== undefined ? { lineHeight: c.lineHeight } : {}),
      marginTop: c.marginTop,
      marginBottom: c.marginBottom,
    },
    { ...ctx, idPrefix: `${ctx.idPrefix}-body` },
  );
}

// --- Bullets ---

function resolveBullets(c: BulletsComponent, ctx: ResolveContext): ResolveResult {
  const variant = c.variant ?? "card";
  const ordered = c.ordered ?? false;

  if (variant === "list") {
    return resolveBulletsList(c, ctx, ordered);
  }
  if (variant === "plain") {
    return resolveBulletsPlain(c, ctx, ordered);
  }
  return resolveBulletsCard(c, ctx, ordered);
}

function resolveBulletsList(c: BulletsComponent, ctx: ResolveContext, ordered: boolean): ResolveResult {
  const fontSize = c.fontSize ?? 30;
  const itemSpacing = c.gap ?? 10;
  const lineH = fontSize * 1.6;
  const h = c.items.length * (lineH + itemSpacing);

  const el: ListElement = {
    kind: "list",
    id: `${ctx.idPrefix}-list`,
    rect: { x: 0, y: 0, w: ctx.panel.w, h },
    items: c.items,
    ordered,
    itemStyle: bodyStyle(ctx.theme, fontSize, {
      color: ctx.textColor ?? ctx.theme.text,
    }),
    bulletColor: ctx.textColor ?? ctx.theme.text,
    itemSpacing,
  };

  return { elements: [el], height: h };
}

function resolveBulletsCard(c: BulletsComponent, ctx: ResolveContext, ordered: boolean): ResolveResult {
  const bulletGap = c.gap ?? 16;
  const bulletPadding = 16;
  const fontSize = c.fontSize ?? 30;
  const lineHeight = 1.6;
  const bulletW = ctx.panel.w;
  const indent = ordered ? 68 : 24; // badge(44)+gap(24) or accent bar indent
  const textW = bulletW - indent - 24;

  const elements: LayoutElement[] = [];
  let totalH = 0;

  c.items.forEach((item, i) => {
    const textH = estimateTextHeight(item, fontSize, lineHeight, textW);
    const itemH = textH + bulletPadding * 2;

    const children: LayoutElement[] = [];

    if (ordered) {
      const badgeSize = 36;
      const badgeY = (itemH - badgeSize) / 2;
      children.push(
        {
          kind: "group",
          id: `${ctx.idPrefix}-bullet-${i}-badge`,
          rect: { x: 16, y: badgeY, w: badgeSize, h: badgeSize },
          children: [{
            kind: "text",
            id: `${ctx.idPrefix}-bullet-${i}-num`,
            rect: { x: 0, y: 0, w: badgeSize, h: badgeSize },
            text: String(i + 1),
            style: {
              fontFamily: ctx.theme.fontHeading,
              fontSize: 20,
              fontWeight: 700,
              color: ctx.theme.bg,
              lineHeight: 1,
              textAlign: "center",
              verticalAlign: "middle",
            },
          }],
          style: { fill: ctx.theme.accent, borderRadius: 100 },
        } satisfies GroupElement,
      );
    }

    children.push({
      kind: "text",
      id: `${ctx.idPrefix}-bullet-${i}-text`,
      rect: { x: indent, y: bulletPadding, w: textW, h: textH },
      text: item,
      style: bodyStyle(ctx.theme, fontSize, {
        color: ctx.textColor ?? ctx.theme.text,
      }),
    });

    const group: GroupElement = {
      kind: "group",
      id: `${ctx.idPrefix}-bullet-${i}`,
      rect: { x: 0, y: totalH, w: bulletW, h: itemH },
      children,
      style: {
        fill: ctx.theme.bgSecondary,
        borderRadius: ctx.theme.radiusSm,
      },
      border: ordered ? undefined : { width: 3, color: ctx.theme.accent, sides: ["left"] },
    };

    if (ctx.animate) {
      group.animation = makeAnimation(
        "fade-up",
        staggerDelay(i, ctx.animationDelay ?? 0),
      );
    }

    elements.push(group);
    totalH += itemH + (i < c.items.length - 1 ? bulletGap : 0);
  });

  return { elements, height: totalH };
}

function resolveBulletsPlain(c: BulletsComponent, ctx: ResolveContext, ordered: boolean): ResolveResult {
  const itemGap = c.gap ?? 20;
  const fontSize = c.fontSize ?? 30;
  const badgeSize = 44;
  const badgeTextGap = 20;
  const textIndent = ordered ? badgeSize + badgeTextGap : 0;
  const textW = ctx.panel.w - textIndent;
  const itemH = 52;

  const elements: LayoutElement[] = [];
  let totalH = 0;

  c.items.forEach((item, i) => {
    const y = totalH;

    if (ordered) {
      // Circle badge
      const badge: GroupElement = {
        kind: "group",
        id: `${ctx.idPrefix}-bullet-${i}-badge`,
        rect: { x: 0, y, w: badgeSize, h: badgeSize },
        children: [{
          kind: "text",
          id: `${ctx.idPrefix}-bullet-${i}-num`,
          rect: { x: 0, y: 0, w: badgeSize, h: badgeSize },
          text: String(i + 1),
          style: {
            fontFamily: ctx.theme.fontHeading,
            fontSize: 24,
            fontWeight: 700,
            color: ctx.theme.bg,
            lineHeight: 1,
            textAlign: "center",
            verticalAlign: "middle",
          },
        }],
        style: { fill: ctx.theme.accent, borderRadius: 100 },
      };

      if (ctx.animate) {
        badge.animation = makeAnimation(
          "fade-up",
          staggerDelay(i, ctx.animationDelay ?? 0),
        );
      }
      elements.push(badge);
    }

    // Item text
    const textEl: TextElement = {
      kind: "text",
      id: `${ctx.idPrefix}-bullet-${i}-text`,
      rect: { x: textIndent, y: y + (ordered ? 4 : 0), w: textW, h: itemH },
      text: item,
      style: bodyStyle(ctx.theme, fontSize, {
        color: ctx.textColor ?? ctx.theme.text,
      }),
    };

    if (ctx.animate) {
      textEl.animation = makeAnimation(
        "fade-up",
        staggerDelay(i, ctx.animationDelay ?? 0),
      );
    }

    elements.push(textEl);
    totalH += itemH + (i < c.items.length - 1 ? itemGap : 0);
  });

  return { elements, height: totalH };
}

// --- Stat ---

function resolveStat(c: StatComponent, ctx: ResolveContext): ResolveResult {
  const valueSize = c.fontSize ?? 64;
  const labelSize = c.labelFontSize ?? 24;
  const valueH = valueSize * 1.15;
  const labelH = labelSize * 1.5;
  const gap = 8;
  const totalH = valueH + gap + labelH;
  const w = ctx.panel.w;
  const align = c.textAlign ?? "left";

  const valueEl: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-stat-value`,
    rect: { x: 0, y: 0, w, h: valueH },
    text: c.value,
    style: {
      fontFamily: ctx.theme.fontHeading,
      fontSize: valueSize,
      fontWeight: 700,
      color: ctx.theme.accent,
      lineHeight: 1.15,
      textAlign: align,
    },
  };

  const labelEl: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-stat-label`,
    rect: { x: 0, y: valueH + gap, w, h: labelH },
    text: c.label,
    style: {
      fontFamily: ctx.theme.fontBody,
      fontSize: labelSize,
      fontWeight: 400,
      color: ctx.textColor ?? ctx.theme.textMuted,
      lineHeight: 1.5,
      textAlign: align,
    },
  };

  return { elements: [valueEl, labelEl], height: totalH };
}

// --- Tag ---

function resolveTag(c: TagComponent, ctx: ResolveContext): ResolveResult {
  const fontSize = 20;
  const paddingX = 20;
  const paddingY = 12;
  const textW = c.text.length * fontSize * 0.7 + paddingX * 2;
  const h = fontSize + paddingY * 2;
  const color = c.color
    ? resolveColor(c.color, ctx.theme, ctx.theme.accent)
    : (ctx.textColor ?? ctx.theme.accent);

  // When textColor override is active (e.g. white text on dark bg), use translucent pill
  const hasTextOverride = !c.color && !!ctx.textColor;
  const pillFill = hasTextOverride ? "rgba(255,255,255,0.15)" : color + "22";
  const pillBorder = hasTextOverride ? "rgba(255,255,255,0.2)" : color;
  const pillTextColor = hasTextOverride ? "rgba(255,255,255,0.9)" : color;

  const x = c.align === "center" ? (ctx.panel.w - textW) / 2 : 0;

  const pill: ShapeElement = {
    kind: "shape",
    id: `${ctx.idPrefix}-tag-bg`,
    rect: { x, y: 0, w: textW, h },
    shape: "pill",
    style: {
      fill: pillFill,
      borderRadius: 100,
    },
    border: { width: 1, color: pillBorder },
  };

  const text: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-tag-text`,
    rect: { x, y: 0, w: textW, h },
    text: c.text,
    style: {
      fontFamily: ctx.theme.fontBody,
      fontSize,
      fontWeight: 600,
      color: pillTextColor,
      lineHeight: 1,
      textAlign: "center",
      verticalAlign: "middle",
    },
  };

  return { elements: [pill, text], height: h };
}

// --- Divider ---

function resolveDivider(c: DividerComponent, ctx: ResolveContext): ResolveResult {
  const variant = c.variant ?? "solid";
  const isBorder = variant === "border";
  const h = isBorder ? 1 : 4;
  const w = isBorder
    ? (c.width ?? ctx.panel.w)
    : (c.width ?? Math.min(ctx.panel.w, 200));
  const align = c.align ?? "left";
  const x = align === "center" ? (ctx.panel.w - w) / 2 : 0;

  const style: ShapeElement["style"] =
    variant === "gradient"
      ? { gradient: ctx.theme.accentGradient, borderRadius: 2 }
      : variant === "ink"
        ? {
            gradient: {
              type: "linear",
              angle: 90,
              stops: [
                { color: ctx.theme.accent, position: 0 },
                { color: "transparent", position: 1 },
              ],
            },
            borderRadius: 2,
          }
        : isBorder
          ? { fill: ctx.theme.border.color }
          : { fill: ctx.theme.accent, borderRadius: 2, opacity: 0.4 };

  const el: ShapeElement = {
    kind: "shape",
    id: `${ctx.idPrefix}-divider`,
    rect: { x, y: 0, w, h },
    shape: "rect",
    style,
  };

  return {
    elements: [el],
    height: h,
    gapBefore: c.marginTop,
    gapAfter: c.marginBottom,
  };
}

// --- Quote ---

function resolveQuote(c: QuoteComponent, ctx: ResolveContext): ResolveResult {
  const quoteFontSize = c.fontSize ?? 30;
  const attrSize = c.attributionFontSize ?? 22;
  const lineHeight = 1.6;
  const align = c.textAlign ?? "left";
  const hasBar = align === "left" && !c.decorative; // accent bar only for left-aligned, non-decorative
  const indent = hasBar ? 28 : 0;
  const textW = ctx.panel.w - indent;

  const elements: LayoutElement[] = [];
  let cursorY = 0;

  // Decorative opening quote mark
  const baseDelay = ctx.animationDelay ?? 0;
  if (c.decorative) {
    const markSize = 120;
    const markGap = 24;
    const markEl: TextElement = {
      kind: "text",
      id: `${ctx.idPrefix}-quote-mark`,
      rect: { x: 0, y: cursorY, w: textW, h: markSize },
      text: "\u201C",
      style: {
        fontFamily: ctx.theme.fontHeading,
        fontSize: markSize,
        fontWeight: 700,
        color: ctx.theme.accent,
        lineHeight: 1,
        textAlign: align,
      },
    };
    if (ctx.animate) {
      markEl.animation = makeAnimation("fade-in", baseDelay);
    }
    elements.push(markEl);
    cursorY += markSize + markGap;
  }

  // Accent bar on the left (only for left-aligned, non-decorative quotes)
  let bar: ShapeElement | undefined;
  if (hasBar) {
    const barW = 4;
    bar = {
      kind: "shape",
      id: `${ctx.idPrefix}-quote-bar`,
      rect: { x: 0, y: cursorY, w: barW, h: 0 }, // height set later
      shape: "rect",
      style: { fill: ctx.theme.accent, borderRadius: 2 },
    };
    elements.push(bar);
  }

  const quoteH = estimateTextHeight(c.text, quoteFontSize, lineHeight, textW);

  // Quote text
  const quoteEl: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-quote-text`,
    rect: { x: hasBar ? 24 : 0, y: cursorY, w: textW, h: quoteH },
    text: c.text,
    style: {
      fontFamily: ctx.theme.fontBody,
      fontSize: quoteFontSize,
      fontWeight: 400,
      fontStyle: "italic",
      color: ctx.textColor ?? ctx.theme.text,
      lineHeight,
      textAlign: align,
    },
  };
  if (ctx.animate) {
    quoteEl.animation = makeAnimation(
      c.decorative ? "scale-up" : "fade-up",
      c.decorative ? baseDelay + 150 : baseDelay,
    );
  }
  elements.push(quoteEl);

  let barH = quoteH;
  cursorY += quoteH;

  // Attribution
  if (c.attribution) {
    const attrGap = 24;
    const attrH = attrSize * 1.5;
    const attrEl: TextElement = {
      kind: "text",
      id: `${ctx.idPrefix}-quote-attr`,
      rect: { x: hasBar ? 24 : 0, y: cursorY + attrGap, w: textW, h: attrH },
      text: `\u2014 ${c.attribution}`,
      style: {
        fontFamily: ctx.theme.fontBody,
        fontSize: attrSize,
        fontWeight: 400,
        color: ctx.textColor ?? ctx.theme.textMuted,
        lineHeight: 1.5,
        textAlign: align,
      },
    };
    if (ctx.animate) {
      attrEl.animation = makeAnimation("fade-up", baseDelay + (c.decorative ? 400 : 200));
    }
    elements.push(attrEl);
    barH += attrGap + attrH;
    cursorY += attrGap + attrH;
  }

  // Set accent bar height to cover quote + attribution
  if (bar) bar.rect.h = barH;

  return { elements, height: cursorY };
}

// --- Card ---

function resolveCard(c: CardComponent, ctx: ResolveContext): ResolveResult {
  const padding = 28;
  const titleSize = 26;
  const bodySize = 24;
  const titleH = titleSize * 1.3;
  const bodyW = ctx.panel.w - padding * 2;
  const bodyH = estimateTextHeight(c.body, bodySize, 1.6, bodyW);
  const innerH = titleH + 12 + bodyH;
  const totalH = innerH + padding * 2;

  const bg = c.dark ? ctx.theme.bgTertiary : ctx.theme.cardBg;
  const textColor = ctx.textColor ?? ctx.theme.text;

  const group: GroupElement = {
    kind: "group",
    id: `${ctx.idPrefix}-card`,
    rect: { x: 0, y: 0, w: ctx.panel.w, h: totalH },
    children: [
      {
        kind: "text",
        id: `${ctx.idPrefix}-card-title`,
        rect: { x: padding, y: padding, w: bodyW, h: titleH },
        text: c.title,
        style: {
          fontFamily: ctx.theme.fontHeading,
          fontSize: titleSize,
          fontWeight: 700,
          color: textColor,
          lineHeight: 1.3,
          textAlign: "left",
        },
      },
      {
        kind: "text",
        id: `${ctx.idPrefix}-card-body`,
        rect: { x: padding, y: padding + titleH + 12, w: bodyW, h: bodyH },
        text: c.body,
        style: {
          fontFamily: ctx.theme.fontBody,
          fontSize: bodySize,
          fontWeight: 400,
          color: ctx.textColor ?? ctx.theme.textMuted,
          lineHeight: 1.6,
          textAlign: "left",
        },
      },
    ],
    style: {
      fill: bg,
      borderRadius: ctx.theme.radius,
      shadow: ctx.theme.shadow,
    },
    border: ctx.theme.cardBorder,
    clipContent: true,
  };

  return { elements: [group], height: totalH };
}

// --- Image ---

function resolveImage(c: ImageComponent, ctx: ResolveContext): ResolveResult {
  const flex = c.height === undefined;
  const h = c.height ?? 0; // flex images get height from stacker
  const src = c.src.startsWith("/") || c.src.startsWith("http") || c.src.startsWith("data:")
    ? c.src
    : `${ctx.imageBase}/${c.src}`;

  // clipCircle requires a square — use height as both dimensions, center horizontally
  const w = c.clipCircle ? (h || ctx.panel.h) : ctx.panel.w;
  const x = c.clipCircle ? (ctx.panel.w - w) / 2 : 0;

  const el: LayoutElement = {
    kind: "image",
    id: `${ctx.idPrefix}-image`,
    rect: { x, y: 0, w, h },
    src,
    objectFit: c.objectFit ?? "contain",
    ...(c.clipCircle ? { clipCircle: true } : {}),
    borderRadius: c.clipCircle ? 0 : (c.borderRadius ?? ctx.theme.radiusSm),
  };

  return { elements: [el], height: h, ...(flex && { flex: true }) };
}

// --- Code ---

function resolveCode(c: CodeComponent, ctx: ResolveContext): ResolveResult {
  const codeFontSize = c.fontSize ?? 24;
  const codeLineH = 1.6;
  const codePadding = c.padding ?? 32;
  const lineCount = c.code.split("\n").length;
  const h = lineCount * codeFontSize * codeLineH + codePadding * 2;

  const el: LayoutElement = {
    kind: "code",
    id: `${ctx.idPrefix}-code`,
    rect: { x: 0, y: 0, w: ctx.panel.w, h },
    code: c.code,
    language: c.language,
    style: {
      fontFamily: ctx.theme.fontMono,
      fontSize: codeFontSize,
      color: ctx.theme.codeText,
      background: ctx.theme.codeBg,
      borderRadius: ctx.theme.radius,
      padding: codePadding,
    },
  };

  return { elements: [el], height: h };
}

// --- Spacer ---

function resolveSpacer(c: SpacerComponent): ResolveResult {
  if (c.flex) {
    return { elements: [], height: 0, flex: true };
  }
  return { elements: [], height: c.height ?? 0 };
}

// --- Raw (escape hatch) ---

/** Skip set: fields that contain user content, not theme tokens. */
const RAW_TOKEN_SKIP = new Set(["text", "id", "code", "src", "language", "shape", "kind"]);

/** Recursively resolve theme.* tokens in all string fields of raw elements. */
function resolveRawTokens(elements: LayoutElement[], theme: ResolvedTheme): LayoutElement[] {
  function walk(obj: unknown, key?: string): unknown {
    // Skip content fields
    if (key && RAW_TOKEN_SKIP.has(key)) return obj;
    // Resolve theme token strings
    if (typeof obj === "string") return resolveThemeToken(obj, theme) ?? obj;
    // Recurse into arrays (e.g. children, rows, headers, items, stops)
    if (Array.isArray(obj)) return obj.map((v, i) => walk(v, String(i)));
    // Recurse into objects
    if (obj && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = walk(v, k);
      }
      return result;
    }
    return obj;
  }

  return elements.map((el) => walk(el) as LayoutElement);
}

function resolveRaw(c: RawComponent, ctx: ResolveContext): ResolveResult {
  const elements = resolveRawTokens(c.elements, ctx.theme);
  return { elements, height: c.height };
}

// --- Columns (horizontal layout) ---

function resolveColumns(c: ColumnsComponent, ctx: ResolveContext): ResolveResult {
  const gap = c.gap ?? 32;
  const count = c.children.length;
  if (count === 0) return { elements: [], height: 0 };

  // Compute column widths — use ratio for 2-column layouts, else equal
  let colWidths: number[];
  if (c.ratio !== undefined && count === 2) {
    const col0W = Math.round(ctx.panel.w * c.ratio);
    const col1W = ctx.panel.w - col0W - gap;
    colWidths = [col0W, col1W];
  } else {
    const equalW = (ctx.panel.w - gap * (count - 1)) / count;
    colWidths = Array(count).fill(equalW) as number[];
  }

  const allElements: LayoutElement[] = [];
  let maxH = 0;
  let colX = 0;

  c.children.forEach((child, i) => {
    const colW = colWidths[i];
    const childCtx: ResolveContext = {
      ...ctx,
      panel: { x: colX, y: 0, w: colW, h: ctx.panel.h },
      idPrefix: `${ctx.idPrefix}-col${i}`,
      animationDelay: ctx.animate
        ? staggerDelay(i, ctx.animationDelay ?? 0)
        : undefined,
    };

    const result = resolveComponent(child, childCtx);

    // Offset child elements to column position
    const positioned = result.elements.map((el) => ({
      ...el,
      rect: { ...el.rect, x: el.rect.x + colX, y: el.rect.y },
    }));

    // Apply per-column staggered animation
    if (ctx.animate) {
      positioned.forEach((el) => {
        if (!el.animation) {
          (el as { animation: unknown }).animation = makeAnimation(
            "fade-up",
            staggerDelay(i, ctx.animationDelay ?? 0),
          );
        }
      });
    }

    allElements.push(...positioned);
    maxH = Math.max(maxH, result.height);
    colX += colW + gap;
  });

  // Stretch all top-level group elements to equal height
  if (c.equalHeight && maxH > 0) {
    allElements.forEach((el) => {
      if (el.kind === "group" && el.rect.h < maxH) {
        el.rect = { ...el.rect, h: maxH };
      }
    });
  }

  return { elements: allElements, height: maxH };
}

// --- Grid (wrapping multi-row layout) ---

function resolveGrid(c: GridComponent, ctx: ResolveContext): ResolveResult {
  const gap = c.gap ?? 32;
  const cols = c.columns ?? 3;
  const count = c.children.length;
  if (count === 0) return { elements: [], height: 0 };

  const colW = (ctx.panel.w - gap * (cols - 1)) / cols;
  const rows = Math.ceil(count / cols);
  // Pre-divide available height equally among rows so flex children
  // in each row get a fair share (instead of first row grabbing all).
  const rowH = (ctx.panel.h - gap * (rows - 1)) / rows;

  const allElements: LayoutElement[] = [];
  let totalH = 0;
  let globalIdx = 0; // for staggered animation across all items

  // Process children in row chunks
  for (let start = 0; start < count; start += cols) {
    const rowChildren = c.children.slice(start, start + cols);
    const rowElements: LayoutElement[][] = [];
    let rowMaxH = 0;

    let hasFlexChild = false;

    rowChildren.forEach((child, colIdx) => {
      const colX = colIdx * (colW + gap);
      const childCtx: ResolveContext = {
        ...ctx,
        panel: { x: colX, y: 0, w: colW, h: rowH },
        idPrefix: `${ctx.idPrefix}-g${globalIdx}`,
        animationDelay: ctx.animate
          ? staggerDelay(globalIdx, ctx.animationDelay ?? 0)
          : undefined,
      };

      const result = resolveComponent(child, childCtx);

      // Expand flex children (e.g. fill boxes) to the pre-computed row height
      if (result.flex) {
        hasFlexChild = true;
        result.elements.forEach((el) => {
          if (el.kind === "group") {
            el.rect = { ...el.rect, h: rowH };
          }
        });
      }

      // Offset to column position within row
      const positioned = result.elements.map((el) => ({
        ...el,
        rect: { ...el.rect, x: el.rect.x + colX, y: el.rect.y + totalH },
      }));

      // Apply per-item staggered animation
      if (ctx.animate) {
        positioned.forEach((el) => {
          if (!el.animation) {
            (el as { animation: unknown }).animation = makeAnimation(
              "fade-up",
              staggerDelay(globalIdx, ctx.animationDelay ?? 0),
            );
          }
        });
      }

      rowElements.push(positioned);
      rowMaxH = Math.max(rowMaxH, result.flex ? rowH : result.height);
      globalIdx++;
    });

    // Stretch groups to equal height within the row
    const effectiveRowH = hasFlexChild ? rowH : rowMaxH;
    if ((c.equalHeight || hasFlexChild) && effectiveRowH > 0) {
      rowElements.forEach((els) => {
        els.forEach((el) => {
          if (el.kind === "group" && el.rect.h < effectiveRowH) {
            el.rect = { ...el.rect, h: effectiveRowH };
          }
        });
      });
    }

    rowElements.forEach((els) => allElements.push(...els));
    totalH += rowMaxH + (start + cols < count ? gap : 0);
  }

  return { elements: allElements, height: totalH };
}

// --- Table ---

function resolveTable(c: TableComponent, ctx: ResolveContext): ResolveResult {
  const fontSize = c.fontSize ?? 26;
  const headerFontSize = c.headerFontSize ?? 26;
  const rowH = 68;
  const headerH = 72;
  const tableH = headerH + c.rows.length * rowH;

  const el: LayoutElement = {
    kind: "table",
    id: `${ctx.idPrefix}-table`,
    rect: { x: 0, y: 0, w: ctx.panel.w, h: tableH },
    headers: c.headers,
    rows: c.rows,
    headerStyle: {
      fontFamily: ctx.theme.fontHeading,
      fontSize: headerFontSize,
      fontWeight: 600,
      color: ctx.theme.bg,
      lineHeight: 1.4,
      textAlign: "left",
      background: ctx.theme.accent,
    },
    cellStyle: {
      fontFamily: ctx.theme.fontBody,
      fontSize,
      fontWeight: 400,
      color: ctx.theme.text,
      lineHeight: 1.4,
      textAlign: "left",
      background: ctx.theme.cardBg,
      altBackground: ctx.theme.bgTertiary,
    },
    borderColor: ctx.theme.border.color,
  };

  return { elements: [el], height: tableH };
}

// --- Steps (numbered badge + connector + card) ---

function resolveSteps(c: StepsComponent, ctx: ResolveContext): ResolveResult {
  const count = c.items.length;
  if (count === 0) return { elements: [], height: 0 };

  const badgeSize = c.badgeSize ?? 48;
  const stepGap = c.gap ?? 24;
  const connectorW = 3;
  const connectorGap = 24; // gap between badge column and card

  // Calculate step height to fill available space
  const availableH = ctx.panel.h;
  const stepH = Math.min(120, (availableH - (count - 1) * stepGap) / count);

  const badgeX = 0;
  const cardX = badgeSize + connectorGap;
  const cardW = ctx.panel.w - badgeSize - connectorGap;
  const cardPad = 24;

  const elements: LayoutElement[] = [];

  c.items.forEach((step, i) => {
    const y = i * (stepH + stepGap);
    const delay = staggerDelay(i, 200, 150);

    // Badge circle (accent bg, number inside)
    elements.push({
      kind: "group",
      id: `${ctx.idPrefix}-badge-${i}`,
      rect: { x: badgeX, y: y + (stepH - badgeSize) / 2, w: badgeSize, h: badgeSize },
      children: [
        {
          kind: "text",
          id: `${ctx.idPrefix}-badge-${i}-num`,
          rect: { x: 0, y: 0, w: badgeSize, h: badgeSize },
          text: String(i + 1),
          style: {
            fontFamily: ctx.theme.fontBody,
            fontSize: 24,
            fontWeight: 700,
            color: ctx.theme.bg,
            lineHeight: 1,
            textAlign: "center",
            verticalAlign: "middle",
          },
        },
      ],
      style: { fill: ctx.theme.accent, borderRadius: 100 },
      ...(ctx.animate && { animation: makeAnimation("scale-up", delay) }),
    });

    // Connector line (between badges, except after last)
    if (i < count - 1) {
      const lineX = badgeSize / 2 - connectorW / 2;
      const lineY = y + (stepH + badgeSize) / 2;
      const lineH = stepGap + (stepH - badgeSize);

      elements.push({
        kind: "shape",
        id: `${ctx.idPrefix}-connector-${i}`,
        rect: { x: lineX, y: lineY, w: connectorW, h: lineH },
        shape: "rect",
        style: { fill: ctx.theme.border.color },
        ...(ctx.animate && { animation: makeAnimation("fade-in", delay + 100) }),
      } as LayoutElement);
    }

    // Step card (label + optional description)
    const cardChildren: LayoutElement[] = [
      {
        kind: "text",
        id: `${ctx.idPrefix}-step-${i}-label`,
        rect: { x: cardPad, y: cardPad, w: cardW - cardPad * 2, h: 36 },
        text: step.label,
        style: {
          fontFamily: ctx.theme.fontHeading,
          fontSize: 30,
          fontWeight: 700,
          color: ctx.theme.heading,
          lineHeight: 1.1,
          textAlign: "left",
        },
      },
    ];

    if (step.description) {
      cardChildren.push({
        kind: "text",
        id: `${ctx.idPrefix}-step-${i}-desc`,
        rect: { x: cardPad, y: cardPad + 40, w: cardW - cardPad * 2, h: 32 },
        text: step.description,
        style: {
          fontFamily: ctx.theme.fontBody,
          fontSize: 24,
          fontWeight: 400,
          color: ctx.theme.textMuted,
          lineHeight: 1.5,
          textAlign: "left",
        },
      });
    }

    elements.push({
      kind: "group",
      id: `${ctx.idPrefix}-step-card-${i}`,
      rect: { x: cardX, y, w: cardW, h: stepH },
      children: cardChildren,
      style: {
        fill: ctx.theme.cardBg,
        borderRadius: ctx.theme.radius,
        shadow: ctx.theme.shadow,
      },
      border: ctx.theme.cardBorder,
      clipContent: true,
      ...(ctx.animate && { animation: makeAnimation("fade-up", delay + 50) }),
    });
  });

  const totalH = count * stepH + (count - 1) * stepGap;
  return { elements, height: totalH };
}

// --- Timeline (horizontal line with dots + event info) ---

function resolveTimeline(c: TimelineComponent, ctx: ResolveContext): ResolveResult {
  const count = c.events.length;
  if (count === 0) return { elements: [], height: 0 };

  const dotSize = c.dotSize ?? 16;
  const dotBorderSize = 3;
  const lineY = 18; // center of dots relative to component top
  const lineH = 3;

  const elements: LayoutElement[] = [];

  // Horizontal connector line spanning full width
  elements.push({
    kind: "shape",
    id: `${ctx.idPrefix}-timeline-line`,
    rect: { x: 0, y: lineY - 1, w: ctx.panel.w, h: lineH },
    shape: "rect",
    style: { fill: ctx.theme.border.color },
    ...(ctx.animate && { animation: makeAnimation("fade-in", 100) }),
  } as LayoutElement);

  // Distribute events horizontally
  const eventW = ctx.panel.w / count;

  let maxBottomY = 0;

  c.events.forEach((event, i) => {
    const centerX = i * eventW + eventW / 2;
    const dotX = centerX - dotSize / 2;
    const dotY = lineY - dotSize / 2 + 1;
    const delay = staggerDelay(i, 200, 150);

    // 3-layer dot: outer ring → inner bg → core accent
    elements.push({
      kind: "shape",
      id: `${ctx.idPrefix}-dot-ring-${i}`,
      rect: { x: dotX - 2, y: dotY - 2, w: dotSize + 4, h: dotSize + 4 },
      shape: "circle",
      style: { fill: ctx.theme.accent },
      ...(ctx.animate && { animation: makeAnimation("scale-up", delay) }),
    } as LayoutElement);

    elements.push({
      kind: "shape",
      id: `${ctx.idPrefix}-dot-inner-${i}`,
      rect: {
        x: dotX + dotBorderSize - 2,
        y: dotY + dotBorderSize - 2,
        w: dotSize - (dotBorderSize - 2) * 2,
        h: dotSize - (dotBorderSize - 2) * 2,
      },
      shape: "circle",
      style: { fill: ctx.theme.bg },
      ...(ctx.animate && { animation: makeAnimation("scale-up", delay) }),
    } as LayoutElement);

    elements.push({
      kind: "shape",
      id: `${ctx.idPrefix}-dot-core-${i}`,
      rect: { x: dotX + 1, y: dotY + 1, w: dotSize - 2, h: dotSize - 2 },
      shape: "circle",
      style: { fill: ctx.theme.accent },
      ...(ctx.animate && { animation: makeAnimation("scale-up", delay) }),
    } as LayoutElement);

    // Text area below dot
    const textX = i * eventW + 16;
    const textW = eventW - 32;
    const dateY = dotY + dotSize + 16;

    // Date text (accent, bold)
    elements.push({
      kind: "text",
      id: `${ctx.idPrefix}-date-${i}`,
      rect: { x: textX, y: dateY, w: textW, h: 32 },
      text: event.date,
      style: {
        fontFamily: ctx.theme.fontBody,
        fontSize: 26,
        fontWeight: 700,
        color: ctx.theme.accent,
        lineHeight: 1.2,
        textAlign: "center",
      },
      ...(ctx.animate && { animation: makeAnimation("fade-up", delay + 50) }),
    });

    // Label text (bold heading)
    const labelY = dateY + 40;
    elements.push({
      kind: "text",
      id: `${ctx.idPrefix}-label-${i}`,
      rect: { x: textX, y: labelY, w: textW, h: 32 },
      text: event.label,
      style: {
        fontFamily: ctx.theme.fontHeading,
        fontSize: 26,
        fontWeight: 700,
        color: ctx.theme.heading,
        lineHeight: 1.1,
        textAlign: "center",
      },
      ...(ctx.animate && { animation: makeAnimation("fade-up", delay + 100) }),
    });

    let bottomY = labelY + 32;

    // Description text (muted, optional)
    if (event.description) {
      const descY = labelY + 40;
      const descH = Math.min(100, ctx.panel.h - descY);
      elements.push({
        kind: "text",
        id: `${ctx.idPrefix}-desc-${i}`,
        rect: { x: textX, y: descY, w: textW, h: descH },
        text: event.description,
        style: {
          fontFamily: ctx.theme.fontBody,
          fontSize: 24,
          fontWeight: 400,
          color: ctx.theme.textMuted,
          lineHeight: 1.5,
          textAlign: "center",
        },
        ...(ctx.animate && { animation: makeAnimation("fade-up", delay + 150) }),
      });
      bottomY = descY + descH;
    }

    if (bottomY > maxBottomY) maxBottomY = bottomY;
  });

  return { elements, height: maxBottomY };
}

// --- Box (card wrapper) ---

function resolveBoxPadding(p: number | number[] | undefined): { top: number; right: number; bottom: number; left: number } {
  if (p === undefined) return { top: 28, right: 28, bottom: 28, left: 28 };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  if (p.length === 4) return { top: p[0], right: p[1], bottom: p[2], left: p[3] };
  if (p.length === 2) return { top: p[0], right: p[1], bottom: p[0], left: p[1] };
  return { top: p[0], right: p[0], bottom: p[0], left: p[0] };
}

function resolveBox(c: BoxComponent, ctx: ResolveContext): ResolveResult {
  const boxW = c.maxWidth ? Math.min(c.maxWidth, ctx.panel.w) : ctx.panel.w;
  const boxX = c.maxWidth ? (ctx.panel.w - boxW) / 2 : 0;
  const pad = resolveBoxPadding(c.padding);
  const accentH = c.accentTop ? 3 : 0;
  const innerY = pad.top + accentH;
  const innerW = boxW - pad.left - pad.right;

  // Stack children manually in local coords (like resolveCard)
  // Two-pass approach: measure fixed children, then distribute flex space
  const childGap = 8;

  // Pass 1: resolve all children, measure fixed content
  interface BoxChild { result: ResolveResult; gapBefore: number; }
  const resolved: BoxChild[] = [];
  let fixedH = innerY; // start with top padding + accent
  let flexCount = 0;

  c.children.forEach((child, i) => {
    const childCtx: ResolveContext = {
      ...ctx,
      panel: { x: pad.left, y: 0, w: innerW, h: ctx.panel.h },
      idPrefix: `${ctx.idPrefix}-box${i}`,
    };

    const result = resolveComponent(child, childCtx);
    const gapBefore = i > 0 ? childGap : 0;
    resolved.push({ result, gapBefore });
    fixedH += gapBefore + (result.flex ? 0 : result.height);
    if (result.flex) flexCount++;
  });

  fixedH += pad.bottom; // bottom padding
  const useFullHeight = flexCount > 0 || (c.fill && !c.height);
  const boxTotalH = c.height ?? (useFullHeight ? ctx.panel.h : fixedH);
  const flexH = flexCount > 0 ? Math.max(0, (boxTotalH - fixedH) / flexCount) : 0;

  // Pass 2: position children with flex heights applied
  const children: LayoutElement[] = [];
  let cursorY = innerY;

  resolved.forEach(({ result, gapBefore }) => {
    cursorY += gapBefore;
    const h = result.flex ? flexH : result.height;

    // Resize flex elements to computed height
    if (result.flex && flexH > 0) {
      result.elements.forEach((el) => {
        el.rect = { ...el.rect, h: flexH };
      });
    }

    // Position children in group-local coords
    result.elements.forEach((el) => {
      children.push({
        ...el,
        rect: { ...el.rect, x: el.rect.x + pad.left, y: el.rect.y + cursorY },
      });
    });

    cursorY += h;
  });

  cursorY += pad.bottom;
  const totalH = c.height ?? (useFullHeight ? boxTotalH : cursorY);

  // Vertically align children within the box
  const vAlign = c.verticalAlign ?? (c.height ? "center" : "top");
  if (vAlign !== "top" && totalH > cursorY) {
    const dy = vAlign === "center"
      ? (totalH - cursorY) / 2
      : totalH - cursorY; // bottom
    children.forEach((el) => {
      el.rect = { ...el.rect, y: el.rect.y + dy };
    });
  }

  const isFlat = c.variant === "flat";
  const isPanel = c.variant === "panel";
  const bg = c.background
    ? resolveColor(c.background, ctx.theme, ctx.theme.cardBg)
    : ctx.theme.cardBg;

  const style: GroupElement["style"] = isFlat
    ? {}
    : isPanel
      ? { fill: bg, borderRadius: ctx.theme.radius }
      : { fill: bg, borderRadius: ctx.theme.radius, shadow: ctx.theme.shadow };

  // Determine border: explicit borderColor/borderWidth > accentTop > theme cardBorder
  const customBorder = c.borderColor
    ? { width: c.borderWidth ?? 2, color: resolveColor(c.borderColor, ctx.theme, ctx.theme.accent), ...(c.borderSides && { sides: c.borderSides }) }
    : undefined;
  const accentBorder = c.accentTop
    ? { width: 3, color: c.accentColor ? resolveColor(c.accentColor, ctx.theme, ctx.theme.accent) : ctx.theme.accent, sides: ["top"] as ("left" | "right" | "top" | "bottom")[] }
    : undefined;

  const group: GroupElement = {
    kind: "group",
    id: `${ctx.idPrefix}-box`,
    rect: { x: boxX, y: 0, w: boxW, h: totalH },
    children,
    style,
    ...(!isFlat && !isPanel && {
      border: customBorder ?? accentBorder ?? ctx.theme.cardBorder,
    }),
    ...(isPanel && (customBorder || accentBorder) && {
      border: customBorder ?? accentBorder,
    }),
    clipContent: !isFlat,
  };

  // Override default stacker/columns animation if component specifies one
  if (c.animationType && ctx.animate) {
    const boxDelay = (c as unknown as SlideComponent).animationDelay ?? ctx.animationDelay ?? 0;
    group.animation = makeAnimation(c.animationType, boxDelay);
  }

  return {
    elements: [group],
    height: totalH,
    ...(c.fill && { flex: true }),
    gapBefore: c.marginTop,
    gapAfter: c.marginBottom,
  };
}

// --- Main dispatch ---

export function resolveComponent(
  component: SlideComponent,
  ctx: ResolveContext,
): ResolveResult {
  let result: ResolveResult;

  switch (component.type) {
    case "text":
      result = resolveText(component, ctx); break;
    case "heading":
      result = resolveHeading(component, ctx); break;
    case "body":
      result = resolveBody(component, ctx); break;
    case "bullets":
      result = resolveBullets(component, ctx); break;
    case "stat":
      result = resolveStat(component, ctx); break;
    case "tag":
      result = resolveTag(component, ctx); break;
    case "divider":
      result = resolveDivider(component, ctx); break;
    case "quote":
      result = resolveQuote(component, ctx); break;
    case "card":
      result = resolveCard(component, ctx); break;
    case "image":
      result = resolveImage(component, ctx); break;
    case "code":
      result = resolveCode(component, ctx); break;
    case "spacer":
      result = resolveSpacer(component); break;
    case "raw":
      result = resolveRaw(component, ctx); break;
    case "columns":
      result = resolveColumns(component, ctx); break;
    case "grid":
      result = resolveGrid(component, ctx); break;
    case "table":
      result = resolveTable(component, ctx); break;
    case "steps":
      result = resolveSteps(component, ctx); break;
    case "timeline":
      result = resolveTimeline(component, ctx); break;
    case "box":
      result = resolveBox(component, ctx); break;
  }

  // Generic animationType override — skip box (handles it internally) and columns (container)
  if (
    component.type !== "box" &&
    component.type !== "columns" &&
    component.type !== "grid" &&
    component.type !== "steps" &&
    component.type !== "timeline" &&
    component.animationType &&
    ctx.animate
  ) {
    const delay = component.animationDelay ?? ctx.animationDelay ?? 0;
    const anim = makeAnimation(component.animationType, delay);
    result.elements.forEach((el) => {
      (el as { animation: unknown }).animation = anim;
    });
  }

  // Generic opacity — apply to all emitted elements
  if (component.opacity !== undefined && component.opacity < 1) {
    const op = component.opacity;
    result.elements.forEach((el) => {
      if (el.kind === "group" || el.kind === "shape") {
        el.style = { ...(el.style ?? {}), opacity: op };
      } else if (el.kind === "image") {
        (el as { opacity?: number }).opacity = op;
      }
      // text/code/list: no direct opacity field — wrap below if needed
    });

    // Wrap non-group/shape/image elements in an opacity group
    const needsWrap = result.elements.some(
      (el) => el.kind !== "group" && el.kind !== "shape" && el.kind !== "image",
    );
    if (needsWrap) {
      const wrapped: GroupElement = {
        kind: "group",
        id: `${ctx.idPrefix}-opacity`,
        rect: { x: 0, y: 0, w: ctx.panel.w, h: result.height },
        children: result.elements,
        style: { opacity: op },
      };
      // Preserve animation from the first element (if any)
      const firstAnim = result.elements.find((el) => el.animation)?.animation;
      if (firstAnim) wrapped.animation = firstAnim;
      result = { ...result, elements: [wrapped] };
    }
  }

  return result;
}
