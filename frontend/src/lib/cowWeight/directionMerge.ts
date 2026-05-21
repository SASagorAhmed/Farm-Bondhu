import type { CowDirectionAssistResult } from "./api";
import type { CowBodyDirection, CowFacing } from "./cowDirection";
import {
  cowBodyDirectionFromHeadSide,
  resolveFacingFromBodyDirection,
} from "./cowDirection";
import type { BBox } from "./types";

const VISION_MIN_CONFIDENCE = 0.5;

export type DirectionVerifySource = "vision" | "local" | "none";

export function mergeVisionWithLocal(
  local: CowBodyDirection | undefined,
  vision: CowDirectionAssistResult | null
): {
  bodyDirection: CowBodyDirection;
  facing: CowFacing | null;
  headBbox: BBox | null;
  source: DirectionVerifySource;
  visionModel?: string;
} {
  const visionSide =
    vision &&
    (vision.headSide === "left" || vision.headSide === "right") &&
    vision.confidence >= VISION_MIN_CONFIDENCE
      ? vision.headSide
      : null;

  if (visionSide) {
    const bodyDirection: CowBodyDirection = {
      ...cowBodyDirectionFromHeadSide(visionSide, "head_band"),
      directionIssueKey: null,
      headBbox: null,
    };
    return {
      bodyDirection,
      facing: resolveFacingFromBodyDirection(bodyDirection),
      headBbox: null,
      source: "vision",
      visionModel: vision?.model,
    };
  }

  if (local && local.headSide !== "unknown" && !local.directionIssueKey) {
    return {
      bodyDirection: local,
      facing: resolveFacingFromBodyDirection(local),
      headBbox: local.headBbox ?? null,
      source: "local",
    };
  }

  return {
    bodyDirection: local ?? {
      headSide: "unknown",
      tailSide: "unknown",
      direction: "unknown",
      isReversed: false,
      directionIssueKey: "cowWeight.scan.issueHeadNotClear",
    },
    facing: null,
    headBbox: null,
    source: "none",
  };
}
