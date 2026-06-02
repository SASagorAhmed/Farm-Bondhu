# MediBondhu: human appointment status (FSM + actors)

MediBondhu human-care appointments use `medibondhu_appointments` and `/api/v1/medibondhu/*` routes. Do not mix this flow with VetBondhu veterinary `consultation_bookings`.

Status updates go through `PATCH /v1/medibondhu/appointments/:id` in `backend/src/routes/v1/medibondhu.js`.

## Allowed status values

Statuses are:

- `pending`: online appointment requested by patient, waiting for doctor to start
- `confirmed`: chamber appointment or an accepted waiting state
- `in_progress`: active online room
- `completed`: terminal
- `cancelled`: terminal
- `rejected`: terminal

## Who is the actor?

After loading the appointment, the server computes:

- **Patient:** `patient_user_id === req.userId`
- **Doctor:** approved MediBondhu doctor whose doctor profile id equals `appointment.doctor_id`
- **Admin:** admin role/capability

Non-admins must be appointment participants.

## Status transitions

### Doctor

- `pending` or `confirmed` -> `in_progress` for online visits
- `pending`, `confirmed`, or `in_progress` -> `completed`
- allowed doctor/admin cancellation paths use `cancelled`

### Patient

- patient can cancel an appointment through the cancellation path
- patient cannot start or manually complete an appointment

## 20-second leave/rejoin grace

Active online appointments support a rejoin window:

- `leave_deadline_at`: timestamp when the room should auto-complete
- `left_user_id`: participant who left
- participants can set/clear these fields while the appointment is not terminal
- after the deadline expires, a participant can complete the appointment through the grace-timeout path

The room UI shows a 20-second countdown and clears it when the leaving participant rejoins in time.

## Availability and booking

Doctor availability is MediBondhu-specific:

- `is_available`: doctor is accepting patients
- `online_consultation`: doctor offers online visits
- `chamber_consultation`: doctor offers chamber visits
- future `medibondhu_doctor_time_slots`: required for patient booking

The public doctor API decorates doctors with:

- `has_open_slots`
- `is_online_now`
- `can_book`
- `availability_label`

`/medibondhu/doctors?available=true` filters to bookable active doctors in the frontend.

## Common failure causes

- stale UI sends status changes after terminal status
- patient tries a doctor-only transition
- doctor profile is not approved or does not match appointment `doctor_id`
- no future schedule window exists
- selected visit type is disabled for the doctor
