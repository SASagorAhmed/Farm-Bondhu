import { describe, expect, it } from "vitest";
import {
  applyAverageFallback,
  CAMERA_DISTANCE_CANDIDATES_CM,
  cmPerPxAtZ,
  DEFAULT_CAMERA_DISTANCE_CM,
  focalLengthPx,
  GROUND_DISTANCE_CONFIDENCE_MIN,
  isGroundDistanceDetected,
  jointSelectCameraDistance,
  snapToDistanceGrid,
} from "./geometry3d";

function isOnGrid(cm: number): boolean {
  return (CAMERA_DISTANCE_CANDIDATES_CM as readonly number[]).includes(cm);
}

describe("geometry3d", () => {
  it("focalLengthPx is positive for typical phone image", () => {
    expect(focalLengthPx(1200, 4.5)).toBeGreaterThan(500);
  });

  it("cmPerPxAtZ grows with distance", () => {
    const f = 900;
    expect(cmPerPxAtZ(200, f)).toBeGreaterThan(cmPerPxAtZ(150, f));
  });

  it("snapToDistanceGrid picks nearest 10cm bucket", () => {
    expect(snapToDistanceGrid(177)).toBe(180);
    expect(snapToDistanceGrid(154)).toBe(150);
  });

  it("jointSelectCameraDistance returns a grid value", () => {
    const r = jointSelectCameraDistance({
      imageWidthPx: 1200,
      imageHeightPx: 900,
      bboxHeightPx: 400,
      bboxWidthPx: 600,
      lengthSpanPx: 430,
    });
    expect(isOnGrid(r.cameraDistanceCm)).toBe(true);
    expect(r.r1).toBeGreaterThan(0);
    expect(r.r2).toBeGreaterThan(0);
    expect(r.bodyHeightCm).toBeGreaterThan(0);
    expect(r.localPriorCm).toBeGreaterThan(0);
    expect(["local", "cloud", "blended"]).toContain(r.distanceSource);
  });

  it("vision prior yields detected distance on grid", () => {
    const r = jointSelectCameraDistance({
      imageWidthPx: 1200,
      imageHeightPx: 900,
      bboxHeightPx: 400,
      bboxWidthPx: 600,
      lengthSpanPx: 430,
      standoffPriorCm: 200,
      visionUsed: true,
    });
    expect(isOnGrid(r.cameraDistanceCm)).toBe(true);
    expect(r.cloudPriorCm).toBe(200);
    expect(r.groundDistanceDetected).toBe(true);
  });

  it("uses average 180 cm when ground distance not detected", () => {
    const joint = jointSelectCameraDistance({
      imageWidthPx: 1200,
      imageHeightPx: 900,
      bboxHeightPx: 400,
      bboxWidthPx: 600,
      lengthSpanPx: 430,
      visionUsed: false,
    });
    expect(joint.groundDistanceDetected).toBe(true);

    const r = applyAverageFallback(
      joint,
      joint.bodyHeightCm > 0 ? 400 : 0,
      joint.focalLengthPx,
      1
    );
    expect(r.groundDistanceDetected).toBe(false);
    expect(r.cameraDistanceCm).toBe(DEFAULT_CAMERA_DISTANCE_CM);
    expect(r.distanceSource).toBe("fallback_average");
    expect(r.r1).toBeCloseTo(
      cmPerPxAtZ(DEFAULT_CAMERA_DISTANCE_CM, r.focalLengthPx),
      5
    );
    expect(isGroundDistanceDetected(false, null, 0.4)).toBe(false);
  });

  it("isGroundDistanceDetected respects cloud and confidence threshold", () => {
    expect(isGroundDistanceDetected(true, 200, 0.3)).toBe(true);
    expect(isGroundDistanceDetected(false, null, GROUND_DISTANCE_CONFIDENCE_MIN)).toBe(true);
    expect(isGroundDistanceDetected(false, null, 0.4)).toBe(false);
  });
});
