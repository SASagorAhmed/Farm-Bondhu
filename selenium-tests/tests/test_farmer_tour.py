import sys
import time

from pathlib import Path



from selenium.webdriver.common.action_chains import ActionChains
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

from conftest import (
    apply_chrome_zoom,
    login_farmer,
    save_screenshot,
    scroll_page_top_bottom_top,
    wait_for_markers,
)

from pages.farm_pages import FARM_TOUR



NEXT_BTN_XPATH = "//button[contains(normalize-space(.), 'Next')]"

CONFIRM_BTN_XPATH = "//button[contains(., 'Confirm & calculate') or contains(., 'Confirm')]"

RESULT_BACK_XPATH = "//a[contains(normalize-space(.), 'Back')] | //button[contains(normalize-space(.), 'Back')]"

BUY_BUTTON_XPATH = "(//button[not(@disabled) and (contains(normalize-space(.), 'Buy') or .//*[contains(normalize-space(.), 'Buy')])])[1]"

USE_ADDRESS_XPATH = "//button[contains(normalize-space(.), 'Use this address')]"

PLACE_ORDER_XPATH = "//button[contains(normalize-space(.), 'Place Order')]"





def _log(msg: str) -> None:

    print(msg, flush=True)





def _visit_url(driver, path: str) -> None:

    driver.get(f"{BASE_URL}{path}")

    WebDriverWait(driver, 20).until(lambda d: d.execute_script("return document.readyState") == "complete")

    apply_chrome_zoom(driver)


def _click_link_by_path(driver, path: str, *, timeout: int = 20) -> None:

    link = WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, f"a[href$='{path}']"))
    )

    driver.execute_script("arguments[0].scrollIntoView({ block: 'center', inline: 'nearest' })", link)

    ActionChains(driver).move_to_element(link).pause(0.2).click(link).perform()

    WebDriverWait(driver, timeout).until(EC.url_contains(path))

    WebDriverWait(driver, timeout).until(lambda d: d.execute_script("return document.readyState") == "complete")

    apply_chrome_zoom(driver)


def _navigate_by_click(driver, path: str) -> None:

    try:

        _click_link_by_path(driver, path)

    except Exception:

        _log(f"Navigation fallback: direct URL for {path}")

        _visit_url(driver, path)


def _click_ready_element(driver, xpath: str, *, timeout: int = 20):

    element = WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.XPATH, xpath))
    )

    driver.execute_script("arguments[0].scrollIntoView({ block: 'center', inline: 'nearest' })", element)

    WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((By.XPATH, xpath)))

    try:

        ActionChains(driver).move_to_element(element).pause(0.2).click(element).perform()

    except Exception:

        driver.execute_script("arguments[0].click()", element)

    return element


def _clear_and_type(driver, by: By, value: str, text: str, *, timeout: int = 20) -> None:

    element = WebDriverWait(driver, timeout).until(EC.visibility_of_element_located((by, value)))

    driver.execute_script("arguments[0].scrollIntoView({ block: 'center', inline: 'nearest' })", element)

    element.clear()

    element.send_keys(text)


def _elements_present(driver, by: By, value: str) -> bool:

    return len(driver.find_elements(by, value)) > 0


def _select_first_visible_option(driver, placeholder: str, *, timeout: int = 20) -> None:

    trigger_xpath = (
        f"//button[.//*[contains(normalize-space(.), {placeholder!r})] "
        f"or contains(normalize-space(.), {placeholder!r})]"
    )

    trigger = WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((By.XPATH, trigger_xpath)))

    driver.execute_script("arguments[0].scrollIntoView({ block: 'center', inline: 'nearest' })", trigger)

    ActionChains(driver).move_to_element(trigger).pause(0.1).click(trigger).perform()

    option = WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable((By.XPATH, "(//*[@role='option' and not(@aria-disabled='true')])[1]"))
    )

    ActionChains(driver).move_to_element(option).pause(0.1).click(option).perform()


def _fill_checkout_address_if_needed(driver) -> None:

    WebDriverWait(driver, 30).until(lambda d: "Loading saved addresses" not in d.page_source)

    if not _elements_present(driver, By.ID, "addrFullName"):

        WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.XPATH, PLACE_ORDER_XPATH))
        )

        return

    _clear_and_type(driver, By.ID, "addrFullName", "FarmBondhu Demo Buyer")

    _clear_and_type(driver, By.ID, "addrPhone", "01700000000")

    _select_first_visible_option(driver, "Select division")

    _select_first_visible_option(driver, "Select district")

    _select_first_visible_option(driver, "Select upazila/thana")

    if _elements_present(driver, By.ID, "addrArea"):

        _clear_and_type(driver, By.ID, "addrArea", "Demo Area")

    _clear_and_type(driver, By.ID, "addrFullAddress", "Demo house, demo road, local test order")

    if _elements_present(driver, By.ID, "addrLandmark"):

        _clear_and_type(driver, By.ID, "addrLandmark", "Near demo bazar")

    _click_ready_element(driver, USE_ADDRESS_XPATH, timeout=20)

    wait_for_markers(driver, ("Delivering to",), timeout=20)


