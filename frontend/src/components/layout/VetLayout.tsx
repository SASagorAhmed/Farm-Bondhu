import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";import VetSidebar from "./VetSidebar";
import TopBar from "./TopBar";
import FarmChatbot from "@/components/FarmChatbot";
import WorkspacePreviewOutlet from "./WorkspacePreviewOutlet";
import { API_BASE, readSession } from "@/api/client";
import { useAuth, isPlatformAdmin } from "@/contexts/AuthContext";

function isVetProfileComplete(profile: Record<string, unknown> | null | undefined) {
  if (!profile) return false;
  return Boolean(profile.is_profile_complete);
}

export default function VetLayout() {
  const { user, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const isVet = Boolean(user && hasRole("vet"));
  const platformAdminPreview = isPlatformAdmin(user);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (platformAdminPreview || !isVet) return;
    const sendHeartbeat = async () => {
      const token = readSession()?.access_token;
      if (!token) return;
      await fetch(`${API_BASE}/v1/vetbondhu/vet/presence/heartbeat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    };
    void sendHeartbeat();
    const interval = window.setInterval(() => {
      void sendHeartbeat();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [isVet, platformAdminPreview]);

  useEffect(() => {
    if (platformAdminPreview || !isVet) {
      setCheckingProfile(false);
      hasCheckedRef.current = false;
      return;
    }
    if (location.pathname === "/vet/profile" || location.pathname === "/vet/profile-account") {
      setCheckingProfile(false);
      return;
    }
    if (hasCheckedRef.current) {
      setCheckingProfile(false);
      return;
    }
    hasCheckedRef.current = true;
    setCheckingProfile(true);
    const token = readSession()?.access_token;
    if (!token) {
      setCheckingProfile(false);
      return;
    }
    let active = true;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/vetbondhu/vet-profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown> };
        const approved = String(body?.data?.verification_status || "").toLowerCase() === "approved";
        const complete = res.ok && (isVetProfileComplete(body.data) || approved);
        const atProfilePage = location.pathname === "/vet/profile";
        if (!complete && !atProfilePage) {
          navigate("/vet/profile", { replace: true });
        }
      } finally {
        if (active) setCheckingProfile(false);
      }
    };
    void check();
    return () => {
      active = false;
    };
  }, [isVet, platformAdminPreview, location.pathname, navigate]);

  if (checkingProfile) {
    return (
      <SidebarProvider defaultOpen={true}>
        <div className="h-screen flex w-full overflow-hidden">
          <VetSidebar />
          <div className="flex-1 flex flex-col min-h-0">
            <TopBar />
            <main className="flex-1 p-4 md:p-6 bg-background overflow-auto">
              <p className="text-sm text-muted-foreground">Checking vet profile...</p>
            </main>
          </div>
        </div>
        <FarmChatbot />
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full overflow-hidden">
        <VetSidebar />
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
