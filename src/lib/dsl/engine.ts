import { parse } from "yaml";
import type { DslTemplateDef } from "./types";
import { createTemplateEnvironment, smartify } from "./nunjucks-env";
import type {
  SceneSlideData,
  SlideBaseFields,
  SlideData,
} from "@/lib/types";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merge = mergeOptionalObject as (a: any, b: any) => any;
    merged[name] = existing
      ? {
          ...existing,
          ...preset,
          ...(existing.frame || preset.frame ? { frame: merge(existing.frame, preset.frame) } : {}),
          ...(existing.shadow || preset.shadow ? { shadow: merge(existing.shadow, preset.shadow) } : {}),
          ...(existing.effects || preset.effects ? { effects: merge(existing.effects, preset.effects) } : {}),
          ...(existing.border || preset.border ? { border: merge(existing.border, preset.border) } : {}),
          ...(existing.entrance || preset.entrance ? { entrance: merge(existing.entrance, preset.entrance) } : {}),
          ...(existing.transform || preset.transform ? { transform: merge(existing.transform, preset.transform) } : {}),
          ...(existing.cssStyle || preset.cssStyle ? { cssStyle: merge(existing.cssStyle, preset.cssStyle) } : {}),
          ...(existing.style || preset.style ? { style: merge(existing.style, preset.style) } : {}),
          ...(existing.layout || preset.layout ? { layout: merge(existing.layout, preset.layout) } : {}),
        }
      : preset;
  }
  return merged;
}

// --- Main expansion function ---

/**
 * Expand a DSL template with slide data into a scene SlideData.
 *
 * 1. Validate required params
 * 2. Build render context (params + style defaults + user style overrides)
 * 3. Render the .template.yaml through Nunjucks
 * 4. Parse the rendered YAML
 * 5. Construct scene SlideData
 */
export function expandDslTemplate(
  slideData: Record<string, unknown>,
  templateDef: DslTemplateDef,
): SlideData {
  // 0. Reject block-scoped templates used at slide level
  if (templateDef.scope === "block") {
    throw new Error(
      `[dsl] Template "${templateDef.name}" has scope: block and cannot be used at slide level. ` +
      `Use it as a kind: block node inside children instead.`,
    );
  }

  // 1. Validate required params
  const params = (slideData.params ?? {}) as Record<string, unknown>;
  for (const [name, def] of Object.entries(templateDef.params)) {
    if (def.required && !(name in params)) {
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
    if (name in params) {
      context[name] = smartify(params[name]);
    }
  }

  // 4. Render through Nunjucks
  let rendered: string;
  try {
    const env = createTemplateEnvironment(templateDef);
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

  if (parsed.mode !== "scene") {
    if (parsed.mode !== undefined) {
      throw new Error(
        `[dsl] Template "${templateDef.name}" emits mode: ${parsed.mode}, expected scene or omitted`,
      );
    }
    // mode: scene omitted — fine for normalized templates, we inject it
  }

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
