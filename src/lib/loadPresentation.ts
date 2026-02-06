import fs from "fs";
import path from "path";
import { parse } from "yaml";
import type { PresentationData, PresentationSummary } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content");

export function loadPresentation(slug: string): PresentationData {
  const filePath = path.join(CONTENT_DIR, slug, "slides.yaml");
  const raw = fs.readFileSync(filePath, "utf-8");
  return parse(raw) as PresentationData;
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
