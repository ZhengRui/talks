/**
 * Server-only BlockExpansionRuntime factory.
 * Isolates FileSystemLoader / nunjucks-env imports from general callers.
 */

import { findTemplate } from "./loader";
import { createTemplateEnvironment } from "./nunjucks-env";
import type { BlockExpansionRuntime } from "./block-expand";

export function createServerRuntime(slug?: string): BlockExpansionRuntime {
  return {
    resolveTemplate: (name) => findTemplate(name, slug) ?? null,
    createEnvironment: (def) => createTemplateEnvironment(def),
    sourceLabel: slug,
  };
}
