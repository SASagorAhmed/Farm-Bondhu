# Vet Call Workflow (Source of Truth)

This file documents the current MediBondhu consultation call workflow so future changes can follow a consistent flow.

## Scope

- Patient booking and entry flow
- Vet request receive/accept flow
- Waiting room behavior
- Room join/rejoin behavior
- 20-second grace timer behavior
- Realtime + polling + broadcast update paths

## Main Booking Statuses

- `pending`: created/paid by patient, waiting for vet accept
- `confirmed`: treated as pending in UI behavior
- `in_progress`: active consultation session
- `completed`: terminal
- `cancelled`: terminal

## Patient Flow

### 1) Create booking

File: `frontend/src/pages/medibondhu/BookConsultation.tsx`

- Patient confirms and inserts a row into `consultation_bookings`
- Booking is created as `status: "pending"` and `payment_status: "paid"`
- For instant calls, patient is sent to waiting room
- After successful insert, patient sends a vet inbox broadcast via:
  - `broadcastVetInboxNewBooking(vetUserId, bookingId)`

### 2) Waiting for vet

File: `frontend/src/pages/medibondhu/WaitingRoom.tsx`

- Waiting room fetches bootstrap booking (`room-bootstrap`) and subscribes to booking realtime updates
- If status becomes `in_progress`, patient auto-navigates to room
- If status is terminal (`completed` or `cancelled`), patient goes back to consultations
- Polling fallback is enabled if realtime misses events

### 3) Join Again from patient consultations

File: `frontend/src/pages/medibondhu/Consultations.tsx`

Join button destination is status-driven:

- `pending` / `confirmed` -> `/medibondhu/waiting/:bookingId`
- `in_progress` (joinable) -> `/medibondhu/room/:bookingId`
- terminal -> no join button

This is implemented by `resolveJoinDestination(...)`.

## Vet Flow

### 1) New request visibility

Files:

- `frontend/src/pages/vet/VetDashboard.tsx`
- `frontend/src/pages/vet/VetConsultations.tsx`
- `frontend/src/api/client.ts`

Vet screens are updated through three paths:

- Supabase postgres realtime (`subscribeConsultationBookings`)
- Fast polling (`refetchInterval`)
- Cross-client broadcast wake-up (`subscribeVetInboxNewBooking`)

### 2) Accept booking

Files:

- `frontend/src/pages/vet/VetDashboard.tsx`
- `frontend/src/pages/vet/VetConsultations.tsx`

When vet accepts:

- Booking is updated to `status: "in_progress"`
- Vet navigates to `/vet/room/:bookingId`
- Caches are patched/invalidated so both dashboard and consultations refresh quickly

## Room Entry Rules

## Patient waiting-room to room permission

File: `frontend/src/pages/medibondhu/WaitingRoom.tsx`

`canPatientJoinRoomNow(...)` allows room join only when:

- `status === "in_progress"` and
- either no `leave_deadline_at`, or `left_user_id` equals current patient user id

If not joinable, waiting room sends patient back to consultations with an ending message.

## Consultation room active check

File: `frontend/src/pages/medibondhu/ConsultationRoom.tsx`

- Room is allowed only for active bookings (`in_progress`)
- Chat and audio/video both use the same booking/grace state rules
- Video/audio uses Zego; chat has no Zego join callback

## Grace Timer (20s) and Rejoin

File: `frontend/src/pages/medibondhu/ConsultationRoom.tsx`

When participant leaves:

- `leave_deadline_at` is set to now + 20s
- `left_user_id` is set to leaver
- UI starts countdown immediately using local refs (for low-latency UX)

When participant rejoins in time:

- Grace timer is cleared in DB and local UI
- `hasExitGraceStartedRef` is reset
- Rejoin success continues session normally

If timer expires:

- Room auto-finalizes consultation (moves to terminal status path)

## Chat-Specific Rejoin Fix

File: `frontend/src/pages/medibondhu/ConsultationRoom.tsx`

Because chat mode has no Zego `onJoinRoom`, UI reset now also happens when:

- booking is `in_progress` and no `leave_deadline_at`
- realtime booking payload clears `leave_deadline_at`
- room bootstrap merge has no `leave_deadline_at`

This prevents stale countdown after successful chat rejoin.

## Realtime Channels and Signals

### Booking/message realtime

- Waiting room booking updates: `waiting-${bookingId}`
- Room booking updates: `room-booking-${bookingId}`
- Room messages: `room-${bookingId}` (message inserts)
- Vet booking streams:
  - `vet-dashboard-bookings-${user.id}`
  - `vet-consultations-${user.id}`

### Vet inbox broadcast

File: `frontend/src/api/client.ts`

- Patient send: `broadcastVetInboxNewBooking(...)`
- Vet subscribe: `subscribeVetInboxNewBooking(...)`
- Topic format: `vet-inbox-${vetUserId}`
- Event: `new-booking`

If Supabase realtime client is unavailable, broadcast becomes no-op and existing polling/realtime remain fallback.

## Navigation Matrix (Quick Reference)

- Patient `pending/confirmed` + Join Again -> waiting room
- Patient waiting room + vet accepts -> room
- Patient `in_progress` + joinable -> room
- Patient `in_progress` + not joinable (grace owned by other side) -> consultations
- Vet pending request + Accept -> vet room
- Any terminal status -> consultations lists

## Change Guidelines (Future)

If you change this workflow, update all of:

- `BookConsultation.tsx` (creation + broadcast)
- `Consultations.tsx` (patient Join Again routing)
- `WaitingRoom.tsx` (status-to-navigation decision)
- `ConsultationRoom.tsx` (grace + finalize logic)
- `VetDashboard.tsx` and `VetConsultations.tsx` (vet discovery + invalidation)
- `api/client.ts` (broadcast helper contract)

Always keep:

- Realtime + polling fallback
- deterministic status-driven navigation
- same joinability rules between screens (no conflicting logic)
