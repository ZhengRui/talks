import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { createExtractStore } from "./store";
import type { StoreApi } from "zustand/vanilla";
import type { ExtractState } from "./store";

let testStore: StoreApi<ExtractState>;

vi.mock("./store", async () => {
  const actual =
    await vi.importActual<typeof import("./store")>("./store");
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useExtractStore: (selector?: any) => {
      const state = testStore.getState();
      return selector ? selector(state) : state;
    },
  };
});

import SlideCard from "./SlideCard";

function makeFile(name = "slide.png"): File {
  return new File(["fake"], name, { type: "image/png" });
}

describe("SlideCard", () => {
  let cardId: string;

  beforeEach(() => {
    testStore = createExtractStore();
    cardId = testStore.getState().addCard(makeFile("test-slide.png"));
  });

  afterEach(cleanup);

  it("renders at the correct position from store", () => {
    const { container } = render(<SlideCard cardId={cardId} />);
    const el = container.querySelector(
      `[data-testid="slide-card-${cardId}"]`,
    ) as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.left).toBe("40px");
    expect(el.style.top).toBe("40px");
    expect(el.style.width).toBe("480px");
  });

  it("click on image card selects the card", () => {
    const { container } = render(<SlideCard cardId={cardId} />);
    const imageCard = container.querySelector(".group") as HTMLElement;
    fireEvent.click(imageCard);
    expect(testStore.getState().selectedCardId).toBe(cardId);
  });

  it("shows an image element", () => {
    const { container } = render(<SlideCard cardId={cardId} />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBeTruthy();
  });

  it("shows slide label above the card", () => {
    const { container } = render(<SlideCard cardId={cardId} />);
    expect(container.textContent).toMatch(/Slide #[a-z0-9]{3}/);
  });

  it("has delete button when selected", () => {
    testStore.getState().selectCard(cardId);
    const { container } = render(<SlideCard cardId={cardId} />);
    const deleteBtn = container.querySelector("[title='Remove slide']") as HTMLElement;
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn);
    expect(testStore.getState().cards.has(cardId)).toBe(false);
  });
});
