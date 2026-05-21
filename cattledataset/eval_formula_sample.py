#!/usr/bin/env python3
"""
Offline sample: compare FarmBondhu formula to manual-weight field in BMGF filenames.

Does NOT run the browser pipeline — uses filename weight as reference only.
Confirm weight units from dataset PDF before trusting MAE.
"""

import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_ROOT = ROOT / "data"
FORMULA_DIVISOR = 660

# Placeholder: without keypoints we cannot get real chest/length cm from images here.
# This script reports parsed filename weights and documents the eval gap.

WEIGHT_RE = re.compile(
    r"^.+_(?:s|r)_.+_(\d+(?:\.\d+)?)_(?:M|F)\.(?:jpg|jpeg|png)$",
    re.IGNORECASE,
)


def find_bmgf_root() -> Path | None:
    for p in DATA_ROOT.rglob("www.acmeai.tech Dataset - BMGF-LivestockWeight-CV"):
        if p.is_dir():
            return p
    return None


def collect_side_images(bmgf: Path) -> list[Path]:
    out: list[Path] = []
    pixel = bmgf / "Pixel"
    if not pixel.is_dir():
        return out
    for path in pixel.rglob("*"):
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        if "Side" in path.parts and "images" in path.parts and "annotations" not in path.parts:
            out.append(path)
    return out


def parse_weight(name: str) -> float | None:
    m = WEIGHT_RE.match(name)
    return float(m.group(1)) if m else None


def main() -> None:
    print("FarmBondhu formula:", f"(chest_cm² × length_cm) / {FORMULA_DIVISOR}")
    print("Reference: manual-weight field in BMGF Side image filenames\n")

    bmgf = find_bmgf_root()
    if not bmgf:
        print("BMGF folder not found under data/. Run download + inspect_download.py first.")
        return

    images = collect_side_images(bmgf)
    parsed: list[tuple[Path, float]] = []
    for img in images:
        w = parse_weight(img.name)
        if w is not None:
            parsed.append((img, w))

    print(f"Side images: {len(images)}")
    print(f"With parseable weight in filename: {len(parsed)}")

    if not parsed:
        print("No weights parsed. Check filename pattern in dataset Readme.md")
        return

    random.seed(42)
    sample = random.sample(parsed, min(20, len(parsed)))
    weights = [w for _, w in sample]
    print(f"\nSample of {len(sample)} filename 'manual-weight' values:")
    print(f"  min={min(weights):.1f} max={max(weights):.1f} mean={sum(weights)/len(weights):.2f}")

    print("\n--- To compute real MAE vs formula ---")
    print("1. Run cow weight scan on Side images (or use Vector keypoints for chest/length px).")
    print("2. Convert px to cm (Plan C stick or calibrated Plan B).")
    print("3. Compare predicted kg to filename weight (after unit conversion).")
    print("\nFor accurate chest_cm + length_cm on Vercel: Plan C + train seg ONNX (SEG_PREP.md).")


if __name__ == "__main__":
    main()
