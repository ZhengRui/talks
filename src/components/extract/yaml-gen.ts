// Client-side YAML generation from proposal state.

import type { Proposal } from "./types";

function yamlString(val: string): string {
  const escaped = val
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
  return `"${escaped}"`;
}

function yamlValue(val: unknown): string {
  if (typeof val === "string") return yamlString(val);
  return JSON.stringify(val);
}

export function generateTemplateYaml(proposal: Proposal): string {
  const lines: string[] = [];
  lines.push(`name: ${proposal.name}`);
  lines.push(`scope: ${proposal.scope}`);

  const params = Object.entries(proposal.params);
  if (params.length > 0) {
    lines.push("params:");
    for (const [name, field] of params) {
      lines.push(`  ${name}: { type: ${field.type}, required: true }`);
    }
  }

  const styles = Object.entries(proposal.style);
  if (styles.length > 0) {
    lines.push("style:");
    for (const [name, field] of styles) {
      lines.push(`  ${name}: { type: ${field.type}, default: ${yamlValue(field.value)} }`);
    }
  }

  lines.push("");
  lines.push(proposal.body);
  return lines.join("\n");
}

export function generateInstanceYaml(proposal: Proposal): string {
  const lines: string[] = [];

  if (proposal.scope === "block") {
    // Block templates are referenced as kind: block nodes inside slide children
    lines.push(`- kind: block`);
    lines.push(`  id: ${proposal.name}-1`);
    lines.push(`  template: ${proposal.name}`);
    lines.push(`  frame: { x: 0, y: 0, w: ${proposal.region.w}, h: ${proposal.region.h} }`);
  } else {
    // Slide templates are top-level slide instances with explicit fit/align
    lines.push(`- template: ${proposal.name}`);
    lines.push("  fit: contain");
    lines.push("  align: center");
  }

  const params = Object.entries(proposal.params);
  if (params.length > 0) {
    lines.push("  params:");
    for (const [name, field] of params) {
      lines.push(`    ${name}: ${yamlValue(field.value)}`);
    }
  }

  return lines.join("\n");
}
