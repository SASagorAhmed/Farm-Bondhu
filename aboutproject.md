# FarmBondhu Project Documentation

## 1) Project Overview

FarmBondhu is a multi-module agriculture platform focused on livestock and farm operations in Bangladesh.

Core goals:
- Help farmers run day-to-day farm operations (animals, feed, health, production, finances, sales).
- Provide a marketplace for buying/selling farm products.
- Provide online veterinary services through MediBondhu.
- Provide community knowledge sharing and Q&A.
- Provide AI assistance through a farm chatbot.
- Provide role-based access for farmer, buyer, vendor, vet, and admin users.

---

## 2) Tech Stack (Current, Canonical)

### Frontend
- React + TypeScript
- Vite
- React Router
- TanStack React Query
- Tailwind CSS + shadcn/ui components
- Framer Motion
- Supabase Realtime (for live updates/channels)

### Backend
- Express (Node.js)
- PostgreSQL (via `postgres`/porsager client)
- JWT auth verification (`requireUser` middleware)
- Modular REST API under `/api/v1/*`

### Integrations
- Supabase (database + realtime context)
- OpenRouter (AI chat completion streaming)
- Brevo / SMTP (OTP and email flows)
- ZegoCloud (consultation call token/integration)
- Cloudinary (media/upload-related flows)

---

## 3) Repository Structure

- `frontend/` — React app
  - `src/App.tsx` — full route map and access control wiring
  - `src/pages/*` — feature pages
  - `src/components/*` — shared UI and layouts
  - `src/contexts/*` — auth/cart/order/language state
  - `src/api/client.ts` — API abstraction layer used by frontend
- `backend/` — Express API
  - `src/server.js` — server bootstrap
  - `src/app.js` — middleware + app-level wiring
  - `src/routes/v1/*` — API domains
  - `src/services/*` — auth/access/business services
  - `src/db/ensureSchema.js` — schema bootstrap + indexes + seed permissions
- `.githooks/` — commit hooks

---

## 4) User Roles and Capabilities

Role/capability model is seeded in backend schema bootstrap and enforced in routes/UI.

### Roles
- Farmer
- Buyer
- Vendor (seller)
- Vet
- Admin

### Seeded permission mappings

#### Farmer
- `can_manage_farm`
- `can_manage_animals`
- `can_access_learning`
- `can_book_vet`
- `can_buy`

#### Buyer
- `can_buy`
- `can_bulk_buy`

#### Vendor
- `can_sell`
- `can_manage_orders`
- `can_manage_store`
- `can_buy`

#### Vet
- `can_consult_as_vet`
- `can_book_vet`

#### Admin
- `can_manage_platform`
- `can_approve`
- `can_reject`
- `can_manage_users`
- `can_broadcast`
- `can_view_reports`

---

## 5) Frontend Route and Access Design

Routing is centralized in `frontend/src/App.tsx` and guarded through `ProtectedRoute`.

