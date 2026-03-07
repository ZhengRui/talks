// OOXML effects post-processor for PPTX export.
// Injects <a:effectLst> (glow, softEdge, blur) and <a:pattFill> into shape XML
// after PptxGenJS generates the file.

import type { ElementEffects, PatternFillDef, GradientDef } from "@/lib/layout/types";
import type { ParsedCssGradient } from "./pptx-helpers";
import { hexColor, colorAlpha } from "./pptx-helpers";

/** Entry mapping PptxGenJS shape indices to their effects. */
export interface EffectsEntry {
  spids: number[];
  effects?: ElementEffects;
  patternFill?: PatternFillDef;
  gradient?: GradientDef;
  /** CSS-parsed radial/linear gradient (from background strings). */
  cssGradient?: ParsedCssGradient;
  textAlpha?: number; // OOXML alpha: 0 (transparent) to 100000 (opaque)
}

/** Convert px to EMU (English Metric Units). 1 inch = 914400 EMU, slide = 13.33 in = 1920 px. */
function pxToEmu(px: number): number {
  return Math.round((px / 1920) * 13.3 * 914400);
}

/**
 * Build <a:effectLst> XML string for glow, softEdge, blur.
 * OOXML effects render more subtly than CSS equivalents, so we apply
 * multipliers: glow 4x, blur 5x,
 * softEdge 10x when glow present (glow adds color back), 5x when alone.
 */
function buildEffectLstXml(effects: ElementEffects): string {
  const parts: string[] = [];

  if (effects.blur) {
    parts.push(`<a:blur rad="${pxToEmu(effects.blur * 5)}" grow="1"/>`);
  }

  if (effects.glow) {
    const { color, radius, opacity = 0.6 } = effects.glow;
    const alphaVal = Math.round(opacity * 100000);
    parts.push(
      `<a:glow rad="${pxToEmu(radius * 4)}">` +
        `<a:srgbClr val="${hexColor(color)}">` +
          `<a:alpha val="${alphaVal}"/>` +
        `</a:srgbClr>` +
      `</a:glow>`,
    );
  }

  if (effects.softEdge) {
    // Higher multiplier when glow is present (glow adds visible color back)
    const softEdgeMul = effects.glow ? 10 : 5;
    parts.push(`<a:softEdge rad="${pxToEmu(effects.softEdge * softEdgeMul)}"/>`);
  }

  if (parts.length === 0) return "";
  return `<a:effectLst>${parts.join("")}</a:effectLst>`;
}

/** Build <a:pattFill> XML string to replace <a:solidFill>. */
function buildPattFillXml(pf: PatternFillDef): string {
  const fgAlpha = pf.fgOpacity !== undefined
    ? `<a:alpha val="${Math.round(pf.fgOpacity * 100000)}"/>`
    : "";
  const bgAlpha = pf.bgOpacity !== undefined
    ? `<a:alpha val="${Math.round(pf.bgOpacity * 100000)}"/>`
    : "";

  const fgColor = pf.fgColor === "transparent"
    ? `<a:srgbClr val="000000"><a:alpha val="0"/></a:srgbClr>`
    : `<a:srgbClr val="${hexColor(pf.fgColor)}">${fgAlpha}</a:srgbClr>`;

  const bgColor = !pf.bgColor || pf.bgColor === "transparent"
    ? `<a:srgbClr val="000000"><a:alpha val="0"/></a:srgbClr>`
    : `<a:srgbClr val="${hexColor(pf.bgColor)}">${bgAlpha}</a:srgbClr>`;

  return (
    `<a:pattFill prst="${pf.preset}">` +
      `<a:fgClr>${fgColor}</a:fgClr>` +
      `<a:bgClr>${bgColor}</a:bgClr>` +
    `</a:pattFill>`
  );
}

/**
 * Build <a:gradFill> XML to replace <a:solidFill> placeholder in shape properties.
 * CSS angle → OOXML: CSS 0° = bottom-to-top, OOXML 0° = left-to-right.
 * OOXML angle unit = 60000ths of a degree.
 */
function buildGradFillXml(gradient: GradientDef): string {
  const ooxmlDeg = (gradient.angle + 270) % 360;
  const ooxmlAngle = Math.round(ooxmlDeg * 60000);

  const stops = gradient.stops
    .map((stop) => {
      const pos = Math.round(stop.position * 100000);
      const hex = hexColor(stop.color);
      const alpha = colorAlpha(stop.color);

      if (alpha !== undefined) {
        // colorAlpha: 0 = opaque, 100 = transparent → OOXML: 100000 = opaque, 0 = transparent
        const ooxmlAlpha = Math.round((100 - alpha) * 1000);
        return `<a:gs pos="${pos}"><a:srgbClr val="${hex}"><a:alpha val="${ooxmlAlpha}"/></a:srgbClr></a:gs>`;
      }
      return `<a:gs pos="${pos}"><a:srgbClr val="${hex}"/></a:gs>`;
    })
    .join("");

  return (
    `<a:gradFill>` +
      `<a:gsLst>${stops}</a:gsLst>` +
      `<a:lin ang="${ooxmlAngle}" scaled="0"/>` +
    `</a:gradFill>`
  );
}

