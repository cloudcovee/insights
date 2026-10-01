import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Download,
  Search,
  Info,
  ExternalLink,
  Package,
} from "lucide-react";
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
import { cn, formatUserId } from "@/lib/utils";
import { useProject } from "@/lib/project-context";

export const Route = createFileRoute("/_dash/events")({ component: EventsPage });

import {
  parseProps,
  isItemPurchasedEvent,
  isAddToCartEvent,
  isProductViewedEvent,
  getDisplayEventName,
  resolveProductDetails,
  deduplicateEvents
} from "@/lib/event-utils";

function EventsPage() {
  const { activeProjectId } = useProject();
  const [q, setQ] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [date, setDate] = useState<Date | undefined>();
  const pageSize = 15;
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchEvents = async () => {
      try {
        const res = await fetch("/api/events");
        if (res.ok) {
          const rawData = await res.json();
          if (mounted && Array.isArray(rawData)) {
            const data =
              activeProjectId === "all"
                ? rawData
                : rawData.filter(
                    (e: any) =>
                      e.projectId === activeProjectId || e.project === activeProjectId
                  );
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
    () => {
      const rawList = events.filter((r) => {
        const p = parseProps(r.properties);
        const displayEvent = getDisplayEventName(r);
        const devType = r.device?.type || r.device || "Unknown";

        // Event filter matching
        if (eventFilter !== "all") {
          if (eventFilter === "Item purchased" && !isItemPurchasedEvent(r, p)) return false;
          else if (eventFilter === "Add to Cart" && !isAddToCartEvent(r, p)) return false;
          else if (eventFilter === "Product Viewed" && !isProductViewedEvent(r, p)) return false;
          else if (
            eventFilter !== "Item purchased" &&
            eventFilter !== "Add to Cart" &&
            eventFilter !== "Product Viewed" &&
            r.event !== eventFilter &&
            displayEvent !== eventFilter
          ) {
            return false;
          }
        }

        if (deviceFilter !== "all" && devType !== deviceFilter) return false;

        if (q) {
          const searchStr = `${displayEvent} ${r.event || ""} ${r.anonId || ""} ${r.userId || ""} ${
            r.country || ""
          } ${r.id || ""} ${p.productName || ""} ${p.productId || ""} ${p.text || ""}`.toLowerCase();
          if (!searchStr.includes(q.toLowerCase())) return false;
        }

        if (date) {
          const rDate = new Date(r.timestamp);
          if (
            rDate.getFullYear() !== date.getFullYear() ||
            rDate.getMonth() !== date.getMonth() ||
            rDate.getDate() !== date.getDate()
          ) {
            return false;
          }
        }

        return true;
      });

      return deduplicateEvents(rawList);
    },
    [q, eventFilter, deviceFilter, date, events]
  );

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Resolved product details for currently selected modal event
  const selectedProductInfo = useMemo(() => {
    return resolveProductDetails(selectedDetail, events);
  }, [selectedDetail, events]);

  const selectedDisplayEvent = useMemo(() => {
    return getDisplayEventName(selectedDetail);
  }, [selectedDetail]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Events Stream"
        subtitle="Real-time event tracking with automatic purchase, product, cart, and session breakdown."
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
              placeholder="Search events, users, products, interaction IDs…"
              className="pl-9"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="Item purchased">Item purchased</SelectItem>
              <SelectItem value="Add to Cart">Add to Cart</SelectItem>
              <SelectItem value="Product Viewed">Product Viewed</SelectItem>
              <SelectItem value="page_view">page_view</SelectItem>
              <SelectItem value="click">click</SelectItem>
              <SelectItem value="error">error</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deviceFilter} onValueChange={setDeviceFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Device" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All devices</SelectItem>
              <SelectItem value="Desktop">Desktop</SelectItem>
              <SelectItem value="Mobile">Mobile</SelectItem>
              <SelectItem value="Tablet">Tablet</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[200px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-4 overflow-x-auto rounded-md border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-1/4 font-semibold text-center pl-6 pr-4">Time</TableHead>
                <TableHead className="w-1/4 font-semibold text-center px-4">Event</TableHead>
                <TableHead className="w-1/4 font-semibold text-center px-4">Visitor Auth Status</TableHead>
                <TableHead className="w-1/4 font-semibold text-center pl-4 pr-6">User Identifier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-16 text-center text-sm text-muted-foreground">
                    No events match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((r) => {
                  const displayEvent = getDisplayEventName(r);
                  const rawId = r.subscriberKey || r.userId || r.anonId || r.id;
                  const formattedId = r.subscriberKey ? r.subscriberKey : formatUserId(rawId);
                  const isLoggedIn = Boolean(r.subscriberKey || r.userId);

                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setSelectedDetail(r)}
                    >
                      <TableCell className="w-1/4 whitespace-nowrap text-xs text-muted-foreground font-mono text-center pl-6 pr-4">
                        {new Date(r.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true })}
                      </TableCell>
                      <TableCell className="w-1/4 text-center px-4">
                        <Badge variant="secondary" className="font-mono text-[11px] whitespace-nowrap font-normal">
                          {displayEvent}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-1/4 text-center px-4">
                        {isLoggedIn ? (
                          <Badge variant="secondary" className="text-xs font-normal gap-1 rounded-full px-2.5 py-0.5 text-muted-foreground bg-muted/60 border-0 inline-flex items-center">
                            <Info className="h-3 w-3 text-muted-foreground" /> Logged in
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs font-normal gap-1 rounded-full px-2.5 py-0.5 text-muted-foreground bg-muted/60 border-0 inline-flex items-center">
                            <Info className="h-3 w-3 text-muted-foreground" /> Anonymous
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="w-1/4 text-center py-2.5 pl-4 pr-6">
                        <Link
                          to={"/users/$userId" as any}
                          params={{ userId: formattedId } as any}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs text-foreground hover:text-primary hover:underline bg-muted/50 px-2.5 py-1 rounded-md border font-normal inline-flex items-center gap-1"
                          title={`View profile for ${formattedId}`}
                        >
                          <span>{formattedId}</span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-60" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
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
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(Math.max(1, page - 1));
                  }}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={page === i + 1}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(i + 1);
                    }}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(Math.min(totalPages, page + 1));
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </Card>

      {/* Event Details Modal */}
      <Dialog open={!!selectedDetail} onOpenChange={(open) => !open && setSelectedDetail(null)}>
        <DialogContent className="sm:max-w-2xl max-w-[95vw] max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <span className="font-semibold text-foreground">
                Event Details
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {selectedDetail?.projectId || selectedDetail?.project || "Go_Kart"}
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs font-normal">
                  {selectedDisplayEvent}
                </Badge>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Timestamp: {selectedDetail ? new Date(selectedDetail.timestamp).toLocaleString() : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedDetail && (
            <div className="space-y-4 pt-2 min-w-0">
              {/* Product / Purchase / Cart details card */}
              {selectedProductInfo && (
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {selectedProductInfo.type === "purchase"
                        ? "PURCHASE & ORDER BREAKDOWN"
                        : selectedProductInfo.type === "cart"
                        ? "CART & PRODUCT DETAILS"
                        : "PRODUCT INFORMATION"}
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                      {selectedProductInfo.status}
                    </Badge>
                  </div>

                  {selectedProductInfo.type === "purchase" && Array.isArray(selectedProductInfo.items) ? (
                    <div className="space-y-3">
                      {/* Multi-item list */}
                      <div className="rounded-md border bg-background divide-y divide-border/60 overflow-hidden">
                        {selectedProductInfo.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-3 gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.productName}
                                  className="h-10 w-10 rounded-md object-cover border bg-muted shadow-xs shrink-0"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                  <Package className="h-4 w-4" />
                                </div>
                              )}
                              <div className="min-w-0 space-y-0.5">
                                <div className="font-semibold text-xs text-foreground truncate">
                                  {item.productName}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {item.category} · ID: {item.productId}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-bold text-xs font-mono text-foreground">
                                ${item.subtotal.toLocaleString()}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                ${item.price.toLocaleString()} × {item.quantity} {item.quantity > 1 ? "units" : "unit"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Order Summary Footer */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        <div className="rounded bg-background p-2 border">
                          <span className="text-muted-foreground block text-[10px]">Total Items</span>
                          <span className="font-medium text-xs text-foreground block">
                            {selectedProductInfo.totalUnits} units ({selectedProductInfo.itemCount} {selectedProductInfo.itemCount > 1 ? "items" : "item"})
                          </span>
                        </div>
                        <div className="rounded bg-background p-2 border">
                          <span className="text-muted-foreground block text-[10px]">Grand Total</span>
                          <span className="font-bold text-xs text-foreground block font-mono">
                            ${selectedProductInfo.grandTotal.toLocaleString()}
                          </span>
                        </div>
                        <div className="rounded bg-background p-2 border">
                          <span className="text-muted-foreground block text-[10px]">Discount / Offer</span>
                          <span className="font-medium text-xs text-foreground truncate block">
                            {selectedProductInfo.discount}
                          </span>
                        </div>
                        <div className="rounded bg-background p-2 border">
                          <span className="text-muted-foreground block text-[10px]">Shipping</span>
                          <span className="font-medium text-xs text-foreground truncate block">
                            {selectedProductInfo.shipping}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {selectedProductInfo.imageUrl ? (
                            <img
                              src={selectedProductInfo.imageUrl}
                              alt={selectedProductInfo.productName}
                              className="h-12 w-12 rounded-lg object-cover border bg-muted shadow-xs shrink-0"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                          <div className="space-y-0.5 min-w-0">
                            <div className="text-base font-bold text-foreground truncate">
                              {selectedProductInfo.productName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Category: {selectedProductInfo.category} · ID: {selectedProductInfo.productId}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-extrabold text-foreground font-mono">
                            ${selectedProductInfo.subtotal.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            ${selectedProductInfo.price.toLocaleString()} × {selectedProductInfo.quantity}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        <div className="rounded bg-background p-2 border">
                          <span className="text-muted-foreground block text-[10px]">Quantity</span>
                          <span className="font-medium text-xs text-foreground block">
                            {selectedProductInfo.quantity} unit{selectedProductInfo.quantity > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="rounded bg-background p-2 border">
                          <span className="text-muted-foreground block text-[10px]">Unit Price</span>
                          <span className="font-medium text-xs text-foreground block font-mono">
                            ${selectedProductInfo.price.toLocaleString()}
                          </span>
                        </div>
                        <div className="rounded bg-background p-2 border">
                          <span className="text-muted-foreground block text-[10px]">Discount / Offer</span>
                          <span className="font-medium text-xs text-foreground truncate block">
                            {selectedProductInfo.discount}
                          </span>
                        </div>
                        <div className="rounded bg-background p-2 border">
                          <span className="text-muted-foreground block text-[10px]">Shipping</span>
                          <span className="font-medium text-xs text-foreground truncate block">
                            {selectedProductInfo.shipping}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Event metadata details cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="rounded-lg border bg-card p-3 space-y-1 min-w-0 overflow-hidden">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block tracking-wider">
                    Project & User
                  </span>
                  <div className="font-semibold text-foreground truncate" title={selectedDetail.userId || "Anonymous Visitor"}>
                    {selectedDetail.userId || "Anonymous Visitor"}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Project: {selectedDetail.projectId || selectedDetail.project || "Go_Kart"}
                  </div>
                  <div
                    className="text-[10px] font-mono text-muted-foreground truncate"
                    title={selectedDetail.ip || selectedDetail.properties?.ip || "127.0.0.1"}
                  >
                    IP: {selectedDetail.ip || selectedDetail.properties?.ip || "127.0.0.1"}
                  </div>
                  {selectedDetail.anonId && (
                    <div
                      className="text-[10px] font-mono text-muted-foreground truncate"
                      title={formatUserId(selectedDetail.anonId)}
                    >
                      Anon ID: {formatUserId(selectedDetail.anonId)}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-card p-3 space-y-1 min-w-0 overflow-hidden">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block tracking-wider">
                    Browser & Device
                  </span>
                  <div className="font-medium text-foreground truncate">
                    {typeof selectedDetail.browser === "object"
                      ? selectedDetail.browser?.name
                      : selectedDetail.browser || "Chrome"}{" "}
                    on {selectedDetail.os || "Windows"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Device:{" "}
                    {typeof selectedDetail.device === "object"
                      ? selectedDetail.device?.type
                      : selectedDetail.device || "Desktop"}
                  </div>
                  {selectedDetail.screenSize && (
                    <div className="text-[10px] text-muted-foreground font-mono">
                      Screen: {selectedDetail.screenSize}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-card p-3 space-y-1 min-w-0 overflow-hidden">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block tracking-wider">
                    Location
                  </span>
                  <div className="font-medium text-foreground truncate">
                    {(parseProps(selectedDetail.properties).city || selectedDetail.city || "Pune")}, {selectedDetail.country && selectedDetail.country !== "Unknown" ? selectedDetail.country : "India"}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {parseProps(selectedDetail.properties).region || selectedDetail.region || "Maharashtra"}
                  </div>
                </div>
              </div>

              {/* Event Details & Properties (Single Unified Box) */}
              <div className="space-y-1.5 min-w-0">
                <span className="text-xs font-semibold text-foreground block">
                  Event Details & Properties
                </span>
                <div className="rounded-lg border bg-card/60 divide-y divide-border/60 overflow-hidden text-xs">
                  {(() => {
                    const p = parseProps(selectedDetail.properties);
                    const entries = Object.entries(p).filter(([_, val]) => val !== undefined && val !== null && val !== "");

                    if (entries.length === 0) {
                      return (
                        <div className="p-4 text-center text-xs text-muted-foreground italic">
                          No additional properties recorded for this event.
                        </div>
                      );
                    }

                    return entries.map(([key, val]) => {
                      const displayVal = typeof val === "object" ? JSON.stringify(val) : String(val);
                      return (
                        <div
                          key={key}
                          className="flex items-start justify-between gap-4 px-3.5 py-2.5 hover:bg-muted/30 transition-colors"
                        >
                          <span className="font-mono text-muted-foreground text-[11px] font-medium shrink-0 min-w-[110px]">
                            {key}
                          </span>
                          <span className="font-medium text-foreground text-right break-all text-xs">
                            {displayVal}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