### Public
- `/`
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/access-denied`

### Shared Authenticated Utilities
- `/home` (auth redirect)
- `/onboarding`
- `/profile`
- `/access-center`

### Farmer Module (`/dashboard`, requires `can_manage_farm`)
- Overview
- Farms
- Animals
- Feed
- Health
- Production
- Finances
- Mortality
- Sales
- Notifications/Profile/Settings/Access Center

### Buyer Module (`/buyer`, role-restricted)
- Buyer home
- Categories
- Wishlist
- Notifications/Profile/Settings/Access Center

### Learning (`/learning`, requires `can_access_learning`)
- Learning center
- Notifications/Profile/Settings

### Marketplace (`/marketplace`, requires `can_buy`)
- Product listing
- Product detail
- Buyer inbox/chat
- Cart (`/cart`)
- Checkout (`/checkout`)
- Orders (`/orders`)
- Return flow

### Seller/Vendor (`/seller`, requires `can_sell`)
- Seller dashboard
- Seller orders
- Product/inventory management
- Payouts/reviews/settings

### Vet Module (`/vet`, roles `vet|admin`)
- Vet dashboard
- Vet consultations
- Consultation room
- Patients
- Vet prescriptions + create/detail
- Availability
- Earnings
- Vet profile

### MediBondhu (`/medibondhu`, requires any of `can_book_vet | can_consult_as_vet`)
- Specialities
- Vet directory/profile
- Book consultation
- Waiting room / consultation room
- Patient consultation history
- Prescriptions

### Community (`/community`, any authenticated user)
- Feed
- Create post
- Post detail
- Category feed
- Unanswered / urgent / saved / history / my posts

### Admin (`/admin`, requires `can_manage_platform`)
- Dashboard
- User management
- Approvals + vet approvals
- Broadcast/team
- Marketplace controls
- Reports
- Learning controls
- MediBondhu overview
- Farms/orders/community admin views

---

## 6) Backend API Domain Map

Versioned routes are mounted under `/api/v1`.

Key domain routers:
- `meta` (manifest/meta)
- `auth`
- `me`
- `farms`
- `animals`
- `sheds`
- `dashboard`
- `notifications`
- `profiles`
- `learning`
- `orders`
- `marketplace`
- `community`
- `medibondhu`
- `ai` (farm chatbot)
- `public` (public read endpoints)
- `compat/from` (compatibility bridge for frontend data patterns)
- `tools` (utility endpoints like token generation)

---

## 7) Major Functional Modules

## 7.1 Farm Management
- Farm CRUD with ownership checks.
- Animal/batch tracking.
- Shed management.
- Production records.
- Financial records.
- Health and mortality logs.
- Sales history.
- Dashboard bundle endpoint for faster page loads.

## 7.2 Marketplace
- Product catalog and filtering.
- Cart and checkout.
- Order lifecycle and tracking.
- Buyer-seller chat with product share.
- Seller dashboard and product management.
- Admin marketplace oversight.

## 7.3 MediBondhu (Veterinary Platform)
- Vet directory and vet profile details.
- Slot/availability and booking support.
- Instant/scheduled consultations.
- Waiting room and consultation room.
- Live consultation messages.
- Prescription creation and retrieval.
- Vet earnings and withdrawal tracking.
- Admin review of vet withdrawals and vet operations.

## 7.4 Community
- Community posts and engagement.
- Comments and answers.
- Reaction/save system.
- Category/urgent/unanswered discovery.
- Post detail bundle endpoint for efficient loading.

## 7.5 AI Farm Chatbot
- Endpoint: `/api/v1/ai/farm-chat`
- Protected by auth (`requireUser`).
- Uses OpenRouter model and streams responses (SSE).
- System prompt tuned for practical farm support in English.

---

## 8) Data and Schema Summary

The backend schema bootstrap (`ensureSchema`) handles:
- `CREATE TABLE IF NOT EXISTS`
- `ADD COLUMN IF NOT EXISTS`
- seed permissions
- performance indexes

Important table groups:
- Identity/access: `profiles`, `auth_credentials`, `user_roles`, `role_permissions`, `user_capabilities`
- Farm core: `farms`, `animals`, `sheds`
- Farm records: `production_records`, `financial_records`, `health_records`, `mortality_records`, `sale_records`, `feed_records`, `feed_inventory`
- Marketplace: `products`, `orders`, `shops`, `conversations`, `chat_messages`, `approval_requests`
- MediBondhu: `vets`, `vet_profiles`, `vet_availability`, `consultation_bookings`, `consultation_messages`, `prescriptions`, `prescription_items`, `e_prescriptions`, `vet_withdrawals`
- Community: `community_posts`, `community_comments`, `community_answers`, `community_reactions`, `community_saves`
- Platform support: `notifications`, `admin_team`

The project includes many targeted indexes for dashboard speed, marketplace query speed, and MediBondhu consultation/prescription speed.

---

## 9) Performance and Caching Strategy

Current strategy includes:
- Bundle endpoints for expensive screens (dashboard/community/medibondhu/marketplace chat).
- Explicit SQL column selection and bounded query limits.
- Pagination where needed.
- React Query stale/gc tuning.
- Route intent prefetch and lazy-loaded pages.
- Realtime invalidation for selected modules.
- Response timing headers (`x-fb-*`) for diagnostics.
- Cache-control headers on selected endpoints.

---

## 10) Auth and Security Approach

- Frontend stores app session in local storage (`farmbondhu.session`).
- Backend validates bearer tokens and identity with middleware.
- Protected routes enforce role/capability checks.
- Ownership checks are used for user-scoped resources.
- Compatibility/admin endpoints enforce stricter access.
- Access-center flow supports role/capability onboarding and expansion.

---

## 11) Notifications and Realtime

- Notifications are persisted in DB and exposed through API.
- Frontend subscribes to realtime channels for updates in selected modules:
  - Marketplace chat/inbox
  - Consultation messages/bookings
  - Admin medibondhu dashboards
  - Products and other event-driven lists

---

## 12) Deployment Model

Current deployment pattern:
- Frontend on Vercel (React app)
- Backend on Vercel (Express API as serverless function setup)
- Frontend calls backend via `VITE_API_URL`.
- Backend CORS is configured to allow frontend origins.
- Region tuning and caching headers are applied for response-time improvements.

---

## 13) Core User Journeys

### Farmer Journey
1. Login/register.
2. Manage farm/animal/shed/records.
3. View dashboard and metrics.
4. Buy products in marketplace.
5. Book and attend MediBondhu consultation.
6. Receive and view prescriptions.
7. Ask AI farm chatbot questions.

### Buyer Journey
1. Browse products.
2. Add to cart and checkout.
3. Track orders and returns.
4. Chat with sellers.

### Vendor Journey
1. Request/obtain seller capability.
2. Manage shop and products.
3. Handle seller orders and customer chats.
4. Review payouts and performance.

### Vet Journey
1. Maintain vet profile and availability.
2. Receive/manage consultations.
3. Join room and consult patients.
4. Issue prescriptions.
5. Track earnings and withdrawals.

### Admin Journey
1. Manage users/roles/capabilities.
2. Handle approvals and vet verification.
3. Monitor marketplace, farms, orders, and community.
4. Broadcast announcements.
5. Oversee platform-wide MediBondhu and withdrawal flow.

---

## 14) Important Notes

- The platform is now standardized on:
  - Frontend: React
  - Backend: Express
- If additional languages/tools are needed for specific subsystems, they can be introduced without changing this core architecture.

---

## 15) Integration Deep-Dive (Professional)

This section explains how each external service is used in live code, what it powers, and how it fails safely.

### 15.1 Brevo / SMTP (Transactional Email)

Primary purpose:
- Registration OTP email delivery.
- Password reset OTP email delivery.

Implementation:
- Backend auth routes trigger email sends in registration/reset flows.
- Mail service supports two transport modes:
  - SMTP mode (via Brevo relay or compatible SMTP provider)
  - Brevo Transactional API mode

Code locations:
- `backend/src/routes/v1/auth.js`
- `backend/src/services/mailSmtp.js`
- `backend/src/services/connectivity.js`

Fail behavior:
- If mail is not configured, OTP endpoints return service/config errors.
- If mail send fails after pending state write, rollback/cleanup logic is applied in relevant flows.

### 15.2 Cloudinary

Primary purpose:
- Vet-related file/media upload flows (profile/verification assets).

Implementation:
- Cloudinary credentials are read server-side in MediBondhu route logic.
- Cloudinary connectivity is checked in service diagnostics.

Code locations:
- `backend/src/routes/v1/medibondhu.js`
- `backend/src/services/connectivity.js`

Fail behavior:
- Upload-related operations fail if keys are missing/invalid.
- Health/service diagnostics clearly report Cloudinary readiness.

### 15.3 OpenRouter (AI)

Primary purpose:
- Farm chatbot responses for authenticated users.

Implementation:
- Endpoint streams AI response using SSE.
- Uses model from env (with default fallback).
- Includes service headers (`HTTP-Referer`, app title) for upstream context.

Code locations:
- `backend/src/routes/v1/aiFarmChat.js`

Fail behavior:
- Missing key returns service unavailable.
- Upstream error is relayed with bounded details.

### 15.4 ZegoCloud

Primary purpose:
- Consultation room voice/video token generation.

Implementation:
- Backend generates Token04 on demand.
- Requires app ID + 32-byte server secret.
- Frontend consultation flow calls token endpoint before joining room.

Code locations:
- `backend/src/routes/v1/tools.js` (`/v1/tools/zego-token`)
- `frontend/src/pages/medibondhu/ConsultationRoom.tsx`

Fail behavior:
- Missing/invalid credentials return explicit config errors.
- Client handles token/join failures with user-facing fallbacks.

### 15.5 Supabase (Context in Current Architecture)

Current role:
- Database and realtime context are present.
- Frontend uses Supabase realtime channels.
- Backend auth and API logic are primarily local Postgres + JWT based.

Code locations:
- `frontend/src/api/client.ts` (realtime client creation and usage)
- `backend/src/services/connectivity.js` (optional Supabase REST reachability check)

---

## 16) Environment Variable Reference (Exact Names, No Secrets)

This table lists exact variables currently used by code and their purpose.

### 16.1 Core Runtime / Server

- `NODE_ENV` - runtime mode (`development` / `production`).
- `BACKEND_PORT` - Express HTTP port (preferred over generic `PORT`).
- `PORT` - fallback port if `BACKEND_PORT` is unset.
- `API_PUBLIC_URL` - public backend URL (used by integrations/headers).
- `CORS_ORIGIN` - comma-separated allowed frontend origins.
- `AUTO_CREATE_SCHEMA` - whether startup schema bootstrap runs.

### 16.2 Database / Pool

- `DATABASE_URL` - Postgres connection string.
- `DB_POOL_MAX` - max DB pool connections.
- `DB_IDLE_TIMEOUT_SEC` - idle timeout.
- `DB_CONNECT_TIMEOUT_SEC` - connect timeout.
- `DB_MAX_LIFETIME_SEC` - pooled connection max lifetime.
- `VERCEL` - runtime marker used for serverless pool defaults.

### 16.3 Auth / JWT / Registration Crypto

- `AUTH_JWT_SECRET` - primary signing/verifying secret.
- `JWT_SECRET` - legacy alias fallback.
- `SUPABASE_JWT_SECRET` - optional legacy fallback.
- `REGISTRATION_SECRET` - encrypt/decrypt pending registration password blob.
- `OFFICIAL_SUPER_ADMIN_EMAIL` - optional super admin seed support.
- `OFFICIAL_SUPER_ADMIN_PASSWORD` - optional super admin seed support.

### 16.4 Supabase

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Used mainly for optional checks/compatibility and realtime support context.

### 16.5 Brevo / Mail

Transactional API mode:
- `BREVO_API_KEY`
- `MAIL_FROM`

SMTP mode:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_LOGIN` (alias)
- `BREVO_SMTP_USER` (alias)
- `SMTP_PASS`
- `SMTP_KEY` (alias)
- `SMTP_PASSWORD` (alias)
- `BREVO_SMTP_PASSWORD` (alias)
- `MAIL_FROM`

