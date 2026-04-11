import { describe, expect, it } from "vitest";
import { extractJsonPayload } from "./json-payload";

describe("extractJsonPayload", () => {
  it("returns fenced json blocks", () => {
    expect(extractJsonPayload("Before\n```json\n{\"ok\":true}\n```\nAfter")).toBe("{\"ok\":true}");
  });

  it("extracts the first complete object before trailing prose", () => {
    expect(extractJsonPayload("{\"ok\":true}\nDone.")).toBe("{\"ok\":true}");
  });

  it("does not return trailing prose that also ends with a brace", () => {
    expect(extractJsonPayload("{\"ok\":true}\nExplanation with trailing brace: {note}")).toBe("{\"ok\":true}");
  });

  it("extracts the first complete object when strings contain braces", () => {
    expect(
      extractJsonPayload("Result: {\"message\":\"keep {these} braces\",\"items\":[1,2,3]} trailing"),
    ).toBe("{\"message\":\"keep {these} braces\",\"items\":[1,2,3]}");
  });

  it("returns null when no json-like payload exists", () => {
    expect(extractJsonPayload("No structured payload")).toBeNull();
  });
});
