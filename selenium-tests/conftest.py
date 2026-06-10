import os
import time
from pathlib import Path

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
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


def scroll_page_top_bottom_top(
    driver,
    *,
    target_sec: float = 0.45,
    max_sec: float = 0.9,
    return_to_top: bool = True,
) -> None:
    viewport_height, page_height = driver.execute_script(
        """
        const main = Array.from(document.querySelectorAll('main'))
            .find((el) => el.scrollHeight > el.clientHeight + 8);
        const scrollingElement = main || document.scrollingElement || document.documentElement;
        window.__farmBondhuScrollTarget = scrollingElement;
        scrollingElement.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        return [
            scrollingElement.clientHeight || window.innerHeight || document.documentElement.clientHeight,
            scrollingElement.scrollHeight,
        ];
        """
    )
    max_position = max(page_height - viewport_height, 0)
    if max_position <= 4:
        time.sleep(0.03)
        return

    started_at = time.monotonic()
    steps = max(1, min(3, int(max_position // max(viewport_height, 1)) + 1))
    pause_sec = min(0.08, max(0.04, target_sec / (steps + (2 if return_to_top else 1))))

    for step in range(1, steps + 1):
        next_position = int(max_position * step / steps)
        driver.execute_script(
            """
            const target = window.__farmBondhuScrollTarget || document.scrollingElement || document.documentElement;
            target.scrollTo({ top: arguments[0], left: 0, behavior: 'smooth' });
            """,
            next_position,
        )
        time.sleep(pause_sec)
        if time.monotonic() - started_at >= max_sec:
            break

    driver.execute_script(
        """
        const target = window.__farmBondhuScrollTarget || document.scrollingElement || document.documentElement;
        target.scrollTo({ top: arguments[0], left: 0, behavior: 'smooth' });
        """,
        max_position,
    )
    time.sleep(pause_sec)
    if return_to_top:
        driver.execute_script(
            """
            const target = window.__farmBondhuScrollTarget || document.scrollingElement || document.documentElement;
            target.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
            """
        )
        time.sleep(pause_sec)


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
    # Keep the app at full browser size. CSS body zoom shrinks the site and
    # leaves black/empty space in fullscreen demo recordings.
    if CHROME_ZOOM != 100:
        print(f"CHROME_ZOOM={CHROME_ZOOM} ignored; Selenium demo keeps app viewport at 100%.")


def setup_chrome_demo_view(driver, *, log: bool = False) -> None:
    if not HEADLESS:
        if CHROME_FULLSCREEN:
            driver.fullscreen_window()
            try:
                ActionChains(driver).send_keys(Keys.F11).perform()
                time.sleep(0.2)
            except Exception:
                pass
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
    elif CHROME_FULLSCREEN:
        options.add_argument("--start-fullscreen")
        options.add_argument("--kiosk")
    elif not CHROME_FULLSCREEN:
        options.add_argument("--window-size=1400,900")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

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
