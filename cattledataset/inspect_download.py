#!/usr/bin/env python3
"""Inspect nasdevs YOLO Seg dataset under cattledataset/data."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_ROOT = ROOT / "data"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def count_images(folder: Path) -> int:
    if not folder.is_dir():
        return 0
    return sum(
        1
        for p in folder.rglob("*")
        if p.suffix.lower() in IMAGE_EXTS and "label" not in p.parts
    )


def main() -> None:
    print("Scanning:", DATA_ROOT)
    if not DATA_ROOT.is_dir():
        print("No data/ folder. Run: python download_dataset.py")
        return

    yaml_files = sorted(DATA_ROOT.rglob("data.yaml"))
    pt_files = sorted(DATA_ROOT.rglob("*.pt"))
    onnx_files = sorted(DATA_ROOT.rglob("*.onnx"))

    archives = list(DATA_ROOT.rglob("*.archive"))
    old_bmgf = list(DATA_ROOT.rglob("*sadhliroomyprime*"))
    if archives or old_bmgf:
        print("\n--- cleanup suggested ---")
        if archives:
            print(f"  {len(archives)} *.archive file(s) — run: python cleanup_old_dataset.py")
        if old_bmgf:
            print("  old sadhliroomyprime BMGF still present — run: python cleanup_old_dataset.py")

    print("\n--- data.yaml (YOLO) ---")
    if not yaml_files:
        print("(none yet — download may still be extracting)")
    for y in yaml_files[:5]:
        print(y)
    if len(yaml_files) > 5:
        print(f"  ... and {len(yaml_files) - 5} more")

    print("\n--- model weights (*.pt) ---")
    if not pt_files:
        print("(none — train with ultralytics or check nested folders)")
    for p in pt_files[:10]:
        print(f"  {p} ({p.stat().st_size / 1e6:.1f} MB)")
    if len(pt_files) > 10:
        print(f"  ... and {len(pt_files) - 10} more")

    if onnx_files:
        print("\n--- ONNX ---")
        for o in onnx_files[:5]:
            print(f"  {o} ({o.stat().st_size / 1e6:.1f} MB)")

    print("\n--- image counts ---")
    for pattern in ("train/images", "valid/images", "val/images", "test/images", "images/train"):
        for folder in DATA_ROOT.rglob(pattern):
            if folder.is_dir():
                n = count_images(folder)
                if n:
                    print(f"  {folder}: {n}")

    print("\n--- FarmBondhu / Vercel ---")
    print("  Camera + upload: already in app (browser pixel analysis)")
    print("  Deploy: export ONNX -> frontend/public/models/yolov8n-seg.onnx")
    print("  Or CDN: VITE_COW_YOLO_SEG_MODEL_URL")
    if pt_files:
        print(f'\n  yolo export model="{pt_files[0]}" format=onnx imgsz=640 simplify=True')
    if yaml_files:
        print(f'  yolo segment train model=yolov8n-seg.pt data="{yaml_files[0]}" epochs=100 imgsz=640')
    print("  Single-class: YOLO_COW_CLASS_ID=0 in yoloSegDetect.ts")
    print("  Chest/length cm: Plan C (1m stick) recommended on Vercel")


if __name__ == "__main__":
    main()
