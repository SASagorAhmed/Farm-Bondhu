import type { CowAnalysisResult, CowLines } from "./types";
import {
  clampLinesToBBox,
  proposeChestFromBBox,
  shouldReproposeChest,
} from "./proposeLines";

/** Same line setup as first Detect Live estimate — not full keypoint repropose. */
export function canonicalLinesFromAnalysis(analysis: CowAnalysisResult): CowLines {
  let lines = clampLinesToBBox(analysis.lines, analysis.bbox);
  if (
    shouldReproposeChest(
      lines.chest,
      analysis.bbox,
      analysis.legCenters,
      analysis.keypoints
    )
  ) {
    lines = {
      ...lines,
      chest: proposeChestFromBBox(analysis.bbox, analysis.keypoints ?? analysis.legCenters),
    };
  }
  return lines;
}
