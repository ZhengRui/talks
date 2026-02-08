// OOXML timing XML builder for PPTX animation post-processing.
// Generates <p:timing> elements that auto-play on slide entry.

import type { AnimationDef, AnimationType } from "@/lib/layout/types";

export interface AnimationEntry {
  spids: number[];
  animation: AnimationDef;
}

const SKIPPABLE: Set<AnimationType> = new Set(["none", "count-up"]);

/** Maximum total stagger delay for PPTX animations (ms). */
const MAX_PPTX_DELAY = 100;

/** Maximum individual animation duration for PPTX (ms). */
const MAX_PPTX_DURATION = 200;

/**
 * Compress animation delays for PPTX export.
 *
 * OOXML `nodeType="withEffect"` delays are cumulative — each entry's delay
 * is relative to the PREVIOUS sibling's start, not the parent container.
 * So we use uniform RELATIVE delays: constant step S between delay groups,
 * delay=0 within the same group. With cumulative interpretation this gives
 * actual start times of 0, S, 2S, 3S, ... — perfectly equal spacing.
 *
 * NOTE: WPS Office appears to interpret these delays as absolute (from the
 * slide trigger), causing all items to appear nearly simultaneously with our
 * small relative delays. This is a known WPS deviation from the OOXML spec
 * and PowerPoint/Keynote behavior. We prioritize spec-correct behavior.
 *
 * Entries are sorted by original delay to ensure correct stagger order.
 * Duration is capped to keep individual animations snappy.
 */
function compressForPptx(entries: AnimationEntry[]): AnimationEntry[] {
  // Sort by original delay (stable sort preserves element order within groups)
  const sorted = [...entries].sort((a, b) => a.animation.delay - b.animation.delay);

  const uniqueDelays = [...new Set(sorted.map((e) => e.animation.delay))].sort(
    (a, b) => a - b,
  );
  const numGroups = uniqueDelays.length;
  const step =
    numGroups <= 1
      ? 0
      : Math.round(
          Math.min(uniqueDelays[uniqueDelays.length - 1], MAX_PPTX_DELAY) /
            (numGroups - 1),
        );

  // Map original delay → group index for quick lookup
  const groupOf = new Map<number, number>();
  for (let i = 0; i < uniqueDelays.length; i++) {
    groupOf.set(uniqueDelays[i], i);
  }

  // Assign relative delays: step for first entry of each new group, 0 otherwise
  let prevGroup = -1;
  return sorted.map((e) => {
    const group = groupOf.get(e.animation.delay) ?? 0;
    const relDelay = group === prevGroup ? 0 : prevGroup === -1 ? 0 : step;
    prevGroup = group;
    return {
      ...e,
      animation: {
        ...e.animation,
        delay: relDelay,
        duration: Math.min(e.animation.duration, MAX_PPTX_DURATION),
      },
    };
  });
}

/**
 * Build OOXML `<p:timing>` XML for a slide's animations.
 * All animations use nodeType="withEffect" so they auto-play on slide entry
 * without requiring clicks. Uses presetID=10 (Fade) as the base preset
 * for all types — custom <p:anim> elements add subtle motion on top.
 * Delays are compressed to equal spacing (max 500ms) for snappy playback.
 * Returns empty string if no animatable entries exist.
 */
export function buildTimingXml(entries: AnimationEntry[]): string {
  const animatable = entries.filter((e) => !SKIPPABLE.has(e.animation.type));
  if (animatable.length === 0) return "";

  const compressed = compressForPptx(animatable);

  let nextId = 1;
  const id = () => nextId++;

  const id1 = id(); // tmRoot
  const id2 = id(); // mainSeq
  const id3 = id(); // click-group
  const id4 = id(); // inner wrapper (WPS requires this extra par layer)

  // Build one animation par per AnimationEntry (not per spid).
  const elementPars: string[] = [];
  for (const entry of compressed) {
    elementPars.push(buildEntryPar(entry, id));
  }

  // Structure matches WPS-generated XML: click-group → wrapper-par → entry-pars.
  // WPS requires the extra wrapper <p:par> between click-group and entry-pars.
  return `<p:timing><p:tnLst><p:par><p:cTn id="${id1}" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="${id2}" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="${id3}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${id4}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${elementPars.join("")}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`;
}

