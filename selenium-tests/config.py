import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

BASE_URL = os.getenv("FB_BASE_URL", "http://localhost:8080").rstrip("/")
TEST_EMAIL = os.getenv("FB_TEST_EMAIL", "")
TEST_PASSWORD = os.getenv("FB_TEST_PASSWORD", "")
CHROME_BINARY = os.getenv("CHROME_BINARY", "").strip()
CHROME_ZOOM = int(os.getenv("CHROME_ZOOM", "80"))
CHROME_FULLSCREEN = os.getenv("CHROME_FULLSCREEN", "true").lower() in ("1", "true", "yes")
HEADLESS = os.getenv("SELENIUM_HEADLESS", "false").lower() in ("1", "true", "yes")
STEP_DELAY_SEC = float(os.getenv("STEP_DELAY_SEC", "4"))
COW_WEIGHT_AI_TIMEOUT_SEC = int(os.getenv("COW_WEIGHT_AI_TIMEOUT_SEC", "180"))
COW_WEIGHT_SAVE_TIMEOUT_SEC = int(os.getenv("COW_WEIGHT_SAVE_TIMEOUT_SEC", "60"))

_image = os.getenv("COW_WEIGHT_TEST_IMAGE", "assets/cow-test.jpg")
COW_WEIGHT_TEST_IMAGE = Path(_image) if Path(_image).is_absolute() else ROOT / _image

SCREENSHOTS_DIR = ROOT / "screenshots"
