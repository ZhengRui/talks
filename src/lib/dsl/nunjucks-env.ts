import nunjucks from "nunjucks";
import path from "path";
import type { DslTemplateDef } from "./types";
import { configureEnvironment } from "./nunjucks-filters";

// Re-export client-safe utilities so existing server-side callers don't break.
export { smartify } from "./nunjucks-filters";

// --- Shared constants ---

const BUILT_IN_TEMPLATE_DIR = path.join(process.cwd(), "src/lib/layout/templates");
const BUILT_IN_MACRO_DIR = path.join(process.cwd(), "src/lib/dsl/macros");

/**
 * Create a fully configured Nunjucks environment for a DSL template.
 * Sets up file system loaders, filters, and options.
 * Server-only — uses FileSystemLoader.
 */
export function createTemplateEnvironment(templateDef: DslTemplateDef): nunjucks.Environment {
  const searchPaths = Array.from(new Set([
    ...(templateDef.sourcePath ? [path.dirname(templateDef.sourcePath)] : []),
    BUILT_IN_MACRO_DIR,
    BUILT_IN_TEMPLATE_DIR,
  ]));

  const loader = new nunjucks.FileSystemLoader(searchPaths, {
    noCache: process.env.NODE_ENV !== "production",
  });

  return configureEnvironment(new nunjucks.Environment(loader, {
    trimBlocks: true,
    lstripBlocks: true,
    autoescape: false,
  }));
}
