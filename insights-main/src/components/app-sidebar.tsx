import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  LayoutDashboard,
  FolderKanban,
  Zap,
  Users,
  MousePointerClick,
  Filter,
  FileBarChart2,
  KeyRound,
  BookOpen,
  Settings,
  Activity,
  Globe,
  Image,
  Library,
  Layers,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const workspaceItems = [
  { title: "Overview", url: "/overview", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Sitemap", url: "/sitemap", icon: Globe },
  { title: "Events", url: "/events", icon: Zap },
  { title: "Users", url: "/users", icon: Users },
  { title: "Sessions", url: "/sessions", icon: MousePointerClick },
  { title: "Funnels", url: "/funnels", icon: Filter },
  { title: "Reports", url: "/reports", icon: FileBarChart2 },
];

const settingsItems = [
  { title: "Documentation", url: "/documentation", icon: BookOpen },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (p: string) => pathname === p || pathname.startsWith(p + "/");

  const [catalogs, setCatalogs] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadCatalogs = () => {
      fetch('/api/catalogs')
        .then(r => (r.ok ? r.json() : []))
        .then(data => {
          if (mounted && Array.isArray(data)) setCatalogs(data);
        })
        .catch(() => {});
    };

    loadCatalogs();
    window.addEventListener('catalog-updated', loadCatalogs);
    const interval = setInterval(loadCatalogs, 3000);

    return () => {
      mounted = false;
      window.removeEventListener('catalog-updated', loadCatalogs);
      clearInterval(interval);
    };
  }, []);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 border-b">
        <Link to="/overview" className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Lumen</span>
              <span className="text-[11px] text-muted-foreground">Acme workspace</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Catalog Content — dynamic, session-scoped */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-1.5">
            <Library className="h-3.5 w-3.5" /> Catalog Content
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {catalogs.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/settings" className="flex items-center gap-2 text-muted-foreground">
                      <Layers className="h-4 w-4" />
                      <span>Add catalog…</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                catalogs.map((cat) => (
                  <SidebarMenuItem key={cat.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(`/catalogs/${cat.id}`) || isActive(`/collections/${cat.id}`)}
                      tooltip={cat.name}
                    >
                      <Link
                        to="/catalogs/$catalogId"
                        params={{ catalogId: cat.id }}
                        className="flex items-center gap-2"
                      >
                        <Layers className="h-4 w-4" />
                        <span>{cat.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Developer</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <div className="flex items-center gap-2 p-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            AK
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-medium">Ada Kohli</span>
              <span className="text-[11px] text-muted-foreground">ada@acme.io</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

