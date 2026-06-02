import { useAdminPreviewMode } from "@/hooks/useAdminPreviewMode";

export const MEDI_DOCTOR_ADMIN_PREVIEW_EMPTY =
  "Admin preview — no doctor profile is linked to this account. Browse layout and navigation only.";

/** Read-only guard for MediBondhu doctor workspace during platform-admin preview. */
export function useMediDoctorPreviewActions() {
  const { readOnly, isPreview } = useAdminPreviewMode();
  return {
    readOnly,
    isPreview,
    previewEmptyHint: isPreview ? MEDI_DOCTOR_ADMIN_PREVIEW_EMPTY : null,
  };
}
