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

## VetBondhu Admin Operations

VetBondhu admin overview and payouts stay in the VetBondhu admin module and use VetBondhu veterinary data only.

| Admin path | Purpose |
|------------|---------|
| `/admin/vetbondhu-overview` | VetBondhu overview, all vets, available-now vets, recent bookings, active sessions, and vet withdrawals |
| `/admin/vetbondhu-access` | VetBondhu-only access controls for vets and VetBondhu users |

The VetBondhu overview uses VetBondhu green/emerald branding. The `Available Now` stat opens the currently online vet list, based on the VetBondhu heartbeat/online window, not just a static availability flag.

## MediBondhu Admin Operations

MediBondhu admin tools are separate from VetBondhu and global account controls. They use MediBondhu cyan branding and MediBondhu-only tables, routes, query keys, and restrictions.

| Admin path | Purpose |
|------------|---------|
| `/admin/medibondhu-human` | Doctor approval, hospitals, specialties, appointments, and MediBondhu human-service operations |
| `/admin/medibondhu-access` | MediBondhu-only freeze, suspend, delete-access, and restore actions for doctors and patients |
| `/admin/medibondhu-payouts` | MediBondhu doctor payout overview, doctor lists, recent bookings, withdrawal details, approve, and reject |

### MediBondhu doctor approval

Approved MediBondhu doctors should show an approved state in Admin → MediBondhu Human, not repeat `Approve` / `Reject` actions. Pending doctors show both actions. Rejected doctors can be approved again when the admin wants to restore the doctor.

### MediBondhu hospitals and specialties

Hospitals and specialties added by admin in `/admin/medibondhu-human` are doctor-facing options. After admin creates or updates these records, the related doctor/profile query caches must be invalidated so doctors can select the new hospital or specialty without waiting for stale cache expiry.

### MediBondhu access controls

MediBondhu access actions are scoped through MediBondhu restriction data. A frozen, suspended, or deleted MediBondhu doctor/patient is blocked inside MediBondhu only; the action must not remove VetBondhu access or globally delete the account.

### MediBondhu payouts

The MediBondhu payout page combines operational overview and payout review:

- `Total Doctors`
- `Available Doctors`
- `Total Bookings`
- `Active Sessions`
- `Pending Withdrawals`
- `All Doctors`, `Available Doctors`, `Recent Bookings`, `Withdrawals`, and `Details` tabs

Withdrawal approval/rejection stays tied to MediBondhu doctor withdrawal records and must not use VetBondhu payout data.

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
