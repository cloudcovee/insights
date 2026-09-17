import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, ExternalLink, ShieldCheck, ShieldAlert, User } from "lucide-react";

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
import { formatUserId } from "@/lib/utils";

export interface RealUserRow {
  id: string;
  userId?: string;
  anonId?: string;
  isLoggedIn: boolean;
  name: string;
  email: string;
  firstSeen: string;
  lastSeen: string;
  sessions: number;
  events: number;
  country: string;
  browser: string;
  timeline: { title: string; time: string; projectId: string }[];
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
          const rawDeviceId = e.anonId || e.id || e.userId;
          const uId = formatUserId(rawDeviceId);
          
          if (!userMap.has(uId)) {
            userMap.set(uId, {
              id: uId,
              userId: e.userId || undefined,
              anonId: e.anonId || undefined,
              isLoggedIn: Boolean(e.userId),
              name: uId,
              email: e.userId || uId,
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
          
          if (e.userId) {
            user.userId = e.userId;
            user.isLoggedIn = true;
            user.email = e.userId;
          }
          if (e.anonId && !user.anonId) {
            user.anonId = e.anonId;
          }

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
                  <TableHead>User Identifier</TableHead>
                  <TableHead>Visitor Auth Status</TableHead>
                  <TableHead>First seen</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Lifetime events</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>CRM Status</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-4">No users tracked yet</TableCell>
                  </TableRow>
                )}
                {filtered.map((u) => {
                  const targetId = u.userId || u.email || u.id;
                  return (
                    <TableRow
                      key={u.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(u)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <Link
                              to="/users/$userId"
                              params={{ userId: u.id }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm font-medium font-mono hover:text-primary hover:underline inline-flex items-center gap-1 text-foreground"
                              title={`View profile for ${u.id}`}
                            >
                              <span className="truncate max-w-[200px]">{u.id}</span>
                              <ExternalLink className="h-3 w-3 opacity-60" />
                            </Link>
                            {u.userId && (
                              <div className="text-xs text-muted-foreground font-mono truncate max-w-[220px]">
                                {u.userId}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.isLoggedIn ? (
                          <Badge variant="secondary" className="text-[11px] font-normal gap-1">
                            <ShieldCheck className="h-3 w-3" /> Logged in
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[11px] text-muted-foreground font-normal gap-1">
                            <ShieldAlert className="h-3 w-3" /> Anonymous
                          </Badge>
                        )}
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
                      <TableCell className="text-right">
                        <Link
                          to="/users/$userId"
                          params={{ userId: u.id }}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          Profile →
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
                <div className="flex items-center justify-between gap-2 pr-6">
                  <div>
                    <SheetTitle className="font-mono">{selected.id}</SheetTitle>
                    <p className="text-sm text-muted-foreground font-mono">
                      {selected.userId ? `Contact: ${selected.userId}` : "Unidentified device session"}
                    </p>
                  </div>
                  {selected.isLoggedIn ? (
                    <Badge variant="secondary" className="text-xs font-normal gap-1 shrink-0">
                      <ShieldCheck className="h-3.5 w-3.5" /> Logged in
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs text-muted-foreground font-normal gap-1 shrink-0">
                      <ShieldAlert className="h-3.5 w-3.5" /> Anonymous
                    </Badge>
                  )}
                </div>
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
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Timeline</h4>
                    {selected.timeline.length > 0 && (
                      <span className="text-xs text-muted-foreground font-mono">
                        Showing {Math.min(selected.timeline.length, 15)} of {selected.timeline.length}
                      </span>
                    )}
                  </div>
                  <ol className="space-y-3 border-l pl-4">
                    {selected.timeline.slice(0, 15).map((t, i) => (
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
                  <div className="mt-3">
                    <Link
                      to="/users/$userId"
                      params={{ userId: selected.userId || selected.email || selected.id }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium border border-input bg-muted/40 hover:bg-accent hover:text-accent-foreground h-8 px-3 transition-colors"
                    >
                      View more events →
                    </Link>
                  </div>
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
