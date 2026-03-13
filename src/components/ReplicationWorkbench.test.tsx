import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReplicationWorkbench from "./ReplicationWorkbench";

vi.mock("next/navigation", () => ({
  usePathname: () => "/workbench/replicate",
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

afterEach(cleanup);

describe("ReplicationWorkbench", () => {
  it("renders the current slide inside the active slide wrapper", () => {
    const { container } = render(
      <ReplicationWorkbench
        presentations={[
          { slug: "demo", title: "Demo", slideCount: 1 },
        ]}
        initialSlug="demo"
        initialSlide={0}
        initialLayout={{
          title: "Demo",
          slides: [
            {
              width: 1920,
              height: 1080,
              background: "#101820",
              elements: [
                {
                  kind: "text",
                  id: "headline",
                  rect: { x: 120, y: 120, w: 600, h: 80 },
                  text: "Workbench slide",
                  style: {
                    fontFamily: "Inter, sans-serif",
                    fontSize: 48,
                    fontWeight: 700,
                    color: "#ffffff",
                    lineHeight: 1.2,
                  },
                },
              ],
            },
          ],
          theme: "modern",
          slideThemes: ["modern"],
          slug: "demo",
        }}
      />,
    );

    expect(container.querySelector(".slide.active")).not.toBeNull();
    expect(screen.getByText("Workbench slide")).toBeTruthy();
  });
});
