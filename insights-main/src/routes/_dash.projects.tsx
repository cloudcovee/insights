import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MoreHorizontal, Trash2, Pencil, Globe } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useEffect } from "react";
// ... imports above
export const Route = createFileRoute("/_dash/projects")({ component: ProjectsPage });

function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadProjects = async () => {
      try {
        const response = await fetch('/api/events');
        if (!response.ok) return;
        const rawEvents = await response.json();
        if (!mounted || !Array.isArray(rawEvents)) return;
        
        const projectMap = new Map<string, any>();
        
        rawEvents.forEach((e: any) => {
          const pId = e.projectId || e.project || 'Unknown';
          if (!projectMap.has(pId)) {
            let domain = 'Unknown';
            try {
              if (e.url) domain = new URL(e.url).hostname;
              else if (e.properties?.url) domain = new URL(e.properties.url).hostname;
            } catch(err) {}
            
            projectMap.set(pId, {
              id: pId,
              name: pId,
              domain: domain,
              environment: 'Production',
              status: 'Active',
              events30d: 0
            });
          }
          projectMap.get(pId).events30d += 1;
        });
        
        setProjects(Array.from(projectMap.values()));
      } catch(err) {
        console.error('Error fetching projects', err);
      }
    };
    
    loadProjects();
    const interval = setInterval(loadProjects, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Projects"
        subtitle="One workspace, many projects. Toggle between environments per project."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <Card key={p.id} className="transition-shadow hover:shadow-sm">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{p.name}</CardTitle>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="h-3 w-3" /> {p.domain}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => toast.info("Edit project")}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
                      setProjects((prev) => prev.filter((x) => x.id !== p.id));
                      toast.success("Project deleted");
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Badge variant="secondary">{p.environment}</Badge>
              <Badge variant={p.status === "Active" ? "default" : "outline"}>{p.status}</Badge>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
              <span>Events (30d)</span>
              <span className="tabular-nums text-foreground">{p.events30d.toLocaleString()}</span>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