### 16.6 Cloudinary

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### 16.7 ZegoCloud

- `ZEGOCLOUD_APP_ID`
- `ZEGOCLOUD_SERVER_SECRET`

### 16.8 OpenRouter

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (optional, defaults in code)

---

## 17) Backend Architecture (Express) - Detailed

Layered backend structure:

1. Entry/bootstrap
- `server.js` starts server, optionally runs schema bootstrap, logs connectivity.

2. App wiring
- `app.js` binds common middleware: CORS, JSON parser, security headers, route mounts, error handler.

3. Middleware
- Auth/session identity (`requireUser`).
- DB presence guard (`requireDatabase`).
- Role/capability guards (e.g., admin checks).
- Async wrapper and centralized error handling.

4. Domain routers
- Organized by business module under `routes/v1`.

5. Services
- Auth/token/session service.
- Mail service.
- Connectivity diagnostics.
- Role/capability bundle and access services.
- Registration encryption helper.

6. Data access
- PostgreSQL via parameterized SQL through `db.js`.
- Explicit SQL per endpoint with ownership constraints.

---

## 18) Frontend Architecture (React) - Detailed

Core frontend patterns:

- Route-centric module composition in `src/App.tsx`.
- Capability/role route guards via `ProtectedRoute`.
- Query/data orchestration via React Query.
- API abstraction in `src/api/client.ts`:
  - direct REST wrappers
  - table-like compatibility query builder behavior
  - auth session persistence (`farmbondhu.session`)
