import type { CowAnalysisResult, DetectionMode } from "./types";
import type { CowEstimationRow } from "./types";
import type { PhotoExifMeta } from "./imageExif";

export type { PhotoExifMeta };

export interface CowWeightUploadState {
  mode: DetectionMode;
}

export interface CowWeightAnalyzeState {
  mode: DetectionMode;
  dataUrl: string;
  exif?: PhotoExifMeta | null;
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
  exif?: PhotoExifMeta | null;
}

export interface CowWeightResultState {
  estimation: CowEstimationRow;
  mode: DetectionMode;
}
