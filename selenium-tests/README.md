# FarmBondhu Selenium Tests (Farmer Tour)

End-to-end Selenium tests for the **project show**: login as a farmer, visit every Farm Management page one-by-one, upload a cow photo on Cow Weight, then logout.

## Prerequisites

- Python 3.10+
- Google Chrome installed
- FarmBondhu **backend** and **frontend** running locally

## Start the app

**Terminal 1 — backend**

```bash
cd backend
npm run dev
```

**Terminal 2 — frontend**

```bash
cd frontend
npm run dev
```

Frontend runs at **http://localhost:8080** (see `frontend/vite.config.ts`).

## Setup tests

```bash
cd selenium-tests
pip install -r requirements.txt
```

Copy env file and fill in your test account:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Edit `.env`:

```env
FB_BASE_URL=http://localhost:8080
FB_TEST_EMAIL=your-farmer@email.com
FB_TEST_PASSWORD=yourpassword
COW_WEIGHT_TEST_IMAGE=assets/cow-test.jpg
SELENIUM_HEADLESS=false
STEP_DELAY_SEC=4
COW_WEIGHT_AI_TIMEOUT_SEC=180
COW_WEIGHT_SAVE_TIMEOUT_SEC=60
```

Place a cow photo at `selenium-tests/assets/cow-test.jpg` (or set `COW_WEIGHT_TEST_IMAGE` to any absolute path).

**Security:** `.env` is gitignored. Never commit real passwords.

## Run the farmer tour

```bash
pytest tests/test_farmer_tour.py -v -s
```

`-s` prints `PASS:` / `FAIL:` lines for your demo.

For live demos, Chrome opens **fullscreen** at **80% zoom** by default (`CHROME_FULLSCREEN=true`, `CHROME_ZOOM=80` in `.env`). Set `CHROME_ZOOM=100` and `CHROME_FULLSCREEN=false` to use a normal maximized window at 100%.

On failure, screenshots are saved under `selenium-tests/screenshots/`.

## Step delay (demo pacing)

`STEP_DELAY_SEC=4` pauses **4 seconds after each successful step** so the browser tour is visible during a project show. The test also **waits for page text** (e.g. `Welcome,`) before asserting — React loads after HTML `readyState`, so instant checks can fail even when the page looks correct.

## Cow Weight full flow

The tour runs the **complete AI wizard** (not just upload):

1. Upload photo on `/dashboard/cow-weight/upload`
2. Wait for AI analyze → scan (up to `COW_WEIGHT_AI_TIMEOUT_SEC`, default 180s)
3. Click **Next** through scan steps 1–5 (4s pause after each)
4. Click **Confirm & calculate** on step 6
5. Wait for **Estimation result** saved (up to `COW_WEIGHT_SAVE_TIMEOUT_SEC`, default 60s)
6. **Back** to Cow Weight hub, then continue Feed → Sales → … → Logout

Expect **3–5 minutes** total runtime when AI and save are included. Increase timeouts on slower machines.

## What the tour covers

1. Login at `/login`
2. Dashboard → Farms → Animals → Cow Weight hub → **full AI save flow**
3. Feed → Health → Production → Mortality → Sales → Finances
4. Access Center → Profile → Support → Settings
5. Logout

## Headless mode

Set `SELENIUM_HEADLESS=true` in `.env` for CI or unattended runs. For live demos, keep `false` so the browser is visible.

## Troubleshooting

### Firefox opens instead of Chrome

This suite **only** launches Google Chrome (`conftest.py`). If you see Firefox during `pytest`, check the following.

**1. Confirm pytest is using the local Chrome fixture**

```bash
cd selenium-tests
pytest tests/test_farmer_tour.py --fixtures | findstr driver
```

You should see the `driver` fixture from `conftest.py`. If a global plugin overrides it, uninstall `pytest-selenium` (not in `requirements.txt`):

```bash
pip uninstall pytest-selenium -y
```

Also remove `--driver Firefox` from Cursor/VS Code pytest args if present.

**2. Confirm Chrome is installed**

```bash
where chrome
```

Windows:

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --version
```

Install Chrome from https://www.google.com/chrome/ if missing.

**3. Set an explicit Chrome path**

If auto-detect fails, add to `.env`:

```env
CHROME_BINARY=C:\Program Files\Google\Chrome\Application\chrome.exe
```

**4. Read the pytest output**

Run with `-s` and look for `Using Chrome: ...` at startup. Search for `firefox`, `gecko`, `SessionNotCreated`, or `cannot find Chrome binary`.

| Terminal output | Likely cause |
|-----------------|--------------|
| `pytest-selenium` installed + `--driver Firefox` | Plugin forcing Firefox — uninstall or drop the flag |
| `SessionNotCreated` / `cannot find Chrome binary` | Chrome missing or wrong path — install or set `CHROME_BINARY` |
| `PASS:` lines but only Firefox visible | Wrong window focused — check taskbar for a Chrome window |
| No `Using Chrome:` line | pytest not loading this folder's `conftest.py` — run from `selenium-tests/` |
