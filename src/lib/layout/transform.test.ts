import { describe, it, expect } from "vitest";
import { transformToCSS } from "./transform";

describe("transformToCSS", () => {
  it("returns empty object when transform is undefined", () => {
    expect(transformToCSS(undefined)).toEqual({});
  });

  it("returns empty object when transform has no properties", () => {
    expect(transformToCSS({})).toEqual({});
  });

  it("converts rotation to CSS transform", () => {
    const result = transformToCSS({ rotate: 45 });
    expect(result.transform).toBe("rotate(45deg)");
  });

  it("converts negative rotation", () => {
    const result = transformToCSS({ rotate: -15 });
    expect(result.transform).toBe("rotate(-15deg)");
  });

  it("converts scale", () => {
    const result = transformToCSS({ scaleX: 1.5, scaleY: 0.8 });
    expect(result.transform).toBe("scale(1.5, 0.8)");
  });

  it("converts flipH to scaleX(-1)", () => {
    const result = transformToCSS({ flipH: true });
    expect(result.transform).toBe("scaleX(-1)");
  });

  it("converts flipV to scaleY(-1)", () => {
    const result = transformToCSS({ flipV: true });
    expect(result.transform).toBe("scaleY(-1)");
  });

  it("combines rotation and flip", () => {
    const result = transformToCSS({ rotate: 45, flipH: true });
    expect(result.transform).toBe("rotate(45deg) scaleX(-1)");
  });

  it("combines rotation, scale and flip", () => {
    const result = transformToCSS({ rotate: 90, scaleX: 2, scaleY: 0.5, flipH: true });
    expect(result.transform).toBe("rotate(90deg) scale(-2, 0.5)");
  });

  it("ignores default scale values (1.0)", () => {
    expect(transformToCSS({ scaleX: 1, scaleY: 1 })).toEqual({});
  });

  it("handles scaleX only (no scaleY)", () => {
    const result = transformToCSS({ scaleX: 2 });
    expect(result.transform).toBe("scale(2, 1)");
  });

  it("handles zero rotation", () => {
    expect(transformToCSS({ rotate: 0 })).toEqual({});
  });
});
