# Cow detection models

## Quick setup (segmentation — exact body outline)

From `frontend/` (requires **Python 3** on PATH):

```bash
npm run cow:models:seg
```

This exports `yolov8n-seg.onnx` (~12 MB) into this folder via Ultralytics. **`yolov8n-seg.onnx` is committed to Git** so Vercel production serves the same model as local dev. Re-run export and commit if you replace the model file.

**Windows:** Install [Python 3](https://www.python.org/downloads/) and ensure `python` works in a terminal. The script runs `pip install ultralytics onnx` automatically.

**After export:** Restart `npm run dev`, upload a side-view cow photo, re-analyze. Step 1 should show **AI body outline** and `analysis.model` = `yolov8n-seg-onnx`.

## Detection (bounding box)

Place `yolov8n.onnx` here for browser YOLO detect (optional if seg is present).

```bash
pip install ultralytics
yolo export model=yolov8n.pt format=onnx imgsz=640
# copy yolov8n.onnx to frontend/public/models/
```

Optional env: `VITE_COW_YOLO_MODEL_URL=/models/yolov8n.onnx`

## Segmentation (exact body outline)

Manual export (same as `npm run cow:models:seg`):

```bash
pip install ultralytics onnx
yolo export model=yolov8n-seg.pt format=onnx imgsz=640 simplify=True
# copy yolov8n-seg.onnx to frontend/public/models/
```

Optional env: `VITE_COW_YOLO_SEG_MODEL_URL=/models/yolov8n-seg.onnx`

When seg ONNX is present, analyze tries **segmentation first** (`yolov8n-seg-onnx`) and traces the decoded mask for an exact curved border. Without seg ONNX, the app uses detect ONNX or COCO-SSD for the bbox, then an **estimated silhouette** (largest dark blob + side-view ribbon contour). For the exact ML cow border, run `npm run cow:models:seg`.

## Fallback

If both ONNX files are missing, the app falls back to TensorFlow.js COCO-SSD (`cow` class) with bbox only and an estimated outline from photo thresholding.
