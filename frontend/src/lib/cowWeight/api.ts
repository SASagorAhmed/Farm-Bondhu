import { API_BASE, apiJson, clearStoredSession, readSession } from "@/api/client";
import type { CowAnalysisResult, CowEstimationRow, DetectionMode } from "./types";

/** New scans always use plan_b; plan_c is legacy DB value only. */
export const COW_WEIGHT_DETECTION_MODE: DetectionMode = "plan_b";
import { dimensionsFromLines, dimensionsFromLinesPlanD } from "./pixelsToCm";
import { cmPerPixelFromReference } from "./referenceScale";
import { computePlanDScale, cmPerPixelFromReferencePlanD } from "./distanceScale";
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
  lines: CowLines,
  analysis: CowAnalysisResult,
  referenceTap?: { a: { x: number; y: number }; b: { x: number; y: number } } | null
): {
  chest_width_cm: number;
  body_length_cm: number;
  confidence: number;
  scaleMethod: "reference_100cm" | "plan_d_pinhole" | "plan_d_pinhole_stick";
} {
  const refLine = referenceTap || lines.reference;
  const planD =
    analysis.planD ??
    computePlanDScale({
      bbox: analysis.bbox,
      lines,
      imageWidthPx: analysis.imageWidth,
      imageHeightPx: analysis.imageHeight,
      focalLengthMm: analysis.focalLengthMm,
      standoffMeters: analysis.standoffMeters,
    });

  if (refLine) {
    const refPx = Math.hypot(refLine.b.x - refLine.a.x, refLine.b.y - refLine.a.y);
    let cmPerPixel = cmPerPixelFromReferencePlanD(refPx, planD, true);
    if (!cmPerPixel || cmPerPixel <= 0) {
      cmPerPixel = cmPerPixelFromReference(refLine);
    }
    if (!cmPerPixel || cmPerPixel <= 0) {
      throw new Error("Could not scale from reference. Tap the top and bottom of your 1m stick.");
    }
    const dims = dimensionsFromLines(lines, cmPerPixel);
    return { ...dims, confidence: analysis.confidence, scaleMethod: "reference_100cm" };
  }

  const dims = dimensionsFromLinesPlanD(lines, planD.r1, planD.r2);
  return {
    chest_width_cm: dims.chest_width_cm,
    body_length_cm: dims.body_length_cm,
    confidence: Math.min(analysis.confidence, 0.55 + planD.geometryConfidence * 0.35),
    scaleMethod: "plan_d_pinhole",
  };
}

export async function saveCowEstimation(payload: {
  detection_mode: DetectionMode;
  chest_width_cm: number;
  body_length_cm: number;
  confidence: number;
  input_method?: "ai_assisted" | "manual" | "annotated" | "ml";
  annotation_json: Record<string, unknown>;
  file_data?: string;
  image_url?: string;
  cow_name?: string;
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
      input_method: payload.input_method ?? "ai_assisted",
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

export interface CowDirectionAssistResult {
  headSide: "left" | "right" | "unknown";
  confidence: number;
  headBbox: { x: number; y: number; width: number; height: number } | null;
  frontLeg: { x: number; y: number } | null;
  hindLeg: { x: number; y: number } | null;
  topChest: { x: number; y: number } | null;
  lowerChest: { x: number; y: number } | null;
  standoffDistanceM: number | null;
  distanceConfidence: number;
  reason: string | null;
  model?: string;
}

export async function assistCowDirection(payload: {
  image_data: string;
  local_hints?: Record<string, unknown>;
}): Promise<CowDirectionAssistResult> {
  if (!readSession()?.access_token) {
    throw new Error("You are not signed in. Please log in and try again.");
  }

  const { res, body } = await apiJson("/v1/cow-estimations/assist-direction", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const record = body as {
    error?: string;
    detail?: string;
    data?: CowDirectionAssistResult;
  };
  if (!res.ok) {
    handleAuthFailure(res, record as Record<string, unknown>);
  }
  if (!record.data) throw new Error("Direction assist failed: empty response");
  return record.data;
}

export async function submitDetectionFeedback(payload: {
  detection_mode: DetectionMode;
  corrected_head_side: "left" | "right";
  predicted_head_side?: string | null;
  predicted_facing?: string | null;
  predicted_head_bbox?: Record<string, unknown> | null;
  corrected_head_bbox?: Record<string, unknown> | null;
  local_model?: string | null;
  vision_model?: string | null;
  annotation_json?: Record<string, unknown>;
  file_data?: string;
}): Promise<{ id: string; created_at: string }> {
  if (!readSession()?.access_token) {
    throw new Error("You are not signed in. Please log in and try again.");
  }
  const { res, body } = await apiJson("/v1/cow-estimations/detection-feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const record = body as { error?: string; data?: { id: string; created_at: string } };
  if (!res.ok) handleAuthFailure(res, record as Record<string, unknown>);
  if (!record.data) throw new Error("Feedback save failed");
  return record.data;
}

export async function fetchCowDetectionFeedbackStats(): Promise<{ total: number }> {
  const { res, body } = await apiJson("/v1/cow-estimations/detection-feedback/stats");
  const record = body as { error?: string; data?: { total: number } };
  if (!res.ok) throw new Error(record.error || "Failed to load stats");
  return record.data ?? { total: 0 };
}

export async function downloadCowDetectionFeedbackExport(): Promise<void> {
  const token = readSession()?.access_token;
  if (!token) throw new Error("Sign in required");
  const resp = await fetch(`${API_BASE}/v1/cow-estimations/detection-feedback/export?format=yolo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error("Export failed");
  const data = await resp.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cow_detection_feedback_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
