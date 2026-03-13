import nunjucks from "nunjucks";
import path from "path";
import { parse } from "yaml";
import type { DslTemplateDef } from "./types";
import type {
  ComponentSlideData,
  SceneSlideData,
  SlideBaseFields,
  SlideData,
} from "@/lib/types";

// --- Nunjucks environment ---

const BUILT_IN_TEMPLATE_DIR = path.join(process.cwd(), "src/lib/layout/templates");
const BUILT_IN_MACRO_DIR = path.join(process.cwd(), "src/lib/dsl/macros");

function configureEnvironment(
  env: nunjucks.Environment,
): nunjucks.Environment {
  // `tojson` filter for multiline strings (e.g., code blocks)
  env.addFilter("tojson", (val: unknown) => JSON.stringify(val));

  // `yaml_string` filter — escapes a string for safe insertion into a YAML double-quoted value.
  // Converts actual newlines back to \n literals so the rendered YAML parses correctly.
  env.addFilter("yaml_string", (val: unknown) => {
    if (typeof val !== "string") return val;
    return val.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
  });

  env.addFilter("indent_yaml", (val: unknown, width = 0) => {
    if (val === null || val === undefined) return val;
    const text = typeof val === "string" ? val : String(val);
    const pad = " ".repeat(Math.max(0, Number(width) || 0));
    return text
      .split("\n")
      .map((line) => (line ? `${pad}${line}` : line))
      .join("\n");
  });

  return env;
}

function createEnvironment(templateDef: DslTemplateDef): nunjucks.Environment {
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

function mergeOptionalObject<T extends Record<string, unknown> | undefined>(
  base: T,
  override: T,
): T {
  if (!base) return override;
  if (!override) return base;
  return {
    ...base,
    ...override,
  } as T;
}

function mergeScenePresetMaps(
  base: SceneSlideData["presets"] | undefined,
  override: SceneSlideData["presets"] | undefined,
): SceneSlideData["presets"] | undefined {
  if (!base) return override;
  if (!override) return base;

  const merged: NonNullable<SceneSlideData["presets"]> = { ...base };
  for (const [name, preset] of Object.entries(override)) {
    const existing = merged[name];
    merged[name] = existing
      ? {
          ...existing,
          ...preset,
          ...(existing.frame || preset.frame ? { frame: mergeOptionalObject(existing.frame, preset.frame) } : {}),
          ...(existing.shadow || preset.shadow ? { shadow: mergeOptionalObject(existing.shadow, preset.shadow) } : {}),
          ...(existing.effects || preset.effects ? { effects: mergeOptionalObject(existing.effects, preset.effects) } : {}),
          ...(existing.border || preset.border ? { border: mergeOptionalObject(existing.border, preset.border) } : {}),
          ...(existing.entrance || preset.entrance ? { entrance: mergeOptionalObject(existing.entrance, preset.entrance) } : {}),
          ...(existing.transform || preset.transform ? { transform: mergeOptionalObject(existing.transform, preset.transform) } : {}),
          ...(existing.cssStyle || preset.cssStyle ? { cssStyle: mergeOptionalObject(existing.cssStyle, preset.cssStyle) } : {}),
          ...(existing.style || preset.style ? { style: mergeOptionalObject(existing.style, preset.style) } : {}),
          ...(existing.layout || preset.layout ? { layout: mergeOptionalObject(existing.layout, preset.layout) } : {}),
        }
      : preset;
  }
  return merged;
}

// --- SmartArray: makes {{ array }} output JSON (valid YAML flow sequence) ---

class SmartArray<T> extends Array<T> {
  override toString(): string {
    return JSON.stringify(this);
  }
}

/**
 * Recursively wrap arrays in SmartArray so {{ var }} serializes to JSON.
 * Plain objects and scalars pass through unchanged.
 */
function smartify(val: unknown): unknown {
  if (Array.isArray(val)) {
    const arr = new SmartArray<unknown>();
    for (const item of val) {
      arr.push(smartify(item));
    }
    return arr;
  }
  if (typeof val === "object" && val !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = smartify(v);
    }
    return out;
  }
  return val;
}

// --- Main expansion function ---

/**
 * Expand a DSL template with slide data into a SlideData.
 *
 * 1. Validate required params
 * 2. Build render context (params + style defaults + user style overrides)
 * 3. Render the .template.yaml through Nunjucks
 * 4. Parse the rendered YAML
 * 5. Construct SlideData
 */
