import { describe, expect, it } from "vitest";
import {
  clampOverlayOpacity,
  parseInitialSlide,
  resolveOverlayConfig,
  resolveOverlayPath,
  resolvePublicOverlayPath,
  shouldShowChrome,
} from "./overlay";

describe("overlay helpers", () => {
  it("parses initial slide as 1-based query param", () => {
    expect(parseInitialSlide("1")).toBe(0);
    expect(parseInitialSlide("3")).toBe(2);
    expect(parseInitialSlide(undefined)).toBe(0);
    expect(parseInitialSlide("0")).toBe(0);
    expect(parseInitialSlide("nope")).toBe(0);
  });

  it("clamps overlay opacity", () => {
    expect(clampOverlayOpacity("0.3")).toBe(0.3);
    expect(clampOverlayOpacity("2")).toBe(1);
    expect(clampOverlayOpacity("-1")).toBe(0);
    expect(clampOverlayOpacity(undefined, 0.4)).toBe(0.4);
  });

  it("resolves relative overlay paths against the deck slug", () => {
    expect(resolvePublicOverlayPath("example-v9", "refs/slide-1.png")).toBe("/example-v9/refs/slide-1.png");
    expect(resolvePublicOverlayPath("example-v9", "/shared/slide-1.png")).toBe("/shared/slide-1.png");
    expect(resolvePublicOverlayPath("example-v9", "https://example.com/a.png")).toBe("https://example.com/a.png");
  });

  it("creates a single-image overlay config", () => {
    const overlay = resolveOverlayConfig("example-v9", {
      overlay: "refs/slide-1.png",
      overlayOpacity: "0.25",
    });

    expect(overlay).toEqual({
      mode: "single",
      opacity: 0.25,
      path: "/example-v9/refs/slide-1.png",
    });
    expect(resolveOverlayPath(overlay, 4)).toBe("/example-v9/refs/slide-1.png");
  });

  it("creates a sequence overlay config with slide pattern expansion", () => {
    const overlay = resolveOverlayConfig("five-dynasties-v9", {
      overlayDir: "refs",
      overlayPattern: "slide-{n}.png",
      overlayOpacity: "0.6",
    });

    expect(overlay).toEqual({
      mode: "sequence",
      opacity: 0.6,
      basePath: "/five-dynasties-v9/refs",
      pattern: "slide-{n}.png",
    });
    expect(resolveOverlayPath(overlay, 0)).toBe("/five-dynasties-v9/refs/slide-1.png");
    expect(resolveOverlayPath(overlay, 3)).toBe("/five-dynasties-v9/refs/slide-4.png");
  });

  it("hides chrome only for explicit falsey query values", () => {
    expect(shouldShowChrome(undefined)).toBe(true);
    expect(shouldShowChrome("1")).toBe(true);
    expect(shouldShowChrome("0")).toBe(false);
    expect(shouldShowChrome("false")).toBe(false);
  });
});
