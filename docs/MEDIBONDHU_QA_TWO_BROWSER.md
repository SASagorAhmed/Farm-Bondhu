# MediBondhu QA: two-browser (patient + vet) checklist

Use two browsers (or profiles) with **separate logins** so each has its own JWT and `userId`. The server treats them as two independent clients updating the same `consultation_bookings` row.

## Before starting a run

- [ ] **Same booking:** Patient and vet both use the **same booking id** (same consultation URL / id from the patient flow after booking is created).
- [ ] **Vet identity:** The row’s vet fields (`vet_user_id`, `vet_mock_id`, and thus `computed_vet_user_id`) match the **vet account** logged into the vet browser. If the booking is tied to another vet’s id, pending lists and Accept actions will not match expectations.
- [ ] **Zego env:** Backend has `ZEGOCLOUD_APP_ID` and `ZEGOCLOUD_SERVER_SECRET`; patient and vet each complete the UIKit flow (see `docs/MEDIBONDHU_ZEGO_TOKEN.md`).

## During the call

- [ ] Vet moves booking to **`in_progress`** (e.g. Accept) before or as the patient enters the room, per product flow.
- [ ] Avoid **double end / double cancel:** leaving the Zego room may trigger `onLeaveRoom` → status update; do not assume a second “End” or “Cancel” is safe without refreshing booking state—see `docs/MEDIBONDHU_BOOKING_STATUS.md` for allowed transitions from `in_progress` / terminal states.

## When something fails

- [ ] Confirm **current** `status` on the booking (network tab or GET) before retrying a PATCH.
- [ ] Confirm **which user** issued the PATCH (patient vs vet vs admin) matches the transition rules.
