import { DEFAULT_CAMERA_DISTANCE_CM } from "./geometry3d";
import type { CameraDistanceSource, PlanDMetricsSnapshot } from "./types";

export interface GroundDistanceUi {
  detected: boolean;
  cm: number;
  source: CameraDistanceSource | null;
}

export function groundDistanceUi(
  planD: PlanDMetricsSnapshot | undefined,
  metrics?: { cameraDistanceCm?: number; distanceSource?: CameraDistanceSource; groundDistanceDetected?: boolean } | null
): GroundDistanceUi {
  const detected =
    planD?.groundDistanceDetected ?? metrics?.groundDistanceDetected ?? false;
  const cm = detected
    ? (planD?.cameraDistanceCm ?? metrics?.cameraDistanceCm ?? DEFAULT_CAMERA_DISTANCE_CM)
    : DEFAULT_CAMERA_DISTANCE_CM;
  const source = detected
    ? (planD?.distanceSource ?? metrics?.distanceSource ?? null)
    : "fallback_average";
  return { detected, cm, source };
}
