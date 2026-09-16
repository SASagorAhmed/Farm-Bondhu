import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const STEP = 0.35;
const DOUBLE_TAP_MS = 280;

type ZoomState = { scale: number; tx: number; ty: number };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function clampPan(scale: number, tx: number, ty: number, width: number, height: number) {
  if (scale <= 1) return { tx: 0, ty: 0 };
  const maxX = ((scale - 1) * width) / 2;
  const maxY = ((scale - 1) * height) / 2;
  return {
    tx: clamp(tx, -maxX, maxX),
    ty: clamp(ty, -maxY, maxY),
  };
}

function isToolbarTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(".consultation-zego-stage-toolbar"));
}

function touchDistance(a: Touch, b: Touch) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

/**
 * Zoom/Meet-style zoom for the fullscreen call stage.
 * Pinch + wheel + pan; reset when disabled (leaving fullscreen).
 */
export function useCallStageZoom(
  targetRef: RefObject<HTMLElement | null>,
  enabled: boolean
): {
  style: CSSProperties;
  scale: number;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
} {
  const [state, setState] = useState<ZoomState>({ scale: 1, tx: 0, ty: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;

  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originTx: number;
    originTy: number;
  } | null>(null);
  const lastTapRef = useRef(0);

  const reset = useCallback(() => {
    setState({ scale: 1, tx: 0, ty: 0 });
  }, []);

  const applyScale = useCallback((nextScale: number, focusX?: number, focusY?: number) => {
    const el = targetRef.current;
    const prev = stateRef.current;
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    if (!el) {
      setState({ scale, tx: scale <= 1 ? 0 : prev.tx, ty: scale <= 1 ? 0 : prev.ty });
      return;
    }
    const rect = el.getBoundingClientRect();
    const width = rect.width || 1;
    const height = rect.height || 1;

    let tx = prev.tx;
    let ty = prev.ty;
    if (scale <= 1) {
      tx = 0;
      ty = 0;
    } else if (focusX != null && focusY != null && prev.scale > 0) {
      // Keep the point under the cursor/pinch roughly stable.
      const cx = width / 2;
      const cy = height / 2;
      const ox = focusX - cx;
      const oy = focusY - cy;
      const ratio = scale / prev.scale;
      tx = ox - (ox - prev.tx) * ratio;
      ty = oy - (oy - prev.ty) * ratio;
    }

    const pan = clampPan(scale, tx, ty, width, height);
    setState({ scale, ...pan });
  }, [targetRef]);

  const zoomIn = useCallback(() => {
    applyScale(stateRef.current.scale + STEP);
  }, [applyScale]);

  const zoomOut = useCallback(() => {
    applyScale(stateRef.current.scale - STEP);
  }, [applyScale]);

  useEffect(() => {
    if (!enabled) {
      reset();
      pinchRef.current = null;
      panRef.current = null;
    }
  }, [enabled, reset]);

  useEffect(() => {
    const el = targetRef.current;
    if (!enabled || !el) return;

    const onWheel = (event: WheelEvent) => {
      if (isToolbarTarget(event.target)) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const delta = event.deltaY > 0 ? -STEP * 0.6 : STEP * 0.6;
      applyScale(stateRef.current.scale + delta, event.clientX - rect.left, event.clientY - rect.top);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (isToolbarTarget(event.target)) return;
      if (event.pointerType === "touch") return; // pan via touch handlers
      if (stateRef.current.scale <= 1) return;
      if (event.button !== 0) return;
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originTx: stateRef.current.tx,
        originTy: stateRef.current.ty,
      };
      el.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      const pan = panRef.current;
      if (!pan || pan.pointerId !== event.pointerId) return;
      const rect = el.getBoundingClientRect();
      const next = clampPan(
        stateRef.current.scale,
        pan.originTx + (event.clientX - pan.startX),
        pan.originTy + (event.clientY - pan.startY),
        rect.width || 1,
        rect.height || 1
      );
      setState((s) => ({ ...s, ...next }));
    };

    const endPan = (event: PointerEvent) => {
      if (panRef.current?.pointerId === event.pointerId) {
        panRef.current = null;
        try {
          el.releasePointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }
    };

    const onDblClick = (event: MouseEvent) => {
      if (isToolbarTarget(event.target)) return;
      event.preventDefault();
      reset();
    };

    const onTouchStart = (event: TouchEvent) => {
      if (isToolbarTarget(event.target)) return;
      if (event.touches.length === 2) {
        panRef.current = null;
        pinchRef.current = {
          startDist: touchDistance(event.touches[0], event.touches[1]),
          startScale: stateRef.current.scale,
        };
        return;
      }
      if (event.touches.length === 1 && stateRef.current.scale > 1) {
        const t = event.touches[0];
        panRef.current = {
          pointerId: -1,
          startX: t.clientX,
          startY: t.clientY,
          originTx: stateRef.current.tx,
          originTy: stateRef.current.ty,
        };
      }

      const now = Date.now();
      if (event.touches.length === 1 && now - lastTapRef.current < DOUBLE_TAP_MS) {
        lastTapRef.current = 0;
        reset();
        return;
      }
      if (event.touches.length === 1) lastTapRef.current = now;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (isToolbarTarget(event.target)) return;
      if (event.touches.length === 2 && pinchRef.current) {
        event.preventDefault();
        const dist = touchDistance(event.touches[0], event.touches[1]);
        if (pinchRef.current.startDist <= 0) return;
        const rect = el.getBoundingClientRect();
        const midX =
          (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
        const midY =
          (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
        const next = pinchRef.current.startScale * (dist / pinchRef.current.startDist);
        applyScale(next, midX, midY);
        return;
      }
      if (event.touches.length === 1 && panRef.current && stateRef.current.scale > 1) {
        event.preventDefault();
        const t = event.touches[0];
        const rect = el.getBoundingClientRect();
        const next = clampPan(
          stateRef.current.scale,
          panRef.current.originTx + (t.clientX - panRef.current.startX),
          panRef.current.originTy + (t.clientY - panRef.current.startY),
          rect.width || 1,
          rect.height || 1
        );
        setState((s) => ({ ...s, ...next }));
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchRef.current = null;
      if (event.touches.length === 0) panRef.current = null;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endPan);
    el.addEventListener("pointercancel", endPan);
    el.addEventListener("dblclick", onDblClick);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endPan);
      el.removeEventListener("pointercancel", endPan);
      el.removeEventListener("dblclick", onDblClick);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [applyScale, enabled, reset, targetRef]);

  const style = useMemo<CSSProperties>(
    () => ({
      transform: `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`,
      transformOrigin: "center center",
      cursor: enabled && state.scale > 1 ? "grab" : undefined,
    }),
    [enabled, state.scale, state.tx, state.ty]
  );

  return { style, scale: state.scale, zoomIn, zoomOut, reset };
}
