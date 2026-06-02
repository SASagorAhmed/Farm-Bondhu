import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import WorkspacePreviewOutlet from "./WorkspacePreviewOutlet";
import { SidebarProvider } from "@/components/ui/sidebar";
import MediBondhuSidebar from "./MediBondhuSidebar";
import TopBar from "./TopBar";
import FarmChatbot from "@/components/FarmChatbot";
import { useAuth, isPlatformAdmin, isAdminPreviewPath } from "@/contexts/AuthContext";
import {
  isMediPatientCarePathForAdminPreview,
  mediDoctorPortalDashboardPath,
} from "@/lib/medibondhuRoutes";

export default function MediBondhuLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !isPlatformAdmin(user) || !isAdminPreviewPath(pathname)) return;
    if (!isMediPatientCarePathForAdminPreview(pathname)) return;
    navigate(mediDoctorPortalDashboardPath(), { replace: true });
  }, [user, pathname, navigate]);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full overflow-hidden">
        <MediBondhuSidebar />
        <div className="flex-1 flex flex-col min-h-0">
          <TopBar />
          <main className="flex-1 p-4 md:p-6 bg-background overflow-auto">
            <WorkspacePreviewOutlet />
          </main>
        </div>
      </div>
      <FarmChatbot />
    </SidebarProvider>
  );
}
