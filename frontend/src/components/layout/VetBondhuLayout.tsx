import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import WorkspacePreviewOutlet from "./WorkspacePreviewOutlet";
import { SidebarProvider } from "@/components/ui/sidebar";
import VetBondhuSidebar from "./VetBondhuSidebar";
import TopBar from "./TopBar";
import FarmChatbot from "@/components/FarmChatbot";
import { API_BASE, readSession } from "@/api/client";
import { useAuth, isPlatformAdmin } from "@/contexts/AuthContext";

export default function VetBondhuLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checkingAccess, setCheckingAccess] = useState(true);

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
    const checkAccess = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/vetbondhu/access/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json().catch(() => ({}))) as { data?: { allowed?: boolean } };
        if (active && res.ok && body.data?.allowed === false) {
          navigate("/vetbondhu/access-denied", { replace: true });
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
  }, [navigate, user]);

  if (checkingAccess) {
    return (
      <SidebarProvider defaultOpen={true}>
        <div className="h-screen flex w-full overflow-hidden">
          <VetBondhuSidebar />
          <div className="flex-1 flex flex-col min-h-0">
            <TopBar />
            <main className="flex-1 p-4 md:p-6 bg-background overflow-auto">
              <p className="text-sm text-muted-foreground">Checking VetBondhu access...</p>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full overflow-hidden">
        <VetBondhuSidebar />
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
