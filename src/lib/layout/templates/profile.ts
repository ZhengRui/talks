import type { ProfileSlideData } from "@/lib/types";
import type { LayoutSlide, LayoutElement, ResolvedTheme } from "../types";
import {
  CANVAS_W,
  CANVAS_H,
  makeSlide,
  makeAnimation,
  headingStyle,
  mutedStyle,
  estimateTextHeight,
} from "../helpers";

export function layoutProfile(
  slide: ProfileSlideData,
  theme: ResolvedTheme,
  imageBase: string,
): LayoutSlide {
  const elements: LayoutElement[] = [];

  // Center everything vertically
  const avatarSize = 200;
  const nameH = 56;
  const titleH = slide.title ? 40 : 0;
  const accentH = 4;
  const bioMaxW = 700;
  const bioH = slide.bio ? estimateTextHeight(slide.bio, 26, 1.5, bioMaxW) : 0;
  const gap = 16;

  const totalH =
    (slide.image ? avatarSize + gap : 0) +
    nameH + gap +
    (titleH > 0 ? titleH + gap : 0) +
    accentH + gap +
    (bioH > 0 ? bioH : 0);

  let y = (CANVAS_H - totalH) / 2;

  // Avatar (circular)
  if (slide.image) {
    elements.push({
      kind: "image",
      id: "avatar",
      rect: {
        x: (CANVAS_W - avatarSize) / 2,
        y,
        w: avatarSize,
        h: avatarSize,
      },
      src: `${imageBase}/${slide.image}`,
      objectFit: "cover",
      clipCircle: true,
      animation: makeAnimation("scale-up", 0),
    });
    y += avatarSize + gap;
  }

  // Name
  elements.push({
    kind: "text",
    id: "name",
    rect: { x: (CANVAS_W - 1200) / 2, y, w: 1200, h: nameH },
    text: slide.name,
    style: headingStyle(theme, 48, { textAlign: "center" }),
    animation: makeAnimation("fade-up", 200),
  });
  y += nameH + gap;

  // Title / role (accent color)
  if (slide.title) {
    elements.push({
      kind: "text",
      id: "title",
      rect: { x: (CANVAS_W - 1000) / 2, y, w: 1000, h: titleH },
      text: slide.title,
      style: {
        fontFamily: theme.fontBody,
        fontSize: 32,
        fontWeight: 400,
        color: theme.accent,
        lineHeight: 1.3,
        textAlign: "center",
      },
      animation: makeAnimation("fade-up", 300),
    });
    y += titleH + gap;
  }

  // Accent line
  const accentW = 80;
  elements.push({
    kind: "shape",
    id: "accent-line",
    rect: { x: (CANVAS_W - accentW) / 2, y, w: accentW, h: accentH },
    shape: "rect",
    style: { gradient: theme.accentGradient, borderRadius: 2 },
    animation: makeAnimation("fade-up", 350),
  });
  y += accentH + gap;

  // Bio (muted, centered)
  if (slide.bio) {
    elements.push({
      kind: "text",
      id: "bio",
      rect: { x: (CANVAS_W - bioMaxW) / 2, y, w: bioMaxW, h: bioH },
      text: slide.bio,
      style: mutedStyle(theme, 26, { textAlign: "center", lineHeight: 1.5 }),
      animation: makeAnimation("fade-up", 400),
    });
  }

  return makeSlide(theme, elements);
}
