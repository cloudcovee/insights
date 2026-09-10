import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Globe, Filter, Copy, Check, Target, MapPin, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "@/lib/project-context";
import { resolveGeoRegion, type GeoRegionInfo, REGION_MAP } from "@/lib/geo-utils";

export interface RealUserRow {
  id: string;
  name: string;
  email: string;
  firstSeen: string;
  lastSeen: string;
  sessions: number;
  events: number;
  country: string;
  geoRegion: GeoRegionInfo;
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
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [users, setUsers] = useState<RealUserRow[]>([]);
  const [selected, setSelected] = useState<RealUserRow | null>(null);
  const [copiedTag, setCopiedTag] = useState(false);

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
          const uId = e.anonId || e.id;
          const userEmail = e.userId || (uId.includes('@') ? uId : '');
          
          if (!userMap.has(uId)) {
            const rawCountry = e.country;
            const geo = resolveGeoRegion(rawCountry, userEmail || uId);
            
            userMap.set(uId, {
              id: uId,
              name: `Anon User`,
              email: uId,
              firstSeen: e.timestamp,
              lastSeen: e.timestamp,
              sessions: 1,
              events: 0,
              country: geo.country,
              geoRegion: geo,
              browser: e.browser?.name || e.browser || 'Unknown',
              timeline: []
            });
          }
          
          const user = userMap.get(uId)!;
          
