#!/usr/bin/env python3
"""Remove old sadhliroomyprime BMGF download from cattledataset/data (D: only)."""

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_ROOT = ROOT / "data"
OLD_SLUG_PART = "sadhliroomyprime"


def assert_not_on_c_drive(path: Path) -> None:
    if path.resolve().drive.upper() == "C:":
        print(f"ERROR: refusing to delete on C: ({path})", file=sys.stderr)
        sys.exit(1)


def dir_size(path: Path) -> int:
    total = 0
    if not path.exists():
        return 0
    for p in path.rglob("*"):
        if p.is_file():
            try:
                total += p.stat().st_size
            except OSError:
                pass
    return total


def main() -> None:
    if not DATA_ROOT.is_dir():
        print("No data/ folder — nothing to clean.")
        return

    assert_not_on_c_drive(DATA_ROOT)
    removed_bytes = 0
    removed_dirs: set[Path] = set()

    for archive in list(DATA_ROOT.rglob("*.archive")):
        assert_not_on_c_drive(archive)
        sz = archive.stat().st_size
        print(f"Removing archive: {archive} ({sz / 1e9:.1f} GB)")
        archive.unlink()
        removed_bytes += sz

    slug_root = DATA_ROOT / "datasets" / OLD_SLUG_PART
    if slug_root.is_dir():
        removed_dirs.add(slug_root)
    for old in list(DATA_ROOT.rglob(f"*{OLD_SLUG_PART}*")):
        if old.is_dir() and OLD_SLUG_PART in old.parts:
            removed_dirs.add(old)
            while old.parent != DATA_ROOT and OLD_SLUG_PART in old.parent.parts:
                old = old.parent
                removed_dirs.add(old)

    for top in sorted(removed_dirs, key=lambda p: len(p.parts), reverse=True):
        assert_not_on_c_drive(top)
        sz = dir_size(top)
        print(f"Removing folder: {top} ({sz / 1e9:.1f} GB)")
        shutil.rmtree(top, ignore_errors=True)
        removed_bytes += sz

    datasets_dir = DATA_ROOT / "datasets"
    if datasets_dir.is_dir() and not any(datasets_dir.iterdir()):
        datasets_dir.rmdir()
        print(f"Removed empty {datasets_dir}")

    print(f"\nFreed approximately {removed_bytes / 1e9:.1f} GB")
    print("Next: python download_dataset.py")


if __name__ == "__main__":
    main()
