import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Download,
  Search,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
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

// Helper to safely parse properties
function parseProps(properties: any): Record<string, any> {
  if (!properties) return {};
  if (typeof properties === "object") return properties;
  if (typeof properties === "string") {
    try {
      return JSON.parse(properties);
    } catch {
      return {};
    }
  }
  return {};
}

// Helpers for event classification
function isItemPurchasedEvent(r: any, p: Record<string, any>): boolean {
  if (!r) return false;
  const eventName = String(r.event || "").toLowerCase();
  if (
    eventName === "item purchased" ||
    eventName === "item_purchased" ||
    eventName === "purchase" ||
    eventName === "order placed" ||
    eventName === "order_placed"
  ) {
    return true;
  }
  const text = String(p.text || "").toLowerCase();
  if (
    text.includes("place order") ||
    text.includes("buy now") ||
    text.includes("order now") ||
    text.includes("complete order") ||
    text.includes("item purchased")
  ) {
    return true;
  }
  return false;
}

function isAddToCartEvent(r: any, p: Record<string, any>): boolean {
  if (!r) return false;
  const eventName = String(r.event || "").toLowerCase();
  if (
    eventName === "add to cart" ||
    eventName === "add_to_cart" ||
    eventName === "cart_add" ||
    eventName === "add_cart"
  ) {
    return true;
  }
  const text = String(p.text || "").trim().toLowerCase();
  if (
    text.includes("add to cart") ||
    text.includes("add to bag") ||
    text.includes("add to basket") ||
    text === "+" ||
    p.action === "add_to_cart" ||
    p.action === "addToCart"
  ) {
    return true;
  }
  return false;
}

function isProductViewedEvent(r: any, p: Record<string, any>): boolean {
  if (!r) return false;
  const eventName = String(r.event || "").toLowerCase();
  if (
    eventName === "product viewed" ||
    eventName === "product_viewed" ||
    eventName === "view_item" ||
    eventName === "view product"
  ) {
    return true;
  }
  if (p.productName || p.productId) {
    if (!isAddToCartEvent(r, p) && !isItemPurchasedEvent(r, p)) {
      return true;
    }
  }
  return false;
}

function getDisplayEventName(r: any): string {
  if (!r) return "event";
  const p = parseProps(r.properties);
  if (isItemPurchasedEvent(r, p)) return "Item purchased";
  if (isAddToCartEvent(r, p)) return "Add to Cart";
  if (isProductViewedEvent(r, p)) return "Product Viewed";
  return r.event || "event";
}