          if (e.userId && (user.name === 'Anon User' || user.email === uId)) {
            user.email = e.userId;
            user.name = e.userId.includes('@') ? e.userId.split('@')[0] : e.userId;
            // Re-resolve geo with email if email was updated
            user.geoRegion = resolveGeoRegion(e.country || user.country, e.userId);
            user.country = user.geoRegion.country;
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

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchQuery = `${u.name} ${u.email} ${u.country} ${u.geoRegion.region} ${u.geoRegion.campaignTag}`
        .toLowerCase()
        .includes(q.toLowerCase());
      
      const matchRegion = regionFilter === 'all' || u.geoRegion.region === regionFilter;
      const matchCountry = countryFilter === 'all' || u.geoRegion.countryCode === countryFilter || u.geoRegion.country === countryFilter;
      
      return matchQuery && matchRegion && matchCountry;
    });
  }, [q, regionFilter, countryFilter, users]);

  // Regional breakdown statistics for campaigning overview
  const regionStats = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach(u => {
      counts[u.geoRegion.region] = (counts[u.geoRegion.region] || 0) + 1;
    });
    return counts;
  }, [users]);

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(true);
    setTimeout(() => setCopiedTag(false), 2000);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader 
        title="Users & Campaign Regions" 
        subtitle="Track identified users and segment by region for targeted marketing campaigns." 
      />

      {/* Regional Campaign Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Tracked Users</div>
              <div className="text-2xl font-bold mt-1 tabular-nums">{users.length}</div>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Globe className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Asia-Pacific (APAC)</div>
              <div className="text-2xl font-bold mt-1 tabular-nums">
                {regionStats["Asia-Pacific"] || 0}
                <span className="text-xs font-normal text-muted-foreground ml-1.5">
                  ({users.length ? Math.round(((regionStats["Asia-Pacific"] || 0) / users.length) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="text-2xl">🇮🇳 🇯🇵 🇦🇺</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">North America (NA)</div>
              <div className="text-2xl font-bold mt-1 tabular-nums">
                {regionStats["North America"] || 0}
                <span className="text-xs font-normal text-muted-foreground ml-1.5">
                  ({users.length ? Math.round(((regionStats["North America"] || 0) / users.length) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="text-2xl">🇺🇸 🇨🇦</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Europe (EU)</div>
              <div className="text-2xl font-bold mt-1 tabular-nums">
                {regionStats["Europe"] || 0}
                <span className="text-xs font-normal text-muted-foreground ml-1.5">
                  ({users.length ? Math.round(((regionStats["Europe"] || 0) / users.length) * 100) : 0}%)
                </span>
              </div>
            </div>
            <div className="text-2xl">🇬🇧 🇩🇪 🇫🇷</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search by user, email, country, or region..." 
                className="pl-9" 
                value={q} 
                onChange={(e) => setQ(e.target.value)} 
              />
            </div>
            
            {/* Filter controls for region and country */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                <span>Filter:</span>
              </div>

              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🌍 All Regions</SelectItem>
                  <SelectItem value="Asia-Pacific">🌏 Asia-Pacific</SelectItem>
                  <SelectItem value="North America">🌎 North America</SelectItem>
                  <SelectItem value="Europe">🌍 Europe</SelectItem>
                </SelectContent>
              </Select>

              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[160px] h-9 text-xs">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🏁 All Countries</SelectItem>
                  <SelectItem value="IN">🇮🇳 India</SelectItem>
                  <SelectItem value="US">🇺🇸 United States</SelectItem>
                  <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                  <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                  <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                  <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                  <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                  <SelectItem value="FR">🇫🇷 France</SelectItem>
                </SelectContent>
              </Select>

              {(regionFilter !== 'all' || countryFilter !== 'all' || q !== '') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => { setRegionFilter('all'); setCountryFilter('all'); setQ(''); }}
                >
                  Reset
                </Button>
              )}
            </div>
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
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead>Country & Region</TableHead>
                  <TableHead>Campaign Segment</TableHead>
                  <TableHead>CRM Status</TableHead>
                  <TableHead>Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <MapPin className="h-8 w-8 text-muted-foreground/50" />
                        <div>No users found matching current region & country filters</div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((u) => (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setSelected(u)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          {u.name.split(" ").map((s) => s[0]).join("").toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(u.firstSeen).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(u.lastSeen).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{u.sessions}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-medium">{u.events.toLocaleString()}</TableCell>
                    
                    {/* Country & Region Column */}
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant="secondary" className="gap-1.5 px-2 py-0.5 text-xs font-medium">
                          <span className="text-base leading-none">{u.geoRegion.flag}</span>
                          <span>{u.geoRegion.country}</span>
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono px-1">
                          {u.geoRegion.region}
                        </span>
                      </div>
                    </TableCell>

                    {/* Campaign Target Badge */}
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 font-medium whitespace-nowrap gap-1">
                        <Target className="h-3 w-3" />
                        {u.geoRegion.campaignTag}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {u.crmData?.status ? (
                        <Badge variant="outline" className="border-primary/50 text-primary">
                          {u.crmData.status}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{u.browser}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Selected User Details Sheet */}
      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-base font-bold">
                    {selected.name.split(" ").map((s) => s[0]).join("").toUpperCase()}
                  </div>
                  <div>
                    <SheetTitle className="text-lg">{selected.name}</SheetTitle>
                    <p className="text-xs text-muted-foreground font-mono">{selected.email}</p>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Campaigning & Region Info Box */}
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Regional Campaigning Target
                      </span>
                      <Badge className="bg-primary text-primary-foreground gap-1">
                        <span>{selected.geoRegion.flag}</span>
                        <span>{selected.geoRegion.countryCode}</span>
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Geographic profile used for campaign timing and audience segmentation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-background border">
                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Country</div>
                        <div className="font-semibold flex items-center gap-1.5 mt-0.5">
                          <span className="text-base">{selected.geoRegion.flag}</span>
                          <span>{selected.geoRegion.country}</span>
                        </div>
                      </div>
                      <div className="p-2 rounded bg-background border">
                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Region Zone</div>
                        <div className="font-semibold mt-0.5">{selected.geoRegion.region}</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-background border space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Campaign Segment Tag:</span>
                        <Badge variant="secondary" className="font-mono text-[11px] bg-muted">
                          {selected.geoRegion.campaignTag.replace(/\s+/g, '_').toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Best Local Contact Window:</span>
                        <span className="font-mono text-xs">09:00 - 18:00 Local</span>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs gap-1.5 h-8 border-primary/40 hover:bg-primary/10"
                      onClick={() => handleCopyTag(`${selected.geoRegion.country}_${selected.geoRegion.region.replace(/\s+/g, '_')}_CAMPAIGN`)}
                    >
                      {copiedTag ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedTag ? "Copied Campaign Tag!" : "Copy Campaign Target Tag"}
                    </Button>
                  </CardContent>
                </Card>

                {/* General Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="First seen" value={new Date(selected.firstSeen).toLocaleString()} />
                  <Stat label="Last seen" value={new Date(selected.lastSeen).toLocaleString()} />
                  <Stat label="Sessions" value={String(selected.sessions)} />
                  <Stat label="Lifetime events" value={selected.events.toLocaleString()} />
                  <Stat label="Country" value={`${selected.geoRegion.flag} ${selected.country}`} />
                  <Stat label="Browser" value={selected.browser} />
                </div>
                
                {/* Unified CRM Data */}
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

                {/* User Activity Timeline */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold">User Activity Timeline</h4>
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
                  <Button variant="outline" className="flex-1" onClick={() => window.location.href = '/sessions'}>
                    View User Sessions
                  </Button>
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
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
