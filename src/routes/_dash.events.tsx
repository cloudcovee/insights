import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, Download, Search } from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { useProject } from "@/lib/project-context";

export const Route = createFileRoute("/_dash/events")({ component: EventsPage });

function EventsPage() {
  const { activeProjectId } = useProject();
  const [q, setQ] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [date, setDate] = useState<Date | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 15;
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

  const filtered = useMemo(
    () =>
      events.filter((r) => {
        const devType = r.device?.type || r.device || 'Unknown';
        if (eventFilter !== "all" && r.event !== eventFilter) return false;
        if (deviceFilter !== "all" && devType !== deviceFilter) return false;
        if (q && !(`${r.event} ${r.anonId || ''} ${r.country || ''} ${r.id || ''}`.toLowerCase().includes(q.toLowerCase()))) return false;
        
        if (date) {
          const rDate = new Date(r.timestamp);
          if (rDate.getFullYear() !== date.getFullYear() || 
              rDate.getMonth() !== date.getMonth() || 
              rDate.getDate() !== date.getDate()) {
            return false;
          }
        }
        
        return true;
      }),
    [q, eventFilter, deviceFilter, date, events],
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Extract unique events for the filter dropdown
  const uniqueEventNames = Array.from(new Set(events.map(e => e.event)));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Events"
        subtitle="Explore every event streamed into your workspace."
        actions={
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search events, users, ids…"
              className="pl-9"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Event" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {uniqueEventNames.length > 0 ? uniqueEventNames.map((e: any) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              )) : (
                ["page_view", "click", "form_submit", "error"].map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Select value={deviceFilter} onValueChange={setDeviceFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Device" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All devices</SelectItem>
              <SelectItem value="Desktop">Desktop</SelectItem>
              <SelectItem value="Mobile">Mobile</SelectItem>
              <SelectItem value="Tablet">Tablet</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-4 overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Anon ID</TableHead>
                <TableHead>Browser</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-16 text-center text-sm text-muted-foreground">
                    No events match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px] whitespace-nowrap">
                        {r.projectId || r.project || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[11px]">{r.event}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-primary">{r.userId ? r.userId : (r.anonId ? `Anon (${r.anonId.substring(0, 6)})` : 'Unknown')}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.anonId || r.id}</TableCell>
                    <TableCell className="text-xs">{r.browser?.name || r.browser || 'Unknown'}</TableCell>
                    <TableCell className="text-xs">{r.country || 'Unknown'}</TableCell>
                    <TableCell className="text-xs">{r.device?.type || r.device || 'Unknown'}</TableCell>
                    <TableCell className="max-w-[240px] truncate font-mono text-[11px] text-muted-foreground">
                      {JSON.stringify(r.properties || {})}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filtered.length.toLocaleString()} events
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage(Math.max(1, page - 1)); }} />
              </PaginationItem>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink href="#" isActive={page === i + 1} onClick={(e) => { e.preventDefault(); setPage(i + 1); }}>
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage(Math.min(totalPages, page + 1)); }} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </Card>
    </div>
  );
}
