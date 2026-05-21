import type { CowAnalysisResult, DetectionMode } from "./types";
import type { CowEstimationRow } from "./types";

export interface CowWeightUploadState {
  mode: DetectionMode;
}

export interface CowWeightAnalyzeState {
  mode: DetectionMode;
  dataUrl: string;
}

export interface CowWeightConfirmState {
  mode: DetectionMode;
  dataUrl: string;
  analysis: CowAnalysisResult;
}

export interface CowWeightScanState {
  mode: DetectionMode;
  dataUrl: string;
  analysis: CowAnalysisResult;
}

export interface CowWeightResultState {
  estimation: CowEstimationRow;
  mode: DetectionMode;
}
