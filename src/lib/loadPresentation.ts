import fs from "fs";
import path from "path";
import { parse } from "yaml";
import type { PresentationData, PresentationSummary } from "./types";
import { findTemplate } from "./dsl/loader";
import { expandDslTemplate } from "./dsl/engine";
import { expandBlockNodes } from "./dsl/block-expand";
import type { SceneSlideData } from "./scene/types";

const CONTENT_DIR = path.join(process.cwd(), "content");

export function loadPresentation(slug: string): PresentationData {
  const filePath = path.join(CONTENT_DIR, slug, "slides.yaml");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = parse(raw) as { title: string; author?: string; theme?: string; slides: Record<string, unknown>[] };

  // Expand DSL templates into scene slides before returning
  const slides = data.slides.map((slide) => {
    const expanded = expandSlideIfDsl(slide, slug);
    if ((expanded as Record<string, unknown>).mode === "scene") {
      return expandBlockNodes(
        expanded as unknown as SceneSlideData,
        slug,
      ) as unknown as Record<string, unknown>;
    }
    return expanded;
  });

  return { ...data, slides } as unknown as PresentationData;
}

function expandSlideIfDsl(
  slide: Record<string, unknown>,
  slug: string,
): Record<string, unknown> {
  const template = slide.template as string;
  if (!template) return slide;

  // Check for DSL template
  const def = findTemplate(template, slug);
  if (!def) return slide;

  return expandDslTemplate(slide, def) as unknown as Record<string, unknown>;
}

export function discoverPresentations(): PresentationSummary[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];

  return fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isDirectory()) return false;
      return fs.existsSync(path.join(CONTENT_DIR, entry.name, "slides.yaml"));
    })
    .map((entry) => {
      const data = loadPresentation(entry.name);
      return {
        slug: entry.name,
        title: data.title,
        author: data.author,
        slideCount: data.slides.length,
      };
    });
}

export function getAllSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];

  return fs
    .readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isDirectory()) return false;
      return fs.existsSync(path.join(CONTENT_DIR, entry.name, "slides.yaml"));
    })
    .map((entry) => entry.name);
}
