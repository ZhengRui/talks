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

  it("reveals the canvas after initial layout measurement", () => {
    const { container } = render(
      <SlideEngine>
        <section>Content</section>
      </SlideEngine>
    );

    const canvas = container.querySelector(".slide-canvas");
    expect(canvas?.classList.contains("ready")).toBe(true);
  });

  it("applies default theme class on each slide when no slideThemes given", () => {
    const { container } = render(
      <SlideEngine theme="bold">
        <section>One</section>
        <section>Two</section>
      </SlideEngine>
    );

    const slides = container.querySelectorAll(".slide");
    expect(slides[0].classList.contains("theme-bold")).toBe(true);
    expect(slides[1].classList.contains("theme-bold")).toBe(true);
  });

  it("applies per-slide theme class when slideThemes provided", () => {
    const { container } = render(
      <SlideEngine theme="modern" slideThemes={[undefined, "elegant", "dark-tech"]}>
        <section>One</section>
        <section>Two</section>
        <section>Three</section>
      </SlideEngine>
    );

    const slides = container.querySelectorAll(".slide");
    expect(slides[0].classList.contains("theme-modern")).toBe(true);
    expect(slides[1].classList.contains("theme-elegant")).toBe(true);
    expect(slides[2].classList.contains("theme-dark-tech")).toBe(true);
  });

  it("uses the provided initial slide", () => {
    const { container } = render(
      <SlideEngine initialSlide={1}>
        <section>One</section>
        <section>Two</section>
      </SlideEngine>
    );

    const slides = container.querySelectorAll(".slide");
    expect(slides[0].classList.contains("inactive")).toBe(true);
    expect(slides[1].classList.contains("active")).toBe(true);
  });

  it("renders an overlay image for the active slide", () => {
    const { container } = render(
      <SlideEngine
        overlay={{ mode: "single", opacity: 0.4, path: "/example-v9/refs/slide-1.png" }}
      >
        <section>One</section>
      </SlideEngine>
    );

    const overlay = container.querySelector(".slide-overlay-image");
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute("src")).toBe("/example-v9/refs/slide-1.png");
    expect(overlay?.getAttribute("style")).toContain("opacity: 0.4");
  });

  it("hides chrome when showChrome is false", () => {
    const { container } = render(
      <SlideEngine showChrome={false} slug="example-v9">
        <section>One</section>
        <section>Two</section>
      </SlideEngine>
    );

    expect(container.querySelector(".slide-nav-dots")).toBeNull();
    expect(container.querySelector(".slide-progress")).toBeNull();
    expect(container.querySelector(".slide-counter")).toBeNull();
    expect(container.querySelector(".slide-export-btn")).toBeNull();
  });
});
