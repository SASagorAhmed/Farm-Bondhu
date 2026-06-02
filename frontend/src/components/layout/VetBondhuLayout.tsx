import WorkspacePreviewOutlet from "./WorkspacePreviewOutlet";
import { SidebarProvider } from "@/components/ui/sidebar";
import VetBondhuSidebar from "./VetBondhuSidebar";
import TopBar from "./TopBar";
import FarmChatbot from "@/components/FarmChatbot";

export default function VetBondhuLayout() {
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
