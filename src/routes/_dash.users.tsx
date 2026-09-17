import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, ExternalLink, Info, User } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

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
              sessions: 1,
              events: 0,
              country: e.country || 'Unknown',
              browser: typeof e.browser === 'object' ? e.browser?.name || 'Unknown' : e.browser || 'Unknown',
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
          if (e.country && user.country === 'Unknown') {
            user.country = e.country;
          }

          user.events += 1;
          
          const eventTime = new Date(e.timestamp).getTime();
          const firstTime = new Date(user.firstSeen).getTime();
          const lastTime = new Date(user.lastSeen).getTime();
          
          if (eventTime < firstTime) user.firstSeen = e.timestamp;
          if (eventTime > lastTime) user.lastSeen = e.timestamp;
          
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
        
        sortedUsers.forEach(u => {
          u.timeline.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        });

        // CRM Sync
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
    () => users.filter((u) => `${u.id} ${u.email || ""} ${u.userId || ""} ${u.country}`.toLowerCase().includes(q.toLowerCase())),
    [q, users],
  );

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Users" subtitle="Every identified user across your projects." />

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search users..." 
              className="pl-9" 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold text-foreground">User Identifier</TableHead>
                  <TableHead className="font-semibold text-foreground">Visitor Auth Status</TableHead>
                  <TableHead className="font-semibold text-foreground">First seen</TableHead>
                  <TableHead className="font-semibold text-foreground">Last seen</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Sessions</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Lifetime events</TableHead>
                  <TableHead className="font-semibold text-foreground">Country</TableHead>
                  <TableHead className="font-semibold text-foreground">CRM Status</TableHead>
                  <TableHead className="font-semibold text-foreground">Browser</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No users tracked yet
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((u) => {
                  const showEmail = u.email && u.email.includes("@") && u.email !== u.id;

                  return (
                    <TableRow
                      key={u.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setSelected(u)}
                    >
                      {/* User Identifier Column */}
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/80 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <Link
                              to={"/users/$userId" as any}
                              params={{ userId: u.id } as any}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm font-medium font-mono hover:text-primary hover:underline inline-flex items-center gap-1 text-foreground"
                              title={`View profile for ${u.id}`}
                            >
                              <span className="truncate max-w-[200px]">{u.id}</span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-60" />
                            </Link>
                            {showEmail && (
                              <div className="text-xs text-muted-foreground font-mono truncate max-w-[220px]">
                                {u.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Visitor Auth Status Column */}
                      <TableCell>
                        {u.isLoggedIn ? (
                          <Badge variant="secondary" className="text-xs font-normal gap-1 rounded-full px-2.5 py-0.5 text-muted-foreground bg-muted/60 border-0">
                            <Info className="h-3.5 w-3.5 text-muted-foreground" /> Logged in
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs font-normal gap-1 rounded-full px-2.5 py-0.5 text-muted-foreground bg-muted/60 border-0">
                            <Info className="h-3.5 w-3.5 text-muted-foreground" /> Anonymous
                          </Badge>
                        )}
                      </TableCell>

                      {/* First seen & Last seen */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(u.firstSeen)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(u.lastSeen)}
                      </TableCell>

                      {/* Sessions */}
                      <TableCell className="text-right tabular-nums text-xs font-mono">{u.sessions}</TableCell>

                      {/* Lifetime events */}
                      <TableCell className="text-right tabular-nums text-xs font-mono font-bold">{u.events.toLocaleString()}</TableCell>

                      {/* Country */}
                      <TableCell>
                        <Badge variant="secondary" className="font-bold text-xs px-2 py-0.5 rounded text-foreground bg-muted/70 border-0">
                          {u.country}
                        </Badge>
                      </TableCell>

                      {/* CRM Status */}
                      <TableCell className="text-xs text-muted-foreground">
                        {u.crmData?.status || "—"}
                      </TableCell>

                      {/* Browser */}
                      <TableCell className="text-xs text-muted-foreground">{u.browser}</TableCell>

                      {/* Actions */}
                      <TableCell className="text-right whitespace-nowrap">
                        <Link
                          to={"/users/$userId" as any}
                          params={{ userId: u.id } as any}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
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

      {/* Side Sheet Drawer for User Quick Inspect */}
      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between gap-2 pr-6">
                  <div>
                    <SheetTitle className="font-mono text-lg">{selected.id}</SheetTitle>
                    <p className="text-sm text-muted-foreground font-mono">
                      {selected.userId ? `Contact: ${selected.userId}` : "Unidentified device session"}
                    </p>
                  </div>
                  {selected.isLoggedIn ? (
                    <Badge variant="secondary" className="text-xs font-normal gap-1 shrink-0">
                      <Info className="h-3.5 w-3.5" /> Logged in
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs text-muted-foreground font-normal gap-1 shrink-0">
                      <Info className="h-3.5 w-3.5" /> Anonymous
                    </Badge>
                  )}
                </div>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="First seen" value={formatDate(selected.firstSeen)} />
                  <Stat label="Last seen" value={formatDate(selected.lastSeen)} />
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
                    <h4 className="text-sm font-semibold">Activity Timeline</h4>
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
                            <span className="text-xs text-muted-foreground">{formatDate(t.time)}</span>
                          </div>
                          <div className="text-sm font-medium break-words max-w-full whitespace-pre-wrap">{t.title}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4">
                    <Link
                      to="/users/$userId"
                      params={{ userId: selected.id }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-semibold border border-input bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 transition-colors"
                    >
                      Open Full Customer Profile →
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
    <div className="rounded-md border p-3 bg-card">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}


