# Cattle YOLO Seg dataset (local D: only)

## Best solution (recommended)

| Use | Dataset |
|-----|---------|
| **Primary (this repo)** | [`nasdevs/project-cattle-weight-detection`](https://www.kaggle.com/datasets/nasdevs/project-cattle-weight-detection) — **YOLO Seg** for cow pixel mask/bbox |
| **Removed** | `sadhliroomyprime/...` BMGF ~47 GB — research masks/keypoints, not needed for Vercel pixel pipeline |

**Vercel:** Camera + gallery upload → **browser pixel analysis** (ONNX WASM) → chest/length lines → API formula. Dataset stays on **D:**; only **small ONNX** ships to production.

## Product flow (already works on Vercel)

1. User **takes photo** or **uploads** image — `CowWeightUpload.tsx`
2. Browser runs `analyzeCowImage` — YOLO seg ONNX, mask, proposed C1/C2/L1/L2
3. User confirms lines in scan wizard
4. **Plan C** (1 m stick) or **Plan B** for cm → weight formula

## Scripts

| Script | Purpose |
|--------|---------|
| `download_dataset.py` | Download nasdevs to `data/` on D: |
| `download.ps1` | Windows wrapper |
| `cleanup_old_dataset.py` | Delete old sadhliroomyprime + `*.archive` |
| `inspect_download.py` | Find `data.yaml`, `.pt`, train/val images |

## Download

```powershell
cd D:\FarmBondhu\cattledataset
python cleanup_old_dataset.py    # if old 47 GB BMGF still present
pip install -r requirements.txt
.\download.ps1
python inspect_download.py
```

## ONNX for Vercel

```powershell
yolo export model="<path-to-best.pt>" format=onnx imgsz=640 simplify=True
copy <exported.onnx> D:\FarmBondhu\frontend\public\models\yolov8n-seg.onnx
```

Set `YOLO_COW_CLASS_ID = 0` if single-class. Optional CDN: `VITE_COW_YOLO_SEG_MODEL_URL`.

## Git ignore

Commit: `*.py`, `*.ps1`, `*.md`, `requirements.txt` only.

Ignore: `data/`, `*.archive`, `tmp/`, `yolo_seg/`, `*.pt`, `runs/`, images.

## Old BMGF docs

See `SEG_PREP.md` / `eval_formula_sample.py` only if you kept the sadhliroomyprime pack for research.
