import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useProject } from "@/lib/project-context";

export interface RealUserRow {
  id: string;
  name: string;
  email: string;
  firstSeen: string;
  lastSeen: string;
  sessions: number;
  events: number;
  country: string;
  browser: string;
  timeline: { title: string, time: string, projectId: string }[];
  crmData?: {
    leadScore?: number;
    company?: string;
    phone?: string;
    crmId?: string;
    status?: string;
  };
}

export const Route = createFileRoute("/_dash/users")({ component: UsersPage });

function UsersPage() {
  const { activeProjectId } = useProject();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<RealUserRow[]>([]);
  const [selected, setSelected] = useState<RealUserRow | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadUsers = async () => {
      try {
        const response = await fetch('/api/events');
        if (!response.ok) return;
        const rawEvents = await response.json();
        if (!mounted || !Array.isArray(rawEvents)) return;
        
        const events = activeProjectId === 'all' 
          ? rawEvents 
          : rawEvents.filter((e: any) => e.projectId === activeProjectId || e.project === activeProjectId);
          
        const userMap = new Map<string, RealUserRow>();

        events.forEach((e: any) => {
          const uId = e.anonId || e.id; // fallback to event id if legacy
          
          if (!userMap.has(uId)) {
            userMap.set(uId, {
              id: uId,
              name: `Anon User`,
              email: uId,
              firstSeen: e.timestamp,
              lastSeen: e.timestamp,
              sessions: 1, // simplified
              events: 0,
              country: e.country || 'Unknown',
              browser: e.browser?.name || 'Unknown',
              timeline: []
            });
          }
          
          const user = userMap.get(uId)!;
          user.events += 1;
          
          const eventTime = new Date(e.timestamp).getTime();
          const firstTime = new Date(user.firstSeen).getTime();
          const lastTime = new Date(user.lastSeen).getTime();
          
          if (eventTime < firstTime) user.firstSeen = e.timestamp;
          if (eventTime > lastTime) user.lastSeen = e.timestamp;
          
          // Add to timeline
          let title = e.event;
          if (e.event === 'page_view') title = `Viewed ${e.path || '/'}`;
          else if (e.event === 'question_asked') title = `Asked: ${e.properties?.question || 'a question'}`;
          else if (e.properties) title = `${e.event} - ${JSON.stringify(e.properties)}`;
          
          user.timeline.push({
            title,
            time: e.timestamp,
            projectId: e.projectId || e.project || 'Unknown'
          });
        });
        
        const sortedUsers = Array.from(userMap.values()).sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
        
        // Sort individual timelines
        sortedUsers.forEach(u => {
          u.timeline.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        });

        // CRM Sync Unification
        try {
          const crmConfigRaw = localStorage.getItem("crm_config");
          if (crmConfigRaw) {
            const crmConfig = JSON.parse(crmConfigRaw);
            if (crmConfig.url && crmConfig.key) {
              const emails = sortedUsers.map(u => u.email).filter(Boolean);
              
              if (emails.length > 0) {
                const crmRes = await fetch('/api/crm/sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    crmUrl: crmConfig.url,
                    crmKey: crmConfig.key,
                    users: emails
                  })
                });
                
                if (crmRes.ok) {
                  const { data } = await crmRes.json();
                  if (data) {
                    sortedUsers.forEach(u => {
                      if (data[u.email]) {
                        u.crmData = data[u.email];
                      }
                    });
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error("CRM Sync failed during user load", e);
        }

        setUsers(sortedUsers);
      } catch (err) {
        console.error('Error fetching users API', err);
      }
    };
    
    loadUsers();
    const interval = setInterval(loadUsers, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeProjectId]);

  const filtered = useMemo(
    () => users.filter((u) => `${u.name} ${u.email} ${u.country}`.toLowerCase().includes(q.toLowerCase())),
    [q, users],
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Users" subtitle="Every identified user across your projects." />

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search users…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>First seen</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Lifetime events</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>CRM Status</TableHead>
                  <TableHead>Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-4">No users tracked yet</TableCell>
                  </TableRow>
                )}
                {filtered.map((u) => (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(u)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
                          {u.name.split(" ").map((s) => s[0]).join("")}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(u.firstSeen).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(u.lastSeen).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{u.sessions}</TableCell>
                    <TableCell className="text-right tabular-nums">{u.events.toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary">{u.country}</Badge></TableCell>
                    <TableCell>
                      {u.crmData?.status ? (
                        <Badge variant="outline" className="border-primary/50 text-primary">
                          {u.crmData.status}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{u.browser}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <p className="text-sm text-muted-foreground">{selected.email}</p>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="First seen" value={new Date(selected.firstSeen).toLocaleString()} />
                  <Stat label="Last seen" value={new Date(selected.lastSeen).toLocaleString()} />
                  <Stat label="Sessions" value={String(selected.sessions)} />
                  <Stat label="Lifetime events" value={selected.events.toLocaleString()} />
                  <Stat label="Country" value={selected.country} />
                  <Stat label="Browser" value={selected.browser} />
                </div>
                
                {selected.crmData && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold flex items-center gap-2">
                      <Badge variant="secondary">Unified</Badge> CRM Profile Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border">
                      <Stat label="CRM ID" value={selected.crmData.crmId || '-'} />
                      <Stat label="Status" value={selected.crmData.status || '-'} />
                      <Stat label="Company" value={selected.crmData.company || '-'} />
                      <Stat label="Lead Score" value={String(selected.crmData.leadScore || '-')} />
                      <Stat label="Phone" value={selected.crmData.phone || '-'} />
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Timeline</h4>
                  <ol className="space-y-3 border-l pl-4">
                    {selected.timeline.map((t, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[9px] h-4 px-1">{t.projectId}</Badge>
                            <span className="text-xs text-muted-foreground">{new Date(t.time).toLocaleString()}</span>
                          </div>
                          <div className="text-sm font-medium break-words max-w-full whitespace-pre-wrap">{t.title}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => window.location.href = '/sessions'}>View sessions</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
