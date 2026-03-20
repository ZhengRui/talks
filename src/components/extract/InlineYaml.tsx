"use client";

import { useCallback, useState } from "react";
import { Copy, Check } from "lucide-react";
import type { Proposal } from "./types";
import { generateTemplateYaml, generateInstanceYaml } from "./yaml-gen";

// ---------------------------------------------------------------------------
// YAML syntax highlighting (extracted from YamlModal)
// ---------------------------------------------------------------------------

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

function highlightValue(value: string): React.ReactNode {
  if (!value) return null;
  if (/\{\{.*\}\}/.test(value)) return highlightTemplateTokens(value);
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) {
    if (/\{\{.*\}\}/.test(value)) return highlightTemplateTokens(value);
    return <span className="text-emerald-600">{value}</span>;
  }
  if (/^(true|false)$/.test(value)) return <span className="text-orange-500">{value}</span>;
  if (/^-?\d+(\.\d+)?$/.test(value)) return <span className="text-purple-600">{value}</span>;
  if (/^(string|number|boolean|array|object|required)$/.test(value)) return <span className="text-amber-600">{value}</span>;
  return <span className="text-gray-700">{value}</span>;
}

function highlightYaml(yaml: string): React.ReactNode[] {
  const lines = yaml.split("\n");
  const gutterWidth = String(lines.length).length;
  return lines.map((line, i) => {
    let content: React.ReactNode = line;

    if (/^\s*\{%/.test(line)) {
      content = <span className="text-rose-500">{line}</span>;
    } else if (/^\s*#/.test(line)) {
      content = <span className="text-gray-400 italic">{line}</span>;
    } else if (/^(\s*)([\w.-]+)(\s*:\s*)(.*)$/.test(line)) {
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
    } else if (/^(\s*-\s+)(.*)$/.test(line)) {
      const m = line.match(/^(\s*-\s+)(.*)$/)!;
      content = (
        <>
          <span className="text-gray-400">{m[1]}</span>
          {highlightValue(m[2])}
        </>
      );
    }

    return (
      <div key={i} className="flex">
        <span className="inline-block select-none text-right text-gray-300 shrink-0" style={{ minWidth: `${gutterWidth}ch`, marginRight: "1.5ch" }}>
          {i + 1}
        </span>
        <span className="flex-1 whitespace-pre-wrap break-words">{content}</span>
      </div>
    );
  });
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

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
      className="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
      title={copied ? "Copied!" : "Copy"}
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// InlineYaml — tab switcher for template / instance YAML
// ---------------------------------------------------------------------------

interface InlineYamlProps {
  proposal: Proposal;
}

export default function InlineYaml({ proposal }: InlineYamlProps) {
  const [activeTab, setActiveTab] = useState<"template" | "instance">("template");

  const templateYaml = generateTemplateYaml(proposal);
  const instanceYaml = generateInstanceYaml(proposal);
  const activeYaml = activeTab === "template" ? templateYaml : instanceYaml;

  return (
    <div className="border-t border-gray-200 p-3">
      <div className="flex items-center gap-1 mb-2">
        <button
          type="button"
          onClick={() => setActiveTab("template")}
          className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
            activeTab === "template"
              ? "bg-white text-gray-700 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Template
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("instance")}
          className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
            activeTab === "instance"
              ? "bg-white text-gray-700 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          Instance
        </button>
        <div className="ml-auto">
          <CopyButton text={activeYaml} />
        </div>
      </div>
      <div className="grid rounded-lg border border-gray-200 bg-gray-50/30 p-3">
        <div className={`text-[11px] leading-[1.6] font-mono col-start-1 row-start-1 ${activeTab !== "template" ? "invisible" : ""}`}>
          {highlightYaml(templateYaml)}
        </div>
        <div className={`text-[11px] leading-[1.6] font-mono col-start-1 row-start-1 ${activeTab !== "instance" ? "invisible" : ""}`}>
          {highlightYaml(instanceYaml)}
        </div>
      </div>
    </div>
  );
}
