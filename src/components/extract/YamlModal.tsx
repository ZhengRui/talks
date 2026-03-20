"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, X } from "lucide-react";
import { useExtractStore } from "./store";
import { generateTemplateYaml, generateInstanceYaml } from "./yaml-gen";

/** Highlight Jinja/Nunjucks template tags within a string. */
function highlightTemplateTokens(text: string): React.ReactNode {
  const parts = text.split(/(\{%.*?%\}|\{\{.*?\}\})/g);
  if (parts.length === 1) return <span className="text-gray-700">{text}</span>;
  return parts.map((part, i) => {
    if (/^\{%.*%\}$/.test(part) || /^\{\{.*\}\}$/.test(part)) {
      return <span key={i} className="text-rose-500 font-medium">{part}</span>;
    }
    return <span key={i} className="text-gray-700">{part}</span>;
  });
}

/** Simple YAML syntax highlighter — returns JSX spans with colors. */
function highlightYaml(yaml: string): React.ReactNode[] {
  return yaml.split("\n").map((line, i) => {
    let content: React.ReactNode = line;

    // Jinja block lines ({% for %}, {% endfor %}, etc.)
    if (/^\s*\{%/.test(line)) {
      content = <span className="text-rose-500">{line}</span>;
    }
    // Comment lines
    else if (/^\s*#/.test(line)) {
      content = <span className="text-gray-400 italic">{line}</span>;
    }
    // Key: value lines
    else if (/^(\s*)([\w.-]+)(\s*:\s*)(.*)$/.test(line)) {
      const m = line.match(/^(\s*)([\w.-]+)(\s*:\s*)(.*)$/)!;
      const [, indent, key, colon, value] = m;
      content = (
        <>
          {indent}
          <span className="text-blue-600">{key}</span>
          <span className="text-gray-400">{colon}</span>
          {highlightValue(value)}
        </>
      );
    }
    // List items (- value)
    else if (/^(\s*-\s+)(.*)$/.test(line)) {
      const m = line.match(/^(\s*-\s+)(.*)$/)!;
      content = (
        <>
          <span className="text-gray-400">{m[1]}</span>
          {highlightValue(m[2])}
        </>
      );
    }

    return <div key={i}>{content}</div>;
  });
}

function highlightValue(value: string): React.ReactNode {
  if (!value) return null;
  // Values containing template tags {{ }}
  if (/\{\{.*\}\}/.test(value)) {
    return highlightTemplateTokens(value);
  }
  // Quoted strings (may contain template tags inside)
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) {
    if (/\{\{.*\}\}/.test(value)) {
      return highlightTemplateTokens(value);
    }
    return <span className="text-emerald-600">{value}</span>;
  }
  // Booleans
  if (/^(true|false)$/.test(value)) {
    return <span className="text-orange-500">{value}</span>;
  }
  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return <span className="text-purple-600">{value}</span>;
  }
  // Types/keywords (string, number, required, etc.)
  if (/^(string|number|boolean|array|object|required)$/.test(value)) {
    return <span className="text-amber-600">{value}</span>;
  }
  return <span className="text-gray-700">{value}</span>;
}

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
      className="flex h-6 w-6 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      title={copied ? "Copied!" : "Copy"}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
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
  const templateHighlighted = highlightYaml(templateYaml);
  const instanceHighlighted = highlightYaml(instanceYaml);

  return (
    <div
      data-testid="yaml-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center"
      onClick={closeYamlModal}
    >
      <div
        className="w-[1100px] max-w-[90vw] max-h-[80vh] rounded-xl border border-gray-200 bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800">{proposal.name}</h2>
          <button
            type="button"
            onClick={closeYamlModal}
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: two columns */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Template YAML column */}
          <div className="flex-1 flex flex-col border-r border-gray-200 min-w-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50">
              <span className="text-xs font-medium text-gray-500">Template YAML</span>
              <CopyButton text={templateYaml} />
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50/30">
              <pre className="text-[11px] leading-[1.6] font-mono whitespace-pre-wrap break-words">
                {templateHighlighted}
              </pre>
            </div>
          </div>

          {/* Instance YAML column */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50">
              <span className="text-xs font-medium text-gray-500">Instance YAML</span>
              <CopyButton text={instanceYaml} />
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50/30">
              <pre className="text-[11px] leading-[1.6] font-mono whitespace-pre-wrap break-words">
                {instanceHighlighted}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
