# MediBondhu: consultation booking status (FSM + actors)

Updates to `consultation_bookings.status` go through `PATCH /v1/medibondhu/bookings/:id` in `backend/src/routes/v1/medibondhu.js`. The handler returns **`403` with `{ error: "Invalid status transition" }`** when the requested next status is not allowed for the **current** status or for the **actor** (patient vs vet vs admin).

## Allowed status values

Statuses must be one of: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled` (see `BOOKING_STATUS` in the same file). Any other value yields **`400` `Invalid status value`**.

## Who is the actor?

After loading the booking, the server computes:

- **`isAdmin`:** user has role `admin` → may patch allowed admin fields; **status:** any transition to another allowed status value is permitted.
- **`isVetParticipant`:** `current.computed_vet_user_id === uid` **or** `current.vet_mock_id === uid`.
- **`isPatientParticipant`:** `current.patient_mock_id === uid`.

Non-admins must be a participant on the row (otherwise `404` before transition rules run). Vet identity for listings and “Accept” flows must match **`computed_vet_user_id`** (see `coalesce(b.vet_user_id, v.user_id, b.vet_mock_id)` in queries) so the vet browser’s JWT `userId` aligns with the booking.

## Allowed transitions (non-admin)

When `patch.status` is present, `prevStatus` is the current row status and `nextStatus` is the requested value.

### Vet

| From | To |
|------|-----|
| `pending` or `confirmed` | `in_progress` or `cancelled` |
| `in_progress` | `completed` or `cancelled` |

### Patient

| From | To |
|------|-----|
| `pending`, `confirmed`, or `in_progress` | `cancelled` only |

Patients **cannot** set `in_progress` or `completed` via this rule set.

### Admin

Any change from `prevStatus` to a valid `nextStatus` in `BOOKING_STATUS` is allowed.

## Side effects

- When `nextStatus === "completed"`, the handler sets `patch.completed_at` to the current ISO timestamp.

## Typical causes of `Invalid status transition`

- **Stale UI / double action:** e.g. booking already `completed` or `cancelled`, then the client sends another status change.
- **Wrong actor:** patient tries a vet-only transition or vice versa.
- **Race:** two clients PATCH status in quick succession; the second request sees a new `prevStatus` and may fail the transition matrix.
