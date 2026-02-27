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
  params: Record<string, DslParamDef>;
  style?: Record<string, DslStyleDef>;
  rawBody: string; // entire file content — Nunjucks template
}
