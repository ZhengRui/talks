/**
 * Client-safe Nunjucks filter registration and environment factory.
 * No `path`, `fs`, or `FileSystemLoader` — safe for browser bundles.
 */

import nunjucks from "nunjucks";
import { estimateTextHeight } from "@/lib/layout/helpers";

// ---------------------------------------------------------------------------
// SmartArray: makes {{ array }} output JSON (valid YAML flow sequence)
// ---------------------------------------------------------------------------

class SmartArray<T> extends Array<T> {
  override toString(): string {
    return JSON.stringify(this);
  }
}

/**
 * Recursively wrap arrays in SmartArray so {{ var }} serializes to JSON.
 * Plain objects and scalars pass through unchanged.
 */
export function smartify(val: unknown): unknown {
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

// ---------------------------------------------------------------------------
// Shared filter registration
// ---------------------------------------------------------------------------

export function configureEnvironment(
  env: nunjucks.Environment,
): nunjucks.Environment {
  env.addFilter("tojson", (val: unknown) => JSON.stringify(val));

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

  env.addFilter("text_height", (
    val: unknown,
    fontSize: number,
    lineHeight: number,
    containerWidth: number,
    fontWeight?: number,
    letterSpacing?: number,
    textTransform?: "uppercase" | "lowercase" | "none",
  ) => {
    const text = typeof val === "string" ? val : String(val ?? "");
    return estimateTextHeight(
      text,
      Number(fontSize),
      Number(lineHeight),
      Number(containerWidth),
      fontWeight != null ? Number(fontWeight) : undefined,
      letterSpacing != null ? Number(letterSpacing) : undefined,
      textTransform,
    );
  });

  env.addFilter("list_height", (
    val: unknown,
    fontSize: number,
    lineHeight: number,
    containerWidth: number,
    itemSpacing = 10,
    ordered = false,
    fontWeight?: number,
    letterSpacing?: number,
    textTransform?: "uppercase" | "lowercase" | "none",
  ) => {
    if (!Array.isArray(val)) return 0;
    const bulletIndent = ordered ? 42 : 30;
    const textWidth = Number(containerWidth) - bulletIndent;
    return val.reduce((sum, item, index) => {
      const itemHeight = estimateTextHeight(
        typeof item === "string" ? item : String(item ?? ""),
        Number(fontSize),
        Number(lineHeight),
        textWidth,
        fontWeight != null ? Number(fontWeight) : undefined,
        letterSpacing != null ? Number(letterSpacing) : undefined,
        textTransform,
      );
      return sum + itemHeight + (index < val.length - 1 ? Number(itemSpacing) : 0);
    }, 0);
  });

  env.addFilter("code_height", (
    val: unknown,
    fontSize: number,
    padding = 32,
    lineHeight = 1.6,
  ) => {
    const code = typeof val === "string" ? val : String(val ?? "");
    const lineCount = code.split("\n").length;
    return lineCount * Number(fontSize) * Number(lineHeight) + Number(padding) * 2;
  });

  return env;
}

// ---------------------------------------------------------------------------
// Minimal environment factory (no FileSystemLoader)
// ---------------------------------------------------------------------------

export function createMinimalEnvironment(): nunjucks.Environment {
  return configureEnvironment(new nunjucks.Environment(null, {
    autoescape: false,
    trimBlocks: true,
    lstripBlocks: true,
  }));
}
