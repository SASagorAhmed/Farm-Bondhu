import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CowBodyDirection } from "@/lib/cowWeight/cowDirection";
import type { BBox, CowKeypoints, CowLines, LineSegment, Point2D, ScanStepId } from "@/lib/cowWeight/types";
import { stepShowsBbox, stepShowsChest, stepShowsLength, stepShowsReference, stepAllowsDrag } from "@/lib/cowWeight/scanMetrics";
import { clampLinesToBBox } from "@/lib/cowWeight/proposeLines";
import { resolveStep1Keypoints } from "@/lib/cowWeight/cowKeypoints";
import type { DetectionMode } from "@/lib/cowWeight/types";

type DragTarget =
  | { kind: "chest"; end: "a" | "b" }
  | { kind: "length"; end: "a" | "b" }
  | { kind: "reference"; end: "a" | "b" }
  | { kind: "leg1" }
  | { kind: "leg2" }
  | { kind: "topChest" }
  | { kind: "lowerChest" }
  | null;

const MAX_DISPLAY_HEIGHT = 600;

function computeDisplaySize(containerWidth: number, imageWidth: number, imageHeight: number) {
  if (!imageWidth || !imageHeight) return { w: 320, h: 240 };

  let availW = containerWidth;
  if (availW <= 0) {
    const parentW = typeof window !== "undefined" ? Math.min(window.innerWidth * 0.45, 480) : 400;
    availW = parentW > 0 ? parentW : 320;
  }

  const scale = Math.min(availW / imageWidth, MAX_DISPLAY_HEIGHT / imageHeight);
  const safeScale = scale > 0 && Number.isFinite(scale) ? scale : Math.min(320 / imageWidth, MAX_DISPLAY_HEIGHT / imageHeight);

  return {
    w: Math.max(1, Math.round(imageWidth * safeScale)),
    h: Math.max(1, Math.round(imageHeight * safeScale)),
  };
}

interface CowWeightOverlayProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  bbox: BBox;
  lines: CowLines;
  mode: DetectionMode;
  activeStep: ScanStepId;
  showReference: boolean;
  editable?: boolean;
  onLinesChange: (lines: CowLines) => void;
  onReferenceTapMode?: boolean;
  onReferenceTap?: (a: Point2D, b: Point2D) => void;
  onKeypointsChange?: (keypoints: CowKeypoints) => void;
  keypoints?: CowKeypoints | null;
  /** Step 1: "Cow faces left" / "Cow faces right" (top-right on photo). */
  orientationLabel?: string | null;
  /** Step 1: resolved body direction for head arrow. */
  headDirection?: CowBodyDirection | null;
  /** Step 1: head region box (vision assist or mask heuristic). */
  headBbox?: BBox | null;
  /** Segmentation / heuristic body outline (image coordinates). */
  bodyOutline?: Point2D[] | null;
  /** Short label for outline source (Step 1). */
  outlineSourceLabel?: string | null;
}

const CHEST_COLOR = "#0a6b74";
const LENGTH_COLOR = "#c92a2a";
const REF_COLOR = "#f59f00";
const BBOX_COLOR = "#22c55e";
/** Detection bbox (always shown on step 1+). */
const BBOX_FILL = "rgba(34, 197, 94, 0.06)";
/** Legacy green body silhouette underlay. */
const BODY_OUTLINE_GREEN_FILL = "rgba(34, 197, 94, 0.14)";
const BODY_OUTLINE_GREEN_STROKE = "#16a34a";
/** Red cow body mask / exact shape on top (CapCut-style fill). */
const BODY_OUTLINE_FILL = "rgba(220, 38, 38, 0.38)";
const BODY_OUTLINE_STROKE = "#ef4444";
const LEG_GUIDE_COLOR = "#eab308";
const KEYPOINT_PREVIEW_CHEST = "#0a6b74";
const HEAD_BOX_STROKE = "#f97316";
const HEAD_BOX_FILL = "rgba(249, 115, 22, 0.12)";

