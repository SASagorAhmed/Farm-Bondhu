# MediBondhu Guide

MediBondhu is FarmBondhu's human-care and doctor consultation service. It helps patients find doctors, check availability, book online or chamber appointments, join waiting rooms, attend online consultations, receive prescriptions, and keep consultation history.

MediBondhu is for human healthcare only. VetBondhu is the separate animal-care module and must not share MediBondhu routes, tables, colors, query keys, payouts, access controls, or medical workflows.

---

## Purpose

MediBondhu gives patients a structured way to reach approved doctors and helps doctors manage their consultation workflow from one professional workspace.

The service supports:

- Human doctor discovery by specialty and availability
- Online and chamber appointment booking
- Waiting-room and consultation-room flows
- Prescription creation and patient prescription history
- Doctor earnings and withdrawal requests
- Admin-managed hospitals, specialties, approvals, access controls, and payouts

MediBondhu does not replace emergency care. Severe or life-threatening human medical issues need local emergency service or in-person hospital care immediately.

---

## Core Patient Flow

1. Patient opens MediBondhu and chooses a specialty or doctor.
2. Patient checks availability and selects online or chamber consultation.
3. Patient books an appointment and joins the waiting room for online visits.
4. Doctor starts the consultation room when ready.
5. Patient and doctor complete the consultation.
6. Doctor issues a prescription when needed.
7. Patient can review consultation and prescription history later.

MediBondhu appointments use `medibondhu_appointments` and the `/api/v1/medibondhu/*` API routes.

---

## Doctor Workspace

MediBondhu doctors manage:

- Profile setup, hospital, specialty, education, fees, and experience
- Schedule windows and consultation availability
- Online and chamber appointment requests
- Consultation room participation
- Human prescriptions
- Earnings and withdrawal requests

Doctors must be approved by admin before they can serve patients as active MediBondhu doctors.

---

## Admin Operations

MediBondhu admin tools are separate from VetBondhu and global account controls. They use MediBondhu cyan branding and MediBondhu-only tables, routes, query keys, and restrictions.

| Admin path | Purpose |
|------------|---------|
| `/admin/medibondhu-human` | Doctor approval, hospitals, specialties, appointments, and MediBondhu human-service operations |
| `/admin/medibondhu-access` | MediBondhu-only freeze, suspend, delete-access, and restore actions for doctors and patients |
| `/admin/medibondhu-payouts` | MediBondhu doctor payout overview, doctor lists, recent bookings, withdrawal details, approve, and reject |

### Doctor approval

Approved MediBondhu doctors show an approved state in Admin -> MediBondhu Human, not repeated `Approve` / `Reject` actions. Pending doctors show both actions. Rejected doctors can be approved again when admin wants to restore the doctor.

### Hospitals and specialties

Hospitals and specialties added by admin in `/admin/medibondhu-human` are doctor-facing options. After admin creates or updates these records, the related doctor/profile query caches must be invalidated so doctors can select the new hospital or specialty without waiting for stale cache expiry.

### Access controls

MediBondhu access actions are scoped through MediBondhu restriction data. A frozen, suspended, or deleted MediBondhu doctor/patient is blocked inside MediBondhu only. The action must not remove VetBondhu access or globally delete the account.

### Doctor payouts

The MediBondhu payout page combines operational overview and withdrawal review:

- `Total Doctors`
- `Available Doctors`
- `Total Bookings`
- `Active Sessions`
- `Pending Withdrawals`
- `All Doctors`, `Available Doctors`, `Recent Bookings`, `Withdrawals`, and `Details` tabs

Withdrawal approval and rejection stay tied to MediBondhu doctor withdrawal records and must not use VetBondhu payout data.

---

## Status And QA References

- [MediBondhu booking status](MEDIBONDHU_BOOKING_STATUS.md)
- [MediBondhu QA checklist](MEDIBONDHU_QA_TWO_BROWSER.md)
- [MediBondhu Zego token notes](MEDIBONDHU_ZEGO_TOKEN.md)
- [Admin reference](admin.md)

