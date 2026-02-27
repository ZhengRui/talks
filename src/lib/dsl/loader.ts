import fs from "fs";
import path from "path";
import { parse } from "yaml";
import type { DslTemplateDef } from "./types";

const BUILT_IN_DIR = path.join(process.cwd(), "src/lib/layout/templates");
const CONTENT_DIR = path.join(process.cwd(), "content");

// In-memory cache: Map<cacheKey, DslTemplateDef>
const cache = new Map<string, DslTemplateDef>();

/** Clear the template cache (useful for tests and dev hot-reload). */
export function clearTemplateCache(): void {
  cache.clear();
}

/**
 * Find a .template.yaml for the given template name.
 * Resolution order:
 *   1. Per-presentation: content/[slug]/templates/[name].template.yaml
 *   2. Built-in: src/lib/layout/templates/[name].template.yaml
 */
export function findTemplate(
  templateName: string,
  slug?: string,
): DslTemplateDef | null {
  const cacheKey = slug ? `${slug}/${templateName}` : templateName;

  if (process.env.NODE_ENV === "production" && cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // 1. Per-presentation override
  if (slug) {
    const perPres = path.join(
      CONTENT_DIR,
      slug,
      "templates",
      `${templateName}.template.yaml`,
    );
    if (fs.existsSync(perPres)) {
      const def = parseTemplateFile(perPres, templateName);
      if (def) {
        cache.set(cacheKey, def);
        return def;
      }
    }
  }

  // 2. Built-in
  const builtIn = path.join(BUILT_IN_DIR, `${templateName}.template.yaml`);
  if (fs.existsSync(builtIn)) {
    const def = parseTemplateFile(builtIn, templateName);
    if (def) {
      cache.set(cacheKey, def);
      return def;
    }
  }

  return null;
}

function parseTemplateFile(
  filePath: string,
  templateName: string,
): DslTemplateDef | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");

    // Extract front matter (params, style) by parsing with a dummy render
    // that strips Jinja expressions. We only need the front-matter keys.
    // Since params/style sections never contain Jinja expressions,
    // we can safely strip all {{ }} and {% %} blocks before parsing.
    const stripped = raw
      .replace(/\{%.*?%\}/g, "")
      // Replace "{{ ... }}" (quoted Jinja) with "x" to stay valid YAML
      .replace(/"(\{\{.*?\}\})"/g, '"x"')
      // Replace unquoted {{ ... }} with 0 (valid YAML scalar)
      .replace(/\{\{.*?\}\}/g, "0");

    // Allow duplicate keys — stripping {% if/else %} can leave two keys
    // (e.g., marginTop: 64 / marginTop: 24) in the same map. We only need
    // name/params/style from the front matter, so duplicates are harmless.
    const parsed = parse(stripped, { uniqueKeys: false });

    return {
      name: parsed.name ?? templateName,
      params: parsed.params ?? {},
      style: parsed.style,
      rawBody: raw,
    };
  } catch (e) {
    console.warn(`[dsl] Failed to parse template: ${filePath}`, e);
    return null;
  }
}
