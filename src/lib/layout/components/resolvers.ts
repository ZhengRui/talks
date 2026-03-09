import type {
  LayoutElement,
  ListElement,
  ResolvedTheme,
  Rect,
  TextElement,
  ShapeElement,
  GroupElement,
  FlexLayout,
  TransformDef,
} from "../types";
import { resolveLayouts } from "../auto-layout";
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
  VideoComponent,
  IframeComponent,
  CodeComponent,
  SpacerComponent,
  RawComponent,
  ColumnsComponent,
  BoxComponent,
  GridComponent,
} from "./types";
import { estimateTextHeight, bodyStyle, makeEntrance, staggerDelay } from "../helpers";
import { toPlainText } from "../richtext";
import { resolveColor, resolveThemeTokenAny } from "./theme-tokens";

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

const FONT_FAMILY_MAP: Record<string, (t: ResolvedTheme) => string> = {
  heading: (t: ResolvedTheme) => t.fontHeading,
  body: (t: ResolvedTheme) => t.fontBody,
  mono: (t: ResolvedTheme) => t.fontMono,
};

/** Resolve a fontFamily value: theme token ("heading"|"body"|"mono") or raw CSS font-family. */
function resolveFontFamily(value: string | undefined, fallback: string, theme: ResolvedTheme): string {
  if (!value) return fallback;
  const mapper = FONT_FAMILY_MAP[value];
  return mapper ? mapper(theme) : value;
}