- Realtime subscriptions for selective live updates.
- Progressive loading:
  - lazy modules
  - route prefetch intent
  - bundled endpoint usage for high-latency pages

---

## 19) Auth and Authorization Mechanics

Authentication model:
- Local JWT-based session issue/refresh on backend.
- Frontend stores session and sends bearer token.

Authorization model:
- Role + capability composition.
- Route-level guard on frontend.
- Backend request guard for protected endpoints.
- Ownership checks for farm/user-scoped records.

Operational security notes:
- JWT secret must be present in runtime.
- Registration flow requires registration encryption secret.
- Mail-dependent flows fail fast if sender transport is not configured.

---

## 20) API Surface by Domain (Operational View)

- `auth` - sign in, OTP registration, OTP recovery/reset, refresh, profile update.
- `me` - authenticated user bundle.
- `dashboard` - overview bundle + farm record CRUD endpoints.
- `marketplace` - products, chat bootstrap, seller/admin inbox bootstrap, related flows.
- `orders` - buyer/seller order operations.
- `medibondhu` - vet profiles, consultations, room/bootstrap, prescriptions, earnings/withdrawals/admin controls.
- `community` - bundled post detail and engagement support.
- `notifications` - listing/unread/mark-read patterns.
- `ai` - authenticated streaming farm chatbot endpoint.
- `tools` - utility/token generation/link metadata.
- `public` - selected unauthenticated reads.
- `compat/from` - controlled compatibility bridge for frontend table-like calls.

