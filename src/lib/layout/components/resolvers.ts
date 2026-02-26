import type {
  LayoutElement,
  ResolvedTheme,
  Rect,
  TextElement,
  ShapeElement,
  GroupElement,
} from "../types";
import type {
  SlideComponent,
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
} from "./types";
import { estimateTextHeight, headingStyle, bodyStyle } from "../helpers";
import { resolveColor } from "./theme-tokens";

// --- Resolver result ---

export interface ResolveResult {
  elements: LayoutElement[];
  height: number;
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
}

// --- Heading ---

const HEADING_SIZES: Record<number, number> = { 1: 54, 2: 42, 3: 34 };

function resolveHeading(c: HeadingComponent, ctx: ResolveContext): ResolveResult {
  const fontSize = HEADING_SIZES[c.level ?? 1] ?? 54;
  const textW = ctx.panel.w;
  const h = estimateTextHeight(c.text, fontSize, 1.15, textW);
  const el: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-heading`,
    rect: { x: 0, y: 0, w: textW, h },
    text: c.text,
    style: headingStyle(ctx.theme, fontSize, {
      textAlign: "left",
      color: ctx.textColor ?? ctx.theme.heading,
    }),
  };
  return { elements: [el], height: h };
}

// --- Body ---

function resolveBody(c: BodyComponent, ctx: ResolveContext): ResolveResult {
  const fontSize = 28;
  const lineHeight = 1.6;
  const textW = ctx.panel.w;
  const h = estimateTextHeight(c.text, fontSize, lineHeight, textW);
  const el: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-body`,
    rect: { x: 0, y: 0, w: textW, h },
    text: c.text,
    style: bodyStyle(ctx.theme, fontSize, {
      color: ctx.textColor ?? ctx.theme.text,
    }),
  };
  return { elements: [el], height: h };
}

// --- Bullets ---

function resolveBullets(c: BulletsComponent, ctx: ResolveContext): ResolveResult {
  const bulletGap = 12;
  const bulletPadding = 14;
  const fontSize = 28;
  const lineHeight = 1.6;
  const bulletW = ctx.panel.w;
  const textW = bulletW - 40; // left padding for accent border + text indent

  const elements: LayoutElement[] = [];
  let totalH = 0;

  c.items.forEach((item, i) => {
    const textH = estimateTextHeight(item, fontSize, lineHeight, textW);
    const itemH = textH + bulletPadding * 2;

    const group: GroupElement = {
      kind: "group",
      id: `${ctx.idPrefix}-bullet-${i}`,
      rect: { x: 0, y: totalH, w: bulletW, h: itemH },
      children: [
        {
          kind: "text",
          id: `${ctx.idPrefix}-bullet-${i}-text`,
          rect: { x: 20, y: bulletPadding, w: textW, h: textH },
          text: item,
          style: bodyStyle(ctx.theme, fontSize, {
            color: ctx.textColor ?? ctx.theme.text,
          }),
        },
      ],
      style: {
        fill: ctx.theme.bgSecondary,
        borderRadius: ctx.theme.radiusSm,
      },
      border: { width: 3, color: ctx.theme.accent, sides: ["left"] },
    };

    elements.push(group);
    totalH += itemH + (i < c.items.length - 1 ? bulletGap : 0);
  });

  return { elements, height: totalH };
}

// --- Stat ---

function resolveStat(c: StatComponent, ctx: ResolveContext): ResolveResult {
  const valueSize = 64;
  const labelSize = 24;
  const valueH = valueSize * 1.15;
  const labelH = labelSize * 1.5;
  const gap = 8;
  const totalH = valueH + gap + labelH;
  const w = ctx.panel.w;

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
      textAlign: "left",
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
      textAlign: "left",
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
  const h = 4;
  const w = Math.min(ctx.panel.w, 200);

  const el: ShapeElement = {
    kind: "shape",
    id: `${ctx.idPrefix}-divider`,
    rect: { x: 0, y: 0, w, h },
    shape: "rect",
    style:
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
          : { fill: ctx.theme.accent, borderRadius: 2, opacity: 0.4 },
  };

  return { elements: [el], height: h };
}

