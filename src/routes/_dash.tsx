import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

import { ProjectProvider } from "@/lib/project-context";

export const Route = createFileRoute("/_dash")({
  component: DashLayout,
});

function DashLayout() {
  return (
    <ProjectProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <SidebarInset className="flex min-w-0 flex-1 flex-col">
            <AppTopbar />
            <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
              <Outlet />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ProjectProvider>
  );
}
