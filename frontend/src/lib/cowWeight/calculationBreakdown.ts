import { bboxCorners, groundLineY, heightLineFromBBox } from "./geometry2d";
import { lineLengthPx } from "./imageUtils";
import { TYPICAL_LENGTH_SPAN_FRAC } from "./pixelsToCm";
import { previewWeightKg, WEIGHT_FORMULA_DIVISOR } from "./scanMetrics";
import type {
  BBox,
  CowAnalysisResult,
  CowKeypoints,
  CowLines,
  LineSegment,
  Point2D,
  ScanMetrics,
  ScanStepId,
} from "./types";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type CalculationBreakdownGroup =
  | "image"
  | "bbox"
  | "keypoints"
  | "frozen"
  | "lines"
  | "scale"
  | "convert"
  | "weight";

export interface CalculationBreakdownRow {
  id: string;
  lineNumber: number;
  group: CalculationBreakdownGroup;
  labelKey: string;
  value: string;
  detail?: string;
}

export interface CalculationBreakdown {
  rows: CalculationBreakdownRow[];
  stepFocusIds: string[];
}

export const WIZARD_AUDIT_STEPS: ScanStepId[] = [1, 2, 3, 4, 5, 6];

function effectiveR1(
  metrics: ScanMetrics | null | undefined,
  planD?: CowAnalysisResult["planD"] | null
): number {
  const fromMetrics = metrics?.r1 ?? metrics?.chestCmPerPixel ?? metrics?.cmPerPixel;
  if (fromMetrics != null && fromMetrics > 0) return fromMetrics;
  return planD?.r1 ?? 0;
}

export function canBuildAudit(
  metrics: ScanMetrics | null | undefined,
  planD?: CowAnalysisResult["planD"] | null
): boolean {
  if (!metrics && !planD) return false;
  return effectiveR1(metrics, planD) > 0;
}

function fmtPt(p: Point2D): string {
  return `(${Math.round(p.x)}, ${Math.round(p.y)})`;
}

type RowDraft = Omit<CalculationBreakdownRow, "lineNumber">;

function assignLineNumbers(drafts: RowDraft[]): CalculationBreakdownRow[] {
  return drafts.map((row, i) => ({ ...row, lineNumber: i + 1 }));
}

function pushLineAudit(
  drafts: RowDraft[],
  group: CalculationBreakdownGroup,
  idPrefix: string,
  labelAKey: string,
  labelBKey: string,
  labelDxKey: string,
  labelDyKey: string,
  labelLenKey: string,
  line: LineSegment
) {
  const px = round2(lineLengthPx(line));
  const dx = Math.round(line.b.x - line.a.x);
  const dy = Math.round(line.b.y - line.a.y);
  drafts.push(
    { id: `${idPrefix}a`, group, labelKey: labelAKey, value: fmtPt(line.a) },
    { id: `${idPrefix}b`, group, labelKey: labelBKey, value: fmtPt(line.b) },
    { id: `${idPrefix}dx`, group, labelKey: labelDxKey, value: `${dx} px`, detail: "b.x − a.x" },
    { id: `${idPrefix}dy`, group, labelKey: labelDyKey, value: `${dy} px`, detail: "b.y − a.y" },
    {
      id: `${idPrefix}len`,
      group,
      labelKey: labelLenKey,
      value: `${px} px`,
      detail: `√(${dx}² + ${dy}²)`,
    }
  );
}

