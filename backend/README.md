# FarmBondhu API (Express)

Backend for FarmBondhu. The **frontend still uses Supabase directly** until you migrate endpoints; this service is ready for incremental replacement.

## Setup

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL (replace [YOUR-PASSWORD] in the pooler URI)
npm install
npm run dev
```

Use the **Session pooler** host from Supabase if you use `5432` with `postgres.<project-ref>` user, as in `.env.example`.

**Port 3001:** The API listens on **`BACKEND_PORT`** (default **3001**). Each `npm run dev` runs **`predev`**, which executes [`scripts/free-port.js`](scripts/free-port.js) and clears anything bound to that port (Windows: `netstat` + `TaskKill`; Unix: `lsof` + `kill`). Do not use 3001 for other apps while developing, or they may be stopped. In **`NODE_ENV=production`**, `free-port` does nothing (safe for deploy).

- Health: `http://localhost:3001/api/health` (if `BACKEND_PORT=3001`)
- DB check: `http://localhost:3001/api/health/db` (needs `DATABASE_URL`)
- Service checks: `GET /api/health/services`
- **API v1:** `GET http://localhost:3001/api/v1` — manifest of routes. Authenticated routes use `Authorization: Bearer <supabase_access_token>` and `SUPABASE_JWT_SECRET` on the server. First implemented domains: **`/api/v1/me`**, **`/api/v1/farms`**, **`/api/v1/animals`**, **`/api/v1/sheds`**.

On startup the terminal prints a **Connectivity** block (database, Supabase REST, Cloudinary, OpenRouter, Brevo, Zego) with per-line OK or failure messages.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | For DB | PostgreSQL URI (Supabase pooler; DB port `5432` is inside the URL) |
| `BACKEND_PORT` | No | **HTTP** port for Express (default `3001`). Use this name so a global `PORT=3000` from Cursor/shell does not override `.env`. Falls back to `PORT` (e.g. Heroku). |
| `CORS_ORIGIN` | Production | Comma-separated origins (e.g. Vite `5173` + Vercel URL) |
| `API_PUBLIC_URL` | No | Public base URL of this API (optional) |
| `SUPABASE_JWT_SECRET` | For `/api/v1/*` auth | Same JWT secret as in Supabase Dashboard → Settings → API (used to verify the browser’s access token) |
| `SUPABASE_URL` / keys | Optional | Used by `/api/health/services` checks and future server-side Supabase calls |
| Cloudinary / Zego / OpenRouter / Brevo | Later | See `.env` / `.env.example` |

## Structure

```
src/
  server.js       # entry, dotenv, listen
  app.js          # express, helmet, cors, routes
  config.js       # env-derived config
  db.js           # postgres (porsager) client
  middleware/
  routes/
    v1/          # versioned REST (expand here as the frontend migrates off supabase-js)
  services/
```

## Next backend work

- Add routes for community, marketplace, vet, admin, notifications (same tables the React app uses today).
- Cloudinary signed upload, Brevo send, OpenRouter proxy, Zego token endpoint.
- Replace Supabase Edge logic: Zego token, AI chat, link preview

## Deploy on Vercel (backend only)

1. Create a new Vercel project with root directory `backend`.
2. Keep install command default (`npm install`).
3. Vercel uses `vercel.json` and `api/index.js` to run this Express app as a serverless function.
4. Add environment variables (Production at minimum):
   - `DATABASE_URL`
   - `AUTH_JWT_SECRET`
   - `REGISTRATION_SECRET`
   - `CORS_ORIGIN` (must include your frontend Vercel URL and any local dev origins)
   - optional integration keys (`BREVO_API_KEY`, `SMTP_*`, `CLOUDINARY_*`, `OPENROUTER_API_KEY`, `ZEGOCLOUD_*`)
5. Set `NODE_ENV=production`.
6. Set `API_PUBLIC_URL=https://<your-backend-domain>.vercel.app`.
7. After deploy, verify:
   - `/api/health`
   - `/api/v1`
