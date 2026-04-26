import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import VendorSidebar from "./VendorSidebar";
import TopBar from "./TopBar";
import FarmChatbot from "@/components/FarmChatbot";

export default function VendorLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full overflow-hidden">
        <VendorSidebar />
        <div className="flex-1 flex flex-col min-h-0">
          <TopBar />
          <main className="flex-1 p-4 md:p-6 bg-background overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <FarmChatbot />
    </SidebarProvider>
  );
}
