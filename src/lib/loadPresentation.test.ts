import { describe, it, expect } from "vitest";
import { getAllSlugs } from "./loadPresentation";

describe("loadPresentation", () => {
  it("getAllSlugs returns an array", () => {
    const slugs = getAllSlugs();
    expect(Array.isArray(slugs)).toBe(true);
  });
});
