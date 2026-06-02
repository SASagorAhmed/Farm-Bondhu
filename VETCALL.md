# Consultation Call Workflow (Source of Truth)

This file documents the current consultation call workflow. VetBondhu and MediBondhu are separate modules and must stay separate:

- VetBondhu: veterinary calls, VetBondhu routes, VetBondhu green theme, veterinary tables.
- MediBondhu: human-care calls, MediBondhu routes, MediBondhu cyan theme, `medibondhu_appointments`.

Use VetBondhu as a behavior reference only. Do not mix routes, query keys, colors, or data tables.

## Scope

- Patient booking and entry flow
- Doctor/vet request receive/start flow
- Waiting room behavior
- Room join/rejoin behavior
- 20-second grace timer behavior
- Realtime + polling + broadcast update paths

## Main Booking Statuses

- `pending`: created/paid by patient, waiting for doctor/vet start
- `confirmed`: treated as pending in UI behavior
- `in_progress`: active consultation session
- `completed`: terminal
- `cancelled`: terminal

## Patient Flow

### 1) Create booking

MediBondhu file: `frontend/src/pages/medibondhu/BookConsultation.tsx`

- Patient selects a MediBondhu doctor, future schedule window, and visit type.
- Appointment is inserted into `medibondhu_appointments`.
- Online appointments start `pending`; the patient is sent to `/medibondhu/waiting/:appointmentId`.
- After successful insert, patient sends a MediBondhu doctor inbox broadcast via `broadcastMediDoctorInboxNewAppointment(...)`.

### 2) Waiting for doctor

MediBondhu file: `frontend/src/pages/medibondhu/MediWaitingRoom.tsx`

- Waiting room fetches appointment details and subscribes to appointment realtime updates.
- If status becomes `in_progress`, patient auto-navigates to room
- If status is terminal (`completed`, `cancelled`, or `rejected`), patient goes back to consultations
- Polling fallback is enabled if realtime misses events

### 3) Join Again from patient consultations

MediBondhu file: `frontend/src/pages/medibondhu/Consultations.tsx`

Join button destination is status-driven:

- `pending` / `confirmed` -> `/medibondhu/waiting/:appointmentId`
- `in_progress` (joinable) -> `/medibondhu/room/:appointmentId`
- terminal -> no join button

Joinability follows `leave_deadline_at` / `left_user_id`: if another participant owns the grace window, show ending state instead of opening the room.

## Doctor / Vet Flow

### 1) New request visibility

VetBondhu veterinary files:

- `frontend/src/pages/vet/VetDashboard.tsx`
- `frontend/src/pages/vet/VetConsultations.tsx`
- `frontend/src/api/client.ts`

MediBondhu human doctor files:

- `frontend/src/pages/doctor/MediDoctorDashboard.tsx`
- `frontend/src/pages/doctor/MediDoctorSchedule.tsx`
- `frontend/src/pages/medibondhu/MediHumanConsultationRoom.tsx`

Screens are updated through realtime, polling, and module-specific broadcast wake-ups.

- Supabase postgres realtime (`subscribeConsultationBookings`)
- Fast polling (`refetchInterval`)
- Cross-client broadcast wake-up (`subscribeVetInboxNewBooking`)

### 2) Start room

VetBondhu veterinary files:

- `frontend/src/pages/vet/VetDashboard.tsx`
- `frontend/src/pages/vet/VetConsultations.tsx`

MediBondhu human-care file:

- `frontend/src/pages/medibondhu/MediHumanConsultationRoom.tsx`

When the doctor opens the MediBondhu room:

- appointment updates to `status: "in_progress"`
- doctor stays in `/medibondhu/room/:appointmentId`
- patient waiting room auto-opens the same room

## Room Entry Rules

## Patient waiting-room to room permission

MediBondhu file: `frontend/src/pages/medibondhu/MediWaitingRoom.tsx`

`canPatientJoinRoomNow(...)` allows room join only when:

- `status === "in_progress"` and
- either no `leave_deadline_at`, or `left_user_id` equals current patient user id

If not joinable, waiting room sends patient back to consultations with an ending message.

## Consultation room active check

MediBondhu file: `frontend/src/pages/medibondhu/MediHumanConsultationRoom.tsx`

- Room is allowed only for active bookings (`in_progress`)
- Chat and audio/video both use the same booking/grace state rules
- Video/audio uses Zego; chat has no Zego join callback

## Grace Timer (20s) and Rejoin

MediBondhu file: `frontend/src/pages/medibondhu/MediHumanConsultationRoom.tsx`

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

MediBondhu file: `frontend/src/pages/medibondhu/MediHumanConsultationRoom.tsx`

Because chat mode has no Zego `onJoinRoom`, UI reset now also happens when:

- booking is `in_progress` and no `leave_deadline_at`
- realtime booking payload clears `leave_deadline_at`
- room bootstrap merge has no `leave_deadline_at`

This prevents stale countdown after successful chat rejoin.

## Realtime Channels and Signals

### Booking/message realtime

- VetBondhu booking streams:
  - `vet-dashboard-bookings-${user.id}`
  - `vet-consultations-${user.id}`
- MediBondhu appointment streams use `subscribeMediHumanAppointments(...)` and module-specific query keys.

### Module inbox broadcast

File: `frontend/src/api/client.ts`

- VetBondhu patient send: `broadcastVetInboxNewBooking(...)`
- MediBondhu patient send: `broadcastMediDoctorInboxNewAppointment(...)`
- VetBondhu topic format: `vet-inbox-${vetUserId}`
- Event: `new-booking`

If Supabase realtime client is unavailable, broadcast becomes no-op and existing polling/realtime remain fallback.

## Navigation Matrix (Quick Reference)

- Patient `pending/confirmed` + Join Again -> waiting room
- Patient waiting room + doctor/vet starts -> room
- Patient `in_progress` + joinable -> room
- Patient `in_progress` + not joinable (grace owned by other side) -> consultations
- Doctor/vet pending request + start/accept -> room
- Any terminal status -> consultations lists

## Change Guidelines (Future)

If you change this workflow, update all of:

- MediBondhu: `BookConsultation.tsx`, `Consultations.tsx`, `MediWaitingRoom.tsx`, `MediHumanConsultationRoom.tsx`
- VetBondhu: `BookConsultation.tsx`, `Consultations.tsx`, `WaitingRoom.tsx`, `ConsultationRoom.tsx`
- Doctor/vet dashboards and consultation lists
- `api/client.ts` (broadcast helper contract)

Always keep:

- Realtime + polling fallback
- deterministic status-driven navigation
- same joinability rules between screens (no conflicting logic)