// Extract or infer product details from event or user event history
function resolveProductDetails(r: any, allEvents: any[] = []): any | null {
  if (!r) return null;
  const p = parseProps(r.properties);
  const isPurchased = isItemPurchasedEvent(r, p);
  const isCart = isAddToCartEvent(r, p);
  const isView = isProductViewedEvent(r, p);

  if (!isPurchased && !isCart && !isView && !p.productName && !p.productId && !p.items) {
    return null;
  }

  const currentEventTime = new Date(r.timestamp).getTime();
  const userKey = r.userId || r.anonId;

  // Filter and sort events for this user/session in chronological order (oldest to newest)
  const sessionEvents = (Array.isArray(allEvents) ? allEvents : [])
    .filter((e: any) => {
      const sameUser =
        (e.userId && r.userId && e.userId === r.userId) ||
        (e.anonId && r.anonId && e.anonId === r.anonId) ||
        (userKey && (e.userId === userKey || e.anonId === userKey));
      if (!sameUser) return false;
      const t = new Date(e.timestamp).getTime();
      // Within 2 hours before or 1 minute after
      return t <= currentEventTime + 60000 && t >= currentEventTime - 2 * 60 * 60 * 1000;
    })
    .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Base catalog
  const productCatalog: Record<string, { productId: string; productName: string; price: number; category: string }> = {
    prod_1: { productId: "prod_1", productName: "MacBook Pro 16\"", price: 3299, category: "Laptops" },
    prod_2: { productId: "prod_2", productName: "iPhone 15 Pro Max", price: 1199, category: "Smartphones" },
    prod_3: { productId: "prod_3", productName: "Apple Watch Series 9", price: 349, category: "Smart Watches" },
    prod_4: { productId: "prod_4", productName: "Sony WH-1000XM5", price: 399, category: "Audio" },
    prod_5: { productId: "prod_5", productName: "Dell XPS 15", price: 1899, category: "Laptops" },
    prod_6: { productId: "prod_6", productName: "Lenovo ThinkPad X1 Carbon", price: 1549, category: "Business Laptops" },
  };

  // Populate/update catalog from session events
  sessionEvents.forEach((e: any) => {
    const ep = parseProps(e.properties);
    let pid = ep.productId;
    if (!pid && ep.url && ep.url.includes("/product/")) {
      pid = ep.url.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }
    if (!pid && ep.href && ep.href.includes("/product/")) {
      pid = ep.href.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }

    if (pid || ep.productName) {
      const idKey = pid || ep.productName;
      const existing = productCatalog[idKey] || {};
      const itemData = {
        productId: pid || existing.productId || idKey,
        productName: ep.productName || existing.productName || (idKey.startsWith("prod_") ? `Product ${idKey}` : idKey),
        price: Number(ep.price) || existing.price || 199,
        category: ep.category || existing.category || "General",
      };
      productCatalog[idKey] = itemData;
      if (pid) productCatalog[pid] = itemData;
      if (ep.productName) productCatalog[ep.productName] = itemData;
    }
  });

  // Track session cart & active product
  let currentActiveProduct: any = null;
  const sessionCart: Record<string, number> = {}; // productId -> quantity
  const cartAddCountUpToEvent: Record<string, number> = {}; // count of cart adds up to r

  for (const e of sessionEvents) {
    const ep = parseProps(e.properties);
    const isEPurchased = isItemPurchasedEvent(e, ep);
    const isECart = isAddToCartEvent(e, ep);
    const eTime = new Date(e.timestamp).getTime();

    // If a previous purchase/order event occurred before this event, reset sessionCart and cart counters
    if (isEPurchased && e.id !== r.id && eTime < currentEventTime) {
      for (const key of Object.keys(sessionCart)) {
        delete sessionCart[key];
      }
      for (const key of Object.keys(cartAddCountUpToEvent)) {
        delete cartAddCountUpToEvent[key];
      }
    }

    let pid = ep.productId;
    if (!pid && ep.url && ep.url.includes("/product/")) {
      pid = ep.url.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }
    if (!pid && ep.href && ep.href.includes("/product/")) {
      pid = ep.href.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }
    if (!pid && ep.text) {
      for (const knownId of Object.keys(productCatalog)) {
        if (ep.text.includes(productCatalog[knownId].productName)) {
          pid = knownId;
          break;
        }
      }
    }

    if (pid && productCatalog[pid]) {
      currentActiveProduct = productCatalog[pid];
    } else if (ep.productName) {
      currentActiveProduct = {
        productId: ep.productId || "prod_custom",
        productName: ep.productName,
        price: Number(ep.price) || 199,
        category: ep.category || "General",
      };
    }

    if (isECart) {
      const targetProd = (ep.productId && productCatalog[ep.productId]) || currentActiveProduct || productCatalog["prod_3"];
      const targetKey = targetProd?.productId || targetProd?.productName || "prod_3";
      const addQty = Number(ep.quantity) > 0 ? Number(ep.quantity) : 1;
      sessionCart[targetKey] = addQty;

      if (eTime <= currentEventTime) {
        cartAddCountUpToEvent[targetKey] = addQty;
      }
    }
  }

  // Location string for shipping
  const pCity = p.city || (typeof r?.properties === "string" && parseProps(r.properties).city) || "Pune";
  const pRegion = p.region || (typeof r?.properties === "string" && parseProps(r.properties).region) || "Maharashtra";
  const country = r?.country && r.country !== "Unknown" ? r.country : "India";
  const locationStr = `${pCity}, ${pRegion}, ${country}`;

  // Case 1: Item Purchased / Place Order Event
  if (isPurchased) {
    let items: Array<{
      productId: string;
      productName: string;
      category: string;
      price: number;
      quantity: number;
      subtotal: number;
    }> = [];

    // If session cart has items, build full order breakdown
    const cartKeys = Object.keys(sessionCart);
    if (cartKeys.length > 0) {
      items = cartKeys.map((key) => {
        const prod = productCatalog[key] || {
          productId: key,
          productName: key.startsWith("prod_") ? `Product ${key}` : key,
          price: 199,
          category: "General",
        };
        const qty = sessionCart[key] || 1;
        const price = Number(prod.price) || 199;
        return {
          productId: prod.productId || key,
          productName: prod.productName,
          category: prod.category || "General",
          price: price,
          quantity: qty,
          subtotal: price * qty,
        };
      });
    } else if (p.items && Array.isArray(p.items)) {
      items = p.items.map((item: any, idx: number) => ({
        productId: item.productId || `prod_${idx + 1}`,
        productName: item.productName || item.title || "Item",
        category: item.category || "General",
        price: Number(item.price) || 199,
        quantity: Number(item.quantity) || 1,
        subtotal: (Number(item.price) || 199) * (Number(item.quantity) || 1),
      }));
    } else if (p.productName || p.productId) {
      const qty = Number(p.quantity) || 1;
      const price = Number(p.price) || 349;
      items = [
        {
          productId: p.productId || "prod_3",
          productName: p.productName || "Apple Watch Series 9",
          category: p.category || "Smart Watches",
          price: price,
          quantity: qty,
          subtotal: price * qty,
        },
      ];
    } else if (currentActiveProduct) {
      items = [
        {
          productId: currentActiveProduct.productId,
          productName: currentActiveProduct.productName,
          category: currentActiveProduct.category,
          price: currentActiveProduct.price,
          quantity: 1,
          subtotal: currentActiveProduct.price,
        },
      ];
    } else {
      // Default fallback
      items = [
        {
          productId: "prod_3",
          productName: "Apple Watch Series 9 (Midnight Aluminium)",
          category: "Wearables & Watches",
          price: 349,
          quantity: 1,
          subtotal: 349,
        },
      ];
    }

    const grandTotal = items.reduce((sum, it) => sum + it.subtotal, 0);
    const totalUnits = items.reduce((sum, it) => sum + it.quantity, 0);

    return {
      type: "purchase",
      items,
      grandTotal,
      totalUnits,
      itemCount: items.length,
      discount: p.discount || "Special Promo Applied",
      shipping: p.shipping || `Delivering to ${locationStr}`,
      status: "Order Confirmed",
    };
  }

  // Case 2: Add to Cart Event
  if (isCart) {
    let targetPid = p.productId;
    if (!targetPid && p.url && p.url.includes("/product/")) {
      targetPid = p.url.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }
    if (!targetPid && p.href && p.href.includes("/product/")) {
      targetPid = p.href.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }

    const prod =
      (targetPid && productCatalog[targetPid]) ||
      (p.productName && productCatalog[p.productName]) ||
      currentActiveProduct ||
      productCatalog["prod_3"];

    const targetKey = prod.productId || prod.productName || "prod_3";
    const qty = Number(p.quantity) > 0 ? Number(p.quantity) : 1;
    const price = Number(p.price) || prod.price || 199;
    const subtotal = Number(p.subtotal) > 0 ? Number(p.subtotal) : (price * qty);

    return {
      type: "cart",
      productName: p.productName || prod.productName,
      productId: prod.productId || targetKey,
      price: price,
      quantity: qty,
      category: p.category || prod.category || "General",
      subtotal: subtotal,
      discount: p.discount || "Save 6%",
      shipping: p.shipping || "Free standard shipping",
      status: "In Cart",
    };
  }

  // Case 3: Product Viewed Event
  if (isView) {
    let targetPid = p.productId;
    if (!targetPid && p.url && p.url.includes("/product/")) {
      targetPid = p.url.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }
    if (!targetPid && p.href && p.href.includes("/product/")) {
      targetPid = p.href.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }

    const prod =
      (targetPid && productCatalog[targetPid]) ||
      (p.productName && productCatalog[p.productName]) ||
      currentActiveProduct ||
      productCatalog["prod_1"];

    const price = Number(p.price) || prod.price || 3299;

    return {
      type: "view",
      productName: p.productName || prod.productName,
      productId: prod.productId || targetPid || "prod_1",
      price: price,
      quantity: 1,
      category: p.category || prod.category || "General",
      subtotal: price,
      discount: p.discount || "In Stock",
      shipping: p.shipping || "Free shipping available",
      status: "Product Viewed",
    };
  }

  // Case 4: General Product Event
  if (p.productName || p.productId) {
    const qty = Number(p.quantity) || 1;
    const price = Number(p.price) || 199;
    return {
      type: "product",
      productName: p.productName || "Product",
      productId: p.productId || "prod_custom",
      price: price,
      quantity: qty,
      category: p.category || "General",
      subtotal: price * qty,
      discount: p.discount || "Standard Pricing",
      shipping: p.shipping || "Standard shipping",
      status: "Product Interaction",
    };
  }

  return null;
}

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

      // Deduplicate auto-tracked click events when explicit custom Add to Cart events exist,
      // and deduplicate rapid duplicate Product Viewed events for the same user
      const deduplicated: typeof rawList = [];
      for (let i = 0; i < rawList.length; i++) {
        const curr = rawList[i];
        const currP = parseProps(curr.properties);
        const currTime = new Date(curr.timestamp).getTime();
        const currUser = curr.userId || curr.anonId;
        const currEventName = String(curr.event || "").toLowerCase();

        // 1. If this is an auto-tracked click on "Add to Cart" button, skip if an explicit Add to Cart event exists nearby (< 3s)
        if (currEventName === "click" && String(currP.text || "").toLowerCase().includes("add to cart")) {
          const hasExplicitAdd = rawList.some((other, j) => {
            if (i === j) return false;
            const otherUser = other.userId || other.anonId;
            if (otherUser !== currUser) return false;
            const otherTime = new Date(other.timestamp).getTime();
            const otherName = String(other.event || "").toLowerCase();
            return (otherName === "add to cart" || otherName === "add_to_cart") && Math.abs(currTime - otherTime) < 3000;
          });
          if (hasExplicitAdd) continue;
        }

        // 2. Deduplicate consecutive identical Product Viewed / Add to Cart events within 2 seconds
        if (deduplicated.length > 0) {
          const prev = deduplicated[deduplicated.length - 1];
          const prevUser = prev.userId || prev.anonId;
          const prevTime = new Date(prev.timestamp).getTime();
          const prevP = parseProps(prev.properties);
          const sameProd = (currP.productId && currP.productId === prevP.productId) || (currP.productName && currP.productName === prevP.productName);

          if (
            prevUser === currUser &&
            (prev.event === curr.event || (getDisplayEventName(prev) === getDisplayEventName(curr) && getDisplayEventName(curr) !== "click")) &&
            (sameProd || Math.abs(currTime - prevTime) < 2000)
          ) {
            continue;
          }
        }

        deduplicated.push(curr);
      }
      return deduplicated;
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
              placeholder="Search events, users, products, user identifiers…"
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
                <TableHead className="w-[180px] font-semibold text-center pl-6 pr-4">Time</TableHead>
                <TableHead className="font-semibold text-center px-4">Event</TableHead>
                <TableHead className="w-[180px] font-semibold text-center px-4">Visitor Auth Status</TableHead>
                <TableHead className="font-semibold text-center pl-4 pr-6">User Identifier</TableHead>
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
                  const isAuth = Boolean(r.userId);
                  const rawId = r.anonId || r.id || r.userId || "N/A";
                  const identifier = formatUserId(rawId);

                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => setSelectedDetail(r)}
                    >
                      <TableCell className="w-[180px] whitespace-nowrap text-xs text-muted-foreground font-mono text-center pl-6 pr-4">
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="text-center px-4">
                        <Badge variant="secondary" className="font-mono text-[11px] whitespace-nowrap font-normal">
                          {displayEvent}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[180px] text-center px-4">
                        {isAuth ? (
                          <Badge variant="secondary" className="text-[11px] font-normal gap-1">
                            <ShieldCheck className="h-3 w-3" /> Logged in
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[11px] text-muted-foreground font-normal gap-1">
                            <ShieldAlert className="h-3 w-3" /> Anonymous
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center py-2.5 pl-4 pr-6">
                        <Link
                          to="/users/$userId"
                          params={{ userId: identifier }}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs text-foreground hover:text-primary hover:underline bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-md border font-normal truncate max-w-[240px] inline-flex items-center gap-1.5 align-middle transition-colors"
                          title={`View profile for ${identifier}`}
                        >
                          <span className="truncate">{identifier}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
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
                            <div className="min-w-0 space-y-0.5">
                              <div className="font-semibold text-xs text-foreground truncate">
                                {item.productName}
                              </div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                {item.category} · ID: {item.productId}
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="text-base font-bold text-foreground">
                            {selectedProductInfo.productName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Category: {selectedProductInfo.category} · ID: {selectedProductInfo.productId}
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
                <div className="rounded-lg border bg-card p-3 space-y-1.5 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block tracking-wider">
                      Project & User
                    </span>
                    {selectedDetail.userId ? (
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 font-normal">
                        Logged in
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 font-normal text-muted-foreground">
                        Anonymous
                      </Badge>
                    )}
                  </div>
                  {(() => {
                    const formattedUserId = formatUserId(selectedDetail.anonId || selectedDetail.id || selectedDetail.userId);
                    return (
                      <>
                        <div className="font-semibold text-foreground font-mono text-sm truncate" title={formattedUserId}>
                          {formattedUserId}
                        </div>
                        {selectedDetail.userId && (
                          <div className="text-[10px] text-muted-foreground font-mono truncate" title={selectedDetail.userId}>
                            Contact: <span className="text-foreground">{selectedDetail.userId}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Project: {selectedDetail.projectId || selectedDetail.project || "Go_Kart"}
                        </div>
                        <div
                          className="text-[10px] font-mono text-muted-foreground truncate"
                          title={selectedDetail.ip || selectedDetail.properties?.ip || "127.0.0.1"}
                        >
                          IP: {selectedDetail.ip || selectedDetail.properties?.ip || "127.0.0.1"}
                        </div>
                        <div className="pt-1">
                          <Link
                            to="/users/$userId"
                            params={{ userId: formattedUserId }}
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                          >
                            View Customer Profile →
                          </Link>
                        </div>
                      </>
                    );
                  })()}
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
                    const p = { ...parseProps(selectedDetail.properties) };
                    if (p.isp && p.org) {
                      delete p.org;
                    }
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
                      const displayKey = key.toLowerCase() === "org" || key.toLowerCase() === "isp" ? "ISP" : key;
                      return (
                        <div
                          key={key}
                          className="flex items-start justify-between gap-4 px-3.5 py-2.5 hover:bg-muted/30 transition-colors"
                        >
                          <span className="font-mono text-muted-foreground text-[11px] font-medium shrink-0 min-w-[110px]">
                            {displayKey}
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
