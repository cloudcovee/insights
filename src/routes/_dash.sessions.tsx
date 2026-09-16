import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { formatUserId } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProject } from "@/lib/project-context";

export const Route = createFileRoute("/_dash/sessions")({ component: SessionsPage });

interface RealSessionRow {
  id: string;
  user: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  durationFormatted: string;
  pages: number;
  events: number;
  browser: string;
  country: string;
  bounce: boolean;
  projectId: string;
}

function SessionsPage() {
  const { activeProjectId } = useProject();
  const [sessions, setSessions] = useState<RealSessionRow[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    avgDuration: "0s",
    avgPages: "0",
    bounceRate: "0%"
  });

  useEffect(() => {
    let mounted = true;

    const loadSessions = async () => {
      try {
        const response = await fetch('/api/events');
        if (!response.ok) return;
        const rawEvents = await response.json();
        if (!mounted || !Array.isArray(rawEvents)) return;
        
        const events = activeProjectId === 'all' 
          ? rawEvents 
          : rawEvents.filter((e: any) => e.projectId === activeProjectId || e.project === activeProjectId);
          
        const sessionMap = new Map<string, RealSessionRow>();

        events.forEach((e: any) => {
          // Use sessionId if available, otherwise fallback to anonId (one session per anonId historically)
          const sId = e.sessionId || e.anonId || e.id; 
          
          if (!sessionMap.has(sId)) {
            sessionMap.set(sId, {
              id: sId,
              user: e.userId || e.anonId || 'Unknown',
              startedAt: e.timestamp,
              endedAt: e.timestamp,
              durationMs: 0,
              durationFormatted: "0s",
              pages: 0,
              events: 0,
              browser: e.browser?.name || e.browser || 'Unknown',
              country: e.country || 'Unknown',
              bounce: true,
              projectId: e.projectId || 'Unknown'
            });
          }
          
          const session = sessionMap.get(sId)!;
          session.events += 1;
          if (e.event === 'page_view') {
            session.pages += 1;
          }
          
          const eventTime = new Date(e.timestamp).getTime();
          const firstTime = new Date(session.startedAt).getTime();
          const lastTime = new Date(session.endedAt).getTime();
          
          if (eventTime < firstTime) session.startedAt = e.timestamp;
          if (eventTime > lastTime) session.endedAt = e.timestamp;
          
          // Recalculate duration
          session.durationMs = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
          
          // Format duration
          if (session.durationMs === 0) {
            session.durationFormatted = "0s";
          } else {
            const secs = Math.floor(session.durationMs / 1000);
            if (secs < 60) session.durationFormatted = `${secs}s`;
            else session.durationFormatted = `${Math.floor(secs / 60)}m ${secs % 60}s`;
          }
          
          // Bounced if only 1 page view and short duration
          session.bounce = session.pages <= 1 && session.durationMs < 10000;
        });
        
        const sortedSessions = Array.from(sessionMap.values()).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        setSessions(sortedSessions);
        
        // Calculate KPIs
        const total = sortedSessions.length;
        const totalDur = sortedSessions.reduce((acc, s) => acc + s.durationMs, 0);
        const totalPages = sortedSessions.reduce((acc, s) => acc + s.pages, 0);
        const bounced = sortedSessions.filter(s => s.bounce).length;
        
        const avgDurSecs = total > 0 ? Math.floor((totalDur / total) / 1000) : 0;
        const avgDurFmt = avgDurSecs < 60 ? `${avgDurSecs}s` : `${Math.floor(avgDurSecs / 60)}m ${avgDurSecs % 60}s`;
        
        setMetrics({
          total,
          avgDuration: avgDurFmt,
          avgPages: total > 0 ? (totalPages / total).toFixed(1) : "0",
          bounceRate: total > 0 ? `${Math.round((bounced / total) * 100)}%` : "0%"
        });
        
      } catch (err) {
        console.error('Error fetching sessions', err);
      }
    };
    
    loadSessions();
    const interval = setInterval(loadSessions, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeProjectId]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Sessions" subtitle="Understand how visitors move through your product." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Sessions" value={metrics.total.toLocaleString()} delta={0} hint="All time" />
        <KpiCard label="Avg. duration" value={metrics.avgDuration} delta={0} hint="All time" />
        <KpiCard label="Avg. pages / session" value={metrics.avgPages} delta={0} hint="All time" />
        <KpiCard label="Bounce rate" value={metrics.bounceRate} delta={0} hint="All time" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Pages</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-4">No sessions tracked yet</TableCell>
                  </TableRow>
                )}
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground" title={s.id}>
                      {s.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[9px] px-1">{s.projectId}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-primary" title={s.user}>
                      <Link
                        to="/users/$userId"
                        params={{ userId: formatUserId(s.user) }}
                        className="hover:underline font-mono"
                      >
                        {formatUserId(s.user)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.startedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{s.durationFormatted}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.pages}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.events}</TableCell>
                    <TableCell className="text-xs">{s.browser}</TableCell>
                    <TableCell><Badge variant="secondary">{s.country}</Badge></TableCell>
                    <TableCell>
                      {s.bounce ? (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">Bounced</Badge>
                      ) : (
                        <Badge>Engaged</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
