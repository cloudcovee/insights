import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, Search, LogOut, User, Settings as SettingsIcon } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/lib/project-context";


const labelMap: Record<string, string> = {
  overview: "Overview",
  projects: "Projects",
  events: "Events",
  users: "Users",
  sessions: "Sessions",
  funnels: "Funnels",
  reports: "Reports",
  "api-keys": "API Keys",
  documentation: "Documentation",
  settings: "Settings",
  catalogs: "Catalogs",
  collections: "Catalogs",
};

const commandItems = Object.entries(labelMap).map(([slug, label]) => ({
  to: `/${slug}`,
  label,
}));

export function AppTopbar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const parts = pathname.split("/").filter(Boolean);
  const [open, setOpen] = useState(false);
  const { activeProjectId, setActiveProjectId, availableProjects } = useProject();
  

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <div className="hidden md:block">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <Select value={activeProjectId} onValueChange={setActiveProjectId}>
                <SelectTrigger className="h-8 w-[180px] bg-transparent border-none focus:ring-0 font-medium">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {availableProjects.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </BreadcrumbItem>
            {parts.map((p, i) => (
              <div key={p} className="flex items-center gap-1.5">
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {i === parts.length - 1 ? (
                    <BreadcrumbPage>{labelMap[p] ?? p}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink>{labelMap[p] ?? p}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hidden md:inline-flex h-9 min-w-[260px] items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
        >
          <Search className="h-4 w-4" />
          <span>Search anything…</span>
          <kbd className="ml-auto rounded border bg-muted px-1.5 text-[10px] font-medium">⌘K</kbd>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[
              { t: "New signup spike on Web app", d: "2m ago" },
              { t: "Weekly report ready", d: "1h ago" },
              { t: "API key rotated", d: "Yesterday" },
            ].map((n) => (
              <DropdownMenuItem key={n.t} className="flex flex-col items-start gap-0.5">
                <span className="text-sm">{n.t}</span>
                <span className="text-xs text-muted-foreground">{n.d}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 items-center gap-2 rounded-full border pl-1 pr-3 text-sm transition-colors hover:bg-accent">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                AK
              </span>
              <span className="hidden sm:inline">Ada</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span>Ada Kohli</span>
              <span className="text-xs font-normal text-muted-foreground">ada@acme.io</span>
              <Badge variant="secondary" className="mt-1 w-fit">Pro plan</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <User className="h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/login" className="flex items-center gap-2 text-destructive">
                <LogOut className="h-4 w-4" /> Sign out
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to page or search events, users…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {commandItems.map((c) => (
              <CommandItem
                key={c.to}
                value={c.label}
                onSelect={() => {
                  setOpen(false);
                  window.location.assign(c.to);
                }}
              >
                {c.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}

// Global cmd+k listener helper (kept simple by focusing search button click). See page for hook.
export function useSearchInputStub() {
  // Placeholder for parity with the codebase pattern.
  Input; // ensures import kept
}
