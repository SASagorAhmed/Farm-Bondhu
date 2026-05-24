import type { CowAnalysisResult, DetectionMode } from "./types";
import type { CowEstimationRow } from "./types";
import type { PhotoExifMeta } from "./imageExif";

export type { PhotoExifMeta };

/** How the user provided the cow photo (drives retake / try again). */
export type PhotoCaptureSource = "camera" | "gallery";

export interface CowWeightUploadState {
  mode?: DetectionMode;
}

export interface CowWeightAnalyzeState {
  mode: DetectionMode;
  dataUrl: string;
  exif?: PhotoExifMeta | null;
  photoSource?: PhotoCaptureSource;
}

export interface CowWeightConfirmState {
  mode: DetectionMode;
  dataUrl: string;
  analysis: CowAnalysisResult;
  photoSource?: PhotoCaptureSource;
}

export interface CowWeightScanState {
  mode: DetectionMode;
  dataUrl: string;
  analysis: CowAnalysisResult;
  exif?: PhotoExifMeta | null;
  photoSource?: PhotoCaptureSource;
}

export interface CowWeightResultState {
  estimation: CowEstimationRow;
  mode: DetectionMode;
}
