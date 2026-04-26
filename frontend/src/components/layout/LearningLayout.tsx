import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import LearningSidebar from "./LearningSidebar";
import TopBar from "./TopBar";
import FarmChatbot from "@/components/FarmChatbot";

export default function LearningLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full overflow-hidden">
        <LearningSidebar />
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
