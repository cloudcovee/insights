import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useProject } from "@/lib/project-context";

export const Route = createFileRoute("/_dash/funnels")({ component: FunnelsPage });

function FunnelsPage() {
  const { activeProjectId } = useProject();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/events');
        if (res.ok) {
          const rawData = await res.json();
          if (mounted && Array.isArray(rawData)) {
            const data = activeProjectId === 'all' 
              ? rawData 
              : rawData.filter((e: any) => e.projectId === activeProjectId || e.project === activeProjectId);
            setEvents(data);
          }
        }
      } catch (err) {}
    };
    
    fetchEvents();
    const interval = setInterval(fetchEvents, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeProjectId]);

  const funnelData = useMemo(() => {
    // Basic auto-tracking funnel: Page View -> Click -> Error
    // We group by anonId (or id) to find unique users completing each step sequentially
    
    const usersStep1 = new Set<string>();
    const usersStep2 = new Set<string>();
    const usersStep3 = new Set<string>();
    
    // Sort events sequentially by timestamp
    const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    sorted.forEach(e => {
      const uId = e.anonId || e.id;
      
      // Step 1: Any page view
      if (e.event === 'page_view') {
        usersStep1.add(uId);
      }
      
      // Step 2: Any click (only count if they already did Step 1)
      if (e.event === 'click' && usersStep1.has(uId)) {
        usersStep2.add(uId);
      }
      
      // Step 3: Any error or form submit (only count if they already did Step 2)
      if ((e.event === 'error' || e.event === 'form_submit') && usersStep2.has(uId)) {
        usersStep3.add(uId);
      }
    });

    const s1 = usersStep1.size;
    const s2 = usersStep2.size;
    const s3 = usersStep3.size;
    
    // Ensure we don't divide by zero
    const max = Math.max(1, s1);

    return [
      { name: "Viewed Page", users: s1, rate: s1 > 0 ? 100 : 0 },
      { name: "Clicked Element", users: s2, rate: Math.round((s2 / max) * 100) },
      { name: "Encountered Error / Form", users: s3, rate: Math.round((s3 / max) * 100) }
    ];
  }, [events]);

  const max = Math.max(1, funnelData[0].users);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Funnels (Live Data)"
        subtitle="Track how users progress through key journeys automatically."
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New funnel
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Auto-Tracking Journey: View → Click → Action</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pb-8">
          {funnelData.map((s, i) => {
            const width = (s.users / max) * 100;
            const drop = i === 0 || funnelData[i - 1].users === 0 ? 0 : ((funnelData[i - 1].users - s.users) / funnelData[i - 1].users) * 100;
            return (
              <div key={s.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold">
                      {i + 1}
                    </span>
                    <span className="font-medium">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-muted-foreground tabular-nums">
                    <span>{s.users.toLocaleString()} users</span>
                    <span>{s.rate}% overall</span>
                    {i > 0 && <span className="text-destructive">-{drop.toFixed(1)}%</span>}
                  </div>
                </div>
                <div className="relative h-9 overflow-hidden rounded-md bg-muted">
                  <div
                    className="h-full rounded-md bg-primary/85 transition-all"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
