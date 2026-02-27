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
} from "./types";
import { estimateTextHeight, headingStyle, bodyStyle, makeAnimation, staggerDelay } from "../helpers";
import { resolveColor } from "./theme-tokens";

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
  const h = estimateTextHeight(c.text, fontSize, lineHeight, textW);

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
  const lineHeight = 1.5;
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
  const paddingY = 8;
  const textW = c.text.length * fontSize * 0.7 + paddingX * 2;
  const h = fontSize + paddingY * 2;
  const color = resolveColor(c.color, ctx.theme, ctx.theme.accent);

  const pill: ShapeElement = {
    kind: "shape",
    id: `${ctx.idPrefix}-tag-bg`,
    rect: { x: 0, y: 0, w: textW, h },
    shape: "pill",
    style: {
      fill: color + "22", // very transparent version of the color
      borderRadius: 100,
    },
    border: { width: 1, color },
  };

  const text: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-tag-text`,
    rect: { x: 0, y: 0, w: textW, h },
    text: c.text,
    style: {
      fontFamily: ctx.theme.fontBody,
      fontSize,
      fontWeight: 600,
      color,
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
  const h = c.height ?? 400;
  const src = c.src.startsWith("/") || c.src.startsWith("http") || c.src.startsWith("data:")
    ? c.src
    : `${ctx.imageBase}/${c.src}`;

  // clipCircle requires a square — use height as both dimensions, center horizontally
  const w = c.clipCircle ? h : ctx.panel.w;
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

  return { elements: [el], height: h };
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

function resolveSpacer(c: SpacerComponent, _ctx: ResolveContext): ResolveResult {
  if (c.flex) {
    return { elements: [], height: 0, flex: true };
  }
  return { elements: [], height: c.height ?? 0 };
}

// --- Raw (escape hatch) ---

function resolveRaw(c: RawComponent, _ctx: ResolveContext): ResolveResult {
  return { elements: c.elements, height: c.height };
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

// --- Box (card wrapper) ---

function resolveBox(c: BoxComponent, ctx: ResolveContext): ResolveResult {
  const padding = c.padding ?? 28;
  const accentH = c.accentTop ? 3 : 0;
  const innerY = padding + accentH;
  const innerW = ctx.panel.w - padding * 2;

  // Stack children manually in local coords (like resolveCard)
  const children: LayoutElement[] = [];
  let cursorY = innerY;
  const childGap = 8;

  c.children.forEach((child, i) => {
    const childCtx: ResolveContext = {
      ...ctx,
      panel: { x: padding, y: cursorY, w: innerW, h: ctx.panel.h - cursorY - padding },
      idPrefix: `${ctx.idPrefix}-box${i}`,
    };

    const result = resolveComponent(child, childCtx);

    // Position children in group-local coords
    result.elements.forEach((el) => {
      children.push({
        ...el,
        rect: { ...el.rect, x: el.rect.x + padding, y: el.rect.y + cursorY },
      });
    });

    cursorY += result.height + (i < c.children.length - 1 ? childGap : 0);
  });

  const contentH = cursorY + padding;
  const totalH = c.fill ? ctx.panel.h : (c.height ?? contentH);

  // Vertically center children when fixed height is larger than content
  // (skip when fill is used — content stays top-aligned)
  if (!c.fill && c.height && c.height > contentH) {
    const dy = (c.height - contentH) / 2;
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

  const group: GroupElement = {
    kind: "group",
    id: `${ctx.idPrefix}-box`,
    rect: { x: 0, y: 0, w: ctx.panel.w, h: totalH },
    children,
    style,
    ...(!isFlat && !isPanel && {
      border: c.accentTop
        ? { width: 3, color: c.accentColor ? resolveColor(c.accentColor, ctx.theme, ctx.theme.accent) : ctx.theme.accent, sides: ["top"] }
        : ctx.theme.cardBorder,
    }),
    ...(isPanel && c.accentTop && {
      border: { width: 3, color: c.accentColor ? resolveColor(c.accentColor, ctx.theme, ctx.theme.accent) : ctx.theme.accent, sides: ["top"] as const },
    }),
    clipContent: !isFlat,
  };

  // Override default stacker/columns animation if component specifies one
  if (c.animationType && ctx.animate) {
    const boxDelay = (c as unknown as SlideComponent).animationDelay ?? ctx.animationDelay ?? 0;
    group.animation = makeAnimation(c.animationType, boxDelay);
  }

  return { elements: [group], height: totalH };
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
      result = resolveSpacer(component, ctx); break;
    case "raw":
      result = resolveRaw(component, ctx); break;
    case "columns":
      result = resolveColumns(component, ctx); break;
    case "box":
      result = resolveBox(component, ctx); break;
  }

  // Generic animationType override — skip box (handles it internally) and columns (container)
  if (
    component.type !== "box" &&
    component.type !== "columns" &&
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
