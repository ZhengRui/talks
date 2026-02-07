import type {
  LayoutSlide,
  LayoutElement,
  AnimationDef,
  TextElement,
  ImageElement,
  ShapeElement,
  GroupElement,
  CodeElement,
  TableElement,
  ListElement,
  GradientDef,
  BoxShadow,
  BorderDef,
} from "@/lib/layout/types";
import React from "react";

// --- Animation mapping ---

const ANIM_CLASS: Record<string, string> = {
  "fade-up": "anim-fade-up",
  "fade-in": "anim-fade-in",
  "slide-left": "anim-slide-left",
  "slide-right": "anim-slide-right",
  "scale-up": "anim-scale-up",
  "count-up": "anim-fade-up", // count-up uses same keyframe as fade-up
};

function animProps(anim?: AnimationDef): {
  className?: string;
  style?: React.CSSProperties;
} {
  if (!anim || anim.type === "none") return {};
  const cls = ANIM_CLASS[anim.type];
  if (!cls) return {};
  return {
    className: cls,
    style: { "--delay": `${anim.delay}ms` } as React.CSSProperties,
  };
}

// --- Style converters ---

function gradientToCSS(g: GradientDef): string {
  const stops = g.stops.map((s) => `${s.color} ${s.position * 100}%`).join(", ");
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

function shadowToCSS(s: BoxShadow): string {
  return `${s.offsetX}px ${s.offsetY}px ${s.blur}px ${s.spread ?? 0}px ${s.color}`;
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

// --- Element renderers ---

function renderText(el: TextElement): React.ReactNode {
  const anim = animProps(el.animation);
  const vAlign = el.style.verticalAlign;
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
        overflow: "hidden",
        ...(vAlign ? {
          display: "flex",
          alignItems: vAlign === "middle" ? "center" : vAlign === "bottom" ? "flex-end" : "flex-start",
          justifyContent: el.style.textAlign === "center" ? "center" : el.style.textAlign === "right" ? "flex-end" : "flex-start",
        } : {}),
        ...anim.style,
      }}
    >
      {el.text}
    </div>
  );
}

function renderImage(el: ImageElement): React.ReactNode {
  const anim = animProps(el.animation);
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

function renderShape(el: ShapeElement): React.ReactNode {
  const anim = animProps(el.animation);
  const style: React.CSSProperties = {
    position: "absolute",
    left: el.rect.x,
    top: el.rect.y,
    width: el.rect.w,
    height: el.rect.h,
    opacity: el.style.opacity,
    ...anim.style,
  };

  // Shape-specific styling
  if (el.shape === "circle") {
    style.borderRadius = "50%";
  } else if (el.shape === "pill") {
    style.borderRadius = Math.min(el.rect.h, el.rect.w) / 2;
  } else if (el.shape === "line") {
    // Line rendered as a thin rect
  } else {
    style.borderRadius = el.style.borderRadius;
  }

  // Fill
  if (el.style.gradient) {
    style.background = gradientToCSS(el.style.gradient);
  } else if (el.style.fill) {
    style.background = el.style.fill;
  }

  // Stroke
  if (el.style.stroke) {
    style.border = `${el.style.strokeWidth ?? 1}px solid ${el.style.stroke}`;
  }

  // Shadow
  if (el.style.shadow) {
    style.boxShadow = shadowToCSS(el.style.shadow);
  }

  // Border override
  if (el.border) {
    Object.assign(style, borderToCSS(el.border, el.border.sides));
  }

  return <div key={el.id} className={anim.className} style={style} />;
}

function renderGroup(el: GroupElement): React.ReactNode {
  const anim = animProps(el.animation);
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
    if (el.style.borderRadius != null) style.borderRadius = el.style.borderRadius;
    if (el.style.opacity != null) style.opacity = el.style.opacity;
    if (el.style.shadow) style.boxShadow = shadowToCSS(el.style.shadow);
  }

  if (el.border) {
    Object.assign(style, borderToCSS(el.border, el.border.sides));
  }

  return (
    <div key={el.id} className={anim.className} style={style}>
      {el.children.map(renderElement)}
    </div>
  );
}

function renderCode(el: CodeElement): React.ReactNode {
  const anim = animProps(el.animation);
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
        borderRadius: el.style.borderRadius,
        padding: el.style.padding,
        whiteSpace: "pre-wrap",
        overflow: "auto",
        textAlign: "left",
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
  const anim = animProps(el.animation);
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
        borderRadius: 12,
        ...anim.style,
      }}
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
                {h}
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
                  {cell}
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
  const anim = animProps(el.animation);
  const Tag = el.ordered ? "ol" : "ul";
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
        ...anim.style,
      }}
    >
      <Tag
        style={{
          paddingLeft: "1.2em",
          margin: 0,
          listStyleType: el.ordered ? "decimal" : "disc",
          color: el.bulletColor,
        }}
      >
        {el.items.map((item, i) => (
          <li
            key={i}
            style={{
              fontFamily: el.itemStyle.fontFamily,
              fontSize: el.itemStyle.fontSize,
              fontWeight: el.itemStyle.fontWeight,
              color: el.itemStyle.color,
              lineHeight: el.itemStyle.lineHeight,
              marginBottom: el.itemSpacing,
            }}
          >
            {item}
          </li>
        ))}
      </Tag>
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
      {slide.elements.map(renderElement)}
    </section>
  );
}