/** Row ids emphasized per wizard step. */
export function stepFocusRowIds(step: ScanStepId, hasReference: boolean): string[] {
  switch (step) {
    case 1:
      return [
        "bbX",
        "bbY",
        "bbWraw",
        "bbHraw",
        "bbX1",
        "bbY1",
        "bbX2",
        "bbY2",
        "bbW",
        "bbH",
        "bbGround",
        "kpLeg1",
        "kpLeg2",
        "kpL1",
        "kpL2",
        "camZ",
        "r1formula",
        "r1",
        "r2",
      ];
    case 2:
      return ["cha", "chb", "chdx", "chdy", "chlen", "frozenChest", "convChest"];
    case 3:
      return ["lna", "lnb", "lndx", "lndy", "lnlen", "frozenLength", "convLength"];
    case 4:
      return hasReference
        ? ["refa", "refb", "refdx", "refdy", "reflen", "camZ", "r1", "r2", "convHeight"]
        : ["bbH", "bbHraw", "htlen", "camZ", "r1formula", "r1", "r2", "convHeight"];
    case 5:
    case 6:
      return ["convChest", "convLength", "weight", "weightDetail"];
    default:
      return [];
  }
}

export function buildCalculationBreakdown(input: {
  metrics: ScanMetrics;
  imageWidthPx: number;
  imageHeightPx: number;
  bbox: BBox;
  lines: CowLines;
  hasReference: boolean;
  keypoints?: CowKeypoints | null;
  detectLines?: CowLines | null;
  planD?: CowAnalysisResult["planD"] | null;
}): CalculationBreakdown {
  const { metrics, imageWidthPx, imageHeightPx, bbox, lines, keypoints, detectLines, planD } = input;
  const drafts: RowDraft[] = [];

  const corners = bboxCorners(bbox);
  const x1 = Math.round(corners.x1);
  const y1 = Math.round(corners.y1);
  const x2 = Math.round(corners.x2);
  const y2 = Math.round(corners.y2);
  const groundY = Math.round(groundLineY(bbox));
  const frameGapPx = Math.max(0, Math.round(imageHeightPx - groundY));
  const bboxHeightPx = Math.round(bbox.height);
  const bboxWidthPx = Math.round(bbox.width);
  const heightLine = heightLineFromBBox(bbox);
  const lengthSpanPx = round2(bboxWidthPx * TYPICAL_LENGTH_SPAN_FRAC);

  const r1 =
    metrics.r1 ??
    metrics.chestCmPerPixel ??
    metrics.cmPerPixel ??
    planD?.r1 ??
    0;
  const r2 =
    metrics.r2 ??
    metrics.lengthCmPerPixel ??
    metrics.cmPerPixel ??
    planD?.r2 ??
    r1;
  const zCm = metrics.cameraDistanceCm ?? planD?.cameraDistanceCm ?? null;
  const focalPx = planD?.focalLengthPx ?? null;
  const floorGapCm = r1 > 0 ? round2(frameGapPx * r1) : 0;
  const bboxHeightCm =
    metrics.bodyHeightCm ?? (r1 > 0 ? round2(bboxHeightPx * r1) : 0);

  const frozenChestPx = detectLines ? round2(lineLengthPx(detectLines.chest)) : null;
  const frozenLengthPx = detectLines ? round2(lineLengthPx(detectLines.length)) : null;
  const liveChestPx = round2(lineLengthPx(lines.chest));
  const liveLengthPx = round2(lineLengthPx(lines.length));

  drafts.push(
    { id: "imgW", group: "image", labelKey: "cowWeight.audit.imageWidth", value: `${imageWidthPx} px` },
    { id: "imgH", group: "image", labelKey: "cowWeight.audit.imageHeight", value: `${imageHeightPx} px` },
    { id: "bbX", group: "bbox", labelKey: "cowWeight.audit.bboxX", value: `${Math.round(bbox.x)} px` },
    { id: "bbY", group: "bbox", labelKey: "cowWeight.audit.bboxY", value: `${Math.round(bbox.y)} px` },
    {
      id: "bbWraw",
      group: "bbox",
      labelKey: "cowWeight.audit.bboxWidthRaw",
      value: `${bboxWidthPx} px`,
      detail: "bbox.width",
    },
    {
      id: "bbHraw",
      group: "bbox",
      labelKey: "cowWeight.audit.bboxHeightRaw",
      value: `${bboxHeightPx} px`,
      detail: "bbox.height",
    },
    { id: "bbX1", group: "bbox", labelKey: "cowWeight.audit.bboxX1", value: `${x1} px`, detail: "left" },
    { id: "bbY1", group: "bbox", labelKey: "cowWeight.audit.bboxY1", value: `${y1} px`, detail: "top" },
    {
      id: "bbX2",
      group: "bbox",
      labelKey: "cowWeight.audit.bboxX2",
      value: `${x2} px`,
      detail: `x + width = ${Math.round(bbox.x)} + ${bboxWidthPx}`,
    },
    {
      id: "bbY2",
      group: "bbox",
      labelKey: "cowWeight.audit.bboxY2",
      value: `${y2} px`,
      detail: `y + height = ${Math.round(bbox.y)} + ${bboxHeightPx} (ground)`,
    },
    {
      id: "bbW",
      group: "bbox",
      labelKey: "cowWeight.audit.bboxWidthDerived",
      value: `${bboxWidthPx} px`,
      detail: `x2 − x1 = ${x2} − ${x1}`,
    },
    {
      id: "bbH",
      group: "bbox",
      labelKey: "cowWeight.audit.bboxHeightDerived",
      value: `${bboxHeightPx} px`,
      detail: `y2 − y1 = ${y2} − ${y1}`,
    },
    {
      id: "bbConf",
      group: "bbox",
      labelKey: "cowWeight.audit.bboxConfidence",
      value: `${Math.round(bbox.confidence * 100)}%`,
    },
    {
      id: "bbGround",
      group: "bbox",
      labelKey: "cowWeight.audit.groundLineY",
      value: `y2 = ${groundY} px`,
    },
    {
      id: "bbGap",
      group: "bbox",
      labelKey: "cowWeight.audit.frameGapPx",
      value: `${frameGapPx} px`,
      detail: `imageHeight ${imageHeightPx} − groundY ${groundY}`,
    }
  );

  if (keypoints) {
    drafts.push(
      { id: "kpLeg1", group: "keypoints", labelKey: "cowWeight.audit.kpLeg1", value: fmtPt(keypoints.leg1) },
      { id: "kpLeg2", group: "keypoints", labelKey: "cowWeight.audit.kpLeg2", value: fmtPt(keypoints.leg2) },
      { id: "kpTopChest", group: "keypoints", labelKey: "cowWeight.audit.kpTopChest", value: fmtPt(keypoints.topChest) },
      { id: "kpLowerChest", group: "keypoints", labelKey: "cowWeight.audit.kpLowerChest", value: fmtPt(keypoints.lowerChest) },
      { id: "kpL1", group: "keypoints", labelKey: "cowWeight.audit.kpL1", value: fmtPt(keypoints.l1) },
      { id: "kpL2", group: "keypoints", labelKey: "cowWeight.audit.kpL2", value: fmtPt(keypoints.l2) },
      {
        id: "kpChestX",
        group: "keypoints",
        labelKey: "cowWeight.audit.kpChestX",
        value: `${Math.round(keypoints.chestCenterX)} px`,
      }
    );
  } else {
    drafts.push({
      id: "kpMissing",
      group: "keypoints",
      labelKey: "cowWeight.audit.kpMissing",
      value: "—",
    });
  }

  if (detectLines) {
    drafts.push(
      {
        id: "frozenChest",
        group: "frozen",
        labelKey: "cowWeight.audit.frozenChestPx",
        value: `${frozenChestPx} px`,
        detail: "Step 1 Detect snapshot (weight policy)",
      },
      {
        id: "frozenLength",
        group: "frozen",
        labelKey: "cowWeight.audit.frozenLengthPx",
        value: `${frozenLengthPx} px`,
        detail: "Step 1 Detect snapshot",
      },
      {
        id: "frozenChestDelta",
        group: "frozen",
        labelKey: "cowWeight.audit.chestPxDelta",
        value: `${round2(liveChestPx - (frozenChestPx ?? 0))} px`,
        detail: `live ${liveChestPx} − frozen ${frozenChestPx}`,
      },
      {
        id: "frozenLengthDelta",
        group: "frozen",
        labelKey: "cowWeight.audit.lengthPxDelta",
        value: `${round2(liveLengthPx - (frozenLengthPx ?? 0))} px`,
        detail: `live ${liveLengthPx} − frozen ${frozenLengthPx}`,
      }
    );
  } else {
    drafts.push({
      id: "frozenNA",
      group: "frozen",
      labelKey: "cowWeight.audit.frozenNA",
      value: "n/a",
      detail: "No Detect snapshot yet",
    });
  }

  pushLineAudit(
    drafts,
    "lines",
    "ch",
    "cowWeight.audit.chestPointA",
    "cowWeight.audit.chestPointB",
    "cowWeight.audit.chestDx",
    "cowWeight.audit.chestDy",
    "cowWeight.audit.chestLinePx",
    lines.chest
  );

  pushLineAudit(
    drafts,
    "lines",
    "ln",
    "cowWeight.audit.lengthPointA",
    "cowWeight.audit.lengthPointB",
    "cowWeight.audit.lengthDx",
    "cowWeight.audit.lengthDy",
    "cowWeight.audit.lengthLinePx",
    lines.length
  );

  pushLineAudit(
    drafts,
    "lines",
    "ht",
    "cowWeight.audit.heightPointGround",
    "cowWeight.audit.heightPointTop",
    "cowWeight.audit.heightDx",
    "cowWeight.audit.heightDy",
    "cowWeight.audit.heightLinePx",
    heightLine
  );

  drafts.push({
    id: "lnSpan",
    group: "lines",
    labelKey: "cowWeight.audit.lengthSpanTypical",
    value: `${lengthSpanPx} px`,
    detail: `bbox.width ${bboxWidthPx} × ${TYPICAL_LENGTH_SPAN_FRAC}`,
  });

  if (lines.reference && metrics.referencePixels != null && metrics.referencePixels > 0) {
    pushLineAudit(
      drafts,
      "lines",
      "ref",
      "cowWeight.audit.refPointR1",
      "cowWeight.audit.refPointR2",
      "cowWeight.audit.refDx",
      "cowWeight.audit.refDy",
      "cowWeight.audit.referencePx",
      lines.reference
    );
  } else {
    drafts.push({
      id: "refNotSet",
      group: "lines",
      labelKey: "cowWeight.audit.refNotSet",
      value: "—",
      detail: "Optional 1 m stick (Step 4)",
    });
  }

  drafts.push({
    id: "scaleMethod",
    group: "scale",
    labelKey: "cowWeight.audit.scaleMethod",
    value: metrics.scaleMethod,
  });

  drafts.push({
    id: "camZ",
    group: "scale",
    labelKey: "cowWeight.audit.cameraDistance",
    value: zCm != null ? `${zCm} cm` : "—",
    detail:
      metrics.groundDistanceDetected === false
        ? "fallback_average"
        : metrics.distanceSource ?? planD?.distanceSource ?? "",
  });

  drafts.push({
    id: "groundDet",
    group: "scale",
    labelKey: "cowWeight.audit.groundDetected",
    value:
      metrics.groundDistanceDetected === false
        ? "no (180 cm avg)"
        : metrics.groundDistanceDetected
          ? "yes"
          : "—",
  });

  if (zCm != null && focalPx != null && focalPx > 0) {
    const r1Calc = round2(zCm / focalPx);
    drafts.push({
      id: "r1formula",
      group: "scale",
      labelKey: "cowWeight.audit.r1Formula",
      value: `${r1Calc} cm/px`,
      detail: `r1 ≈ Z / focal = ${zCm} / ${round2(focalPx)}`,
    });
  }

  drafts.push(
    {
      id: "r1",
      group: "scale",
      labelKey: "cowWeight.audit.r1",
      value: r1 > 0 ? `${round2(r1)} cm/px` : "—",
    },
    {
      id: "r2",
      group: "scale",
      labelKey: "cowWeight.audit.r2",
      value: r2 > 0 ? `${round2(r2)} cm/px` : "—",
    }
  );

  drafts.push({
    id: "focal",
    group: "scale",
    labelKey: "cowWeight.audit.focalLengthPx",
    value: focalPx != null ? `${round2(focalPx)} px` : "—",
  });

  drafts.push({
    id: "geoConf",
    group: "scale",
    labelKey: "cowWeight.audit.geometryConfidence",
    value:
      metrics.geometryConfidence != null
        ? String(round2(metrics.geometryConfidence))
        : planD?.geometryConfidence != null
          ? String(round2(planD.geometryConfidence))
          : "—",
  });

  if (planD) {
    drafts.push(
      { id: "pinhole", group: "scale", labelKey: "cowWeight.audit.pinholePrior", value: `${planD.pinholePriorCm} cm` },
      { id: "localPrior", group: "scale", labelKey: "cowWeight.audit.localPrior", value: `${planD.localPriorCm} cm` },
      {
        id: "cloudPrior",
        group: "scale",
        labelKey: "cowWeight.audit.cloudPrior",
        value: planD.cloudPriorCm != null ? `${planD.cloudPriorCm} cm` : "—",
      }
    );
  }

  drafts.push(
    {
      id: "convHeight",
      group: "convert",
      labelKey: "cowWeight.audit.bboxHeightCm",
      value: `${bboxHeightCm} cm`,
      detail: r1 > 0 ? `${bboxHeightPx} × ${round2(r1)} = ${bboxHeightCm}` : "",
    },
    {
      id: "convFloor",
      group: "convert",
      labelKey: "cowWeight.audit.frameGapCm",
      value: `${floorGapCm} cm`,
      detail: r1 > 0 ? `${frameGapPx} × ${round2(r1)} = ${floorGapCm}` : "",
    },
    {
      id: "convChest",
      group: "convert",
      labelKey: "cowWeight.audit.chestCm",
      value: `${metrics.chestWidthCm} cm`,
      detail: r1 > 0 ? `${metrics.chestPixels} × ${round2(r1)} = ${metrics.chestWidthCm}` : "",
    },
    {
      id: "convLength",
      group: "convert",
      labelKey: "cowWeight.audit.lengthCm",
      value: `${metrics.bodyLengthCm} cm`,
      detail: r2 > 0 ? `${metrics.lengthPixels} × ${round2(r2)} = ${metrics.bodyLengthCm}` : "",
    }
  );

  if (metrics.referencePixels != null && metrics.referencePixels > 0 && metrics.cmPerPixel > 0) {
    drafts.push({
      id: "convRef",
      group: "convert",
      labelKey: "cowWeight.audit.referenceCm",
      value: `${round2(metrics.referencePixels * metrics.cmPerPixel)} cm`,
      detail:
        metrics.scaleMethod === "reference_100cm"
          ? "100 cm ÷ ref px"
          : `${metrics.referencePixels} × cm/px`,
    });
  }

  const weightCheck = previewWeightKg(metrics.chestWidthCm, metrics.bodyLengthCm);
  drafts.push({
    id: "weight",
    group: "weight",
    labelKey: "cowWeight.audit.liveWeight",
    value: `~${metrics.estimatedLiveWeightKg} kg`,
  });
  drafts.push({
    id: "weightDetail",
    group: "weight",
    labelKey: "cowWeight.audit.weightFormula",
    value: `(${metrics.chestWidthCm}² × ${metrics.bodyLengthCm}) ÷ ${WEIGHT_FORMULA_DIVISOR}`,
    detail: `≈ ${weightCheck} kg`,
  });

  const rows = assignLineNumbers(drafts);
  return { rows, stepFocusIds: [] };
}

export const CALCULATION_GROUP_ORDER: CalculationBreakdownGroup[] = [
  "image",
  "bbox",
  "keypoints",
  "frozen",
  "lines",
  "scale",
  "convert",
  "weight",
];
