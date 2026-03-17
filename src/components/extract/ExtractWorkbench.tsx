"use client";

import { useState } from "react";
import type { AnalysisResult } from "./types";
import ImageUpload from "./ImageUpload";
import OverlayPreview from "./OverlayPreview";
import ProposalPanel from "./ProposalPanel";

export default function ExtractWorkbench() {
  // Phase 1 state
  const [imageFile, setImageFile] = useState<File>();
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [text, setText] = useState("");
  const [slug, setSlug] = useState("");

  // Analysis state
  const [analysis, setAnalysis] = useState<AnalysisResult>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  function handleImageSelected(file: File, url: string) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(url);
  }

  async function handleAnalyze() {
    if (!imageFile) return;
    setLoading(true);
    setError(undefined);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      if (text.trim()) formData.append("text", text.trim());
      if (slug.trim()) formData.append("slug", slug.trim());

      const response = await fetch("/api/extract/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const details = body?.raw ? `\nRaw: ${body.raw}` : "";
        throw new Error(
          (body?.error ?? `Analysis failed (${response.status})`) + details,
        );
      }

      const result: AnalysisResult = await response.json();
      setAnalysis(result);
      setSelectedIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // ---- Phase 2: visualization ----
  if (analysis) {
    return (
      <main className="min-h-screen bg-[#0a0f18] text-[#e6edf7]">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">
              Extracted Templates ({analysis.proposals.length})
            </h1>
            <button
              type="button"
              onClick={() => setAnalysis(undefined)}
              className="rounded-lg border border-[#364152] bg-[#1a2232] px-4 py-2 text-[13px] text-slate-200 hover:bg-[#222c3f]"
            >
              Back
            </button>
          </div>

          {/* Screenshot with regions */}
          <OverlayPreview
            screenshotUrl={analysis.source.imagePath}
            sourceDimensions={analysis.source.dimensions}
            proposals={analysis.proposals}
            selectedIndex={selectedIndex}
            onSelectProposal={setSelectedIndex}
          />

          {/* Proposal tabs + detail */}
          <ProposalPanel
            proposals={analysis.proposals}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />
        </div>
      </main>
    );
  }

  // ---- Phase 1: input ----
  return (
    <main className="min-h-screen bg-[#0a0f18] text-[#e6edf7]">
      <div className="mx-auto flex max-w-[1000px] flex-col gap-6 px-4 py-8">
        <h1 className="text-2xl font-semibold text-white">Extract Templates</h1>

        <div className="flex gap-6">
          {/* Left: image */}
          <div className="flex-1">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8899b0]">
              Slide Screenshot
            </label>
            <ImageUpload onImageSelected={handleImageSelected} previewUrl={previewUrl} />
          </div>

          {/* Right: text + slug */}
          <div className="flex w-[360px] shrink-0 flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8899b0]">
                Description (optional)
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Describe the slide or what to extract..."
                rows={4}
                className="w-full rounded-xl border border-[#2b3648] bg-[#0d1421] px-4 py-3 text-[#e6edf7] placeholder-[#5a6a80] focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8899b0]">
                Target Slug (optional)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-talk"
                className="w-full rounded-xl border border-[#2b3648] bg-[#0d1421] px-4 py-3 text-[#e6edf7] placeholder-[#5a6a80] focus:border-cyan-400/50 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <pre className="whitespace-pre-wrap rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-300">
            {error}
          </pre>
        )}

        <button
          onClick={handleAnalyze}
          disabled={!imageFile || loading}
          className="w-full rounded-xl bg-[#2e5fbf] px-6 py-3 font-medium text-white transition-colors hover:bg-[#3a6fd4] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>
    </main>
  );
}
