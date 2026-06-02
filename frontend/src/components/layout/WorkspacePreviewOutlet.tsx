import { Outlet } from "react-router-dom";
import AdminPreviewBanner from "./AdminPreviewBanner";
import { useAuth, isPlatformAdmin, isAdminPreviewPath } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";

interface Props {
  children?: React.ReactNode;
}

/** Renders preview banner + outlet (or children) for workspace layouts. */
export default function WorkspacePreviewOutlet({ children }: Props) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const showBanner = Boolean(user && isPlatformAdmin(user) && isAdminPreviewPath(pathname));

  return (
    <>
      {showBanner && <AdminPreviewBanner />}
      {children ?? <Outlet />}
    </>
  );
}
