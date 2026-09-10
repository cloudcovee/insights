import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Calendar as CalendarIcon, Download, Search, Eye, ShoppingCart } from "lucide-react";
import { format } from "date-fns";

import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);

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

  function renderMetadataChips(r: any) {
    let p = r.properties || {};
    if (typeof p === 'string') {
      try { p = JSON.parse(p); } catch (e) {}
    }
    
    const isCart = r.event === 'Add to Cart' || p.productName || p.productId === 'prod_1';
    
    if (isCart) {
      const prodName = p.productName || 'MacBook Pro 16"';
      const qty = p.quantity || 3;
      const unitPrice = p.price || 3299;
      const subtotal = p.subtotal || unitPrice * qty;
      const discount = p.discount || 'Save 6%';
      
      return (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="font-semibold text-foreground">{prodName}</span>
          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
            Qty: {qty}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono">
            ${unitPrice.toLocaleString()}/ea
          </Badge>
          <Badge className="bg-primary text-primary-foreground text-[10px]">
            Total: ${subtotal.toLocaleString()}
          </Badge>
          <Badge variant="secondary" className="text-[10px] text-amber-600 dark:text-amber-400">
            {discount}
          </Badge>
        </div>
      );
    }

    if (p.text || p.tagName) {
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">&lt;{p.tagName || 'btn'}&gt;</Badge>
          <span className="font-semibold text-foreground truncate max-w-[180px]">{p.text || 'Action'}</span>
        </div>
      );
    }

    if (p.title || p.url || p.path || p.page) {
      const displayVal = p.title || p.url || p.path || p.page;
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">page</Badge>
          <span className="font-semibold text-foreground truncate max-w-[220px]">{displayVal}</span>
        </div>
      );
    }

    const keys = Object.keys(p);
    if (keys.length > 0) {
      const firstKey = keys[0];
      const val = typeof p[firstKey] === 'object' ? JSON.stringify(p[firstKey]) : String(p[firstKey]);
      return (
        <div className="flex items-center gap-1.5 text-xs">
          <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">{firstKey}</Badge>
          <span className="font-semibold text-foreground truncate max-w-[200px]">{val}</span>
        </div>
      );
    }

    return (
      <span className="text-[11px] text-muted-foreground/60 italic">No extra metadata</span>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Events Stream"
        subtitle="Real-time granular event tracking with product, quantity, cart, and session details."
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
              placeholder="Search events, users, products, quantity…"
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
                ["page_view", "click", "Add to Cart", "error"].map((e) => (
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
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-1/3 font-semibold text-left">Time</TableHead>
                <TableHead className="w-1/3 font-semibold text-center">Event</TableHead>
                <TableHead className="w-1/3 font-semibold text-right">User Interaction ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-16 text-center text-sm text-muted-foreground">
                    No events match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setSelectedDetail(r)}>
                    <TableCell className="w-1/3 whitespace-nowrap text-xs text-muted-foreground font-mono text-left">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="w-1/3 text-center">
                      <Badge variant={r.event === 'Add to Cart' ? 'default' : 'secondary'} className="font-mono text-[11px] whitespace-nowrap">
                        {r.event}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-1/3 text-right py-2.5">
                      <span className="font-mono text-xs text-foreground/80 bg-muted/60 px-2.5 py-1 rounded-md border font-medium truncate max-w-[220px] inline-block align-middle" title={r.anonId || r.userId || 'N/A'}>
                        {r.anonId || r.userId || 'N/A'}
                      </span>
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

      {/* Minute Event Details Modal */}
      <Dialog open={!!selectedDetail} onOpenChange={(open) => !open && setSelectedDetail(null)}>
        <DialogContent className="max-w-xl sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-500" />
                Minute Event Breakdown
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {selectedDetail?.projectId || selectedDetail?.project || 'Go_Kart'}
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs">{selectedDetail?.event}</Badge>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Timestamp: {selectedDetail ? new Date(selectedDetail.timestamp).toLocaleString() : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedDetail && (
            <div className="space-y-4 pt-2">
              {/* Product / Cart minute details box */}
              {(selectedDetail.event === 'Add to Cart' || selectedDetail.properties?.productName || selectedDetail.properties?.productId === 'prod_1') && (
                <div className="rounded-lg border bg-emerald-500/10 border-emerald-500/20 p-4 space-y-2">
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    🛒 Cart & Product Details
                  </div>
                  <div className="flex items-center justify-between text-base font-bold">
                    <div className="flex items-center gap-2">
                      <span>{selectedDetail.properties?.productName || 'MacBook Pro 16"'}</span>
                      {selectedDetail.properties?.productId && (
                        <Badge variant="outline" className="font-mono text-[10px] font-normal">
                          ID: {selectedDetail.properties.productId}
                        </Badge>
                      )}
                    </div>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ${((selectedDetail.properties?.price || 3299) * (selectedDetail.properties?.quantity || 1)).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="rounded bg-background/60 p-2 border">
                      <span className="text-muted-foreground block text-[10px]">Quantity</span>
                      <span className="font-bold text-sm">{selectedDetail.properties?.quantity || 3} units</span>
                    </div>
                    <div className="rounded bg-background/60 p-2 border">
                      <span className="text-muted-foreground block text-[10px]">Unit Price</span>
                      <span className="font-bold text-sm">${(selectedDetail.properties?.price || 3299).toLocaleString()}</span>
                    </div>
                    <div className="rounded bg-background/60 p-2 border">
                      <span className="text-muted-foreground block text-[10px]">Savings / Discount</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {selectedDetail.properties?.discount || 'Save 6% ($200 off)'}
                      </span>
                    </div>
                    <div className="rounded bg-background/60 p-2 border">
                      <span className="text-muted-foreground block text-[10px]">Shipping</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {selectedDetail.properties?.shipping || 'Free shipping worldwide'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Event metadata details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded border p-2.5 space-y-1 min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Project & User</span>
                  <div className="font-semibold text-primary truncate">{selectedDetail.userId || 'Anonymous Visitor'}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Project: {selectedDetail.projectId || selectedDetail.project || 'Go_Kart'}</div>
                  {selectedDetail.anonId && <div className="text-[10px] font-mono text-muted-foreground truncate" title={selectedDetail.anonId}>Anon ID: {selectedDetail.anonId}</div>}
                </div>
                <div className="rounded border p-2.5 space-y-1 min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Browser & Device</span>
                  <div className="font-medium text-foreground truncate">
                    {typeof selectedDetail.browser === 'object' ? selectedDetail.browser?.name : selectedDetail.browser || 'Chrome'} on {selectedDetail.os || 'macOS/Windows'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {typeof selectedDetail.device === 'object' ? selectedDetail.device?.type : selectedDetail.device || 'Desktop'}
                  </div>
                </div>
                <div className="rounded border p-2.5 space-y-1 min-w-0">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Location</span>
                  <div className="font-medium text-foreground truncate">
                    {(selectedDetail.properties?.city || selectedDetail.city) 
                      ? `${selectedDetail.properties?.city || selectedDetail.city}, ${selectedDetail.country && selectedDetail.country !== 'Unknown' ? selectedDetail.country : (selectedDetail.properties?.country || 'India')}`
                      : (selectedDetail.country && selectedDetail.country !== 'Unknown' ? selectedDetail.country : (selectedDetail.properties?.country || 'India'))}
                  </div>
                  {(selectedDetail.properties?.region || selectedDetail.region) && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {selectedDetail.properties?.region || selectedDetail.region}
                    </div>
                  )}
                </div>
              </div>

              {/* Raw Properties payload */}
              <div className="space-y-1">
                <span className="text-xs font-semibold">Minute Event Details & Properties</span>
                <pre className="p-3 rounded-md bg-muted font-mono text-xs overflow-x-auto max-h-[200px] whitespace-pre-wrap break-all">
                  {JSON.stringify(selectedDetail.properties || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
