# Admin platform

## Control Center (`/admin`)

Module picker hub for platform administration: Platform, Farm Management, VetBondhu, MediBondhu, Learning, Marketplace, and Community. Each module shows only its related sidebar controls.

Cross-user moderation (all users, approvals, marketplace products, community reports, etc.) stays in Control Center modules — not on the admin personal profile.

## Preview workspaces

In the admin sidebar, **Preview workspaces** opens user-facing apps (Farm, Marketplace, Vet portal, MediBondhu, VetBondhu, Learning, Community) so admins can verify UX.

| Admin tier | Preview navigation | Edits in preview |
|------------|-------------------|------------------|
| Super Admin | All workspaces | Full CRUD in preview, including delete on any marketplace product, post, comment, or answer while browsing |
| Co-Admin / Moderator | All workspaces | Read-only; backend returns 403 on writes |

A banner at the top of preview pages links back to Control Center and shows the current mode.

**Note:** Preview CRUD applies to the admin account’s own rows in user APIs, except Super Admin moderation deletes (any product/post/comment/answer in marketplace and community preview). Managing other users’ farms, orders, or doctors remains in the matching **Admin →** module (e.g. `/admin/farms`, `/admin/medibondhu-human`).

### Super Admin moderation in preview

While previewing **Marketplace** or **Community**, Super Admin sees delete actions on content they do not own:

- **Marketplace:** Delete product on product detail (`/marketplace/product/:id`)
- **Community:** Delete post, comment, or answer on post detail and in the feed

Co-Admin and Moderator do not see these controls; delete API calls return 403. Hard deletes from Control Center (e.g. Admin → Marketplace products table) use the same Super Admin backend bypass.

## Admin profile

`/admin/profile` shows account details and Platform shortcuts only — not MediBondhu doctor verification. Doctor and vet onboarding are managed under Admin → MediBondhu and Admin → VetBondhu.

## Email Audit (Platform)

**Path:** `/admin/email-audit` (Platform module sidebar)

Lists all transactional emails logged after send attempts: registration OTP, password reset OTP, and marketplace order updates. Data is written from [`mailSmtp.js`](../backend/src/services/mailSmtp.js) via [`emailAuditLog.js`](../backend/src/services/emailAuditLog.js).

| Privacy rule | Behavior |
|--------------|----------|
| OTP code | Never stored in DB or API — `sensitive_fields.code = "hasValue"` only |
| Email body preview | Sanitized text; OTP digits replaced with `[REDACTED]` |
| Marketplace mail | Subject + preview; metadata includes `orderId`, `eventKey`, `audience` |

Admin API: `GET /v1/admin/email-audit` (filter by `type`, `status`, paginate) and `GET /v1/admin/email-audit/stats` (7-day breakdown). Requires platform admin (`requireAdmin`).

Only emails sent **after** this feature is deployed are logged; Brevo history is not backfilled.
