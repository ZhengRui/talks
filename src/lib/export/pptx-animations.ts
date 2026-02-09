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

/** Tracks a shape's participation in the build list for auto-hiding. */
interface BuildEntry {
  spid: number;
  grpId: number;
}

/**
 * Build OOXML `<p:timing>` XML for a slide's animations.
 * All animations use nodeType="withEffect" so they auto-play on slide entry
 * without requiring clicks. Uses presetID=10 (Fade) as the base preset
 * for all types — custom <p:anim> elements add subtle motion on top.
 * Delays are compressed to equal spacing (max 500ms) for snappy playback.
 *
 * Includes `<p:bldLst>` with one `<p:bldP>` per animated shape so that
 * presentation apps auto-hide each shape before its entrance animation.
 * Each shape gets a unique `grpId` matching its entry-par — without this,
 * apps only auto-hide the first shape in a group (backing shapes animate
 * but foreground shapes like text remain visible from the start).
 *
 * Returns empty string if no animatable entries exist.
 */
export function buildTimingXml(entries: AnimationEntry[]): string {
  const animatable = entries.filter((e) => !SKIPPABLE.has(e.animation.type));
  if (animatable.length === 0) return "";

  const compressed = compressForPptx(animatable);

  let nextId = 1;
  const id = () => nextId++;

  let nextGrpId = 0;
  const grpId = () => nextGrpId++;

  const id1 = id(); // tmRoot
  const id2 = id(); // mainSeq
  const id3 = id(); // click-group
  const id4 = id(); // inner wrapper (WPS requires this extra par layer)

  // Build one animation par per spid (not per entry).
  // Standard PowerPoint XML gives each shape its own <p:par> with presetClass="entr".
  // Apps use this to auto-hide each shape before its entrance animation.
  // Putting multiple spids in one <p:par> causes some apps to only hide the first.
  const elementPars: string[] = [];
  const buildEntries: BuildEntry[] = [];
  for (const entry of compressed) {
    const result = buildEntryPars(entry, id, grpId);
    elementPars.push(...result.pars);
    buildEntries.push(...result.builds);
  }

  // <p:bldLst> tells the app which shapes participate in entrance animations
  // and should be auto-hidden before their animation plays.
  const bldLst = `<p:bldLst>${buildEntries.map((e) => `<p:bldP spid="${e.spid}" grpId="${e.grpId}"/>`).join("")}</p:bldLst>`;

  // Structure matches WPS-generated XML: click-group → wrapper-par → entry-pars.
  // WPS requires the extra wrapper <p:par> between click-group and entry-pars.
  return `<p:timing><p:tnLst><p:par><p:cTn id="${id1}" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="${id2}" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="${id3}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${id4}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${elementPars.join("")}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>${bldLst}</p:timing>`;
}

/**
 * Build one `<p:par>` per spid in an AnimationEntry.
 *
 * Each shape needs its own par with a unique grpId so that `<p:bldLst>`
 * auto-hiding works for all shapes (shared grpId only hides the first).
 *
 * For multi-shape entries (groups using the backing-shape technique):
 * - Pars are emitted in REVERSE order (foreground first, backing last).
 *   Apps process pars sequentially — if the backing par triggers first,
 *   the accent color is briefly visible before the foreground covers it.
 *   Reversing ensures the opaque foreground appears first, so the backing
 *   is never visible to the user.
 * - Fade is skipped — overlapping shapes cause color blending when they
 *   fade independently. Motion (slide-up) is still applied to all shapes.
 *
 * For single-shape entries: full animation (fade + motion).
 *
 * Uses presetID=10 (Fade) as the base preset for all types.
 * Uses nodeType="withEffect" so everything auto-plays on slide entry.
 */
function buildEntryPars(
  entry: AnimationEntry,
  id: () => number,
  grpId: () => number,
): { pars: string[]; builds: BuildEntry[] } {
  const { animation, spids } = entry;
  const pars: string[] = [];
  const builds: BuildEntry[] = [];
  const isMultiShape = spids.length > 1;

  // Reverse for multi-shape: foreground (text, inset) first, backing last.
  const ordered = isMultiShape ? [...spids].reverse() : spids;

  for (let i = 0; i < ordered.length; i++) {
    const spid = ordered[i];
    const parId = id();
    const gid = grpId();
    const delay = i === 0 ? animation.delay : 0;
    const children: string[] = [];
    children.push(buildVisibilitySet(spid, id));
    children.push(...buildBehaviorList(spid, animation, id, !isMultiShape));
    pars.push(`<p:par><p:cTn id="${parId}" fill="hold" grpId="${gid}" presetID="10" presetClass="entr" presetSubtype="0" nodeType="withEffect"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst>${children.join("")}</p:childTnLst></p:cTn></p:par>`);
    builds.push({ spid, grpId: gid });
  }

  return { pars, builds };
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
 *
 * When `includeFade` is false, only motion/scale behaviors are returned
 * (no opacity transition). Used for foreground shapes in multi-shape groups
 * to prevent color blending flash during simultaneous independent fades.
 */
function buildBehaviorList(
  spid: number,
  anim: AnimationDef,
  id: () => number,
  includeFade: boolean,
): string[] {
  const fade = includeFade ? [buildFade(spid, anim, id)] : [];
  switch (anim.type) {
    case "fade-in":
      return fade;
    case "fade-up":
      return [...fade, buildPositionY(spid, anim, id, 0.028)];
    case "slide-left":
      return [...fade, buildPositionX(spid, anim, id, 0.031)];
    case "slide-right":
      return [...fade, buildPositionX(spid, anim, id, -0.031)];
    case "scale-up":
      return [...fade, buildScale(spid, anim, id)];
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
