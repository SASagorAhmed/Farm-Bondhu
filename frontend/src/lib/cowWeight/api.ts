import { apiJson, clearStoredSession, readSession } from "@/api/client";
import type { CowAnalysisResult, CowEstimationRow, DetectionMode } from "./types";
import { dimensionsFromLines, dimensionsFromLinesPlanB } from "./pixelsToCm";
import { cmPerPixelFromReference } from "./referenceScale";
import type { CowLines } from "./types";

function authErrorMessage(body: Record<string, unknown>, res: Response): string {
  const err = body.error;
  if (typeof err === "string" && err.trim()) return err.trim();
  if (res.status === 401) return "Session expired or invalid. Please sign in again.";
  return `Request failed (${res.status})`;
}

function handleAuthFailure(res: Response, body: Record<string, unknown>): never {
  if (res.status === 401 || res.status === 403) {
    clearStoredSession();
    throw new Error(authErrorMessage(body, res));
  }
  throw new Error(authErrorMessage(body, res));
}

export function resolveDimensions(
  mode: DetectionMode,
  lines: CowLines,
  analysis: CowAnalysisResult,
  referenceTap?: { a: { x: number; y: number }; b: { x: number; y: number } } | null
): { chest_width_cm: number; body_length_cm: number; confidence: number } {
  let cmPerPixel = analysis.cmPerPixel ?? 0;

  if (mode === "plan_c") {
    const refLine = referenceTap || lines.reference;
    if (refLine) {
      cmPerPixel = cmPerPixelFromReference(refLine);
    }
    if (!cmPerPixel || cmPerPixel <= 0) {
      throw new Error("Could not scale from reference. Tap the top and bottom of your 1m stick.");
    }
  } else {
    const planB = dimensionsFromLinesPlanB(lines, analysis.bbox);
    return {
      chest_width_cm: planB.chest_width_cm,
      body_length_cm: planB.body_length_cm,
      confidence: Math.min(analysis.confidence, 0.5),
    };
  }

  const dims = dimensionsFromLines(lines, cmPerPixel);
  let confidence = analysis.confidence;

  return { ...dims, confidence };
}

export async function saveCowEstimation(payload: {
  detection_mode: DetectionMode;
  chest_width_cm: number;
  body_length_cm: number;
  confidence: number;
  annotation_json: Record<string, unknown>;
  file_data?: string;
  image_url?: string;
  farm_id?: string;
  animal_id?: string;
}): Promise<CowEstimationRow> {
  if (!readSession()?.access_token) {
    throw new Error("You are not signed in. Please log in and try again.");
  }

  const { res, body } = await apiJson("/v1/cow-estimations", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      input_method: "ai_assisted",
      model_version: "browser-v1",
    }),
  });

  const record = body as { error?: string; detail?: string; data?: CowEstimationRow };
  if (!res.ok) {
    handleAuthFailure(res, record as Record<string, unknown>);
  }
  if (!record.data) throw new Error("Save failed: empty response");
  return record.data;
}

export async function fetchCowEstimations(): Promise<CowEstimationRow[]> {
  if (!readSession()?.access_token) {
    return [];
  }

  const { res, body } = await apiJson("/v1/cow-estimations");
  const record = body as { error?: string; data?: CowEstimationRow[] };
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearStoredSession();
      return [];
    }
    throw new Error(authErrorMessage(record as Record<string, unknown>, res));
  }
  return record.data || [];
}
