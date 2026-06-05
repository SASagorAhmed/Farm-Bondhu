from dataclasses import dataclass



from selenium.webdriver.remote.webdriver import WebDriver





@dataclass

class FarmPageStep:

    name: str

    path: str

    markers: tuple[str, ...]

    """Substrings expected in page source (any one match passes)."""

    custom_action: str | None = None

    """Named handler in test module: cow_weight_full_flow, logout."""





FARM_TOUR: list[FarmPageStep] = [

    FarmPageStep("Dashboard", "/dashboard", ("Welcome,",)),

    FarmPageStep("Farms", "/dashboard/farms", ("Farms", "Manage your farms")),

    FarmPageStep("Animals", "/dashboard/animals", ("Animals",)),

    FarmPageStep("Cow Weight Hub", "/dashboard/cow-weight", ("Cow Weight & Meat AI",)),

    FarmPageStep("Cow Weight Full Flow", "", (), custom_action="cow_weight_full_flow"),

    FarmPageStep("Feed", "/dashboard/feed", ("Feed Management",)),

    FarmPageStep("Health", "/dashboard/health", ("Health Records",)),

    FarmPageStep("Production", "/dashboard/production", ("Production",)),

    FarmPageStep("Mortality", "/dashboard/mortality", ("Mortality Tracking",)),

    FarmPageStep("Sales", "/dashboard/sales", ("Sales Tracking",)),

    FarmPageStep("Finances", "/dashboard/finances", ("Finances",)),

    FarmPageStep("Access Center", "/dashboard/access-center", ("Access Center",)),

    FarmPageStep("Profile", "/dashboard/profile", ("My Profile",)),

    FarmPageStep("Support", "/dashboard/support", ("Help & Support", "Chat with support")),

    FarmPageStep("Settings", "/dashboard/settings", ("Settings",)),

    FarmPageStep("Logout", "", (), custom_action="logout"),

]





def page_passed(driver: WebDriver, step: FarmPageStep) -> bool:

    source = driver.page_source

    url = driver.current_url

    for marker in step.markers:

        if marker.startswith("/"):

            if marker in url:

                return True

        elif marker in source:

            return True

    return len(step.markers) == 0

