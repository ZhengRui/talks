"use client";

import { useCallback, useEffect, useState } from "react";
import { useExtractStore } from "./store";
import { generateTemplateYaml, generateInstanceYaml } from "./yaml-gen";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded px-2 py-0.5 text-[11px] text-[#8899b0] hover:text-white hover:bg-[#1e2a3a] transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function YamlModal() {
  const { open, cardId, templateIndex } = useExtractStore((s) => s.yamlModal);
  const cards = useExtractStore((s) => s.cards);
  const closeYamlModal = useExtractStore((s) => s.closeYamlModal);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeYamlModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeYamlModal]);

  if (!open || !cardId) return null;

  const card = cards.get(cardId);
  if (!card?.analysis) return null;

  const proposal = card.analysis.proposals[templateIndex];
  if (!proposal) return null;

  const templateYaml = generateTemplateYaml(proposal);
  const instanceYaml = generateInstanceYaml(proposal);

  return (
    <div
      data-testid="yaml-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onClick={closeYamlModal}
    >
      <div
        className="w-[900px] max-w-[90vw] max-h-[80vh] rounded-xl border border-[#1e2a3a] bg-[#0f1724] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e2a3a] px-5 py-3">
          <h2 className="text-sm font-semibold text-white">{proposal.name}</h2>
          <button
            type="button"
            onClick={closeYamlModal}
            className="text-[#5a6a80] hover:text-white text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Body: two columns */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Template YAML column */}
          <div className="flex-1 flex flex-col border-r border-[#1e2a3a] min-w-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e2a3a]">
              <span className="text-xs font-medium text-[#8899b0]">Template YAML</span>
              <CopyButton text={templateYaml} />
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-[11px] leading-4 text-emerald-300/80 font-mono whitespace-pre-wrap break-words">
                {templateYaml}
              </pre>
            </div>
          </div>

          {/* Instance YAML column */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e2a3a]">
              <span className="text-xs font-medium text-[#8899b0]">Instance YAML</span>
              <CopyButton text={instanceYaml} />
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-[11px] leading-4 text-cyan-300/80 font-mono whitespace-pre-wrap break-words">
                {instanceYaml}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
