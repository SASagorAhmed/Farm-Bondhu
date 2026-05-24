# Option B: Pixel Side masks → YOLO seg (offline on D:)

Train a cattle segmentation model from the BMGF **Pixel/Side** folders, then export **ONNX** for the FarmBondhu browser (Vercel-safe).

## Prerequisites

- Dataset extracted under `D:\FarmBondhu\cattledataset\data\...\versions\3\`
- `pip install ultralytics` in `cattledataset/.venv`
- GPU recommended (CPU training is very slow)

## 1. Locate Side image + mask pairs

Example paths:

```text
.../Pixel/B2/Side/images/<name>.jpg
.../Pixel/B2/Side/annotations/<name>.jpg___fuse.png   (or similar mask filename)
```

Cattle mask color (B2): RGB `0,255,0` (class Cattle). See dataset `Readme.md` for B3/B4 colors.

## 2. Convert masks to YOLO segmentation labels

For each Side image:

1. Load RGB mask from `annotations/`.
2. Build binary mask where pixel == cattle color (tolerance for JPEG).
3. Find largest contour / polygon.
4. Normalize polygon points to 0–1 (YOLO seg format: `class x1 y1 x2 y2 ...`).
5. Single class: `0` = cattle.

Output layout:

```text
D:\FarmBondhu\cattledataset\yolo_seg\
  data.yaml
  images/train/
  images/val/
  labels/train/
  labels/val/
```

Example `data.yaml`:

```yaml
path: D:/FarmBondhu/cattledataset/yolo_seg
train: images/train
val: images/val
names:
  0: cattle
nc: 1
```

Split ~80/20 train/val from B2/B3/B4 Side images only (skip Rear for FarmBondhu side-view app).

Add `yolo_seg/` to `.gitignore` if you generate it locally (large).

## 3. Train on D:

```powershell
cd D:\FarmBondhu\cattledataset
$env:ULTRALYTICS_CONFIG_DIR = "D:\FarmBondhu\cattledataset\.ultralytics"
yolo segment train model=yolov8n-seg.pt data=yolo_seg/data.yaml epochs=100 imgsz=640 batch=8
```

Weights land in `cattledataset/runs/segment/train/weights/best.pt` (gitignored).

## 4. Export ONNX for Vercel / browser

```powershell
yolo export model=runs/segment/train/weights/best.pt format=onnx imgsz=640 simplify=True
copy runs\segment\train\weights\best.onnx D:\FarmBondhu\frontend\public\models\yolov8n-seg.onnx
```

Or upload ONNX to CDN and set `VITE_COW_YOLO_SEG_MODEL_URL` in Vercel env.

## 5. App code change

In `frontend/src/lib/cowWeight/yoloSegDetect.ts` and `yoloDetect.ts`:

- Set `YOLO_COW_CLASS_ID = 0` (single class `cattle`).
- If ONNX output shape differs from COCO-80, adjust `NUM_CLASSES` / parsing (only if export fails in browser).

## 6. Accuracy for chest + length

Better seg → better bbox + outline → better default C1/C2/L1/L2. **Still use Plan C (1 m stick)** for cm scale unless you adopt keypoint ONNX (Option C in main README).

## Optional: conversion script

A future `convert_pixel_to_yolo.py` can automate steps 2–split. For now, use Roboflow import or a small custom script on D: only.
