import nunjucks from "nunjucks";
import { parse } from "yaml";
import type { DslTemplateDef } from "./types";
import type {
  ComponentSlideData,
  SlideBaseFields,
} from "@/lib/types";

// --- Nunjucks environment ---

const env = new nunjucks.Environment(null, {
  trimBlocks: true,
  lstripBlocks: true,
  autoescape: false,
});

// `tojson` filter for multiline strings (e.g., code blocks)
env.addFilter("tojson", (val: unknown) => JSON.stringify(val));

// `yaml_string` filter — escapes a string for safe insertion into a YAML double-quoted value.
// Converts actual newlines back to \n literals so the rendered YAML parses correctly.
env.addFilter("yaml_string", (val: unknown) => {
  if (typeof val !== "string") return val;
  return val.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
});

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
 * Expand a DSL template with slide data into a compose SlideData.
 *
 * 1. Validate required params
 * 2. Build render context (params + style defaults + user style overrides)
 * 3. Render the .template.yaml through Nunjucks
 * 4. Parse the rendered YAML
 * 5. Construct ComponentSlideData
 */
export function expandDslTemplate(
  slideData: Record<string, unknown>,
  templateDef: DslTemplateDef,
): ComponentSlideData & SlideBaseFields {
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

  // Slide-level background/backgroundImage: slideData (user YAML) takes precedence over template output
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
