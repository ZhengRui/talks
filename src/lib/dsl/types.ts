/** Parameter definition in a .template.yaml */
export interface DslParamDef {
  type: string; // "string" | "number" | "string[]" | "array"
  required?: boolean;
}

/** Style property definition with default value */
export interface DslStyleDef {
  type: string; // "string" | "number"
  default: string | number;
}

/** Parsed .template.yaml definition */
export interface DslTemplateDef {
  name: string;
  alias?: string; // redirect to another template by name
  params: Record<string, DslParamDef>;
  style?: Record<string, DslStyleDef>;
  sourcePath?: string;
  rawBody: string; // entire file content — Nunjucks template
}
