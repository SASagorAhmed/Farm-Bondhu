# FarmBondhu Post-Deploy Checklist (Vercel)

Use this checklist after every deployment of backend + frontend.

## 1) Deploy Order

1. Deploy **backend** first.
2. Deploy **frontend** second.
3. Update backend `CORS_ORIGIN` with the final frontend URL (if changed), then redeploy backend.

---

## 2) Backend Vercel Config

Project root: `backend`

### Required environment variables

- `NODE_ENV=production`
- `DATABASE_URL=...`
- `AUTH_JWT_SECRET=...`
- `REGISTRATION_SECRET=...`
- `API_PUBLIC_URL=https://<backend-domain>.vercel.app`
- `CORS_ORIGIN=http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173,https://<frontend-domain>.vercel.app`

### Optional integrations (if used)

- Brevo/SMTP: `BREVO_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- AI: `OPENROUTER_API_KEY`
- Zego: `ZEGOCLOUD_APP_ID`, `ZEGOCLOUD_SERVER_SECRET`

### Backend smoke tests

- `https://<backend-domain>.vercel.app/api/health` returns OK.
- `https://<backend-domain>.vercel.app/api/v1` returns route manifest.
- Authenticated endpoint test (`/api/v1/me`) works from frontend.

---

## 3) Frontend Vercel Config

Project root: `frontend`

### Required environment variable

- `VITE_API_URL=https://<backend-domain>.vercel.app`
  - no trailing slash

### Build settings

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

### Frontend smoke tests

- Login works.
- Logout then login again works.
- At least 2-3 data pages load (dashboard/marketplace/etc.).
- No CORS errors in browser console.
- Network calls go to `https://<backend-domain>.vercel.app/api/...`.

---

## 4) Local Development Safety

Keep local env unchanged.

### `frontend/.env`

- `VITE_API_URL=http://127.0.0.1:3001`

### Backend local run

- `cd backend && npm run dev`

### Frontend local run

- `cd frontend && npm run dev`

---

## 5) Release Sign-Off

Mark all before closing deploy.

- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully
- [ ] Backend `CORS_ORIGIN` includes current frontend URL
- [ ] Login + `/api/v1/me` verified in production
- [ ] No critical errors in browser console/network
- [ ] Secrets are production-safe and not leaked
