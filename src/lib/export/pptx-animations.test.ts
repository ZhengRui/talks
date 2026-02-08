import { describe, it, expect } from "vitest";
import { buildTimingXml, type AnimationEntry } from "./pptx-animations";

describe("buildTimingXml", () => {
  it("returns empty string for no animations", () => {
    expect(buildTimingXml([])).toBe("");
  });

  it("skips 'none' animation type", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "none", delay: 0, duration: 500 } },
    ];
    expect(buildTimingXml(entries)).toBe("");
  });

  it("skips 'count-up' animation type", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "count-up", delay: 0, duration: 1000 } },
    ];
    expect(buildTimingXml(entries)).toBe("");
  });

  it("generates timing XML for fade-in", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "fade-in", delay: 0, duration: 600 } },
    ];
    const xml = buildTimingXml(entries);
    expect(xml).toContain("<p:timing>");
    expect(xml).toContain("</p:timing>");
    expect(xml).toContain('spid="3"');
    expect(xml).toContain("p:animEffect");
    expect(xml).toContain('filter="fade"');
    expect(xml).toContain('transition="in"');
    // presetID=10 (Fade) for all types — won't add unwanted built-in motion
    expect(xml).toContain('presetID="10"');
    expect(xml).toContain('presetClass="entr"');
    expect(xml).toContain('grpId="0"');
    // All elements use withEffect for auto-play on slide entry
    expect(xml).toContain('nodeType="withEffect"');
    expect(xml).not.toContain("clickEffect");
  });

  it("generates timing XML for fade-up with subtle motion", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "fade-up", delay: 200, duration: 600 } },
    ];
    const xml = buildTimingXml(entries);
    expect(xml).toContain("p:animEffect");
    expect(xml).toContain("ppt_y");
    // Motion should be ~0.028 (30px/1080px)
    expect(xml).toContain("0.028");
    // Single entry: delay compressed to 0 (nothing to stagger against)
    expect(xml).toContain('delay="0"');
  });

  it("generates timing XML for slide-left with subtle motion", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "slide-left", delay: 0, duration: 500 } },
    ];
    const xml = buildTimingXml(entries);
    expect(xml).toContain("ppt_x");
    expect(xml).toContain("p:animEffect");
    expect(xml).toContain("0.031");
  });

  it("generates timing XML for slide-right", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "slide-right", delay: 0, duration: 500 } },
    ];
    const xml = buildTimingXml(entries);
    expect(xml).toContain("ppt_x");
    expect(xml).toContain("-0.031");
  });

  it("generates timing XML for scale-up with 85% start", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "scale-up", delay: 0, duration: 500 } },
    ];
    const xml = buildTimingXml(entries);
    expect(xml).toContain("p:animScale");
    expect(xml).toContain("p:animEffect");
    expect(xml).toContain('x="85000"');
    expect(xml).toContain('x="100000"');
  });

  it("groups multiple spids into one animation par", () => {
    const entries: AnimationEntry[] = [
      { spids: [3, 4, 5], animation: { type: "fade-in", delay: 0, duration: 600 } },
    ];
    const xml = buildTimingXml(entries);
    expect(xml).toContain('spid="3"');
    expect(xml).toContain('spid="4"');
    expect(xml).toContain('spid="5"');
    // 3 fade effects (one per spid), all inside one entry par
    const fadeEffects = xml.match(/<p:animEffect /g) || [];
    expect(fadeEffects.length).toBe(3);
    // Only one entry par (id=3), not three separate ones
    // With single entry, there should be exactly 3 cTn with delay:
    // auto-play container + 1 entry + 3 visibility sets
    // The entry par cTn has id="3"
    expect(xml).toContain('id="3"');
  });

  it("handles multiple animation entries with staggered delays", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "fade-in", delay: 0, duration: 600 } },
      { spids: [4], animation: { type: "fade-up", delay: 200, duration: 600 } },
    ];
    const xml = buildTimingXml(entries);
    expect(xml).toContain('spid="3"');
    expect(xml).toContain('spid="4"');
    // Two groups → step = min(200,100)/1 = 100. Relative delays: [0, 100]
    expect(xml).toContain('delay="0"');
    expect(xml).toContain('delay="100"');
    // Both entries use withEffect for auto-play
    expect(xml).toContain('nodeType="withEffect"');
  });

  it("produces sequentially incrementing cTn ids", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "fade-in", delay: 0, duration: 600 } },
    ];
    const xml = buildTimingXml(entries);
    const ids = [...xml.matchAll(/p:cTn[^>]*\bid="(\d+)"/g)].map((m) =>
      parseInt(m[1]),
    );
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    }
    expect(ids[0]).toBe(1);
  });

  it("includes visibility set for each animated shape", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "fade-in", delay: 0, duration: 600 } },
    ];
    const xml = buildTimingXml(entries);
    expect(xml).toContain("p:set");
    expect(xml).toContain('val="visible"');
  });

  it("caps duration at 200ms for snappy PPTX playback", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "fade-in", delay: 0, duration: 800 } },
    ];
    const xml = buildTimingXml(entries);
    expect(xml).toContain('dur="200"');
    expect(xml).not.toContain('dur="800"');
  });

  it("filters out skippable types from mixed entries", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "none", delay: 0, duration: 500 } },
      { spids: [4], animation: { type: "fade-in", delay: 0, duration: 600 } },
      { spids: [5], animation: { type: "count-up", delay: 0, duration: 1000 } },
    ];
    const xml = buildTimingXml(entries);
    expect(xml).toContain("<p:timing>");
    expect(xml).toContain('spid="4"');
    expect(xml).not.toContain('spid="3"');
    expect(xml).not.toContain('spid="5"');
  });

  it("uses uniform relative delays for cumulative OOXML timing", () => {
    // Simulate a busy slide like the timeline (delays 0→950ms, 8 unique groups)
    const entries: AnimationEntry[] = [];
    const delays = [0, 100, 200, 350, 500, 650, 800, 950];
    for (let i = 0; i < delays.length; i++) {
      entries.push({
        spids: [i + 3],
        animation: { type: "fade-in", delay: delays[i], duration: 600 },
      });
    }
    const xml = buildTimingXml(entries);

    // Extract all entry-par delays (on presetID cTn nodes)
    const entryDelays = [
      ...xml.matchAll(/presetID="10"[^>]*><p:stCondLst><p:cond delay="(\d+)"/g),
    ].map((m) => parseInt(m[1]));

    expect(entryDelays).toHaveLength(8);
    // First entry: delay=0
    expect(entryDelays[0]).toBe(0);
    // All subsequent entries: same uniform step (relative delays)
    // step = min(950, 100) / 7 ≈ 14
    const step = entryDelays[1];
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThanOrEqual(15);
    for (let i = 1; i < entryDelays.length; i++) {
      expect(entryDelays[i]).toBe(step);
    }
  });

  it("assigns delay=0 for entries in the same delay group", () => {
    // Two entries share delay=200, one at delay=0
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "fade-in", delay: 0, duration: 600 } },
      { spids: [4], animation: { type: "fade-in", delay: 200, duration: 600 } },
      { spids: [5], animation: { type: "fade-up", delay: 200, duration: 600 } },
    ];
    const xml = buildTimingXml(entries);

    const entryDelays = [
      ...xml.matchAll(/presetID="10"[^>]*><p:stCondLst><p:cond delay="(\d+)"/g),
    ].map((m) => parseInt(m[1]));

    expect(entryDelays).toHaveLength(3);
    // First: delay=0, second: step, third: 0 (same group as second)
    expect(entryDelays[0]).toBe(0);
    expect(entryDelays[1]).toBe(100); // step = min(200,100)/1 = 100
    expect(entryDelays[2]).toBe(0);   // same delay group
  });

  it("preserves original spacing when under 100ms cap", () => {
    const entries: AnimationEntry[] = [
      { spids: [3], animation: { type: "fade-in", delay: 0, duration: 600 } },
      { spids: [4], animation: { type: "fade-up", delay: 80, duration: 600 } },
    ];
    const xml = buildTimingXml(entries);
    // Two groups, step = min(80, 100) / 1 = 80
    // Relative delays: [0, 80]
    expect(xml).toContain('delay="0"');
    expect(xml).toContain('delay="80"');
  });
});
