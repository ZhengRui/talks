/* @vitest-environment node */

import { beforeEach, describe, expect, it } from "vitest";
import {
  getRefineArtifact,
  putRefineArtifact,
  sweepRefineArtifacts,
} from "./refine-artifacts";

describe("refine artifact store", () => {
  beforeEach(() => {
    sweepRefineArtifacts(0);
  });

  it("stores and retrieves an artifact", () => {
    const buf = Buffer.from("test-png-data");
    const id = putRefineArtifact({
      buffer: buf,
      contentType: "image/png",
      createdAt: Date.now(),
    });

    const artifact = getRefineArtifact(id);
    expect(artifact).not.toBeNull();
    expect(artifact!.buffer.toString()).toBe("test-png-data");
  });

  it("returns null for unknown ID", () => {
    expect(getRefineArtifact("nonexistent")).toBeNull();
  });

  it("expires artifacts after TTL", () => {
    const id = putRefineArtifact({
      buffer: Buffer.from("old"),
      contentType: "image/png",
      createdAt: Date.now() - 20 * 60 * 1000,
    });

    expect(getRefineArtifact(id)).toBeNull();
  });
});
