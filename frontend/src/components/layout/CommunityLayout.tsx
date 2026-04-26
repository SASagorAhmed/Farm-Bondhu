import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import CommunitySidebar from "./CommunitySidebar";
import TopBar from "./TopBar";

export default function CommunityLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full overflow-hidden">
        <CommunitySidebar />
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <TopBar />
          <main className="flex-1 p-4 md:p-6 bg-background overflow-auto overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
