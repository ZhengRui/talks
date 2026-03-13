import { describe, expect, it } from "vitest";
import {
  buildViewerUrl,
  normalizeWorkbenchMode,
  resolveWorkbenchReference,
} from "./workbench";

describe("workbench helpers", () => {
  it("resolves deck-relative references", () => {
    expect(resolveWorkbenchReference("v9-features", "refs/slide-1.png")).toBe("/v9-features/refs/slide-1.png");
    expect(resolveWorkbenchReference("v9-features", "/shared/ref.png")).toBe("/shared/ref.png");
    expect(resolveWorkbenchReference("v9-features", "")).toBeUndefined();
  });

  it("builds a viewer URL with overlay controls", () => {
    expect(
      buildViewerUrl("", "v9-features", 2, "/v9-features/refs/slide-3.png", 0.4),
    ).toBe("/v9-features?slide=3&chrome=0&overlay=%2Fv9-features%2Frefs%2Fslide-3.png&overlayOpacity=0.4");
  });

  it("normalizes workbench mode", () => {
    expect(normalizeWorkbenchMode("overlay")).toBe("overlay");
    expect(normalizeWorkbenchMode("diff")).toBe("diff");
    expect(normalizeWorkbenchMode("wat")).toBe("render");
    expect(normalizeWorkbenchMode(undefined)).toBe("render");
  });
});