/**
 * Build one `<p:par>` for an entire AnimationEntry.
 * All spids in the entry animate together inside one container.
 * Uses presetID=10 (Fade) for all types — Keynote needs a preset to
 * recognize the animation, and Fade won't add unwanted built-in motion.
 *
 * Uses nodeType="withEffect" so everything auto-plays on slide entry.
 * grpId="0" matches the standard PowerPoint pattern.
 */
function buildEntryPar(
  entry: AnimationEntry,
  id: () => number,
): string {
  const parId = id();
  const { animation, spids } = entry;

  // Build visibility sets + behaviors for ALL spids in this entry
  const children: string[] = [];
  for (const spid of spids) {
    children.push(buildVisibilitySet(spid, id));
  }
  for (const spid of spids) {
    children.push(...buildBehaviorList(spid, animation, id));
  }

  return `<p:par><p:cTn id="${parId}" fill="hold" grpId="0" presetID="10" presetClass="entr" presetSubtype="0" nodeType="withEffect"><p:stCondLst><p:cond delay="${animation.delay}"/></p:stCondLst><p:childTnLst>${children.join("")}</p:childTnLst></p:cTn></p:par>`;
}

function buildVisibilitySet(spid: number, id: () => number): string {
  const setId = id();
  return `<p:set><p:cBhvr><p:cTn id="${setId}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`;
}

/**
 * Build animation behavior elements for one spid.
 * Motion values match the CSS keyframes in animations.css:
 *   fade-up:     translateY(30px)  → 30/1080 ≈ 0.028
 *   slide-left:  translateX(-60px) → 60/1920 ≈ 0.031
 *   slide-right: translateX(60px)  → 60/1920 ≈ 0.031
 *   scale-up:    scale(0.85→1)     → 85000→100000 EMU
 */
function buildBehaviorList(
  spid: number,
  anim: AnimationDef,
  id: () => number,
): string[] {
  switch (anim.type) {
    case "fade-in":
      return [buildFade(spid, anim, id)];
    case "fade-up":
      return [buildFade(spid, anim, id), buildPositionY(spid, anim, id, 0.028)];
    case "slide-left":
      return [buildFade(spid, anim, id), buildPositionX(spid, anim, id, 0.031)];
    case "slide-right":
      return [buildFade(spid, anim, id), buildPositionX(spid, anim, id, -0.031)];
    case "scale-up":
      return [buildFade(spid, anim, id), buildScale(spid, anim, id)];
    default:
      return [];
  }
}

function buildFade(
  spid: number,
  anim: AnimationDef,
  id: () => number,
): string {
  const effectId = id();
  return `<p:animEffect filter="fade" transition="in"><p:cBhvr><p:cTn id="${effectId}" dur="${anim.duration}" fill="hold"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect>`;
}

function buildPositionY(
  spid: number,
  anim: AnimationDef,
  id: () => number,
  offset: number,
): string {
  const animId = id();
  return `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${animId}" dur="${anim.duration}" fill="hold"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:fltVal val="#ppt_y+${offset}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:fltVal val="#ppt_y"/></p:val></p:tav></p:tavLst></p:anim>`;
}

function buildPositionX(
  spid: number,
  anim: AnimationDef,
  id: () => number,
  offset: number,
): string {
  const animId = id();
  return `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${animId}" dur="${anim.duration}" fill="hold"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>ppt_x</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:fltVal val="#ppt_x+${offset}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:fltVal val="#ppt_x"/></p:val></p:tav></p:tavLst></p:anim>`;
}

function buildScale(
  spid: number,
  anim: AnimationDef,
  id: () => number,
): string {
  const scaleId = id();
  return `<p:animScale><p:cBhvr><p:cTn id="${scaleId}" dur="${anim.duration}" fill="hold"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr><p:by x="100000" y="100000"/><p:from x="85000" y="85000"/><p:to x="100000" y="100000"/></p:animScale>`;
}
