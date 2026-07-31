import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { TaskDeadlinePopup } from "@/components/commercial/task-deadline-popup";
import { LearnerStatusSync } from "@/components/production/learner-status-sync";
import { ChatBubble } from "@/components/assistant/chat-bubble";
import { PermissionGuard } from "@/components/layout/permission-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="flex flex-col h-screen w-full">
          <TopNav />
          <div className="flex flex-1 overflow-hidden">
            <AppSidebar />
            <main className="flex-1 overflow-auto"><PermissionGuard>{children}</PermissionGuard></main>
          </div>
        </div>
        <TaskDeadlinePopup />
        <LearnerStatusSync />
        <ChatBubble />
      </SidebarProvider>
    </TooltipProvider>
  );
}