// --- Quote ---

function resolveQuote(c: QuoteComponent, ctx: ResolveContext): ResolveResult {
  const quoteFontSize = 30;
  const lineHeight = 1.6;
  const textW = ctx.panel.w - 28; // indent for accent bar
  const quoteH = estimateTextHeight(c.text, quoteFontSize, lineHeight, textW);

  const elements: LayoutElement[] = [];

  // Accent bar on the left
  const barW = 4;
  const bar: ShapeElement = {
    kind: "shape",
    id: `${ctx.idPrefix}-quote-bar`,
    rect: { x: 0, y: 0, w: barW, h: quoteH },
    shape: "rect",
    style: { fill: ctx.theme.accent, borderRadius: 2 },
  };
  elements.push(bar);

  // Quote text
  const quoteEl: TextElement = {
    kind: "text",
    id: `${ctx.idPrefix}-quote-text`,
    rect: { x: 24, y: 0, w: textW, h: quoteH },
    text: c.text,
    style: {
      fontFamily: ctx.theme.fontBody,
      fontSize: quoteFontSize,
      fontWeight: 400,
      fontStyle: "italic",
      color: ctx.textColor ?? ctx.theme.text,
      lineHeight,
      textAlign: "left",
    },
  };
  elements.push(quoteEl);

  let totalH = quoteH;

  // Attribution
  if (c.attribution) {
    const attrSize = 22;
    const attrH = attrSize * 1.5;
    const attrEl: TextElement = {
      kind: "text",
      id: `${ctx.idPrefix}-quote-attr`,
      rect: { x: 24, y: quoteH + 12, w: textW, h: attrH },
      text: `\u2014 ${c.attribution}`,
      style: {
        fontFamily: ctx.theme.fontBody,
        fontSize: attrSize,
        fontWeight: 400,
        color: ctx.textColor ?? ctx.theme.textMuted,
        lineHeight: 1.5,
        textAlign: "left",
      },
    };
    elements.push(attrEl);
    totalH += 12 + attrH;
    // Extend accent bar to cover attribution
    bar.rect.h = totalH;
  }

  return { elements, height: totalH };
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

  const el: LayoutElement = {
    kind: "image",
    id: `${ctx.idPrefix}-image`,
    rect: { x: 0, y: 0, w: ctx.panel.w, h },
    src,
    objectFit: "contain",
    borderRadius: ctx.theme.radiusSm,
  };

  return { elements: [el], height: h };
}

// --- Code ---

function resolveCode(c: CodeComponent, ctx: ResolveContext): ResolveResult {
  const codeFontSize = 22;
  const codeLineH = 1.6;
  const codePadding = 28;
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
  return { elements: [], height: c.height };
}

// --- Raw (escape hatch) ---

function resolveRaw(c: RawComponent, _ctx: ResolveContext): ResolveResult {
  return { elements: c.elements, height: c.height };
}

// --- Main dispatch ---

export function resolveComponent(
  component: SlideComponent,
  ctx: ResolveContext,
): ResolveResult {
  switch (component.type) {
    case "heading":
      return resolveHeading(component, ctx);
    case "body":
      return resolveBody(component, ctx);
    case "bullets":
      return resolveBullets(component, ctx);
    case "stat":
      return resolveStat(component, ctx);
    case "tag":
      return resolveTag(component, ctx);
    case "divider":
      return resolveDivider(component, ctx);
    case "quote":
      return resolveQuote(component, ctx);
    case "card":
      return resolveCard(component, ctx);
    case "image":
      return resolveImage(component, ctx);
    case "code":
      return resolveCode(component, ctx);
    case "spacer":
      return resolveSpacer(component, ctx);
    case "raw":
      return resolveRaw(component, ctx);
  }
}
