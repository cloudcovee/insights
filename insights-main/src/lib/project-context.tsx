import React, { createContext, useContext, useState, useEffect } from "react";

interface ProjectContextType {
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  availableProjects: string[];
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [activeProjectId, setActiveProjectId] = useState<string>("all");
  const [availableProjects, setAvailableProjects] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/events');
        if (res.ok) {
          const events = await res.json();
          if (!mounted) return;
          const projects = new Set<string>();
          if (Array.isArray(events)) {
            events.forEach((e: any) => {
              if (e.projectId) {
                projects.add(e.projectId);
              } else if (e.project) {
                projects.add(e.project);
              }
            });
          }
          setAvailableProjects(Array.from(projects));
        }
      } catch (err) {}
    };
    
    fetchProjects();
    const interval = setInterval(fetchProjects, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <ProjectContext.Provider value={{ activeProjectId, setActiveProjectId, availableProjects }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