/**
 * Build <a:gradFill> XML for a CSS-parsed gradient (radial or linear).
 * Radial: uses <a:path path="circle"> with fillToRect for center position.
 * Linear: delegates to buildGradFillXml via GradientDef adapter.
 */
function buildCssGradFillXml(g: ParsedCssGradient): string {
  const stops = g.stops
    .map((stop) => {
      const pos = Math.round(stop.position * 100000);
      const hex = hexColor(stop.color);
      const alpha = colorAlpha(stop.color);

      if (alpha !== undefined) {
        const ooxmlAlpha = Math.round((100 - alpha) * 1000);
        return `<a:gs pos="${pos}"><a:srgbClr val="${hex}"><a:alpha val="${ooxmlAlpha}"/></a:srgbClr></a:gs>`;
      }
      // "transparent" → black with 0 alpha
      if (stop.color.trim().toLowerCase() === "transparent") {
        return `<a:gs pos="${pos}"><a:srgbClr val="000000"><a:alpha val="0"/></a:srgbClr></a:gs>`;
      }
      return `<a:gs pos="${pos}"><a:srgbClr val="${hex}"/></a:gs>`;
    })
    .join("");

  if (g.type === "radial") {
    const cx = Math.round((g.centerX ?? 50) * 1000);
    const cy = Math.round((g.centerY ?? 50) * 1000);
    const rx = 100000 - cx;
    const ry = 100000 - cy;
    return (
      `<a:gradFill rotWithShape="0">` +
        `<a:gsLst>${stops}</a:gsLst>` +
        `<a:path path="circle">` +
          `<a:fillToRect l="${cx}" t="${cy}" r="${rx}" b="${ry}"/>` +
        `</a:path>` +
      `</a:gradFill>`
    );
  }

  // Linear — convert to GradientDef and delegate
  return buildGradFillXml({
    type: "linear",
    angle: g.angle ?? 180,
    stops: g.stops.map((s) => ({ color: s.color, position: s.position })),
  });
}

/**
 * Apply effects to a slide XML string.
 * Finds <p:sp> elements by spid and injects effectLst / replaces solidFill.
 */
/** Entry for fixing cover image srcRect (PptxGenJS doesn't compute crop correctly). */
export interface CoverImageEntry {
  spid: number;
  /** OOXML srcRect percentages in 1000ths of percent. */
  l: number;
  r: number;
  t: number;
  b: number;
}

/**
 * Fix <a:srcRect> for cover images. PptxGenJS uses box dimensions as image
 * dimensions, so srcRect is always zero (no crop). We replace with correct
 * values computed from actual intrinsic image dimensions.
 */
export function applyCoverImagesToSlideXml(
  slideXml: string,
  entries: CoverImageEntry[],
): string {
  let xml = slideXml;
  for (const entry of entries) {
    // Match <p:cNvPr id="SPID"...> within <p:pic> and find its <a:srcRect>
    const pattern = new RegExp(
      `(<p:cNvPr\\s+id="${entry.spid}"[\\s\\S]*?)<a:srcRect[^/]*/>`,
    );
    xml = xml.replace(
      pattern,
      `$1<a:srcRect l="${entry.l}" r="${entry.r}" t="${entry.t}" b="${entry.b}"/>`,
    );
  }
  return xml;
}

