import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Download } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/page-header";
import { ReportsSnapshotCard } from "@/components/reports-snapshot-card";
import { ActiveUsersByCountryCard } from "@/components/active-users-country-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatUserId } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  browsers,
  countries,
  devices,
  os,
  timeSeries30d,
} from "@/lib/mock-data";

import { useProject } from "@/lib/project-context";

export const Route = createFileRoute("/_dash/overview")({ component: OverviewPage });

const chartColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function OverviewPage() {
  const { activeProjectId } = useProject();
  const [topEvents, setTopEvents] = useState<{name: string, count: number}[]>([]);
  const [topPages, setTopPages] = useState<{path: string, views: number}[]>([]);
  const [recentActivity, setRecentActivity] = useState<{id: string, timestamp: string, event: string, user: string, projectId: string, properties: any}[]>([]);
  const [browserStats, setBrowserStats] = useState<{name: string, value: number}[]>([]);
  const [deviceStats, setDeviceStats] = useState<{name: string, value: number}[]>([]);
  const [osStats, setOsStats] = useState<{name: string, value: number}[]>([]);
  const [countryStats, setCountryStats] = useState<{name: string, value: number, code: string}[]>([]);
  const [eventsOverTime, setEventsOverTime] = useState<{name: string, events: number}[]>([]);
  const [totalActiveUsers, setTotalActiveUsers] = useState<number>(0);

  useEffect(() => {
    let mounted = true;

    const loadEvents = async () => {
      try {
        const response = await fetch('/api/events');
        if (!response.ok) return;
        const rawEvents = await response.json();
        if (!mounted) return;
        
        if (!Array.isArray(rawEvents)) return;
        
        // FILTER BY PROJECT
        const events = activeProjectId === 'all' 
          ? rawEvents 
          : rawEvents.filter((e: any) => e.projectId === activeProjectId || e.project === activeProjectId);
        
        // Aggregate top events
        const eventCounts: Record<string, number> = {};
        events.forEach((e: any) => {
          eventCounts[e.event] = (eventCounts[e.event] || 0) + 1;
        });
        
        const sortedEvents = Object.entries(eventCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
          
        setTopEvents(sortedEvents);
        
        // Aggregate top pages
        const pageViews = events.filter((e: any) => e.event === 'page_view');
        const pathCounts: Record<string, number> = {};
        pageViews.forEach((e: any) => {
          const path = e.path || 'unknown';
          pathCounts[path] = (pathCounts[path] || 0) + 1;
        });
        
        const sortedPages = Object.entries(pathCounts)
          .map(([path, views]) => ({ path, views }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 5);
          
        setTopPages(sortedPages);
        
        // Recent activity (latest 5)
        const recent = events.slice(0, 5).map((e: any) => {
          const rawId = e.anonId || e.id || e.userId;
          const formattedId = formatUserId(rawId);
          return {
            id: e.id,
            timestamp: e.timestamp,
            event: e.event,
            user: formattedId,
            userId: formattedId,
            projectId: e.projectId || e.project || 'Unknown',
            properties: e.properties || {}
          };
        });
        
        setRecentActivity(recent);
        
        // Aggregate demographics
        const devicesCount: Record<string, number> = {};
        const browsersCount: Record<string, number> = {};
        const osCount: Record<string, number> = {};
        const countryCount: Record<string, number> = {};
        
        events.forEach((e: any) => {
          if (e.browser?.name) browsersCount[e.browser.name] = (browsersCount[e.browser.name] || 0) + 1;
          if (e.browser?.os) osCount[e.browser.os] = (osCount[e.browser.os] || 0) + 1;
          if (e.device?.type) devicesCount[e.device.type] = (devicesCount[e.device.type] || 0) + 1;
          // We don't have country detected properly yet, just set a default for now if it doesn't exist
          const country = e.country || 'Unknown';
          countryCount[country] = (countryCount[country] || 0) + 1;
        });

        const formatStats = (countMap: Record<string, number>) => Object.entries(countMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

        setBrowserStats(formatStats(browsersCount));
        setOsStats(formatStats(osCount));
        setDeviceStats(formatStats(devicesCount));
        setCountryStats(formatStats(countryCount).map((c, i) => ({ ...c, code: c.name === 'Unknown' ? 'UN' : c.name.substring(0, 2).toUpperCase() })));
        
        // Time series (group by day)
        const dateCounts: Record<string, number> = {};
        events.forEach((e: any) => {
          const date = new Date(e.timestamp).toISOString().slice(5, 10); // MM-DD
          dateCounts[date] = (dateCounts[date] || 0) + 1;
        });
        
        // Fill last 7 days including today
        const series = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().slice(5, 10);
          series.push({ name: dateStr, events: dateCounts[dateStr] || 0 });
        }
        setEventsOverTime(series);
        
        // Compute unique active users using 15-char formatted User ID
        const uniqueUsers = new Set(events.map((e: any) => formatUserId(e.anonId || e.id || e.userId)));
        setTotalActiveUsers(uniqueUsers.size || 0);
        
      } catch (err) {
        console.error('Error fetching events API', err);
      }
    };
    
    // Load immediately
    loadEvents();
    
    // Poll every 2 seconds
    const interval = setInterval(loadEvents, 2000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Compute summary stats
  const totalViews = topPages.reduce((acc, curr) => acc + curr.views, 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Overview"
        subtitle="A snapshot of your product across all projects."
        actions={
          <>
            <Select defaultValue="30">
              <SelectTrigger className="w-[160px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportsSnapshotCard stats={{ views: totalViews, activeUsers: totalActiveUsers }} />

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Events over time</CardTitle>
            <Badge variant="secondary">Daily</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventsOverTime} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="events" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <ActiveUsersByCountryCard data={countryStats} />

        <DonutCard title="Browser" data={browserStats} />
        <DonutCard title="Device" data={deviceStats} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DonutCard title="Operating system" data={osStats} />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top events (Live Data)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topEvents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-4">No events tracked yet</TableCell>
                  </TableRow>
                )}
                {topEvents.map((e) => (
                  <TableRow key={e.name}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.count.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top pages (Live Data)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-4">No page views tracked yet</TableCell>
                  </TableRow>
                )}
                {topPages.map((p) => (
                  <TableRow key={p.path}>
                    <TableCell className="font-mono text-xs">{p.path}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.views.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent activity (Live Data)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">No activity tracked yet</TableCell>
                  </TableRow>
                )}
                {recentActivity.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px] whitespace-nowrap">{r.projectId}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px] whitespace-nowrap">{r.event}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono whitespace-nowrap">
                      {r.userId ? (
                        <Link
                          to="/users/$userId"
                          params={{ userId: r.userId }}
                          className="text-primary hover:underline font-medium"
                        >
                          {r.user}
                        </Link>
                      ) : (
                        r.user
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={JSON.stringify(r.properties)}>
                      {Object.keys(r.properties).length > 0 
                        ? Object.entries(r.properties).map(([k, v]) => `${k}: ${v}`).join(', ') 
                        : (r.event === 'page_view' ? r.properties.path || '/' : '')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-foreground)",
} as const;

function DonutCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={45} outerRadius={70} stroke="var(--color-card)" strokeWidth={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={chartColors[i % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
