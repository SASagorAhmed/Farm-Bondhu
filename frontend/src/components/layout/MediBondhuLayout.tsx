import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import WorkspacePreviewOutlet from "./WorkspacePreviewOutlet";
import { SidebarProvider } from "@/components/ui/sidebar";
import MediBondhuSidebar from "./MediBondhuSidebar";
import TopBar from "./TopBar";
import FarmChatbot from "@/components/FarmChatbot";
import { API_BASE, readSession } from "@/api/client";
import { useAuth, isPlatformAdmin, isAdminPreviewPath } from "@/contexts/AuthContext";
import {
  isMediPatientCarePathForAdminPreview,
  mediDoctorPortalDashboardPath,
} from "@/lib/medibondhuRoutes";

export default function MediBondhuLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    if (!user || !isPlatformAdmin(user) || !isAdminPreviewPath(pathname)) return;
    if (!isMediPatientCarePathForAdminPreview(pathname)) return;
    navigate(mediDoctorPortalDashboardPath(), { replace: true });
  }, [user, pathname, navigate]);

  useEffect(() => {
    if (isPlatformAdmin(user)) {
      setCheckingAccess(false);
      return;
    }
    const token = readSession()?.access_token;
    if (!token) {
      setCheckingAccess(false);
      return;
    }
    let active = true;
    const subjectType = pathname.startsWith("/medibondhu/doctor") ? "doctor" : "patient";
    const checkAccess = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/medibondhu/access/status?subject_type=${subjectType}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as { data?: { allowed?: boolean } };
        if (active && res.ok && body.data?.allowed === false) {
          navigate("/access-denied", { replace: true });
          return;
        }
      } finally {
        if (active) setCheckingAccess(false);
      }
    };
    void checkAccess();
    return () => {
      active = false;
    };
  }, [navigate, pathname, user]);

  if (checkingAccess) {
    return (
      <SidebarProvider defaultOpen={true}>
        <div className="h-screen flex w-full overflow-hidden">
          <MediBondhuSidebar />
          <div className="flex-1 flex flex-col min-h-0">
            <TopBar />
            <main className="flex-1 p-4 md:p-6 bg-background overflow-auto">
              <p className="text-sm text-muted-foreground">Checking MediBondhu access...</p>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

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
