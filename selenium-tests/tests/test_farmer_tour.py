import sys

from pathlib import Path



from selenium.webdriver.common.by import By

from selenium.webdriver.support import expected_conditions as EC

from selenium.webdriver.support.ui import WebDriverWait



ROOT = Path(__file__).resolve().parent.parent

sys.path.insert(0, str(ROOT))



from config import (

    BASE_URL,

    COW_WEIGHT_AI_TIMEOUT_SEC,

    COW_WEIGHT_SAVE_TIMEOUT_SEC,

    COW_WEIGHT_TEST_IMAGE,

)

from conftest import apply_chrome_zoom, login_farmer, save_screenshot, step_pause, wait_for_markers

from pages.farm_pages import FARM_TOUR



NEXT_BTN_XPATH = "//button[contains(normalize-space(.), 'Next')]"

CONFIRM_BTN_XPATH = "//button[contains(., 'Confirm & calculate') or contains(., 'Confirm')]"

RESULT_BACK_XPATH = "//a[contains(normalize-space(.), 'Back')] | //button[contains(normalize-space(.), 'Back')]"





def _log(msg: str) -> None:

    print(msg, flush=True)





def _visit_url(driver, path: str) -> None:

    driver.get(f"{BASE_URL}{path}")

    WebDriverWait(driver, 20).until(lambda d: d.execute_script("return document.readyState") == "complete")

    apply_chrome_zoom(driver)





def _wait_step(driver, step_name: str, markers: tuple[str, ...]) -> None:

    try:

        wait_for_markers(driver, markers, timeout=20)

    except Exception:

        save_screenshot(driver, f"fail_{step_name}")

        label = ", ".join(markers) or "(custom)"

        raise AssertionError(f"{step_name}: timed out waiting for one of [{label}]") from None

    _log(f"PASS: {step_name}")

    step_pause()





def _cow_weight_full_flow(driver) -> None:

    _visit_url(driver, "/dashboard/cow-weight/upload")

    wait = WebDriverWait(driver, 20)

    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='file'][accept='image/*']")))



    if not COW_WEIGHT_TEST_IMAGE.is_file():

        raise FileNotFoundError(

            f"Cow weight test image not found: {COW_WEIGHT_TEST_IMAGE}\n"

            "Set COW_WEIGHT_TEST_IMAGE in selenium-tests/.env to your photo path."

        )



    file_input = driver.find_element(By.CSS_SELECTOR, "input[type='file'][accept='image/*']")

    file_input.send_keys(str(COW_WEIGHT_TEST_IMAGE.resolve()))



    WebDriverWait(driver, 60).until(EC.url_contains("/dashboard/cow-weight/analyze"))

    _log("PASS: Cow Weight Upload (navigated to analyze)")

    step_pause()



    def scan_ready(d):

        if "/dashboard/cow-weight/scan" in d.current_url:

            return True

        src = d.page_source

        return (

            "Cow detected" in src

            or "Live weight" in src

            or "Detect cow" in src

            or "Analysis failed" in src

        )



    try:

        WebDriverWait(driver, COW_WEIGHT_AI_TIMEOUT_SEC).until(scan_ready)

    except Exception:

        save_screenshot(driver, "fail_Cow_Weight_Scan_ready")

        raise AssertionError(

            f"Cow Weight: timed out waiting for scan page ({COW_WEIGHT_AI_TIMEOUT_SEC}s)"

        ) from None



    if "/dashboard/cow-weight/scan" not in driver.current_url:

        save_screenshot(driver, "fail_Cow_Weight_Not_on_scan")

        raise AssertionError("Cow Weight: expected to reach /dashboard/cow-weight/scan")



    _log("PASS: Cow Weight Analyze (scan ready)")

    step_pause()



    for step_num in range(1, 6):

        try:

            next_btn = WebDriverWait(driver, COW_WEIGHT_AI_TIMEOUT_SEC).until(

                EC.element_to_be_clickable((By.XPATH, NEXT_BTN_XPATH))

            )

            next_btn.click()

        except Exception:

            save_screenshot(driver, f"fail_Cow_Weight_Scan_step_{step_num}")

            raise AssertionError(f"Cow Weight: could not click Next on scan step {step_num}") from None

        _log(f"PASS: Cow Weight Scan step {step_num} -> Next")

        step_pause()



    try:

        confirm_btn = WebDriverWait(driver, 30).until(

            EC.element_to_be_clickable((By.XPATH, CONFIRM_BTN_XPATH))

        )

        confirm_btn.click()

    except Exception:

        save_screenshot(driver, "fail_Cow_Weight_Confirm")

        raise AssertionError("Cow Weight: could not click Confirm & calculate") from None



    _log("PASS: Cow Weight Confirm & calculate clicked")

    step_pause()



    def result_ready(d):

        return "/dashboard/cow-weight/result" in d.current_url and "Estimation result" in d.page_source



    try:

        WebDriverWait(driver, COW_WEIGHT_SAVE_TIMEOUT_SEC).until(result_ready)

    except Exception:

        save_screenshot(driver, "fail_Cow_Weight_Save")

        raise AssertionError(

            f"Cow Weight: timed out waiting for saved result ({COW_WEIGHT_SAVE_TIMEOUT_SEC}s)"

        ) from None



    _log("PASS: Cow Weight Save (estimation result)")

    step_pause()



    try:

        back_el = WebDriverWait(driver, 20).until(

            EC.element_to_be_clickable((By.XPATH, RESULT_BACK_XPATH))

        )

        back_el.click()

        wait_for_markers(driver, ("Cow Weight & Meat AI",), timeout=20)

    except Exception:

        _log("Cow Weight: Back link fallback to hub URL")

        _visit_url(driver, "/dashboard/cow-weight")

        wait_for_markers(driver, ("Cow Weight & Meat AI",), timeout=20)



    _log("PASS: Cow Weight Back to hub")

    step_pause()

    _log("PASS: Cow Weight full flow (saved)")





def _logout(driver) -> None:

    wait = WebDriverWait(driver, 20)

    logout_btn = wait.until(

        EC.element_to_be_clickable(

            (By.XPATH, "//button[contains(., 'Logout') or .//span[contains(text(),'Logout')]]")

        )

    )

    logout_btn.click()



    wait.until(EC.url_contains("/login"))

    _log("PASS: Logout")

    step_pause()





def test_farmer_visits_all_pages_and_logs_out(driver):

    """Sequential farmer tour: login, each farm page, full cow weight save, logout."""

    _log("--- FarmBondhu farmer Selenium tour ---")

    login_farmer(driver)

    _log("PASS: Login")

    step_pause()



    for step in FARM_TOUR:

        if step.custom_action == "cow_weight_full_flow":

            _cow_weight_full_flow(driver)

            continue

        if step.custom_action == "logout":

            _logout(driver)

            continue



        _visit_url(driver, step.path)

        _wait_step(driver, step.name, step.markers)



    _log("--- Tour complete ---")


