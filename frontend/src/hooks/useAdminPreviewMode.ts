import { useLocation } from "react-router-dom";
import { useAuth, isAdminPreviewPath, isPlatformAdmin, isSuperAdmin } from "@/contexts/AuthContext";

export function useAdminPreviewMode() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isPreview = Boolean(user && isPlatformAdmin(user) && isAdminPreviewPath(pathname));
  const readOnly = isPreview && !isSuperAdmin(user);
  const canModerate = isPreview && isSuperAdmin(user);
  return { isPreview, readOnly, canModerate };
}
