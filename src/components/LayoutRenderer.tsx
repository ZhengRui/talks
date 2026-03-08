import type {
  LayoutSlide,
  LayoutElement,
  EntranceDef,
  TransformDef,
  TextElement,
  ImageElement,
  ShapeElement,
  GroupElement,
  CodeElement,
  TableElement,
  ListElement,
  VideoElement,
  IframeElement,
  GradientDef,
  BoxShadow,
  BorderDef,
  PatternFillDef,
  ElementEffects,
  TextRun,
  RichText,
} from "@/lib/layout/types";
import React from "react";
import { transformToCSS } from "@/lib/layout/transform";
import { parseMarkdownToRuns } from "@/lib/layout/richtext";

// --- Animation mapping ---

const ANIM_CLASS: Record<string, string> = {
  "fade-up": "anim-fade-up",
  "fade-in": "anim-fade-in",
  "slide-left": "anim-slide-left",
  "slide-right": "anim-slide-right",
  "scale-up": "anim-scale-up",
  "count-up": "anim-fade-up", // count-up uses same keyframe as fade-up
};

/** Maps entrance animation types to their CSS keyframe names. */
const ANIM_KEYFRAME: Record<string, string> = {
  "fade-up": "fadeUp",
  "fade-in": "fadeIn",
  "slide-left": "slideInLeft",
  "slide-right": "slideInRight",
  "scale-up": "scaleUp",
  "count-up": "fadeUp",
};

function animProps(
  entrance?: EntranceDef,
  animation?: string,
  clipPath?: string,
  transform?: TransformDef,
): {
  className?: string;
  style?: React.CSSProperties;
} {
  const result: { className?: string; style?: React.CSSProperties } = {};
  if (entrance && entrance.type !== "none") {
    const cls = ANIM_CLASS[entrance.type];
    if (cls) {
      if (animation) {
        // When both entrance + continuous animations exist, combine them in inline style.
        // The CSS class still provides the initial opacity: 0.
        const keyframe = ANIM_KEYFRAME[entrance.type] || "fadeUp";
        const dur = entrance.duration || 600;
        const delay = entrance.delay || 0;
        result.className = cls;
        result.style = {
          animation: `${keyframe} ${dur}ms ${delay}ms ease both, ${animation}`,
        };
      } else {
        result.className = cls;
        result.style = { "--delay": `${entrance.delay}ms` } as React.CSSProperties;
      }
    }
  } else if (animation) {
    result.style = { animation };
  }
  if (clipPath) {
    result.style = { ...result.style, clipPath };
  }
  if (transform) {
    const txCSS = transformToCSS(transform);
    if (txCSS.transform) {
      if (result.className) {
        // Entrance animation keyframes set `transform`, which overrides inline transform.
        // Use CSS custom property referenced by keyframes: var(--static-tx, )
        result.style = { ...result.style, "--static-tx": txCSS.transform } as React.CSSProperties;
      } else {
        result.style = { ...result.style, transform: txCSS.transform };
      }
    }
  }
  return result;
}

// --- Style converters ---

