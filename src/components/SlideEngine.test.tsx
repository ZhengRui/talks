import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import SlideEngine from "./SlideEngine";

afterEach(cleanup);

describe("SlideEngine", () => {
  it("renders all slides", () => {
    const { container } = render(
      <SlideEngine>
        <section>Alpha</section>
        <section>Beta</section>
        <section>Gamma</section>
      </SlideEngine>
    );

    const slides = container.querySelectorAll(".slide");
    expect(slides).toHaveLength(3);
  });

  it("marks first slide as active by default", () => {
    const { container } = render(
      <SlideEngine>
        <section>First</section>
        <section>Second</section>
      </SlideEngine>
    );

    const slides = container.querySelectorAll(".slide");
    expect(slides[0].classList.contains("active")).toBe(true);
    expect(slides[1].classList.contains("inactive")).toBe(true);
  });

  it("applies theme-modern class by default", () => {
    const { container } = render(
      <SlideEngine>
        <section>Content</section>
      </SlideEngine>
    );

    const engine = container.querySelector(".slide-engine");
    expect(engine?.classList.contains("theme-modern")).toBe(true);
  });

  it("applies custom theme class", () => {
    const { container } = render(
      <SlideEngine theme="dark-tech">
        <section>Content</section>
      </SlideEngine>
    );

    const engine = container.querySelector(".slide-engine");
    expect(engine?.classList.contains("theme-dark-tech")).toBe(true);
  });

  it("renders progress bar", () => {
    const { container } = render(
      <SlideEngine>
        <section>One</section>
        <section>Two</section>
      </SlideEngine>
    );

    const progressBar = container.querySelector(".slide-progress-bar");
    expect(progressBar).not.toBeNull();
    expect(progressBar?.getAttribute("style")).toContain("width");
  });

  it("renders slide canvas with correct dimensions", () => {
    const { container } = render(
      <SlideEngine>
        <section>Content</section>
      </SlideEngine>
    );

    const canvas = container.querySelector(".slide-canvas");
    expect(canvas).not.toBeNull();
  });
});
