"use client";

import { useState } from "react";
import { regionColor, type Proposal } from "./types";
import { generateTemplateYaml, generateInstanceYaml } from "./yaml-gen";

interface ProposalPanelProps {
  proposals: Proposal[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md border border-[#364152] px-2 py-0.5 text-[11px] text-slate-300 hover:bg-[#222c3f]"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function ProposalPanel({ proposals, selectedIndex, onSelect }: ProposalPanelProps) {
  const selected = proposals[selectedIndex];
  if (!selected) return null;

  const templateYaml = generateTemplateYaml(selected);
  const instanceYaml = generateInstanceYaml(selected);

  return (
    <div className="overflow-hidden rounded-[16px] border border-[#253044] bg-[#121a28]">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-[#253044] bg-[#0d1421]">
        {proposals.map((p, i) => {
          const active = i === selectedIndex;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors ${
                active
                  ? "border-cyan-400 bg-[#121a28] text-white"
                  : "border-transparent text-[#7c8ca8] hover:bg-[#162030] hover:text-slate-300"
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: regionColor(i) }}
              />
              <span className="max-w-[160px] truncate">{p.name}</span>
              <span
                className={`rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${
                  p.scope === "slide"
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-emerald-500/20 text-emerald-300"
                }`}
              >
                {p.scope}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected proposal detail */}
      <div className="p-4">
        <p className="mb-4 text-[13px] text-[#8899b0]">{selected.description}</p>

        <div className="flex gap-4">
          {/* Params */}
          {Object.keys(selected.params).length > 0 && (
            <div className="flex-1">
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8ca8]">Params</h4>
              <div className="space-y-1">
                {Object.entries(selected.params).map(([name, field]) => (
                  <div key={name} className="flex items-center gap-2 rounded-lg bg-[#0b111c] px-3 py-1.5">
                    <span className="text-[13px] font-medium text-[#c8d4e2]">{name}</span>
                    <span className="text-[10px] text-[#5a6a80]">{field.type}</span>
                    <span className="ml-auto max-w-[200px] truncate text-[12px] text-[#8899b0]">
                      {typeof field.value === "string" ? field.value : JSON.stringify(field.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Styles */}
          {Object.keys(selected.style).length > 0 && (
            <div className="flex-1">
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8ca8]">Style</h4>
              <div className="space-y-1">
                {Object.entries(selected.style).map(([name, field]) => (
                  <div key={name} className="flex items-center gap-2 rounded-lg bg-[#0b111c] px-3 py-1.5">
                    <span className="text-[13px] font-medium text-[#c8d4e2]">{name}</span>
                    {typeof field.value === "string" && field.value.startsWith("#") && (
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm border border-[#364152]"
                        style={{ backgroundColor: field.value }}
                      />
                    )}
                    <span className="ml-auto text-[12px] text-[#8899b0]">
                      {String(field.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* YAML output */}
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8ca8]">Template YAML</span>
              <CopyButton text={templateYaml} />
            </div>
            <pre className="max-h-[240px] overflow-auto rounded-xl border border-[#2b3648] bg-[#0b111c] p-3 text-[12px] leading-5 text-slate-200">
              {templateYaml}
            </pre>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7c8ca8]">Instance YAML</span>
              <CopyButton text={instanceYaml} />
            </div>
            <pre className="max-h-[120px] overflow-auto rounded-xl border border-[#2b3648] bg-[#0b111c] p-3 text-[12px] leading-5 text-slate-200">
              {instanceYaml}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
