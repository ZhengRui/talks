import type { SidebarSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_H,
  CONTENT_X,
  CONTENT_W,
  makeSlide,
  makeAnimation,
  headingStyle,
  bodyStyle,
} from "../helpers";

export function layoutSidebar(
  slide: SidebarSlideData,
  theme: ResolvedTheme,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];
  const position = slide.sidebarPosition ?? "left";
  let contentY = 60;

  // Sidebar (30%) and main (70%) columns
  const gap = 40;
  const sidebarW = Math.round(CONTENT_W * 0.3);
  const mainW = CONTENT_W - sidebarW - gap;

  const sidebarX = position === "left" ? CONTENT_X : CONTENT_X + mainW + gap;
  const mainX = position === "left" ? CONTENT_X + sidebarW + gap : CONTENT_X;

  // Optional title (aligned with main content area)
  if (slide.title) {
    const titleH = 52;
    elements.push({
      kind: "text",
      id: "title",
      rect: { x: mainX, y: contentY, w: mainW, h: titleH },
      text: slide.title,
      style: headingStyle(theme, 48, { textAlign: "left" }),
      animation: makeAnimation("fade-up", 0),
    });
    contentY += titleH + 32;
  }

  const colH = CANVAS_H - contentY - 60;

  // Sidebar panel (with background)
  elements.push({
    kind: "group",
    id: "sidebar-panel",
    rect: { x: sidebarX, y: contentY, w: sidebarW, h: colH },
    children: [
      {
        kind: "text",
        id: "sidebar-text",
        rect: { x: 40, y: 40, w: sidebarW - 80, h: colH - 80 },
        text: slide.sidebar,
        style: bodyStyle(theme, 28),
      },
    ],
    style: {
      fill: theme.bgSecondary,
      borderRadius: theme.radius,
    },
    animation: makeAnimation(
      position === "left" ? "slide-left" : "slide-right",
      200,
    ),
  });

  // Main content
  elements.push({
    kind: "text",
    id: "main-text",
    rect: { x: mainX, y: contentY + 20, w: mainW, h: colH - 40 },
    text: slide.main,
    style: bodyStyle(theme, 30),
    animation: makeAnimation(
      position === "left" ? "slide-right" : "slide-left",
      200,
    ),
  });

  return makeSlide(theme, elements);
}