export function expandDslTemplate(
  slideData: Record<string, unknown>,
  templateDef: DslTemplateDef,
): SlideData {
  // 1. Validate required params
  for (const [name, def] of Object.entries(templateDef.params)) {
    if (def.required && !(name in slideData)) {
      throw new Error(
        `[dsl] Template "${templateDef.name}" requires param "${name}" but it was not provided`,
      );
    }
  }

  // 2. Build style context with defaults
  const styleContext: Record<string, string | number> = {};
  if (templateDef.style) {
    for (const [name, def] of Object.entries(templateDef.style)) {
      styleContext[name] = def.default;
    }
  }
  // Merge user-provided style overrides
  const userStyle = slideData.style as Record<string, unknown> | undefined;
  if (userStyle) {
    for (const [k, v] of Object.entries(userStyle)) {
      if (v !== undefined) styleContext[k] = v as string | number;
    }
  }

  // 3. Build render context
  const context: Record<string, unknown> = { style: styleContext };
  for (const name of Object.keys(templateDef.params)) {
    if (name in slideData) {
      context[name] = smartify(slideData[name]);
    }
  }

  // 4. Render through Nunjucks
  let rendered: string;
  try {
    const env = createEnvironment(templateDef);
    rendered = env.renderString(templateDef.rawBody, context);
  } catch (e) {
    throw new Error(
      `[dsl] Nunjucks render failed for template "${templateDef.name}": ${e}`,
    );
  }

  // 5. Parse rendered YAML
  let parsed: Record<string, unknown>;
  try {
    parsed = parse(rendered) as Record<string, unknown>;
  } catch (e) {
    throw new Error(
      `[dsl] YAML parse failed after rendering template "${templateDef.name}": ${e}\n\nRendered output:\n${rendered}`,
    );
  }

  // 6. Construct output SlideData
  const base: SlideBaseFields = {};
  if (slideData.animation) base.animation = slideData.animation as SlideBaseFields["animation"];
  if (slideData.theme) base.theme = slideData.theme as SlideBaseFields["theme"];

  if (parsed.mode === "scene") {
    const parsedPresets = parsed.presets as SceneSlideData["presets"] | undefined;
    const overridePresets = slideData.presets as SceneSlideData["presets"] | undefined;
    const presets = mergeScenePresetMaps(parsedPresets, overridePresets);

    return {
      mode: "scene",
      ...(parsed.background !== undefined ? { background: parsed.background as SceneSlideData["background"] } : {}),
      ...(parsed.guides !== undefined ? { guides: parsed.guides as SceneSlideData["guides"] } : {}),
      ...(presets ? { presets } : {}),
      ...(parsed.sourceSize !== undefined ? { sourceSize: parsed.sourceSize as SceneSlideData["sourceSize"] } : {}),
      ...(parsed.fit !== undefined ? { fit: parsed.fit as SceneSlideData["fit"] } : {}),
      ...(parsed.align !== undefined ? { align: parsed.align as SceneSlideData["align"] } : {}),
      ...(slideData.background !== undefined ? { background: slideData.background as SceneSlideData["background"] } : {}),
      ...(slideData.guides !== undefined ? { guides: slideData.guides as SceneSlideData["guides"] } : {}),
      ...(slideData.fit !== undefined ? { fit: slideData.fit as SceneSlideData["fit"] } : {}),
      ...(slideData.align !== undefined ? { align: slideData.align as SceneSlideData["align"] } : {}),
      ...(slideData.sourceSize !== undefined ? { sourceSize: slideData.sourceSize as SceneSlideData["sourceSize"] } : {}),
      children: (parsed.children ?? []) as SceneSlideData["children"],
      ...base,
    } as SceneSlideData & SlideBaseFields;
  }

  // Component template path. Slide-level background/backgroundImage still allow user overrides.
  return {
    ...(parsed.background !== undefined ? { background: String(parsed.background) } : {}),
    ...(parsed.backgroundImage !== undefined ? { backgroundImage: String(parsed.backgroundImage) } : {}),
    ...(slideData.background !== undefined ? { background: String(slideData.background) } : {}),
    ...(slideData.backgroundImage !== undefined ? { backgroundImage: String(slideData.backgroundImage) } : {}),
    ...(parsed.overlay !== undefined ? { overlay: String(parsed.overlay) } : {}),
    children: (parsed.children ?? []) as ComponentSlideData["children"],
    ...base,
  } as ComponentSlideData & SlideBaseFields;
}
