import { describe, it, expect } from "vitest";
import { generateInstanceYaml, generateTemplateYaml } from "./yaml-gen";
import type { Proposal } from "./types";

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    scope: "slide",
    name: "test-slide",
    description: "test",
    region: { x: 0, y: 0, w: 800, h: 600 },
    params: {
      title: { type: "string", value: "Hello" },
    },
    style: {},
    body: "sourceSize: { w: 800, h: 600 }\nchildren: []",
    ...overrides,
  };
}

describe("generateInstanceYaml", () => {
  it("emits fit and align on slide-scope instance", () => {
    const yaml = generateInstanceYaml(makeProposal());
    expect(yaml).toContain("- template: test-slide");
    expect(yaml).toContain("fit: contain");
    expect(yaml).toContain("align: center");
    expect(yaml).toContain('title: "Hello"');
  });

  it("emits kind: block snippet for block-scope proposals", () => {
    const yaml = generateInstanceYaml(
      makeProposal({
        scope: "block",
        name: "stat-card",
        params: {
          value: { type: "string", value: "42%" },
          label: { type: "string", value: "Growth" },
        },
      }),
    );
    expect(yaml).toContain("kind: block");
    expect(yaml).toContain("template: stat-card");
    expect(yaml).toContain("id: stat-card-1");
    expect(yaml).toContain('value: "42%"');
    // Block snippets must NOT have fit/align
    expect(yaml).not.toContain("fit:");
    expect(yaml).not.toContain("align:");
  });
});

describe("generateTemplateYaml", () => {
  it("does not include fit or align in template output", () => {
    const yaml = generateTemplateYaml(makeProposal());
    expect(yaml).toContain("name: test-slide");
    expect(yaml).toContain("scope: slide");
  });
});
