import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useExtractStore } from "./store";

// Mock react-markdown to avoid ESM issues in vitest/jsdom
vi.mock("react-markdown", () => ({
  default: ({ children }: { children?: string }) => <span>{children}</span>,
}));
vi.mock("remark-gfm", () => ({ default: () => {} }));

// Dynamically import after mocks are set up
const { default: YamlModal } = await import("./YamlModal");

afterEach(cleanup);

/** Seed a card into the store with a completed analysis. */
function seedCard() {
  const store = useExtractStore.store();
  const state = store.getState();
  const id = state.addCard(new File(["x"], "slide.png", { type: "image/png" }));
  store.getState().completeAnalysis(id, {
    source: {
      image: "data:image/png;base64,abc",
      dimensions: { w: 1920, h: 1080 },
    },
    proposals: [
      {
        scope: "slide",
        name: "hero-banner",
        description: "A hero banner slide",
        region: { x: 0, y: 0, w: 1920, h: 1080 },
        params: {
          title: { type: "string", value: "Hello World" },
        },
        style: {
          bg: { type: "color", value: "#101820" },
        },
        body: "children:\n  - kind: text\n    text: {{ title }}",
      },
    ],
  });
  return id;
}

describe("YamlModal", () => {
  it("renders template and instance YAML columns", () => {
    const id = seedCard();
    useExtractStore.store().getState().openYamlModal(id, 0);

    render(<YamlModal />);

    // Template column
    expect(screen.getByText("Template YAML")).toBeTruthy();
    // Instance column
    expect(screen.getByText("Instance YAML")).toBeTruthy();

    // Content from YAML generation should be present
    const pres = document.querySelectorAll("pre");
    expect(pres.length).toBeGreaterThanOrEqual(2);

    // Template YAML should contain the proposal name
    const templatePre = pres[0];
    expect(templatePre.textContent).toContain("hero-banner");
    expect(templatePre.textContent).toContain("scope: slide");

    // Instance YAML should contain template reference
    const instancePre = pres[1];
    expect(instancePre.textContent).toContain("template: hero-banner");
    expect(instancePre.textContent).toContain("Hello World");
  });

  it("closes on backdrop click", () => {
    const id = seedCard();
    useExtractStore.store().getState().openYamlModal(id, 0);

    render(<YamlModal />);

    // Modal should be visible
    expect(screen.getByText("Template YAML")).toBeTruthy();

    // Click backdrop
    const backdrop = document.querySelector('[data-testid="yaml-modal-backdrop"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    // Modal should close — the store state should be updated
    const state = useExtractStore.store().getState();
    expect(state.yamlModal.open).toBe(false);
  });

  it("returns null when not open", () => {
    const { container } = render(<YamlModal />);
    expect(container.innerHTML).toBe("");
  });
});
