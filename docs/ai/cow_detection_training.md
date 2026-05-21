# Cow detection — training from farmer feedback

FarmBondhu saves **head direction corrections** from cow weight Step 1 into `cow_detection_feedback`. Use this guide to improve local YOLO / head detection over time.

## Flow

1. Farmer scans a cow → browser YOLO/seg + local keypoints + **one cloud vision assist** (head, front/hind legs, chest, distance hint) every scan.
2. If AI is wrong, farmer picks **Head left / Head right** and taps **Save correction for training**.
3. Admin exports data → trains YOLO → deploys new ONNX to `frontend/public/models/`.

## Export data

### Admin UI

`/admin/cow-detection-export` — download JSON pack (YOLO label lines + metadata).

### CLI (YOLO folders)

```bash
cd backend
npm run db:ensure
npm run cow:export-feedback
```

Output: `backend/exports/cow-feedback-YYYYMMDD/` with `images/`, `labels/`, `data.yaml`, `README.md`.

Image files are URL stubs unless you add a download step; labels and `annotation_json` bbox are the main training signal.

## Train (Ultralytics)

```bash
pip install ultralytics
yolo train model=yolov8n.pt data=backend/exports/cow-feedback-YYYYMMDD/data.yaml epochs=100 imgsz=640
yolo export model=runs/detect/train/weights/best.pt format=onnx
```

Copy exported ONNX:

- Full cow: replace `frontend/public/models/yolov8n.onnx` or seg model (update `YOLO_COW_CLASS_ID` in `yoloDetect.ts` if single-class).
- Head-only (optional Phase 4): `cow_head.onnx` + loader in frontend.

## Runtime behavior (current app)

| Step | Behavior |
|------|----------|
| New photo | Always runs `analyzeCowImage` (fresh browser detection) |
| Step 1 | Always calls OpenRouter full assist (`OPENROUTER_VISION_MODEL`) — head, legs, chest, standoff |
| Re-analyze | Re-runs YOLO/mask without retake |
| Leg labels | **Front** = `leg1` (head-side foreleg), **Hind** = `leg2` (tail-side) |
| Distance | Plan B estimate (~m) + warnings; 1 m stick (Plan C) still sets exact scale |
| Head box | Anchored to **L2 (head)** after facing order; vision bbox when verified |

## Env

- `OPENROUTER_API_KEY` — vision verify
- `OPENROUTER_VISION_MODEL` — must support images (not text-only chat models)
- `COW_DIRECTION_ASSIST_ENABLED=false` — disable cloud verify only

Chat models (`OPENROUTER_CHAT_MODELS`) do **not** affect cow weight vision.
