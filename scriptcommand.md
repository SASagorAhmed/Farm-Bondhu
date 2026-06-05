# FarmBondhu Script Commands

Short copy-paste commands for demos and E2E tests.

## Prerequisites (all Selenium tours)

- **Backend** and **frontend** running locally
- **Google Chrome** installed (tests use Chrome only — if Firefox opens instead, see [Troubleshooting](selenium-tests/README.md#troubleshooting) in `selenium-tests/README.md`)
- [`selenium-tests/.env`](selenium-tests/.env) configured (copy from [`.env.example`](selenium-tests/.env.example))

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Frontend: **http://localhost:8080**

---

## Farmer — Selenium tour (`testfarmer`)

Full farm management page tour: login as farmer, visit every sidebar page, complete **Cow Weight AI** (upload → scan steps → save result), 4s pause between steps, then logout. Chrome opens **fullscreen at 80% zoom** once at start (see `CHROME_ZOOM` / `CHROME_FULLSCREEN` in `.env`).

**One-time setup:**

```bash
cd selenium-tests
pip install -r requirements.txt
```

Windows: `copy .env.example .env`  
macOS/Linux: `cp .env.example .env`

Edit `.env`: `FB_TEST_EMAIL`, `FB_TEST_PASSWORD`, `COW_WEIGHT_TEST_IMAGE` (path to cow photo).

**Run test farmer:**

```bash
cd selenium-tests
pytest tests/test_farmer_tour.py -v -s
```

From repo root (Windows path example):

```bash
cd D:/FarmBondhu/selenium-tests && pytest tests/test_farmer_tour.py -v -s
```

`-s` prints `PASS:` lines in the terminal for your demo. See [`selenium-tests/README.md`](selenium-tests/README.md) for timeouts (`STEP_DELAY_SEC`, `COW_WEIGHT_AI_TIMEOUT_SEC`).

---

## MediBondhu — (coming soon)

<!-- Add pytest or demo commands here when MediBondhu Selenium tour exists -->

---

## VetBondhu — (coming soon)

<!-- Add pytest or demo commands here when VetBondhu Selenium tour exists -->

---

## Marketplace — (coming soon)

<!-- Add pytest or demo commands here when Marketplace Selenium tour exists -->
