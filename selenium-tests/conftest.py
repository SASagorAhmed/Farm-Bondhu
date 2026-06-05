import os
import time
from pathlib import Path

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

from config import (
    BASE_URL,
    CHROME_BINARY,
    CHROME_FULLSCREEN,
    CHROME_ZOOM,
    HEADLESS,
    SCREENSHOTS_DIR,
    STEP_DELAY_SEC,
    TEST_EMAIL,
    TEST_PASSWORD,
)

FARM_SHELL_MARKERS = ("Welcome,", "Farm Management", "Your farm overview at a glance")


def step_pause() -> None:
    if STEP_DELAY_SEC > 0:
        time.sleep(STEP_DELAY_SEC)


def _marker_present(driver, marker: str) -> bool:
    if marker.startswith("/"):
        return marker in driver.current_url
    if marker in driver.page_source:
        return True
    try:
        xpath = f"//*[contains(text(), {repr(marker)})]"
        driver.find_element(By.XPATH, xpath)
        return True
    except Exception:
        return False


def wait_for_markers(driver, markers: tuple[str, ...], timeout: int = 20) -> None:
    if not markers:
        return

    def any_marker(_driver):
        return any(_marker_present(_driver, m) for m in markers)

    WebDriverWait(driver, timeout).until(any_marker)


def _resolve_chrome_binary() -> str:
    if CHROME_BINARY:
        path = Path(CHROME_BINARY)
        if path.is_file():
            return str(path.resolve())
        raise RuntimeError(
            f"CHROME_BINARY is set but not found: {CHROME_BINARY}. "
            "Install Google Chrome or fix the path in selenium-tests/.env"
        )

    candidates: list[Path] = []
    if os.name == "nt":
        for env_key in ("ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"):
            base = os.environ.get(env_key)
            if base:
                candidates.append(Path(base) / "Google" / "Chrome" / "Application" / "chrome.exe")
    else:
        for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
            candidates.append(Path(f"/usr/bin/{name}"))
        candidates.append(Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"))

    for candidate in candidates:
        if candidate.is_file():
            return str(candidate.resolve())

    raise RuntimeError(
        "Chrome not found. Install Google Chrome or set CHROME_BINARY in selenium-tests/.env"
    )


def apply_chrome_zoom(driver) -> None:
    if CHROME_ZOOM != 100:
        driver.execute_cdp_cmd(
            "Emulation.setPageScaleFactor",
            {"pageScaleFactor": CHROME_ZOOM / 100},
        )


def setup_chrome_demo_view(driver, *, log: bool = False) -> None:
    if not HEADLESS:
        if CHROME_FULLSCREEN:
            driver.fullscreen_window()
        else:
            driver.maximize_window()
    apply_chrome_zoom(driver)
    if log:
        if HEADLESS:
            mode = "headless"
        elif CHROME_FULLSCREEN:
            mode = "fullscreen"
        else:
            mode = "maximized"
        print(f"Chrome demo view: {mode}, zoom={CHROME_ZOOM}%")


@pytest.fixture
def driver():
    chrome_path = _resolve_chrome_binary()
    print(f"Using Chrome: {chrome_path}")

    options = webdriver.ChromeOptions()
    options.binary_location = chrome_path
    if HEADLESS:
        options.add_argument("--headless=new")
        options.add_argument("--window-size=1920,1080")
    elif not CHROME_FULLSCREEN:
        options.add_argument("--window-size=1400,900")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")

    drv = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options,
    )
    drv.implicitly_wait(10)
    setup_chrome_demo_view(drv, log=True)
    yield drv
    drv.quit()


def login_farmer(driver) -> None:
    if not TEST_EMAIL or not TEST_PASSWORD:
        raise RuntimeError("Set FB_TEST_EMAIL and FB_TEST_PASSWORD in selenium-tests/.env")

    driver.get(f"{BASE_URL}/login")
    apply_chrome_zoom(driver)
    wait = WebDriverWait(driver, 20)

    email = wait.until(EC.visibility_of_element_located((By.ID, "email")))
    email.clear()
    email.send_keys(TEST_EMAIL)

    password = driver.find_element(By.ID, "password")
    password.clear()
    password.send_keys(TEST_PASSWORD)

    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()

    wait.until(lambda d: "/login" not in d.current_url)
    driver.get(f"{BASE_URL}/dashboard")
    apply_chrome_zoom(driver)
    wait.until(EC.url_contains("/dashboard"))
    wait_for_markers(driver, FARM_SHELL_MARKERS, timeout=25)
    step_pause()


def save_screenshot(driver, name: str) -> None:
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
    driver.save_screenshot(str(SCREENSHOTS_DIR / f"{safe}.png"))