export default function CowWeightOverlay({
  imageUrl,
  imageWidth,
  imageHeight,
  bbox,
  lines,
  mode,
  activeStep,
  showReference,
  editable = true,
  onLinesChange,
  onReferenceTapMode,
  onReferenceTap,
  onKeypointsChange,
  keypoints,
  orientationLabel,
  headDirection,
  headBbox,
  bodyOutline,
  outlineSourceLabel,
}: CowWeightOverlayProps) {
  const { t } = useLanguage();
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragTarget>(null);
  const [tapPoints, setTapPoints] = useState<Point2D[]>([]);
  const [displaySize, setDisplaySize] = useState(() =>
    computeDisplaySize(400, imageWidth, imageHeight)
  );

  const canDragLines = editable && stepAllowsDrag(activeStep) && !onReferenceTapMode;
  const canDragStep1Kp =
    editable && activeStep === 1 && !onReferenceTapMode && !!onKeypointsChange;

  const bx = bbox.x;
  const by = bbox.y;
  const bw = bbox.width;
  const bh = bbox.height;
  const labelFontSize = Math.max(22, Math.min(44, Math.max(bh, bw) * 0.042));
  const handleRadius = Math.max(10, labelFontSize * 0.4);
  const handleRadiusHi = handleRadius * 1.3;
  const labelOffsetX = labelFontSize * 0.75;
  const labelOffsetY = labelFontSize * 0.32;
  const textStrokeW = Math.max(4, labelFontSize * 0.14);
  const lineStrokeW = Math.max(3, bh * 0.004);
  const hitRadius = Math.max(32, labelFontSize * 1.4);

  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    let containerW = el.getBoundingClientRect().width;
    if (containerW <= 0 && el.parentElement) {
      containerW = el.parentElement.getBoundingClientRect().width;
    }
    setDisplaySize(computeDisplaySize(containerW, imageWidth, imageHeight));
  }, [imageWidth, imageHeight]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [measure]);

  const scaleX = displaySize.w / imageWidth || 1;
  const scaleY = displaySize.h / imageHeight || 1;

  const toImageCoords = useCallback(
    (clientX: number, clientY: number): Point2D => {
      const svg = svgRef.current;
      if (svg) {
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const p = pt.matrixTransform(ctm.inverse());
          return {
            x: Math.max(0, Math.min(imageWidth, p.x)),
            y: Math.max(0, Math.min(imageHeight, p.y)),
          };
        }
      }
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: Math.max(0, Math.min(imageWidth, (clientX - rect.left) / scaleX)),
        y: Math.max(0, Math.min(imageHeight, (clientY - rect.top) / scaleY)),
      };
    },
    [imageWidth, imageHeight, scaleX, scaleY]
  );

  const step1Kp = useMemo(
    () => resolveStep1Keypoints(keypoints, lines, bbox),
    [keypoints, lines, bbox]
  );

  const pickHandle = (p: Point2D): DragTarget => {
    const hits: Array<{ t: DragTarget; d: number }> = [];
    const addPt = (t: DragTarget, pt: Point2D) => {
      hits.push({ t, d: Math.hypot(pt.x - p.x, pt.y - p.y) });
    };
    if (canDragStep1Kp) {
      const kp = step1Kp;
      addPt({ kind: "leg1" }, kp.leg1);
      addPt({ kind: "leg2" }, kp.leg2);
      addPt({ kind: "topChest" }, kp.topChest);
      addPt({ kind: "lowerChest" }, kp.lowerChest);
    }
    if (!canDragLines) {
      hits.sort((a, b) => a.d - b.d);
      if (hits.length && hits[0].d < hitRadius) return hits[0].t;
      return null;
    }
    const add = (kind: "chest" | "length" | "reference", line: LineSegment, end: "a" | "b") => {
      const pt = end === "a" ? line.a : line.b;
      hits.push({ t: { kind, end }, d: Math.hypot(pt.x - p.x, pt.y - p.y) });
    };
    if (stepShowsChest(activeStep)) {
      add("chest", lines.chest, "a");
      add("chest", lines.chest, "b");
    }
    if (stepShowsLength(activeStep)) {
      add("length", lines.length, "a");
      add("length", lines.length, "b");
    }
    if (lines.reference && showReference && stepShowsReference(activeStep, true)) {
      add("reference", lines.reference, "a");
      add("reference", lines.reference, "b");
    }
    hits.sort((a, b) => a.d - b.d);
    if (hits.length && hits[0].d < hitRadius) return hits[0].t;
    return null;
  };

  const updateLine = (target: DragTarget, p: Point2D) => {
    if (!target) return;
    if (
      target.kind === "leg1" ||
      target.kind === "leg2" ||
      target.kind === "topChest" ||
      target.kind === "lowerChest"
    ) {
      if (!onKeypointsChange) return;
      const base = step1Kp;
      const next: CowKeypoints = {
        ...base,
        detected: { ...base.detected },
      };
      if (target.kind === "leg1") next.leg1 = p;
      else if (target.kind === "leg2") next.leg2 = p;
      else if (target.kind === "topChest") next.topChest = p;
      else if (target.kind === "lowerChest") next.lowerChest = p;
      next.chestCenterX = (next.topChest.x + next.lowerChest.x) / 2;
      onKeypointsChange(next);
      return;
    }
    const next = { ...lines, chest: { ...lines.chest }, length: { ...lines.length } };
    if (target.kind === "chest") next.chest[target.end] = p;
    else if (target.kind === "length") next.length[target.end] = p;
    else if (target.kind === "reference" && next.reference) {
      next.reference = { ...next.reference, [target.end]: p };
    }
    onLinesChange(clampLinesToBBox(next, bbox));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = toImageCoords(e.clientX, e.clientY);
    if (onReferenceTapMode) {
      const next = [...tapPoints, p];
      if (next.length >= 2) {
        onReferenceTap?.(next[0], next[1]);
        setTapPoints([]);
      } else {
        setTapPoints(next);
      }
      return;
    }
    setDrag(pickHandle(p));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    updateLine(drag, toImageCoords(e.clientX, e.clientY));
  };

  const px = (p: Point2D) => p;

  const drawLabeledPoint = (p: Point2D, label: string, color: string, highlight: boolean) => {
    const { x, y } = px(p);
    const r = highlight ? handleRadiusHi : handleRadius;
    return (
      <g key={label}>
        <circle cx={x} cy={y} r={r} fill={color} stroke="#fff" strokeWidth={Math.max(2, r * 0.2)} />
        <text
          x={x + labelOffsetX}
          y={y + labelOffsetY}
          fill="#fff"
          fontSize={labelFontSize}
          fontWeight="700"
          stroke="#000"
          strokeWidth={textStrokeW}
          paintOrder="stroke"
        >
          {label}
        </text>
      </g>
    );
  };

  const drawLine = (line: LineSegment, color: string, key: string) => {
    const a = px(line.a);
    const b = px(line.b);
    const hr = handleRadius * 0.95;
    return (
      <g key={key}>
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={color}
          strokeWidth={lineStrokeW}
          strokeDasharray={canDragLines ? undefined : "6 4"}
        />
        {canDragLines && (
          <>
            <circle cx={a.x} cy={a.y} r={hr} fill={color} stroke="#fff" strokeWidth={Math.max(2, hr * 0.2)} />
            <circle cx={b.x} cy={b.y} r={hr} fill={color} stroke="#fff" strokeWidth={Math.max(2, hr * 0.2)} />
          </>
        )}
      </g>
    );
  };

  const showDim = activeStep >= 2 && activeStep <= 3;

  const frameW = displaySize.w > 0 ? displaySize.w : "100%";
  const frameH = displaySize.h > 0 ? displaySize.h : undefined;
  const bboxClipId = useId().replace(/:/g, "");
  const headArrowMarkerId = useId().replace(/:/g, "");

  const bodyOutlinePath = useMemo(() => {
    if (!bodyOutline || bodyOutline.length < 3) return null;
    const d =
      bodyOutline
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
        .join(" ") + " Z";
    return d;
  }, [bodyOutline]);

  const renderStep1Keypoints = () => {
    if (activeStep !== 1) return null;
    const kp = step1Kp;
    const legGuideTop = by + bh * 0.22;
    const legTop = by;
    const legBottom = by + bh;
    const bandX1 = bx + bw * 0.04;
    const bandX2 = bx + bw * 0.96;

    const headPt = kp.l2;
    const tailPt = kp.l1;
    const lengthMidY = (headPt.y + tailPt.y) / 2;
    const headSide = headDirection?.headSide;
    const tailSide =
      headDirection?.tailSide ??
      (headSide === "left" ? "right" : headSide === "right" ? "left" : "unknown");

    const directionUnknown = !headSide || headSide === "unknown";

    const arrowFromX =
      tailSide === "left"
        ? bx + bw * 0.12
        : tailSide === "right"
          ? bx + bw * 0.88
          : (headPt.x + tailPt.x) / 2;
    const arrowFromY = lengthMidY;

    const arrowToX =
      headSide === "left"
        ? bx + bw * 0.1
        : headSide === "right"
          ? bx + bw * 0.9
          : headPt.x;
    const arrowToY = lengthMidY;

    const dx = arrowToX - arrowFromX;
    const dy = arrowToY - arrowFromY;
    const segLen = Math.hypot(dx, dy) || 1;
    const arrowLineToX = arrowToX - (dx / segLen) * Math.min(28, segLen * 0.12);
    const arrowLineToY = arrowToY - (dy / segLen) * Math.min(28, segLen * 0.12);

    return (
      <>
        <defs>
          <clipPath id={bboxClipId}>
            <rect x={bx} y={by} width={bw} height={bh} />
          </clipPath>
          <marker
            id={headArrowMarkerId}
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill="#f59e0b" />
          </marker>
        </defs>
        <g key="step1-keypoints" pointerEvents="none" clipPath={`url(#${bboxClipId})`}>
          <line
            x1={kp.leg1.x}
            y1={legGuideTop}
            x2={kp.leg1.x}
            y2={kp.leg1.y}
            stroke={LEG_GUIDE_COLOR}
            strokeWidth={5}
            strokeOpacity={0.9}
            strokeDasharray="10 6"
          />
          <line
            x1={kp.leg2.x}
            y1={legGuideTop}
            x2={kp.leg2.x}
            y2={kp.leg2.y}
            stroke={LEG_GUIDE_COLOR}
            strokeWidth={5}
            strokeOpacity={0.9}
            strokeDasharray="10 6"
          />
          <line
            x1={kp.chestCenterX}
            y1={legTop}
            x2={kp.chestCenterX}
            y2={legBottom}
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="4 4"
            strokeOpacity={0.85}
          />
          <line
            x1={bandX1}
            y1={kp.topChest.y}
            x2={bandX2}
            y2={kp.topChest.y}
            stroke={LEG_GUIDE_COLOR}
            strokeWidth={4}
            strokeOpacity={0.85}
            strokeDasharray="8 5"
          />
          <line
            x1={bandX1}
            y1={kp.lowerChest.y}
            x2={bandX2}
            y2={kp.lowerChest.y}
            stroke={LEG_GUIDE_COLOR}
            strokeWidth={4}
            strokeOpacity={0.85}
            strokeDasharray="8 5"
          />
          <line
            x1={kp.topChest.x}
            y1={kp.topChest.y}
            x2={kp.lowerChest.x}
            y2={kp.lowerChest.y}
            stroke={KEYPOINT_PREVIEW_CHEST}
            strokeWidth={3}
            strokeDasharray="6 4"
            strokeOpacity={0.95}
          />
          <line
            x1={kp.l1.x}
            y1={kp.l1.y}
            x2={kp.l2.x}
            y2={kp.l2.y}
            stroke={LENGTH_COLOR}
            strokeWidth={3}
            strokeDasharray="6 4"
            strokeOpacity={0.85}
          />
          <line
            x1={arrowFromX}
            y1={arrowFromY}
            x2={arrowLineToX}
            y2={arrowLineToY}
            stroke="#f59e0b"
            strokeWidth={5}
            strokeOpacity={directionUnknown ? 0.55 : 0.95}
            strokeDasharray={directionUnknown ? "10 8" : undefined}
            markerEnd={`url(#${headArrowMarkerId})`}
          />
          {directionUnknown && (
            <text
              x={(arrowFromX + arrowToX) / 2}
              y={lengthMidY - 22}
              textAnchor="middle"
              fill="#f59e0b"
              fontSize={18}
              fontWeight="700"
              stroke="#fff"
              strokeWidth={3}
              paintOrder="stroke"
            >
              ?
            </text>
          )}
          {drawLabeledPoint(
            kp.leg1,
            t("cowWeight.scan.frontLegShort"),
            LEG_GUIDE_COLOR,
            canDragStep1Kp
          )}
          {drawLabeledPoint(
            kp.leg2,
            t("cowWeight.scan.hindLegShort"),
            LEG_GUIDE_COLOR,
            canDragStep1Kp
          )}
          {drawLabeledPoint(kp.topChest, "C1", KEYPOINT_PREVIEW_CHEST, canDragStep1Kp)}
          {drawLabeledPoint(kp.lowerChest, "C2", KEYPOINT_PREVIEW_CHEST, canDragStep1Kp)}
          {drawLabeledPoint(kp.l1, "L1", LENGTH_COLOR, false)}
          {drawLabeledPoint(kp.l2, "L2", LENGTH_COLOR, false)}
        </g>
      </>
    );
  };

  return (
    <div ref={wrapRef} className="relative w-full min-h-[320px] flex justify-center items-start">
      <div
        ref={frameRef}
        className="relative rounded-lg overflow-hidden border bg-muted/30 max-w-full"
        style={{
          width: frameW,
          height: frameH,
          aspectRatio: `${imageWidth} / ${imageHeight}`,
          maxHeight: MAX_DISPLAY_HEIGHT,
        }}
      >
        <img
          src={imageUrl}
          alt="Cow"
          className="w-full h-full object-cover"
          draggable={false}
          onLoad={measure}
        />
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full touch-none"
          viewBox={`0 0 ${imageWidth} ${imageHeight}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
        >
          {showDim && (
            <>
              <rect x={0} y={0} width={imageWidth} height={by} fill="rgba(0,0,0,0.45)" />
              <rect x={0} y={by + bh} width={imageWidth} height={imageHeight - by - bh} fill="rgba(0,0,0,0.45)" />
              <rect x={0} y={by} width={bx} height={bh} fill="rgba(0,0,0,0.45)" />
              <rect x={bx + bw} y={by} width={imageWidth - bx - bw} height={bh} fill="rgba(0,0,0,0.45)" />
            </>
          )}

          {stepShowsBbox(activeStep) && (
            <rect
              x={bx}
              y={by}
              width={bw}
              height={bh}
              fill={BBOX_FILL}
              stroke={BBOX_COLOR}
              strokeWidth={2}
              strokeDasharray="8 4"
              pointerEvents="none"
            />
          )}

          {activeStep === 1 && headBbox && headBbox.width > 0 && headBbox.height > 0 && (
            <g pointerEvents="none">
              <rect
                x={headBbox.x}
                y={headBbox.y}
                width={headBbox.width}
                height={headBbox.height}
                fill={HEAD_BOX_FILL}
                stroke={HEAD_BOX_STROKE}
                strokeWidth={3}
                strokeDasharray="10 6"
              />
              <text
                x={headBbox.x + 6}
                y={headBbox.y + Math.max(20, headBbox.height * 0.2)}
                fill={HEAD_BOX_STROKE}
                fontSize={Math.max(16, labelFontSize * 0.55)}
                fontWeight="700"
                stroke="#fff"
                strokeWidth={textStrokeW * 0.6}
                paintOrder="stroke"
              >
                {t("cowWeight.scan.headBoxLabel")}
              </text>
            </g>
          )}

          {renderStep1Keypoints()}

          {stepShowsChest(activeStep) && (
            <>
              {drawLine(lines.chest, CHEST_COLOR, "chest")}
              {drawLabeledPoint(lines.chest.a, "C1", CHEST_COLOR, activeStep === 2)}
              {drawLabeledPoint(lines.chest.b, "C2", CHEST_COLOR, activeStep === 2)}
            </>
          )}

          {stepShowsLength(activeStep) && (
            <>
              {drawLine(lines.length, LENGTH_COLOR, "length")}
              {drawLabeledPoint(lines.length.a, "L1", LENGTH_COLOR, activeStep === 3)}
              {drawLabeledPoint(lines.length.b, "L2", LENGTH_COLOR, activeStep === 3)}
            </>
          )}

          {showReference && lines.reference && stepShowsReference(activeStep, true) && (
            <>
              {drawLine(lines.reference, REF_COLOR, "ref")}
              {drawLabeledPoint(lines.reference.a, "R1", REF_COLOR, activeStep === 4)}
              {drawLabeledPoint(lines.reference.b, "R2", REF_COLOR, activeStep === 4)}
            </>
          )}

          {activeStep === 4 && !lines.reference && (
            <line
              x1={bx + bw * 0.05}
              y1={by}
              x2={bx + bw * 0.05}
              y2={by + bh}
              stroke="#a855f7"
              strokeWidth={2}
              strokeDasharray="4 3"
            />
          )}

          {stepShowsBbox(activeStep) && bodyOutlinePath && (
            <>
              <path
                d={bodyOutlinePath}
                fill={BODY_OUTLINE_GREEN_FILL}
                stroke={BODY_OUTLINE_GREEN_STROKE}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                fillRule="evenodd"
                pointerEvents="none"
              />
              <path
                d={bodyOutlinePath}
                fill={BODY_OUTLINE_FILL}
                stroke={BODY_OUTLINE_STROKE}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
                fillRule="evenodd"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            </>
          )}
        </svg>

        {activeStep === 1 && (
          <>
            <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
              <div className="bg-black/75 text-white text-sm sm:text-base font-medium px-3 py-1.5 rounded-md shadow">
                Cow detected {Math.round(bbox.confidence * 100)}%
              </div>
              {outlineSourceLabel && bodyOutlinePath && (
                <div className="bg-red-700/90 text-white text-[10px] sm:text-xs font-medium px-2 py-1 rounded-md shadow">
                  {outlineSourceLabel}
                </div>
              )}
            </div>
            {orientationLabel && (
              <div className="absolute top-2 right-2 bg-amber-500/95 text-amber-950 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-md shadow max-w-[min(100%,220px)] text-right">
                {orientationLabel}
              </div>
            )}
          </>
        )}

        {onReferenceTapMode && tapPoints.length === 1 && (
          <p className="absolute bottom-2 left-2 right-2 text-sm bg-black/75 text-white rounded-md px-3 py-2 text-center">
            Tap bottom of 1m stick (R2)
          </p>
        )}
      </div>
    </div>
  );
}