export function applyEffectsToSlideXml(
  slideXml: string,
  entries: EffectsEntry[],
): string {
  let xml = slideXml;

  for (const entry of entries) {
    for (const spid of entry.spids) {
      // Find the shape's <p:spPr> block by spid.
      // PptxGenJS writes <p:cNvPr id="N" name="..."></p:cNvPr> (not self-closing).
      const spIdPattern = new RegExp(
        `(<p:cNvPr\\s+id="${spid}"[\\s\\S]*?</p:spPr>)`,
      );
      const match = xml.match(spIdPattern);
      if (!match) continue;

      let shapeXml = match[1];

      // Inject <a:effectLst> before </p:spPr>
      if (entry.effects) {
        const effectLstXml = buildEffectLstXml(entry.effects);
        if (effectLstXml) {
          shapeXml = shapeXml.replace("</p:spPr>", `${effectLstXml}</p:spPr>`);
        }
      }

      // Replace fill with <a:pattFill>
      if (entry.patternFill) {
        const pattFillXml = buildPattFillXml(entry.patternFill);
        if (/<a:solidFill>[\s\S]*?<\/a:solidFill>/.test(shapeXml)) {
          shapeXml = shapeXml.replace(
            /<a:solidFill>[\s\S]*?<\/a:solidFill>/,
            pattFillXml,
          );
        } else {
          // No solidFill (shape had noFill) — replace <a:noFill/> or inject before </p:spPr>
          if (shapeXml.includes("<a:noFill/>")) {
            shapeXml = shapeXml.replace("<a:noFill/>", pattFillXml);
          } else {
            shapeXml = shapeXml.replace("</p:spPr>", `${pattFillXml}</p:spPr>`);
          }
        }
      }

      // Replace solid fill placeholder with <a:gradFill>
      if (entry.gradient) {
        const gradFillXml = buildGradFillXml(entry.gradient);
        if (/<a:solidFill>[\s\S]*?<\/a:solidFill>/.test(shapeXml)) {
          shapeXml = shapeXml.replace(
            /<a:solidFill>[\s\S]*?<\/a:solidFill>/,
            gradFillXml,
          );
        } else if (shapeXml.includes("<a:noFill/>")) {
          shapeXml = shapeXml.replace("<a:noFill/>", gradFillXml);
        } else {
          shapeXml = shapeXml.replace("</p:spPr>", `${gradFillXml}</p:spPr>`);
        }
      }

      // Replace solid fill with CSS-parsed gradient (radial or linear)
      if (entry.cssGradient) {
        const gradFillXml = buildCssGradFillXml(entry.cssGradient);
        if (/<a:solidFill>[\s\S]*?<\/a:solidFill>/.test(shapeXml)) {
          shapeXml = shapeXml.replace(
            /<a:solidFill>[\s\S]*?<\/a:solidFill>/,
            gradFillXml,
          );
        } else if (shapeXml.includes("<a:noFill/>")) {
          shapeXml = shapeXml.replace("<a:noFill/>", gradFillXml);
        } else {
          shapeXml = shapeXml.replace("</p:spPr>", `${gradFillXml}</p:spPr>`);
        }
      }

      xml = xml.replace(match[1], shapeXml);

      // Inject text color alpha into <p:txBody> run properties
      if (entry.textAlpha !== undefined) {
        const fullSpPattern = new RegExp(
          `(<p:cNvPr\\s+id="${spid}"[\\s\\S]*?</p:sp>)`,
        );
        const fullMatch = xml.match(fullSpPattern);
        if (fullMatch) {
          let fullXml = fullMatch[1];
          const txIdx = fullXml.indexOf("<p:txBody");
          if (txIdx >= 0) {
            const before = fullXml.substring(0, txIdx);
            let txPart = fullXml.substring(txIdx);
            // Replace self-closing <a:srgbClr/> with alpha child
            txPart = txPart.replace(
              /<a:srgbClr val="([A-F0-9]{6})"\/>/g,
              `<a:srgbClr val="$1"><a:alpha val="${entry.textAlpha}"/></a:srgbClr>`,
            );
            fullXml = before + txPart;
          }
          xml = xml.replace(fullMatch[1], fullXml);
        }
      }
    }
  }

  return xml;
}

// ---------------------------------------------------------------------------
// Flip transforms — inject flipH/flipV into <a:xfrm>
// ---------------------------------------------------------------------------

export interface FlipEntry {
  spid: number;
  flipH?: boolean;
  flipV?: boolean;
}

/**
 * Apply flipH/flipV attributes to <a:xfrm> elements by spid.
 * PptxGenJS doesn't support flip natively, so we inject via post-processing.
 */
export function applyFlipsToSlideXml(
  slideXml: string,
  entries: FlipEntry[],
): string {
  let xml = slideXml;
  for (const entry of entries) {
    if (!entry.flipH && !entry.flipV) continue;

    // Find <a:xfrm> associated with this spid
    const pattern = new RegExp(
      `(<p:cNvPr\\s+id="${entry.spid}"[\\s\\S]*?<a:xfrm)(\\s*[^>]*>)`,
    );
    const match = xml.match(pattern);
    if (!match) continue;

    let attrs = "";
    if (entry.flipH) attrs += ` flipH="1"`;
    if (entry.flipV) attrs += ` flipV="1"`;

    xml = xml.replace(match[0], match[1] + attrs + match[2]);
  }
  return xml;
}