---

## 21) Operations Runbook

### 21.1 Local Startup

Backend:
1. Copy `backend/.env.example` to `.env`.
2. Fill required secrets/config.
3. Run backend dev server.
4. Verify:
   - `/api/health`
   - `/api/health/db`
   - `/api/v1`

Frontend:
1. Set frontend env to point at backend base URL.
2. Run Vite dev server.
3. Validate authenticated routes and module pages.

### 21.2 Startup Diagnostics

Backend startup connectivity block reports service status for:
- database
- supabase (optional)
- cloudinary
- openrouter
- brevo
- zego

### 21.3 Production Deployment (Vercel split)

- Frontend and backend deploy as separate Vercel projects.
- Frontend must point to backend public URL.
- Backend CORS must include frontend domain(s).
- Required secrets must be configured in backend environment.

### 21.4 Recommended Post-Deploy Verification

- Auth: login, refresh, protected route check.
- Dashboard: bundle endpoint timings and data loads.
- Marketplace: product listing + chat bootstrap.
- MediBondhu: vet directory, booking, room token path.
- AI: farm chat request/stream.
- Email: registration OTP and password reset OTP flows.

---

## 22) Troubleshooting Guide

### 22.1 Auth failures

Symptoms:
- `/me` or protected endpoints fail with auth errors.