def _marketplace_order_flow(driver) -> None:

    _navigate_by_click(driver, "/marketplace")

    wait_for_markers(driver, ("All Products", "Browse the full marketplace catalog"), timeout=30)

    _log("PASS: Marketplace")

    scroll_page_top_bottom_top(driver, return_to_top=False)

    _click_ready_element(driver, BUY_BUTTON_XPATH, timeout=30)

    WebDriverWait(driver, 30).until(EC.url_contains("/checkout"))

    wait_for_markers(driver, ("Checkout", "Complete your order"), timeout=30)

    _log("PASS: Marketplace product selected")

    scroll_page_top_bottom_top(driver, return_to_top=False)

    _fill_checkout_address_if_needed(driver)

    scroll_page_top_bottom_top(driver, return_to_top=False)

    place_order = WebDriverWait(driver, 40).until(
        EC.element_to_be_clickable((By.XPATH, PLACE_ORDER_XPATH))
    )

    driver.execute_script("arguments[0].scrollIntoView({ block: 'center', inline: 'nearest' })", place_order)

    ActionChains(driver).move_to_element(place_order).pause(0.1).click(place_order).perform()

    WebDriverWait(driver, 40).until(lambda d: "/orders/" in d.current_url)

    _log("PASS: Marketplace order placed")

    scroll_page_top_bottom_top(driver, return_to_top=False)
    time.sleep(2)





def _wait_step(driver, step_name: str, markers: tuple[str, ...]) -> None:

    try:

        wait_for_markers(driver, markers, timeout=20)

    except Exception:

        save_screenshot(driver, f"fail_{step_name}")

        label = ", ".join(markers) or "(custom)"

        raise AssertionError(f"{step_name}: timed out waiting for one of [{label}]") from None

    _log(f"PASS: {step_name}")
    scroll_page_top_bottom_top(driver, return_to_top=False)





def _cow_weight_full_flow(driver) -> None:

    _click_link_by_path(driver, "/dashboard/cow-weight/upload")

    wait = WebDriverWait(driver, 20)

    wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='file'][accept='image/*']")))
    scroll_page_top_bottom_top(driver, return_to_top=False)



    if not COW_WEIGHT_TEST_IMAGE.is_file():

        raise FileNotFoundError(

            f"Cow weight test image not found: {COW_WEIGHT_TEST_IMAGE}\n"

            "Set COW_WEIGHT_TEST_IMAGE in selenium-tests/.env to your photo path."

        )



    file_input = driver.find_element(By.CSS_SELECTOR, "input[type='file'][accept='image/*']")

    file_input.send_keys(str(COW_WEIGHT_TEST_IMAGE.resolve()))



    WebDriverWait(driver, 60).until(EC.url_contains("/dashboard/cow-weight/analyze"))

    _log("PASS: Cow Weight Upload (navigated to analyze)")
    scroll_page_top_bottom_top(driver, return_to_top=False)



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
    scroll_page_top_bottom_top(driver, return_to_top=False)



    for step_num in range(1, 6):

        try:

            _click_ready_element(driver, NEXT_BTN_XPATH, timeout=COW_WEIGHT_AI_TIMEOUT_SEC)

        except Exception:

            save_screenshot(driver, f"fail_Cow_Weight_Scan_step_{step_num}")

            raise AssertionError(f"Cow Weight: could not click Next on scan step {step_num}") from None

        _log(f"PASS: Cow Weight Scan step {step_num} -> Next")
        scroll_page_top_bottom_top(driver, return_to_top=False)



    try:

        _click_ready_element(driver, CONFIRM_BTN_XPATH, timeout=30)

    except Exception:

        save_screenshot(driver, "fail_Cow_Weight_Confirm")

        raise AssertionError("Cow Weight: could not click Confirm & calculate") from None



    _log("PASS: Cow Weight Confirm & calculate clicked")
    scroll_page_top_bottom_top(driver, return_to_top=False)



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
    scroll_page_top_bottom_top(driver, return_to_top=False)



    try:

        _click_ready_element(driver, RESULT_BACK_XPATH, timeout=20)

        wait_for_markers(driver, ("Cow Weight & Meat AI",), timeout=20)

    except Exception:

        _log("Cow Weight: Back link fallback to hub URL")

        _navigate_by_click(driver, "/dashboard/cow-weight")

        wait_for_markers(driver, ("Cow Weight & Meat AI",), timeout=20)



    _log("PASS: Cow Weight Back to hub")
    scroll_page_top_bottom_top(driver, return_to_top=False)

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





def test_farmer_visits_all_pages_and_logs_out(driver):

    """Sequential farmer tour: login, each farm page, full cow weight save, logout."""

    _log("--- FarmBondhu farmer Selenium tour ---")

    login_farmer(driver)

    _log("PASS: Login")



    for step in FARM_TOUR:

        if step.custom_action == "cow_weight_full_flow":

            _cow_weight_full_flow(driver)

            continue

        if step.custom_action == "logout":

            _marketplace_order_flow(driver)

            _logout(driver)

            continue



        _navigate_by_click(driver, step.path)

        _wait_step(driver, step.name, step.markers)



    _log("--- Tour complete ---")


