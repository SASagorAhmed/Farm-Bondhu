#!/usr/bin/env python3
"""Download nasdevs YOLO Seg dataset via kagglehub — all files under FarmBondhu/cattledataset on D:."""

import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE_DIR = ROOT / "data"
TMP_DIR = ROOT / "tmp"
PIP_CACHE_DIR = ROOT / ".pip-cache"
ULTRA_DIR = ROOT / ".ultralytics"

DATASET_SLUG = "nasdevs/project-cattle-weight-detection"
MIN_FREE_GB = 10


def assert_not_on_c_drive(path: Path, label: str) -> None:
    drive = path.resolve().drive.upper()
    if drive == "C:":
        print(f"ERROR: {label} is on C: ({path})", file=sys.stderr)
        print("All downloads must stay under D:\\FarmBondhu\\cattledataset", file=sys.stderr)
        sys.exit(1)


def setup_paths() -> None:
    for d in (CACHE_DIR, TMP_DIR, PIP_CACHE_DIR, ULTRA_DIR):
        d.mkdir(parents=True, exist_ok=True)

    os.environ["KAGGLEHUB_CACHE"] = str(CACHE_DIR)
    os.environ["TEMP"] = str(TMP_DIR)
    os.environ["TMP"] = str(TMP_DIR)
    os.environ["PIP_CACHE_DIR"] = str(PIP_CACHE_DIR)

    for path, label in (
        (CACHE_DIR, "KAGGLEHUB_CACHE"),
        (TMP_DIR, "TEMP/TMP"),
        (PIP_CACHE_DIR, "PIP_CACHE_DIR"),
        (ULTRA_DIR, "Ultralytics dir"),
    ):
        assert_not_on_c_drive(path, label)

    usage = shutil.disk_usage(CACHE_DIR)
    free_gb = usage.free / (1024**3)
    print("FarmBondhu cattle ML — D: drive only (nothing on C:)")
    print("Dataset:", DATASET_SLUG)
    print("KAGGLEHUB_CACHE:", os.environ["KAGGLEHUB_CACHE"])
    print("TEMP/TMP:       ", os.environ["TEMP"])
    print(f"Free space on {CACHE_DIR.drive}: {free_gb:.1f} GB")
    if free_gb < MIN_FREE_GB:
        print(f"ERROR: Need at least {MIN_FREE_GB} GB free on {CACHE_DIR.drive}", file=sys.stderr)
        sys.exit(1)


setup_paths()

import kagglehub  # noqa: E402

if __name__ == "__main__":
    path = kagglehub.dataset_download(DATASET_SLUG)
    print("Path to dataset files:", path)
    print("Next: python inspect_download.py")