function gradientToCSS(g: GradientDef): string {
  const stops = g.stops.map((s) => `${s.color} ${s.position * 100}%`).join(", ");
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

function shadowToCSS(s: BoxShadow): string {
  return `${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.spread ?? 0}px ${s.color}`;
}

/** Map PatternFillDef to a CSS background-image (repeating-linear-gradient). */
function patternFillToCSS(p: PatternFillDef): React.CSSProperties {
  const fg = p.fgColor;
  const fgA = p.fgOpacity ?? 1;
  // Build rgba string
  const fgRgba = fg === "transparent" ? "transparent" : hexToRgba(fg, fgA);
  const bgRgba = !p.bgColor || p.bgColor === "transparent"
    ? "transparent"
    : hexToRgba(p.bgColor, p.bgOpacity ?? 0);

  switch (p.preset) {
    case "narHorz": // scan lines
      return {
        backgroundImage: `repeating-linear-gradient(0deg, ${bgRgba} 0px, ${bgRgba} 2px, ${fgRgba} 2px, ${fgRgba} 4px)`,
      };
    case "narVert":
      return {
        backgroundImage: `repeating-linear-gradient(90deg, ${bgRgba} 0px, ${bgRgba} 2px, ${fgRgba} 2px, ${fgRgba} 4px)`,
      };
    case "smGrid":
      return {
        backgroundImage: [
          `repeating-linear-gradient(0deg, ${fgRgba} 0px, ${fgRgba} 1px, transparent 1px, transparent 40px)`,
          `repeating-linear-gradient(90deg, ${fgRgba} 0px, ${fgRgba} 1px, transparent 1px, transparent 40px)`,
        ].join(", "),
      };
    case "lgGrid":
      return {
        backgroundImage: [
          `repeating-linear-gradient(0deg, ${fgRgba} 0px, ${fgRgba} 1px, transparent 1px, transparent 80px)`,
          `repeating-linear-gradient(90deg, ${fgRgba} 0px, ${fgRgba} 1px, transparent 1px, transparent 80px)`,
        ].join(", "),
      };
    case "dotGrid":
      return {
        backgroundImage: `radial-gradient(circle, ${fgRgba} 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
      };
    case "pct5":
      return {
        backgroundImage: `radial-gradient(circle, ${fgRgba} 0.5px, transparent 0.5px)`,
        backgroundSize: "12px 12px",
      };
    case "pct10":
      return {
        backgroundImage: `radial-gradient(circle, ${fgRgba} 1px, transparent 1px)`,
        backgroundSize: "10px 10px",
      };
    case "dnDiag":
      return {
        backgroundImage: `repeating-linear-gradient(45deg, transparent 0px, transparent 4px, ${fgRgba} 4px, ${fgRgba} 5px)`,
      };
    case "upDiag":
      return {
        backgroundImage: `repeating-linear-gradient(-45deg, transparent 0px, transparent 4px, ${fgRgba} 4px, ${fgRgba} 5px)`,
      };
    case "diagCross":
      return {
        backgroundImage: [
          `repeating-linear-gradient(45deg, transparent 0px, transparent 4px, ${fgRgba} 4px, ${fgRgba} 5px)`,
          `repeating-linear-gradient(-45deg, transparent 0px, transparent 4px, ${fgRgba} 4px, ${fgRgba} 5px)`,
        ].join(", "),
      };
    default:
      return {};
  }
}

/** Convert hex color + opacity to rgba string. */
function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** Map ElementEffects to CSS properties. */
function effectsToCSS(effects?: ElementEffects): React.CSSProperties {
  if (!effects) return {};
  const style: React.CSSProperties = {};
  const filters: string[] = [];

  if (effects.glow) {
    const { color, radius, opacity = 0.6 } = effects.glow;
    const glowColor = hexToRgba(color.replace("#", "").length === 6 ? color : color, opacity);
    // Combine with existing boxShadow if needed
    style.boxShadow = `0 0 ${radius}px ${radius / 2}px ${glowColor}`;
  }

  if (effects.blur) {
    filters.push(`blur(${effects.blur}px)`);
  }

  if (effects.softEdge) {
    // softEdge feathers the edges — approximate with a combination of blur on a wrapper
    // or use mask-image for edge feathering
    filters.push(`blur(${effects.softEdge}px)`);
  }

  if (filters.length > 0) {
    style.filter = filters.join(" ");
  }

  return style;
}

function borderToCSS(b: BorderDef, sides?: string[]): React.CSSProperties {
  if (sides && sides.length > 0) {
    const style: React.CSSProperties = {};
    for (const side of sides) {
      const key = `border${side.charAt(0).toUpperCase() + side.slice(1)}` as
        | "borderTop"
        | "borderRight"
        | "borderBottom"
        | "borderLeft";
      style[key] = `${b.width}px solid ${b.color}`;
    }
    return style;
  }
  return { border: `${b.width}px solid ${b.color}` };
}

// --- Rich text rendering ---

/** Render a single TextRun as an inline <span>. */
function renderTextRun(run: TextRun, index: number): React.ReactNode {
  const style: React.CSSProperties = {};
  if (run.bold) style.fontWeight = 700;
  if (run.italic) style.fontStyle = "italic";
  if (run.underline) style.textDecoration = "underline";
  if (run.strikethrough) {
    style.textDecoration = (style.textDecoration ? style.textDecoration + " " : "") + "line-through";
  }
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
 * Strings: parse **bold** and *italic* markdown, apply highlightColor if set.
 * TextRun[]: render each run with its inline styles.
 */
function renderRichText(text: RichText, highlightColor?: string): React.ReactNode {
  if (typeof text === "string") {
    if (!highlightColor && !text.includes("**") && !text.includes("*")) {
      return text;
    }
    const runs = parseMarkdownToRuns(text, highlightColor);
    if (runs.length === 1 && !runs[0].bold && !runs[0].italic) return text;
    return runs.map((run, i) => renderTextRun(run, i));
  }
  return text.map((run, i) => renderTextRun(run, i));
}

// --- Element renderers ---

function renderText(el: TextElement): React.ReactNode {
  const anim = animProps(el.entrance, el.animation, el.clipPath, el.transform);
  const vAlign = el.style.verticalAlign;
  const hc = el.style.highlightColor;
  const style: React.CSSProperties = {
    position: "absolute",
    left: el.rect.x,
    top: el.rect.y,
    width: el.rect.w,
    height: el.rect.h,
    fontFamily: el.style.fontFamily,
    fontSize: el.style.fontSize,
    fontWeight: el.style.fontWeight,
    fontStyle: el.style.fontStyle,
    color: el.style.color,
    lineHeight: el.style.lineHeight,
    textAlign: el.style.textAlign,
    textShadow: el.style.textShadow,
    letterSpacing: el.style.letterSpacing,
    textTransform: el.style.textTransform,
    whiteSpace: "pre-line",
    overflow: "hidden",
    ...(vAlign ? {
      display: "flex",
      alignItems: vAlign === "middle" ? "center" : vAlign === "bottom" ? "flex-end" : "flex-start",
      justifyContent: el.style.textAlign === "center" ? "center" : el.style.textAlign === "right" ? "flex-end" : "flex-start",
    } : {}),
  };
  if (el.opacity != null) style.opacity = el.opacity;
  if (el.borderRadius != null) style.borderRadius = el.borderRadius;
  if (el.shadow) style.boxShadow = shadowToCSS(el.shadow);
  if (el.border) Object.assign(style, borderToCSS(el.border, el.border.sides));
  Object.assign(style, effectsToCSS(el.effects));
  if (el.cssStyle) Object.assign(style, el.cssStyle);
  Object.assign(style, anim.style);
  return (
    <div
      key={el.id}
      className={anim.className}
      style={style}
    >
      {renderRichText(el.text, hc)}
    </div>
  );
}

function renderImage(el: ImageElement): React.ReactNode {
  const anim = animProps(el.entrance, el.animation, el.clipPath, el.transform);
  return (
    <div
      key={el.id}
      className={anim.className}
      style={{
        position: "absolute",
        left: el.rect.x,
        top: el.rect.y,
        width: el.rect.w,
        height: el.rect.h,
        overflow: "hidden",
        borderRadius: el.clipCircle ? "50%" : el.borderRadius,
        opacity: el.opacity,
        ...(el.cssStyle ?? {}),
        ...anim.style,
      }}
    >
      <img
        src={el.src}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: el.objectFit,
          display: "block",
        }}
      />
    </div>
  );
}

// SVG path data for vector shapes (viewBox 0 0 100 100)
const SVG_SHAPE_PATHS: Record<string, string> = {
  arrow: "M 0 25 L 60 25 L 60 0 L 100 50 L 60 100 L 60 75 L 0 75 Z",
  triangle: "M 50 0 L 100 100 L 0 100 Z",
  chevron: "M 0 0 L 75 0 L 100 50 L 75 100 L 0 100 L 25 50 Z",
  diamond: "M 50 0 L 100 50 L 50 100 L 0 50 Z",
  star: (() => {
    const cx = 50, cy = 50, outerR = 50, innerR = 20;
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return pts.join(" ") + " Z";
  })(),
  callout: "M 5 0 L 95 0 Q 100 0 100 5 L 100 70 Q 100 75 95 75 L 30 75 L 10 100 L 20 75 L 5 75 Q 0 75 0 5 Q 0 0 5 0 Z",
};

function renderShape(el: ShapeElement): React.ReactNode {
  const anim = animProps(el.entrance, el.animation, el.clipPath, el.transform);

  // --- SVG-based shapes (arrow, triangle, chevron, diamond, star, callout) ---
  const svgPath = SVG_SHAPE_PATHS[el.shape];
  if (svgPath) {
    const style: React.CSSProperties = {
      position: "absolute",
      left: el.rect.x,
      top: el.rect.y,
      width: el.rect.w,
      height: el.rect.h,
      opacity: el.opacity,
      ...anim.style,
    };

    // Shadow via drop-shadow (follows SVG outline, unlike box-shadow)
    const filters: string[] = [];
    if (el.shadow) {
      filters.push(
        `drop-shadow(${el.shadow.offsetX}px ${el.shadow.offsetY}px ${el.shadow.blur}px ${el.shadow.color})`,
      );
    }
    const fx = effectsToCSS(el.effects);
    if (fx.filter) filters.push(fx.filter);
    if (filters.length) style.filter = filters.join(" ");
    if (el.cssStyle) Object.assign(style, el.cssStyle);

    const svgFill = el.style.gradient ? undefined : (el.style.fill ?? "none");
    const gradientId = el.style.gradient ? `grad-${el.id}` : undefined;

    return (
      <div key={el.id} className={anim.className} style={style}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          style={{ display: "block" }}
        >
          {gradientId && el.style.gradient && (
            <defs>
              <linearGradient id={gradientId} gradientTransform={`rotate(${el.style.gradient.angle})`}>
                {el.style.gradient.stops.map((s, i) => (
                  <stop key={i} offset={`${s.position * 100}%`} stopColor={s.color} />
                ))}
              </linearGradient>
            </defs>
          )}
          <path
            d={svgPath}
            fill={gradientId ? `url(#${gradientId})` : svgFill}
            stroke={el.style.stroke ?? "none"}
            strokeWidth={el.style.stroke ? (el.style.strokeWidth ?? 1) : 0}
            strokeDasharray={el.style.strokeDash === "dash" ? "12 6" : el.style.strokeDash === "dot" ? "2 4" : el.style.strokeDash === "dashDot" ? "12 4 2 4" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    );
  }

  // --- CSS-based shapes (rect, circle, line, pill) ---
  const style: React.CSSProperties = {
    position: "absolute",
    left: el.rect.x,
    top: el.rect.y,
    width: el.rect.w,
    height: el.rect.h,
    opacity: el.opacity,
    ...anim.style,
  };

  if (el.shape === "circle") {
    style.borderRadius = "50%";
  } else if (el.shape === "pill") {
    style.borderRadius = Math.min(el.rect.h, el.rect.w) / 2;
  } else if (el.shape === "line") {
    // Line rendered as a thin rect
  } else {
    style.borderRadius = el.borderRadius;
  }

  // Fill
  if (el.style.gradient) {
    style.background = gradientToCSS(el.style.gradient);
  } else if (el.style.patternFill) {
    Object.assign(style, patternFillToCSS(el.style.patternFill));
  } else if (el.style.fill) {
    style.background = el.style.fill;
  }

  // Stroke
  if (el.style.stroke) {
    const dashStyle = el.style.strokeDash === "dash" ? "dashed" : el.style.strokeDash === "dot" ? "dotted" : "solid";
    style.border = `${el.style.strokeWidth ?? 1}px ${dashStyle} ${el.style.stroke}`;
  }

  // Shadow
  const shapeShadow = el.shadow;
  if (shapeShadow) {
    style.boxShadow = shadowToCSS(shapeShadow);
  }

  // Border override
  if (el.border) {
    Object.assign(style, borderToCSS(el.border, el.border.sides));
  }

  // Effects (glow, blur, softEdge)
  const fx = effectsToCSS(el.effects);
  if (fx.boxShadow) {
    style.boxShadow = style.boxShadow
      ? `${style.boxShadow}, ${fx.boxShadow}`
      : fx.boxShadow;
  }
  if (fx.filter) style.filter = fx.filter;
  if (el.cssStyle) Object.assign(style, el.cssStyle);

  return <div key={el.id} className={anim.className} style={style} />;
}

function renderGroup(el: GroupElement): React.ReactNode {
  const anim = animProps(el.entrance, el.animation, el.clipPath, el.transform);
  const style: React.CSSProperties = {
    position: "absolute",
    left: el.rect.x,
    top: el.rect.y,
    width: el.rect.w,
    height: el.rect.h,
    overflow: el.clipContent ? "hidden" : undefined,
    ...anim.style,
  };

  if (el.style) {
    if (el.style.fill) style.background = el.style.fill;
    if (el.style.gradient) style.background = gradientToCSS(el.style.gradient);
  }
  if (el.borderRadius != null) style.borderRadius = el.borderRadius;
  if (el.opacity != null) style.opacity = el.opacity;
  if (el.shadow) style.boxShadow = shadowToCSS(el.shadow);

  if (el.border) {
    Object.assign(style, borderToCSS(el.border, el.border.sides));
  }

  // Effects (glow, blur, softEdge)
  Object.assign(style, effectsToCSS(el.effects));
  if (el.cssStyle) Object.assign(style, el.cssStyle);

  return (
    <div key={el.id} className={anim.className} style={style}>
      {el.children.map(renderElement)}
    </div>
  );
}

function renderCode(el: CodeElement): React.ReactNode {
  const anim = animProps(el.entrance, el.animation, el.clipPath, el.transform);
  return (
    <div
      key={el.id}
      className={anim.className}
      style={{
        position: "absolute",
        left: el.rect.x,
        top: el.rect.y,
        width: el.rect.w,
        height: el.rect.h,
        background: el.style.background,
        color: el.style.color,
        fontFamily: el.style.fontFamily,
        fontSize: el.style.fontSize,
        lineHeight: 1.6,
        borderRadius: el.borderRadius ?? el.style.borderRadius,
        padding: el.style.padding,
        whiteSpace: "pre-wrap",
        overflow: "auto",
        textAlign: "left",
        ...(el.cssStyle ?? {}),
        ...anim.style,
      }}
    >
      {el.language && (
        <span
          style={{
            position: "absolute",
            top: 12,
            right: 16,
            fontSize: 14,
            opacity: 0.6,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {el.language}
        </span>
      )}
      {el.code}
    </div>
  );
}

function renderTable(el: TableElement): React.ReactNode {
  const anim = animProps(el.entrance, el.animation, el.clipPath, el.transform);
  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    left: el.rect.x,
    top: el.rect.y,
    width: el.rect.w,
    height: el.rect.h,
    overflow: "hidden",
    borderRadius: el.borderRadius ?? 12,
  };
  if (el.opacity != null) wrapperStyle.opacity = el.opacity;
  if (el.shadow) wrapperStyle.boxShadow = shadowToCSS(el.shadow);
  if (el.border) Object.assign(wrapperStyle, borderToCSS(el.border, el.border.sides));
  Object.assign(wrapperStyle, effectsToCSS(el.effects));
  if (el.cssStyle) Object.assign(wrapperStyle, el.cssStyle);
  Object.assign(wrapperStyle, anim.style);
  return (
    <div
      key={el.id}
      className={anim.className}
      style={wrapperStyle}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          fontSize: el.cellStyle.fontSize,
        }}
      >
        <thead>
          <tr>
            {el.headers.map((h, i) => (
              <th
                key={i}
                style={{
                  background: el.headerStyle.background,
                  color: el.headerStyle.color,
                  fontFamily: el.headerStyle.fontFamily,
                  fontWeight: el.headerStyle.fontWeight,
                  fontSize: el.headerStyle.fontSize,
                  padding: "16px 24px",
                  textAlign: el.headerStyle.textAlign ?? "left",
                }}
              >
                {renderRichText(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {el.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "14px 24px",
                    color: el.cellStyle.color,
                    fontFamily: el.cellStyle.fontFamily,
                    fontSize: el.cellStyle.fontSize,
                    background:
                      ri % 2 === 0
                        ? el.cellStyle.altBackground
                        : el.cellStyle.background,
                    borderBottom: `1px solid ${el.borderColor}`,
                  }}
                >
                  {renderRichText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderList(el: ListElement): React.ReactNode {
  const anim = animProps(el.entrance, el.animation, el.clipPath, el.transform);
  const Tag = el.ordered ? "ol" : "ul";
  const useCustomBullets = !el.ordered && el.bulletColor && el.bulletColor !== el.itemStyle.color;
  const fontSize = typeof el.itemStyle.fontSize === "number" ? el.itemStyle.fontSize : parseFloat(String(el.itemStyle.fontSize));
  const dotSize = Math.round(fontSize * 0.48);
  const dotPadding = Math.round(fontSize * 1.5);
  const rawLH = el.itemStyle.lineHeight;
  const lineH = rawLH < 10 ? rawLH * fontSize : rawLH;  // unitless multiplier vs absolute px
  const listWrapperStyle: React.CSSProperties = {
    position: "absolute",
    left: el.rect.x,
    top: el.rect.y,
    width: el.rect.w,
    height: el.rect.h,
    overflow: "hidden",
  };
  if (el.opacity != null) listWrapperStyle.opacity = el.opacity;
  if (el.borderRadius != null) listWrapperStyle.borderRadius = el.borderRadius;
  if (el.shadow) listWrapperStyle.boxShadow = shadowToCSS(el.shadow);
  if (el.border) Object.assign(listWrapperStyle, borderToCSS(el.border, el.border.sides));
  Object.assign(listWrapperStyle, effectsToCSS(el.effects));
  if (el.cssStyle) Object.assign(listWrapperStyle, el.cssStyle);
  Object.assign(listWrapperStyle, anim.style);
  return (
    <div
      key={el.id}
      className={anim.className}
      style={listWrapperStyle}
    >
      <Tag
        style={{
          paddingLeft: useCustomBullets ? 0 : "1.2em",
          margin: 0,
          listStyleType: useCustomBullets ? "none" : (el.ordered ? "decimal" : "disc"),
        }}
      >
        {el.items.map((item, i) => {
          const content = renderRichText(item);
          return (
            <li
              key={i}
              style={{
                position: useCustomBullets ? "relative" : undefined,
                paddingLeft: useCustomBullets ? dotPadding : undefined,
                fontFamily: el.itemStyle.fontFamily,
                fontSize: el.itemStyle.fontSize,
                fontWeight: el.itemStyle.fontWeight,
                color: el.itemStyle.color,
                lineHeight: el.itemStyle.lineHeight,
                marginBottom: el.itemSpacing,
              }}
            >
              {useCustomBullets && (
                <span style={{
                  position: "absolute",
                  left: 0,
                  top: (lineH - dotSize) / 2,
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  backgroundColor: el.bulletColor,
                }} />
              )}
              {content}
            </li>
          );
        })}
      </Tag>
    </div>
  );
}

// --- Video / Iframe helpers ---

/** Detect YouTube/Vimeo URLs and return an embed-friendly URL. */
function toEmbedUrl(src: string): string | null {
  // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  const ytMatch = src.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/,
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Vimeo: vimeo.com/ID, player.vimeo.com/video/ID
  const vimeoMatch = src.match(
    /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([\d]+)/,
  );
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
}

function mediaWrapperStyle(el: VideoElement | IframeElement, anim: ReturnType<typeof animProps>): React.CSSProperties {
  const style: React.CSSProperties = {
    position: "absolute",
    left: el.rect.x,
    top: el.rect.y,
    width: el.rect.w,
    height: el.rect.h,
    overflow: "hidden",
    borderRadius: el.borderRadius,
    ...anim.style,
  };
  if (el.opacity != null) style.opacity = el.opacity;
  if (el.shadow) style.boxShadow = shadowToCSS(el.shadow);
  if (el.border) Object.assign(style, borderToCSS(el.border, el.border.sides));
  Object.assign(style, effectsToCSS(el.effects));
  if (el.cssStyle) Object.assign(style, el.cssStyle);
  return style;
}

function renderVideo(el: VideoElement): React.ReactNode {
  const anim = animProps(el.entrance, el.animation, el.clipPath, el.transform);
  const wrapperStyle = mediaWrapperStyle(el, anim);

  const embedUrl = toEmbedUrl(el.src);
  if (embedUrl) {
    return (
      <div key={el.id} className={anim.className} style={wrapperStyle}>
        <iframe
          src={embedUrl}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div key={el.id} className={anim.className} style={wrapperStyle}>
      <video
        src={el.src}
        poster={el.poster}
        controls
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}

function renderIframe(el: IframeElement): React.ReactNode {
  const anim = animProps(el.entrance, el.animation, el.clipPath, el.transform);
  return (
    <div
      key={el.id}
      className={anim.className}
      style={mediaWrapperStyle(el, anim)}
    >
      <iframe
        src={el.src}
        style={{ width: "100%", height: "100%", border: "none" }}
        allowFullScreen
      />
    </div>
  );
}

// --- Dispatcher ---

function renderElement(el: LayoutElement): React.ReactNode {
  switch (el.kind) {
    case "text":
      return renderText(el);
    case "image":
      return renderImage(el);
    case "shape":
      return renderShape(el);
    case "group":
      return renderGroup(el);
    case "code":
      return renderCode(el);
    case "table":
      return renderTable(el);
    case "list":
      return renderList(el);
    case "video":
      return renderVideo(el);
    case "iframe":
      return renderIframe(el);
  }
}

// --- Main component ---

interface LayoutSlideRendererProps {
  slide: LayoutSlide;
  animationNone?: boolean;
}

export function LayoutSlideRenderer({
  slide,
  animationNone,
}: LayoutSlideRendererProps) {
  const sectionStyle: React.CSSProperties = {
    position: "relative",
    width: slide.width,
    height: slide.height,
    background: slide.background,
    overflow: "hidden",
  };

  return (
    <section
      className={animationNone ? "anim-none" : undefined}
      style={sectionStyle}
    >
      {slide.backgroundImage && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: slide.backgroundImage.startsWith("url(")
              ? slide.backgroundImage
              : `url(${slide.backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />
      )}
      {slide.overlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: slide.overlay,
            zIndex: 1,
            pointerEvents: "none",
          }}
        />
      )}
      {slide.elements.map(renderElement)}
    </section>
  );
}