Checks:
- `AUTH_JWT_SECRET` exists and is consistent.
- Token issuance and refresh endpoints work.
- Frontend points to correct backend URL.

### 22.2 OTP email failures

Symptoms:
- registration/recovery OTP send fails.

Checks:
- Configure either:
  - SMTP (`SMTP_USER` + `SMTP_PASS` + `MAIL_FROM`), or
  - Brevo API (`BREVO_API_KEY` + `MAIL_FROM`).
- Verify sender identity in email provider.

### 22.3 Cloudinary upload failures

Checks:
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- Service connectivity status endpoint output.

### 22.4 Zego call join/token failures

Checks:
- `ZEGOCLOUD_APP_ID` and `ZEGOCLOUD_SERVER_SECRET`.
- Secret length constraints and parsing.
- Token endpoint response and room/user payload correctness.

### 22.5 AI chat errors

Checks:
- `OPENROUTER_API_KEY`.
- Upstream status in response.
- API base URL and auth header forwarding.

---

## 23) Security and Secrets Handling Policy

- Never commit real secrets to source control.
- Use only env variables in deployment platforms.
- Rotate secrets after accidental exposure or team changes.
- Keep production and local secrets separate.
- Restrict service role keys and admin-level credentials.
- Ensure error payloads do not leak sensitive internals in production.

Sensitive variables include (non-exhaustive):
- `AUTH_JWT_SECRET`, `REGISTRATION_SECRET`
- `DATABASE_URL`
- `BREVO_API_KEY`, SMTP passwords
- `CLOUDINARY_API_SECRET`
- `OPENROUTER_API_KEY`
- `ZEGOCLOUD_SERVER_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 24) Data Ownership and Access Semantics

General rule:
- user-scoped records are filtered by authenticated `user_id`.
- farm-scoped operations verify farm ownership before mutation.
- admin routes require elevated role/capability checks.
- vet-facing flows apply vet ownership or approved access checks in MediBondhu services.

---

## 25) Reliability, Performance, and Observability

Current reliability/performance posture:
- defensive schema bootstrap in non-strict environments.
- indexed DB access for critical list and timeline queries.
- endpoint bundling for high-traffic screens.
- timing headers on selected endpoints.
- selective cache control.
- realtime updates with query invalidation.

Observability touchpoints:
- startup connectivity logs.
- health/service endpoints.
- route-specific timing headers.

### 25.1 Hybrid Caching (React + Express)

FarmBondhu uses a layered caching strategy to balance speed and correctness:

- Frontend in-memory cache:
  - React Query stores previously loaded data for instant repeat navigation.
  - Module-level stale windows are tuned by page criticality.
- Backend short-TTL response cache:
  - User-scoped in-memory cache keys prevent cross-user leakage.
  - Expensive bootstrap/list GET endpoints use short TTL windows.
- Hybrid freshness policy:
  - Critical data (auth/session/active consultation state) refreshes aggressively.
  - Non-critical list and overview pages use stale-while-revalidate behavior.

Backend cache utility:
- `backend/src/services/responseCache.js`

Examples of cached endpoint groups:
- Dashboard overview bundle (`dashboard` routes)
- Marketplace product/inbox bootstraps (`marketplace` routes)
- MediBondhu bootstrap endpoints for vet/patient lists (`medibondhu` routes)

Invalidation model:
- Route-level write success (`POST`/`PATCH`/`DELETE`) clears relevant cache prefixes.
- Realtime updates in frontend continue to invalidate/refetch active query keys.

---

## 26) Document Versioning Guidance

Maintain `aboutproject.md` as a living contract:
- update when routes/capabilities/env contracts change.
- update integration sections when providers/config logic change.
- sync troubleshooting with newly seen production incidents.
- keep all variable names exact and code-traceable.

