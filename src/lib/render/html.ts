import { readFileSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
import React from "react";
import { LayoutSlideRenderer } from "@/components/LayoutRenderer";
import type { LayoutSlide } from "@/lib/layout/types";
import { FONT_FAMILY_VARS, GOOGLE_FONTS_URL } from "./fonts";

const require = createRequire(import.meta.url);
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");

const animationsCss = readFileSync(
  join(process.cwd(), "src/styles/animations.css"),
  "utf8",
);

export type RenderFit = "contain" | "cover" | "stretch";

export interface BuildSlideHtmlOptions {
  width?: number;
  height?: number;
  fit?: RenderFit;
  background?: string;
  assetBaseUrl?: string;
}

interface FitTransform {
  x: number;
  y: number;
  transform: string;
}

function assertSafeCssValue(name: string, value: string): void {
  if (value.includes("<")) {
    throw new Error(`[render] Unsafe ${name} value`);
  }
}

function buildFontVarCss(): string {
  return Object.entries(FONT_FAMILY_VARS)
    .map(([key, value]) => `${key}: ${value};`)
    .join(" ");
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function resolveOutputSize(
  slide: LayoutSlide,
  width?: number,
  height?: number,
): { width: number; height: number } {
  return {
    width: width ?? slide.width,
    height: height ?? slide.height,
  };
}

function computeFitTransform(
  slide: LayoutSlide,
  width: number,
  height: number,
  fit: RenderFit,
): FitTransform {
  const scaleX = width / slide.width;
  const scaleY = height / slide.height;

  if (fit === "stretch") {
    return {
      x: 0,
      y: 0,
      transform: `scale(${scaleX}, ${scaleY})`,
    };
  }

  const scale = fit === "cover"
    ? Math.max(scaleX, scaleY)
    : Math.min(scaleX, scaleY);

  return {
    x: (width - slide.width * scale) / 2,
    y: (height - slide.height * scale) / 2,
    transform: `scale(${scale})`,
  };
}

/**
 * Build a self-contained HTML document that renders a single LayoutSlide.
 * Designed for `page.setContent()` + element screenshot.
 */
export function buildSlideHtml(
  slide: LayoutSlide,
  options: BuildSlideHtmlOptions = {},
): string {
  const { width, height } = resolveOutputSize(slide, options.width, options.height);
  const fit = options.fit ?? "contain";
  const background = options.background ?? slide.background;
  assertSafeCssValue("background", background);
  const baseHref = options.assetBaseUrl
    ? `<base href="${escapeHtmlAttribute(options.assetBaseUrl)}" />`
    : "";
  const { x, y, transform } = computeFitTransform(slide, width, height, fit);
  const markup = renderToStaticMarkup(
    React.createElement(LayoutSlideRenderer, {
      slide,
      animationNone: true,
    }),
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  ${baseHref}
  <link rel="stylesheet" href="${GOOGLE_FONTS_URL}" />
  <style>
    :root { ${buildFontVarCss()} }
    html, body {
      margin: 0;
      padding: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${background};
    }
    #render-root {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: ${background};
    }
    #render-slide {
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: ${slide.width}px;
      height: ${slide.height}px;
      transform-origin: top left;
      transform: ${transform};
    }
    ${animationsCss}
  </style>
</head>
<body>
  <div id="render-root">
    <div id="render-slide">${markup}</div>
  </div>
</body>
</html>`;
}
