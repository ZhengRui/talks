import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import type { AnalysisResultPayload, Proposal } from "@/components/extract/types";

export const MOCK_CLAUDE_MODEL = "mock-claude";

function truncateText(value: string, maxLength: number): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 1)}…`;
}

function buildMockSlideBody(title: string, subtitle: string): string {
  return yamlStringify({
    mode: "scene",
    background: {
      type: "solid",
      color: "#0f172a",
    },
    children: [
      {
        kind: "text",
        id: "mock-title",
        frame: { x: 112, y: 112, w: 1056, h: 120 },
        text: title,
        style: {
          fontSize: 56,
          fontWeight: 700,
          color: "#f8fafc",
        },
      },
      {
        kind: "text",
        id: "mock-subtitle",
        frame: { x: 112, y: 250, w: 1056, h: 96 },
        text: subtitle,
        style: {
          fontSize: 28,
          color: "#94a3b8",
        },
      },
      {
        kind: "text",
        id: "mock-footer",
        frame: { x: 112, y: 620, w: 1056, h: 28 },
        text: "Mock Claude response for local UI testing",
        style: {
          fontSize: 20,
          color: "#22d3ee",
        },
      },
    ],
  }).trim();
}

function cloneProposal(proposal: Proposal): Proposal {
  return {
    ...proposal,
    region: { ...proposal.region },
    params: Object.fromEntries(
      Object.entries(proposal.params).map(([key, field]) => [key, { ...field }]),
    ),
    style: Object.fromEntries(
      Object.entries(proposal.style).map(([key, field]) => [key, { ...field }]),
    ),
  };
}

export function isMockClaudeModel(model: string): boolean {
  return model === MOCK_CLAUDE_MODEL;
}

export function createMockAnalysisResult(options: {
  description?: string | null;
  slug?: string | null;
  dimensions: { w: number; h: number };
}): AnalysisResultPayload {
  const { description, slug, dimensions } = options;
  const promptText = truncateText(description ?? "", 72);
  const title = promptText || truncateText(slug ?? "", 48) || "Mock Extract";
  const subtitle = promptText
    ? "Deterministic local extract result"
    : "No Claude call was made";

  return {
    source: {
      image: "mock://claude/extract",
      dimensions,
      contentBounds: { x: 0, y: 0, w: dimensions.w, h: dimensions.h },
    },
    inventory: {
      slideBounds: { x: 0, y: 0, w: dimensions.w, h: dimensions.h },
      background: {
        summary: "Dark presentation background with cyan accent metadata.",
        base: "#0f172a",
        palette: ["#0f172a", "#f8fafc", "#94a3b8", "#22d3ee"],
        layers: [],
      },
      typography: [
        {
          id: "mock-title",
          text: title,
          bbox: { x: 112, y: 112, w: 1056, h: 120 },
          importance: "high",
          style: {
            color: "#f8fafc",
            fontSize: 56,
            fontWeight: 700,
            textAlign: "left",
          },
        },
      ],
      regions: [],
      repeatGroups: [],
      signatureVisuals: [
        {
          text: "Mock Claude response",
          importance: "medium",
        },
      ],
      mustPreserve: [],
      uncertainties: ["This is a deterministic local stub, not a model extract."],
      blockCandidates: [],
    },
    proposals: [
      {
        scope: "slide",
        name: "mock-slide",
        description: "Deterministic local extract result",
        region: { x: 0, y: 0, w: dimensions.w, h: dimensions.h },
        params: {},
        style: {},
        body: buildMockSlideBody(title, subtitle),
      },
    ],
  };
}

export function createMockRefineProposals(
  proposals: Proposal[],
  iteration: number,
): Proposal[] {
  const nextProposals = proposals.map(cloneProposal);
  const slideProposal = nextProposals.find((proposal) => proposal.scope === "slide");
  if (!slideProposal) return nextProposals;

  let parsedBody: Record<string, unknown> | null = null;
  try {
    const candidate = yamlParse(slideProposal.body);
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      parsedBody = candidate as Record<string, unknown>;
    }
  } catch {
    parsedBody = null;
  }

  const scene = parsedBody ?? yamlParse(buildMockSlideBody("Mock Refine", "Injected local stub")) as Record<string, unknown>;
  const children = Array.isArray(scene.children) ? [...scene.children] : [];
  const badgeX = Math.max(32, slideProposal.region.w - 360);
  const badgeY = Math.max(24, slideProposal.region.h - 72);
  const badgeNode = {
    kind: "text",
    id: "mock-refine-badge",
    frame: { x: badgeX, y: badgeY, w: 320, h: 28 },
    text: `Mock refine iter ${iteration}`,
    style: {
      fontSize: 22,
      fontWeight: 700,
      color: "#22d3ee",
      textAlign: "right",
    },
  };

  const withoutBadge = children.filter((child) => {
    if (!child || typeof child !== "object" || Array.isArray(child)) return true;
    return (child as Record<string, unknown>).id !== "mock-refine-badge";
  });

  slideProposal.body = yamlStringify({
    mode: "scene",
    ...scene,
    children: [...withoutBadge, badgeNode],
  }).trim();
  slideProposal.description = `Mock refine iteration ${iteration}`;

  return nextProposals;
}