function resolveText(c: TextComponent, ctx: ResolveContext): ResolveResult {
  const fontSize = c.fontSize ?? 28;
  const fontWeight = c.fontWeight === "bold" ? 700 : 400;
  const lineHeight = c.lineHeight ?? 1.6;
  const fontFamily = resolveFontFamily(c.fontFamily, ctx.theme.fontBody, ctx.theme);
  const color = c.color
    ? resolveColor(c.color, ctx.theme, ctx.theme.text)
    : (ctx.textColor ?? ctx.theme.text);
  const textW = c.maxWidth ? Math.min(c.maxWidth, ctx.panel.w) : ctx.panel.w;
  const textX = c.maxWidth ? (ctx.panel.w - textW) / 2 : 0;
  const h = estimateTextHeight(toPlainText(c.text), fontSize, lineHeight, textW, fontWeight);

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
  const fontWeight = c.fontWeight ?? 700;
  const fontFamily = resolveFontFamily(c.fontFamily, ctx.theme.fontHeading, ctx.theme);
  const color = c.color
    ? resolveColor(c.color, ctx.theme, ctx.theme.heading)
    : (ctx.textColor ?? ctx.theme.heading);
  const lineHeight = 1.15;
  const w = ctx.panel.w;
  const h = estimateTextHeight(toPlainText(c.text), fontSize, lineHeight, w, fontWeight);

  const el: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-heading`,
    rect: { x: 0, y: 0, w, h },
    text: c.text,
    style: {
      fontFamily,
      fontSize,
      fontWeight,
      color,
      lineHeight,
      textAlign: c.textAlign ?? "left",
      ...(c.letterSpacing != null ? { letterSpacing: c.letterSpacing } : {}),
      ...(c.textTransform ? { textTransform: c.textTransform } : {}),
    },
  };

  return { elements: [el], height: h };
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
    bulletColor: c.bulletColor ? resolveColor(c.bulletColor, ctx.theme, ctx.textColor ?? ctx.theme.text) : (ctx.textColor ?? ctx.theme.text),
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
    const textH = estimateTextHeight(toPlainText(item), fontSize, lineHeight, textW);
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
          style: { fill: ctx.theme.accent },
          borderRadius: 100,
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
      style: { fill: ctx.theme.bgSecondary },
      borderRadius: ctx.theme.radiusSm,
      border: ordered ? undefined : { width: 3, color: c.bulletColor ? resolveColor(c.bulletColor, ctx.theme, ctx.theme.accent) : ctx.theme.accent, sides: ["left"] },
    };

    if (ctx.animate) {
      group.entrance = makeEntrance(
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
        style: { fill: ctx.theme.accent },
        borderRadius: 100,
      };

      if (ctx.animate) {
        badge.entrance = makeEntrance(
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
      textEl.entrance = makeEntrance(
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
  const valueFontFamily = resolveFontFamily(c.fontFamily, ctx.theme.fontHeading, ctx.theme);

  const valueEl: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-stat-value`,
    rect: { x: 0, y: 0, w, h: valueH },
    text: c.value,
    style: {
      fontFamily: valueFontFamily,
      fontSize: valueSize,
      fontWeight: 700,
      color: c.color ?? ctx.theme.accent,
      lineHeight: 1.15,
      textAlign: align,
    },
  };

  const labelColor = c.labelColor
    ? resolveColor(c.labelColor, ctx.theme, ctx.theme.textMuted)
    : (ctx.textColor ?? ctx.theme.textMuted);

  const labelEl: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-stat-label`,
    rect: { x: 0, y: valueH + gap, w, h: labelH },
    text: c.label,
    style: {
      fontFamily: ctx.theme.fontBody,
      fontSize: labelSize,
      fontWeight: c.labelFontWeight ?? 400,
      color: labelColor,
      lineHeight: 1.5,
      textAlign: align,
      ...(c.letterSpacing != null ? { letterSpacing: c.letterSpacing } : {}),
      ...(c.textTransform ? { textTransform: c.textTransform } : {}),
    },
  };

  return { elements: [valueEl, labelEl], height: totalH };
}

// --- Tag ---

function resolveTag(c: TagComponent, ctx: ResolveContext): ResolveResult {
  const fontSize = 20;
  const paddingX = 20;
  const paddingY = 12;
  const textW = toPlainText(c.text).length * fontSize * 0.7 + paddingX * 2;
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
    style: { fill: pillFill },
    borderRadius: 100,
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
      ? { gradient: ctx.theme.accentGradient }
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
          }
        : isBorder
          ? { fill: ctx.theme.border.color }
          : { fill: ctx.theme.accent };

  const needsRadius = variant !== "border";
  const isSolid = variant === "solid";

  const el: ShapeElement = {
    kind: "shape",
    id: `${ctx.idPrefix}-divider`,
    rect: { x, y: 0, w, h },
    shape: "rect",
    style,
    ...(needsRadius ? { borderRadius: 2 } : {}),
    ...(isSolid ? { opacity: 0.4 } : {}),
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
      markEl.entrance = makeEntrance("fade-in", baseDelay);
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
      style: { fill: ctx.theme.accent },
      borderRadius: 2,
    };
    elements.push(bar);
  }

  const quoteH = estimateTextHeight(toPlainText(c.text), quoteFontSize, lineHeight, textW);

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
    quoteEl.entrance = makeEntrance(
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
      attrEl.entrance = makeEntrance("fade-up", baseDelay + (c.decorative ? 400 : 200));
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
  const bodyH = estimateTextHeight(toPlainText(c.body), bodySize, 1.6, bodyW);
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
    style: { fill: bg },
    borderRadius: ctx.theme.radius,
    shadow: ctx.theme.shadow,
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

// --- Video ---

function resolveVideo(c: VideoComponent, ctx: ResolveContext): ResolveResult {
  const flex = c.height === undefined;
  const h = c.height ?? 0;
  const src = c.src.startsWith("/") || c.src.startsWith("http") || c.src.startsWith("data:")
    ? c.src
    : `${ctx.imageBase}/${c.src}`;

  const el: LayoutElement = {
    kind: "video",
    id: `${ctx.idPrefix}-video`,
    rect: { x: 0, y: 0, w: ctx.panel.w, h },
    src,
    ...(c.poster ? { poster: c.poster } : {}),
    borderRadius: c.borderRadius ?? ctx.theme.radius,
    border: ctx.theme.cardBorder,
    shadow: ctx.theme.shadow,
  };

  return { elements: [el], height: h, ...(flex && { flex: true }) };
}

// --- Iframe ---

function resolveIframe(c: IframeComponent, ctx: ResolveContext): ResolveResult {
  const flex = c.height === undefined;
  const h = c.height ?? 0;

  const el: LayoutElement = {
    kind: "iframe",
    id: `${ctx.idPrefix}-iframe`,
    rect: { x: 0, y: 0, w: ctx.panel.w, h },
    src: c.src,
    borderRadius: c.borderRadius ?? ctx.theme.radius,
    border: ctx.theme.cardBorder,
    shadow: ctx.theme.shadow,
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
  // Default to flex when no explicit height — a zero-height non-flex spacer is useless
  if (c.flex ?? (c.height == null)) {
    return { elements: [], height: 0, flex: true };
  }
  return { elements: [], height: c.height ?? 0 };
}

// --- Raw (escape hatch) ---

/** Skip set: fields that contain user content, not theme tokens. */
const RAW_TOKEN_SKIP = new Set(["text", "id", "code", "src", "language", "shape", "kind"]);

/** Recursively resolve theme.* tokens in all string fields of raw elements. */
export function resolveRawTokens(elements: LayoutElement[], theme: ResolvedTheme): LayoutElement[] {
  function walk(obj: unknown, key?: string): unknown {
    // Skip content fields
    if (key && RAW_TOKEN_SKIP.has(key)) return obj;
    // Resolve theme token strings (supports object-type values like border, shadow)
    if (typeof obj === "string" && obj.startsWith("theme.")) {
      const resolved = resolveThemeTokenAny(obj, theme);
      return resolved !== undefined ? resolved : obj;
    }
    if (typeof obj === "string") return obj;
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
        if (!el.entrance) {
          (el as { entrance: unknown }).entrance = makeEntrance(
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

      // Apply per-item staggered entrance
      if (ctx.animate) {
        positioned.forEach((el) => {
          if (!el.entrance) {
            (el as { entrance: unknown }).entrance = makeEntrance(
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

// --- Box (card wrapper) ---

/** Build the GroupElement wrapper shared by both stacked and layout-mode boxes. */
function buildBoxGroup(
  c: BoxComponent,
  ctx: ResolveContext,
  boxX: number,
  boxW: number,
  totalH: number,
  children: LayoutElement[],
): GroupElement {
  const isFlat = c.variant === "flat";
  const isPanel = c.variant === "panel";
  const bg = c.background
    ? resolveColor(c.background, ctx.theme, ctx.theme.cardBg)
    : ctx.theme.cardBg;

  const radius = c.borderRadius ?? ctx.theme.radius;
  const style: GroupElement["style"] = isFlat
    ? (c.background ? { fill: bg } : {})
    : { fill: bg };

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
    ...(!isFlat || c.borderRadius != null ? { borderRadius: c.borderRadius ?? radius } : {}),
    ...(!isFlat && !isPanel ? { shadow: ctx.theme.shadow } : {}),
    ...(!isFlat && !isPanel && {
      border: customBorder ?? accentBorder ?? ctx.theme.cardBorder,
    }),
    ...(isPanel && (customBorder || accentBorder) && {
      border: customBorder ?? accentBorder,
    }),
    clipContent: !isFlat,
  };

  // Override default stacker/columns animation if component specifies one
  if (c.entranceType && ctx.animate) {
    const boxDelay = (c as unknown as SlideComponent).entranceDelay ?? ctx.animationDelay ?? 0;
    group.entrance = makeEntrance(c.entranceType, boxDelay);
  }

  return group;
}

function resolveBoxPadding(p: number | number[] | undefined): { top: number; right: number; bottom: number; left: number } {
  if (p === undefined) return { top: 28, right: 28, bottom: 28, left: 28 };
  if (typeof p === "number") return { top: p, right: p, bottom: p, left: p };
  if (p.length === 4) return { top: p[0], right: p[1], bottom: p[2], left: p[3] };
  if (p.length === 2) return { top: p[0], right: p[1], bottom: p[0], left: p[1] };
  return { top: p[0], right: p[0], bottom: p[0], left: p[0] };
}

/** Parse CSS-style margin: number | [vert, horiz] | [top, right, bottom, left]. */
function resolveMargin(m: number | number[] | undefined): { top: number; right: number; bottom: number; left: number } {
  if (m === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof m === "number") return { top: m, right: m, bottom: m, left: m };
  if (m.length === 4) return { top: m[0], right: m[1], bottom: m[2], left: m[3] };
  if (m.length === 2) return { top: m[0], right: m[1], bottom: m[0], left: m[1] };
  return { top: m[0], right: m[0], bottom: m[0], left: m[0] };
}

/** Apply staggered entrance animations to box children.
 *  Elements belonging to each child component get the same delay.
 *  Spacers are skipped in the stagger count. */
function applyAutoEntrance(
  elements: LayoutElement[],
  childElementCounts: number[],
  childIsSpacer: boolean[],
  autoEntrance: NonNullable<BoxComponent["autoEntrance"]>,
): void {
  const { type, stagger = 100, baseDelay = 0 } = autoEntrance;
  let elementIdx = 0;
  let staggerIdx = 0;

  for (let childIdx = 0; childIdx < childElementCounts.length; childIdx++) {
    const count = childElementCounts[childIdx];
    const isSpacer = childIsSpacer[childIdx];
    const delay = baseDelay + staggerIdx * stagger;

    for (let j = 0; j < count; j++) {
      const el = elements[elementIdx + j];
      if (!el.entrance) {
        (el as { entrance: unknown }).entrance = makeEntrance(type, delay);
      }
    }

    elementIdx += count;
    if (!isSpacer) staggerIdx++;
  }
}

/** Layout-based child positioning for flex-row, flex-column, and grid modes. */
function resolveBoxWithLayout(
  c: BoxComponent,
  ctx: ResolveContext,
  boxW: number,
  boxX: number,
  pad: { top: number; right: number; bottom: number; left: number },
  accentH: number,
  innerW: number,
): ResolveResult {
  const layout = c.layout!;
  const gap = layout.gap ?? 16;
  const innerY = pad.top + accentH;
  const innerH = (c.height ?? ctx.panel.h) - pad.top - pad.bottom - accentH;

  const allChildren: LayoutElement[] = [];
  // Track per-component element counts for autoEntrance staggering
  const childElementCounts: number[] = [];
  const childIsSpacer: boolean[] = [];
  let contentH = 0;

  if (layout.type === "flex" && layout.direction === "row") {
    // --- Flex-row: delegate to auto-layout engine for justify support ---
    const children = c.children ?? [];

    // 1. Parse per-child margins and compute assigned widths
    const childMarginsRow = children.map((child) => resolveMargin((child as SlideComponent).margin));
    const childExplicitWidths = children.map(child => child.width);
    const totalMarginW = childMarginsRow.reduce((s, m) => s + m.left + m.right, 0);
    const explicitTotalW = childExplicitWidths
      .filter((w): w is number => w != null)
      .reduce((s, w) => s + w, 0);
    const autoCount = childExplicitWidths.filter(w => w == null).length;
    const totalGap = (children.length - 1) * gap;
    const autoW = autoCount > 0
      ? (innerW - explicitTotalW - totalMarginW - totalGap) / autoCount
      : 0;
    const assignedWidths = children.map((_, i) =>
      childExplicitWidths[i] ?? autoW,
    );

    // 2. Resolve each child with its assigned width
    let aeStaggerIdxRow = 0;
    const resolved = children.map((child, i) => {
      const isSpacer = child.type === "spacer";
      const aeDelay = c.autoEntrance
        ? (c.autoEntrance.baseDelay ?? 0) + aeStaggerIdxRow * (c.autoEntrance.stagger ?? 100)
        : undefined;
      const childCtx: ResolveContext = {
        ...ctx,
        panel: { x: 0, y: 0, w: assignedWidths[i], h: innerH },
        idPrefix: `${ctx.idPrefix}-box${i}`,
        ...(c.autoEntrance ? { animate: true, animationDelay: aeDelay } : {}),
      };
      if (!isSpacer) aeStaggerIdxRow++;
      return resolveComponent(child, childCtx);
    });

    // 3. Build placeholder elements — bake horizontal margin into placeholder width,
    //    vertical margin into placeholder height
    const placeholders: LayoutElement[] = resolved.map((r, i) => {
      const m = childMarginsRow[i];
      return {
        kind: "shape" as const,
        id: `ph-${i}`,
        rect: { x: 0, y: 0, w: assignedWidths[i] + m.left + m.right, h: r.height + m.top + m.bottom },
        shape: "rect" as const,
        style: {},
      };
    });

    const flexLayout: FlexLayout = {
      type: "flex",
      direction: "row",
      gap,
      align: layout.align,
      justify: layout.justify,
      wrap: layout.wrap,
    };

    const virtualGroup: GroupElement = {
      kind: "group",
      id: "box-flex",
      rect: { x: 0, y: 0, w: innerW, h: innerH },
      layout: flexLayout,
      children: placeholders,
    };

    const [resolvedGroup] = resolveLayouts([virtualGroup]);
    const positioned = (resolvedGroup as GroupElement).children;

    // 4. Map auto-layout positions to actual resolved elements, offsetting by margin
    let maxChildH = 0;
    resolved.forEach((r) => { maxChildH = Math.max(maxChildH, r.height); });

    resolved.forEach((result, i) => {
      const pos = positioned[i].rect;
      const m = childMarginsRow[i];
      result.elements.forEach((el) => {
        allChildren.push({
          ...el,
          rect: {
            x: el.rect.x + pos.x + pad.left + m.left,
            y: el.rect.y + pos.y + innerY + m.top,
            w: el.rect.w,
            h: el.rect.h,
          },
        });
      });
      childElementCounts.push(result.elements.length);
      childIsSpacer.push((c.children ?? [])[i]?.type === "spacer");
    });

    contentH = maxChildH;
  } else if (layout.type === "flex" && (!layout.direction || layout.direction === "column")) {
    // --- Flex-column: delegate to auto-layout engine ---
    const children = c.children ?? [];

    // 1. Resolve each child at full innerW
    // When autoEntrance is set, pass animate + animationDelay so component
    // resolvers (e.g. bullets) can apply their own internal staggering.
    let aeStaggerIdx = 0;
    const resolved = children.map((child, i) => {
      const isSpacer = child.type === "spacer";
      const aeDelay = c.autoEntrance
        ? (c.autoEntrance.baseDelay ?? 0) + aeStaggerIdx * (c.autoEntrance.stagger ?? 100)
        : undefined;
      const childCtx: ResolveContext = {
        ...ctx,
        panel: { x: 0, y: 0, w: innerW, h: innerH },
        idPrefix: `${ctx.idPrefix}-box${i}`,
        ...(c.autoEntrance ? { animate: true, animationDelay: aeDelay } : {}),
      };
      if (!isSpacer) aeStaggerIdx++;
      return resolveComponent(child, childCtx);
    });

    // 2. Parse per-child margins and build placeholders
    //    Vertical margin is baked into placeholder height so the auto-layout engine
    //    handles spacing. Horizontal margin offsets elements in the map-back step.
    const childMargins = children.map((child) => resolveMargin((child as SlideComponent).margin));
    const placeholders: LayoutElement[] = resolved.map((r, i) => {
      const m = childMargins[i];
      const h = r.flex ? 0 : r.height + m.top + m.bottom;
      return {
        kind: "shape" as const,
        id: `ph-${i}`,
        rect: { x: 0, y: 0, w: innerW, h },
        shape: "rect" as const,
        style: {},
      };
    });

    // 3. Build virtual group and delegate to auto-layout
    const flexLayout: FlexLayout = {
      type: "flex",
      direction: "column",
      gap,
      align: layout.align,
      justify: layout.justify,
    };

    const virtualGroup: GroupElement = {
      kind: "group",
      id: "box-flex-col",
      rect: { x: 0, y: 0, w: innerW, h: innerH },
      layout: flexLayout,
      children: placeholders,
    };

    const [resolvedGroup] = resolveLayouts([virtualGroup]);
    const positioned = (resolvedGroup as GroupElement).children;

    // 4. Re-resolve flex children with their actual distributed height.
    //    Like CSS flexbox: flex-grow items get remaining space, then their
    //    children are laid out WITHIN that final height — not the full container.
    resolved.forEach((result, i) => {
      if (result.flex && positioned[i].rect.h > 0) {
        const m = childMargins[i];
        const flexH = positioned[i].rect.h - m.top - m.bottom;
        const isSpacer = children[i].type === "spacer";
        const aeDelay = c.autoEntrance
          ? (c.autoEntrance.baseDelay ?? 0) +
            (isSpacer ? 0 : children.slice(0, i).filter((ch) => ch.type !== "spacer").length) *
              (c.autoEntrance.stagger ?? 100)
          : undefined;
        const childCtx: ResolveContext = {
          ...ctx,
          panel: { x: 0, y: 0, w: innerW, h: flexH },
          idPrefix: `${ctx.idPrefix}-box${i}`,
          ...(c.autoEntrance ? { animate: true, animationDelay: aeDelay } : {}),
        };
        resolved[i] = resolveComponent(children[i], childCtx);
      }
    });

    // 5. Map positions back to actual resolved elements
    //    Offset by child margin (top pushes content down within placeholder,
    //    left/right inset horizontally).
    let maxBottom = 0;
    resolved.forEach((result, i) => {
      const pos = positioned[i].rect;
      const m = childMargins[i];
      const childH = result.flex ? pos.h : result.height;

      // Update flex elements to their computed height (subtract margin from placeholder height)
      if (result.flex && pos.h > 0) {
        const flexChildH = pos.h - m.top - m.bottom;
        result.elements.forEach((el) => {
          el.rect = { ...el.rect, h: flexChildH };
        });
      }

      result.elements.forEach((el) => {
        allChildren.push({
          ...el,
          rect: {
            x: el.rect.x + pos.x + pad.left + m.left,
            y: el.rect.y + pos.y + innerY + m.top,
            w: el.rect.w,
            h: el.rect.h,
          },
        });
      });
      childElementCounts.push(result.elements.length);
      childIsSpacer.push(children[i]?.type === "spacer");

      maxBottom = Math.max(maxBottom, pos.y + m.top + childH + m.bottom);
    });

    contentH = maxBottom;
  } else {
    // --- Grid: column-based layout ---
    const gridChildren = c.children ?? [];
    const childMarginsGrid = gridChildren.map((child) => resolveMargin((child as SlideComponent).margin));
    let aeStaggerIdxGrid = 0;
    const resolved = gridChildren.map((child, i) => {
      const isSpacer = child.type === "spacer";
      const aeDelay = c.autoEntrance
        ? (c.autoEntrance.baseDelay ?? 0) + aeStaggerIdxGrid * (c.autoEntrance.stagger ?? 100)
        : undefined;
      const childCtx: ResolveContext = {
        ...ctx,
        panel: { x: 0, y: 0, w: innerW, h: innerH },
        idPrefix: `${ctx.idPrefix}-box${i}`,
        ...(c.autoEntrance ? { animate: true, animationDelay: aeDelay } : {}),
      };
      if (!isSpacer) aeStaggerIdxGrid++;
      return resolveComponent(child, childCtx);
    });

    const cols = layout.columns ?? 2;
    const colGap = layout.columnGap ?? gap;
    const rGap = layout.rowGap ?? gap;
    const colW = (innerW - (cols - 1) * colGap) / cols;
    const count = resolved.length;
    let totalH = 0;

    for (let start = 0; start < count; start += cols) {
      const rowResults = resolved.slice(start, start + cols);
      let rowMaxH = 0;

      rowResults.forEach((r, colIdx) => {
        const m = childMarginsGrid[start + colIdx];
        rowMaxH = Math.max(rowMaxH, r.height + m.top + m.bottom);
      });

      rowResults.forEach((result, colIdx) => {
        const m = childMarginsGrid[start + colIdx];
        const colX = pad.left + colIdx * (colW + colGap);
        const childY = innerY + totalH;

        result.elements.forEach((el) => {
          const scaleX = colW / (ctx.panel.w > 0 ? ctx.panel.w : colW);
          allChildren.push({
            ...el,
            rect: {
              x: el.rect.x * scaleX + colX + m.left,
              y: el.rect.y + childY + m.top,
              w: el.kind === "group" ? colW : el.rect.w * scaleX,
              h: el.rect.h,
            },
          });
        });
        childElementCounts.push(result.elements.length);
        childIsSpacer.push(gridChildren[start + colIdx]?.type === "spacer");
      });

      totalH += rowMaxH + (start + cols < count ? rGap : 0);
    }

    contentH = totalH;
  }

  const totalH = c.height ?? (contentH + pad.top + pad.bottom + accentH);

  // Vertical alignment within box
  const cursorH = contentH + pad.top + pad.bottom + accentH;
  const vAlign = c.verticalAlign ?? (c.height ? "center" : "top");
  if (vAlign !== "top" && totalH > cursorH) {
    const dy = vAlign === "center"
      ? (totalH - cursorH) / 2
      : totalH - cursorH; // bottom
    allChildren.forEach((el) => {
      el.rect = { ...el.rect, y: el.rect.y + dy };
    });
  }

  // Apply autoEntrance staggering
  if (c.autoEntrance) {
    applyAutoEntrance(allChildren, childElementCounts, childIsSpacer, c.autoEntrance);
  }

  const group = buildBoxGroup(c, ctx, boxX, boxW, totalH, allChildren);

  return {
    elements: [group],
    height: totalH,
    ...(c.fill && { flex: true }),
    gapBefore: c.marginTop,
    gapAfter: c.marginBottom,
  };
}

function resolveBox(c: BoxComponent, ctx: ResolveContext): ResolveResult {
  const boxW = c.maxWidth ? Math.min(c.maxWidth, ctx.panel.w) : ctx.panel.w;
  const boxX = c.maxWidth ? (ctx.panel.w - boxW) / 2 : 0;
  const pad = resolveBoxPadding(c.padding);
  const accentH = c.accentTop ? 3 : 0;
  const innerY = pad.top + accentH;
  const innerW = boxW - pad.left - pad.right;

  // Dispatch to layout-based positioning for flex-row, flex-column, and grid modes
  if (c.layout) {
    return resolveBoxWithLayout(c, ctx, boxW, boxX, pad, accentH, innerW);
  }

  // Stack children manually in local coords (like resolveCard)
  // Two-pass approach: measure fixed children, then distribute flex space
  const childGap = 8;
  const noLayoutChildren = c.children ?? [];
  const childMarginsNoLayout = noLayoutChildren.map((child) => resolveMargin((child as SlideComponent).margin));

  // Pass 1: resolve all children, measure fixed content
  interface BoxChild { result: ResolveResult; gapBefore: number; }
  const resolved: BoxChild[] = [];
  let fixedH = innerY; // start with top padding + accent
  let flexCount = 0;

  let aeStaggerIdxStack = 0;
  noLayoutChildren.forEach((child, i) => {
    const isSpacer = child.type === "spacer";
    const aeDelay = c.autoEntrance
      ? (c.autoEntrance.baseDelay ?? 0) + aeStaggerIdxStack * (c.autoEntrance.stagger ?? 100)
      : undefined;
    const childCtx: ResolveContext = {
      ...ctx,
      panel: { x: pad.left, y: 0, w: innerW, h: ctx.panel.h },
      idPrefix: `${ctx.idPrefix}-box${i}`,
      ...(c.autoEntrance ? { animate: true, animationDelay: aeDelay } : {}),
    };
    if (!isSpacer) aeStaggerIdxStack++;

    const m = childMarginsNoLayout[i];
    const result = resolveComponent(child, childCtx);
    const gapBefore = i > 0 ? childGap : 0;
    resolved.push({ result, gapBefore });
    fixedH += gapBefore + m.top + (result.flex ? 0 : result.height) + m.bottom;
    if (result.flex) flexCount++;
  });

  fixedH += pad.bottom; // bottom padding
  const useFullHeight = flexCount > 0 || (c.fill && !c.height);
  const boxTotalH = c.height ?? (useFullHeight ? ctx.panel.h : fixedH);
  const flexH = flexCount > 0 ? Math.max(0, (boxTotalH - fixedH) / flexCount) : 0;

  // Pass 2: position children with flex heights applied
  const boxChildren: LayoutElement[] = [];
  const boxChildElementCounts: number[] = [];
  const boxChildIsSpacer: boolean[] = [];
  let cursorY = innerY;

  resolved.forEach(({ result, gapBefore }, idx) => {
    const m = childMarginsNoLayout[idx];
    cursorY += gapBefore + m.top;
    const h = result.flex ? flexH : result.height;

    // Resize flex elements to computed height
    if (result.flex && flexH > 0) {
      result.elements.forEach((el) => {
        el.rect = { ...el.rect, h: flexH };
      });
    }

    // Position children in group-local coords
    result.elements.forEach((el) => {
      boxChildren.push({
        ...el,
        rect: { ...el.rect, x: el.rect.x + pad.left + m.left, y: el.rect.y + cursorY },
      });
    });
    boxChildElementCounts.push(result.elements.length);
    boxChildIsSpacer.push(noLayoutChildren[idx]?.type === "spacer");

    cursorY += h + m.bottom;
  });

  cursorY += pad.bottom;
  const totalH = c.height ?? (useFullHeight ? boxTotalH : cursorY);

  // Vertically align children within the box
  const vAlign = c.verticalAlign ?? (c.height ? "center" : "top");
  if (vAlign !== "top" && totalH > cursorY) {
    const dy = vAlign === "center"
      ? (totalH - cursorY) / 2
      : totalH - cursorY; // bottom
    boxChildren.forEach((el) => {
      el.rect = { ...el.rect, y: el.rect.y + dy };
    });
  }

  // Apply autoEntrance staggering
  if (c.autoEntrance) {
    applyAutoEntrance(boxChildren, boxChildElementCounts, boxChildIsSpacer, c.autoEntrance);
  }

  const group = buildBoxGroup(c, ctx, boxX, boxW, totalH, boxChildren);

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
    case "video":
      result = resolveVideo(component, ctx); break;
    case "iframe":
      result = resolveIframe(component, ctx); break;
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
    case "box":
      result = resolveBox(component, ctx); break;
  }

  // v8 style passthrough — apply to root element
  if (result.elements.length > 0) {
    const root = result.elements[0];
    if (component.transform)
      (root as { transform?: TransformDef }).transform = component.transform;
    if (component.clipPath)
      (root as { clipPath?: string }).clipPath = component.clipPath;
    if (component.cssStyle)
      (root as { cssStyle?: Record<string, string> }).cssStyle = component.cssStyle;

    if (component.borderRadius != null) {
      root.borderRadius = component.borderRadius;
    }

    if (component.effects) {
      root.effects = { ...root.effects, ...component.effects };
    }
  }

  // Generic entranceType override — skip box (handles it internally) and columns (container)
  if (
    component.type !== "box" &&
    component.type !== "columns" &&
    component.type !== "grid" &&
    component.entranceType &&
    ctx.animate
  ) {
    const delay = component.entranceDelay ?? ctx.animationDelay ?? 0;
    const anim = makeEntrance(component.entranceType, delay);
    result.elements.forEach((el) => {
      (el as { entrance: unknown }).entrance = anim;
    });
  }

  // Generic opacity — apply to all emitted elements (all elements support opacity via ElementBase)
  if (component.opacity !== undefined && component.opacity < 1) {
    result.elements.forEach((el) => {
      el.opacity = component.opacity;
    });
  }

  return result;
}
