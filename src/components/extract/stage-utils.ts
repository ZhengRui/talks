import type { SlideCard } from "./store";
import type { AnalysisResult, AnalysisStage } from "./types";

export function getStageAnalysis(
  card: SlideCard,
  stage: AnalysisStage,
): AnalysisResult | null {
  if (stage === "extract") {
    return card.analysis;
  }
  return card.refineAnalysis;
}
