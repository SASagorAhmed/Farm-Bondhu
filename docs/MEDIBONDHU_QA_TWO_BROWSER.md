# MediBondhu QA: two-browser (patient + doctor) checklist

Use two browsers (or profiles) with **separate logins** so each has its own JWT and `userId`. The server treats them as two independent clients updating the same `medibondhu_appointments` row.

MediBondhu is the human-care module. Keep it separate from VetBondhu veterinary routes, tables, colors, and query keys.

## Before starting a run

- [ ] **Same appointment:** Patient and doctor both use the **same appointment id** (`/medibondhu/waiting/:id` or `/medibondhu/room/:id`).
- [ ] **Doctor identity:** The appointment’s `doctor_id` matches the approved MediBondhu doctor profile for the doctor browser account.
- [ ] **Doctor availability:** In `/medibondhu/doctor/schedule`, doctor is accepting patients, the intended visit type is enabled, and at least one future schedule window exists.
- [ ] **Available doctors:** `/medibondhu/doctors?available=true` shows only doctors with `can_book === true`.
- [ ] **Zego env:** Backend has `ZEGOCLOUD_APP_ID` and `ZEGOCLOUD_SERVER_SECRET`; patient and doctor each complete the UIKit flow (see `docs/MEDIBONDHU_ZEGO_TOKEN.md`).

## During the call

- [ ] Doctor opens the room and moves the online appointment to **`in_progress`**.
- [ ] Patient waiting room auto-opens the room after the doctor starts.
- [ ] Leaving the Zego room starts the 20-second rejoin window (`leave_deadline_at`, `left_user_id`).
- [ ] The leaving participant can rejoin before timeout; countdown clears for both clients.
- [ ] If the countdown reaches 0, the appointment completes and chat history remains readable.
- [ ] All Zego controls remain visible on phone and laptop, including camera switch on phone.

## When something fails

- [ ] Confirm **current** `status` on the appointment (network tab or GET) before retrying a PATCH.
- [ ] Confirm `leave_deadline_at` and `left_user_id` when testing rejoin behavior.
- [ ] Confirm **which user** issued the PATCH (patient vs doctor vs admin) matches the transition rules.
