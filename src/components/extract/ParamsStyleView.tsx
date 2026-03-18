"use client";

import type { Proposal, ProposalField } from "./types";

interface ParamsStyleViewProps {
  proposal: Proposal;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value);
}

function truncate(value: unknown, max = 30): string {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function FieldRow({ name, field }: { name: string; field: ProposalField }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1 text-xs">
      <span className="shrink-0 font-medium text-gray-800">{name}</span>
      <span className="rounded bg-gray-200 px-1 py-0.5 text-[10px] text-gray-500">
        {field.type}
      </span>
      <span className="ml-auto flex items-center gap-1 truncate text-gray-500">
        {isHexColor(field.value) && (
          <span
            className="inline-block h-3 w-3 shrink-0 rounded border border-gray-300"
            style={{ backgroundColor: field.value }}
          />
        )}
        {truncate(field.value)}
      </span>
    </div>
  );
}

function FieldColumn({
  title,
  fields,
}: {
  title: string;
  fields: Record<string, ProposalField>;
}) {
  const entries = Object.entries(fields);
  if (entries.length === 0) return null;

  return (
    <div className="flex-1 min-w-0">
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400">
        {title}
      </h4>
      <div className="flex flex-col gap-1">
        {entries.map(([name, field]) => (
          <FieldRow key={name} name={name} field={field} />
        ))}
      </div>
    </div>
  );
}

export default function ParamsStyleView({ proposal }: ParamsStyleViewProps) {
  return (
    <div className="flex flex-col gap-3 p-3">
      {proposal.description && (
        <p className="text-xs text-gray-500">{proposal.description}</p>
      )}
      <div className="flex gap-3">
        <FieldColumn title="Params" fields={proposal.params} />
        <FieldColumn title="Style" fields={proposal.style} />
      </div>
    </div>
  );
}
