/** Known doctor clinical workspace segments under `/medibondhu/doctor/`. */
const MEDI_DOCTOR_PORTAL_SEGMENTS = new Set([
  "dashboard",
  "schedule",
  "consultations",
  "patients",
  "prescriptions",
  "earnings",
  "rx",
  "profile-setup",
]);

const MEDI_SHARED_UTILITY_PREFIXES = [
  "/medibondhu/profile",
  "/medibondhu/settings",
  "/medibondhu/support",
  "/medibondhu/access-center",
  "/medibondhu/notifications",
] as const;

const MEDI_DOCTOR_PORTAL_DASHBOARD = "/medibondhu/doctor/dashboard";

/** True for approved-doctor workspace routes (not public `/medibondhu/doctor/:uuid` profiles). */
export function isMediDoctorPortalPath(pathname: string): boolean {
  if (!pathname.startsWith("/medibondhu/doctor/")) return false;
  const rest = pathname.slice("/medibondhu/doctor/".length);
  const segment = rest.split("/")[0];
  return MEDI_DOCTOR_PORTAL_SEGMENTS.has(segment);
}

function isMediSharedUtilityPath(pathname: string): boolean {
  return MEDI_SHARED_UTILITY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Patient-care MediBondhu routes; platform admins in preview should land on the doctor portal instead.
 */
export function isMediPatientCarePathForAdminPreview(pathname: string): boolean {
  if (!pathname.startsWith("/medibondhu")) return false;
  if (isMediDoctorPortalPath(pathname)) return false;
  if (isMediSharedUtilityPath(pathname)) return false;
  return true;
}

export function mediDoctorPortalDashboardPath(): string {
  return MEDI_DOCTOR_PORTAL_DASHBOARD;
}
