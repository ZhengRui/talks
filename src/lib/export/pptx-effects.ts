// OOXML effects post-processor for PPTX export.
// Injects <a:effectLst> (glow, softEdge, blur) and <a:pattFill> into shape XML
// after PptxGenJS generates the file.

import type { ElementEffects, PatternFillDef } from "@/lib/layout/types";
import { hexColor } from "./pptx-helpers";

/** Entry mapping PptxGenJS shape indices to their effects. */
export interface EffectsEntry {
  spids: number[];
  effects?: ElementEffects;
  patternFill?: PatternFillDef;
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
 * Apply effects to a slide XML string.
 * Finds <p:sp> elements by spid and injects effectLst / replaces solidFill.
 */
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

      xml = xml.replace(match[1], shapeXml);
    }
  }

  return xml;
}
