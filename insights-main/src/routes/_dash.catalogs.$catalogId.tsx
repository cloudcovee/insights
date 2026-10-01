import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Upload, RefreshCw, Send, Eye, Users, Package, Clock, ChevronRight, ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CsvUploadModal } from "@/components/collections/CsvUploadModal";
import { ManualAddModal } from "@/components/collections/ManualAddModal";

export const Route = createFileRoute("/_dash/catalogs/$catalogId")({
  component: CatalogPage,
});

interface Attribute {
  name: string;
  type: string;
  required: boolean;
}

interface Catalog {
  id: string;
  name: string;
  projectId: string;
  attributes: Attribute[];
}

interface CatalogItem {
  id: string;
  collectionId: string;
  projectId: string;
  batchId: string | null;
  status: "staging" | "published";
  validationStatus: "pending" | "valid" | "invalid";
  validationErrors: { field: string; message: string }[];
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function formatFullUrl(rawUrl?: unknown): string {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return "—";
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const base = "http://localhost:3000";
  return `${base}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

export function CatalogPage() {
  const { catalogId } = Route.useParams();

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [stagingItems, setStagingItems] = useState<CatalogItem[]>([]);
  const [publishedItems, setPublishedItems] = useState<CatalogItem[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedDetailItem, setSelectedDetailItem] = useState<CatalogItem | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [notAuthed, setNotAuthed] = useState(false);

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch(`/api/catalogs/${catalogId}`);
      if (res.status === 401) { setNotAuthed(true); return; }
      if (res.status === 403) { toast.error("Access denied"); return; }
      if (!res.ok) { toast.error("Catalog not found"); return; }
      setCatalog(await res.json());
    } catch {}
  }, [catalogId]);

  const fetchItems = useCallback(async () => {
    try {
      const [stagingRes, publishedRes] = await Promise.all([
        fetch(`/api/catalogs/${catalogId}/items?status=staging`),
        fetch(`/api/catalogs/${catalogId}/items?status=published`),
      ]);
      if (stagingRes.status === 401) { setNotAuthed(true); return; }
      if (stagingRes.ok) setStagingItems(await stagingRes.json());
      if (publishedRes.ok) setPublishedItems(await publishedRes.json());
    } catch {}
  }, [catalogId]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (res.ok) setEvents(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchCatalog();
    fetchItems();
    fetchEvents();
  }, [fetchCatalog, fetchItems, fetchEvents]);

  // Compute Product View Analytics per product item (View Count & Avg View Time)
  const isProductsCatalog = catalog?.name?.toLowerCase() === "products";

  const productAnalyticsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        viewedUsers: string[];
        totalViewCount: number;
        avgViewTimeFormatted: string;
        avgViewTimeMs: number;
      }
    >();
    if (!events.length) return map;

    const allItems = [...publishedItems, ...stagingItems];

    const sortedEvents = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    allItems.forEach((item) => {
      const pId = String(item.data.productId || item.data.id || "").toLowerCase().trim();
      const pName = String(item.data.name || item.data.productName || "").toLowerCase().trim();

      const userIds = new Set<string>();

      const viewEvents = sortedEvents.filter((ev) => {
        const isViewType =
          ev.event === "Product Viewed" ||
          ev.event === "View Item" ||
          (ev.event === "page_view" && (ev.url?.includes("/product/") || ev.path?.includes("/product/")));

        if (!isViewType) return false;

        const evId = String(ev.properties?.productId || ev.properties?.id || "").toLowerCase().trim();
        const evName = String(ev.properties?.productName || ev.properties?.name || "").toLowerCase().trim();
        const evUrl = String(ev.url || ev.path || ev.properties?.url || "").toLowerCase().trim();

        const matchesId = pId && evId && evId === pId;
        const matchesName = pName && evName && evName === pName;
        const matchesUrl = pId && evUrl && (evUrl === `/product/${pId}` || evUrl.endsWith(`/product/${pId}`));

        return matchesId || matchesName || matchesUrl;
      });

      const viewSessions: { user: string; startTime: number }[] = [];
      let totalDurationMs = 0;

      viewEvents.forEach((ev) => {
        const uid = ev.userId || ev.subscriberKey || ev.anonId;
        if (uid && uid !== "unknown") userIds.add(uid);

        const evTime = new Date(ev.timestamp).getTime();
        const lastSession = viewSessions[viewSessions.length - 1];

        // De-duplicate: skip if same user had a session start within 10s
        if (lastSession && lastSession.user === uid && evTime - lastSession.startTime < 10000) {
          return;
        }

        // Priority 1: use an explicit duration property logged with the event (in ms or seconds)
        const rawDuration =
          ev.properties?.duration ??
          ev.properties?.view_time ??
          ev.properties?.timeOnPage ??
          ev.duration ??
          null;

        let durationMs = 0;

        if (rawDuration !== null && rawDuration !== undefined) {
          const num = Number(rawDuration);
          if (!isNaN(num) && num > 0) {
            // Treat values < 3600 as seconds (common), >= 3600 as already ms
            durationMs = num < 3600 ? num * 1000 : num;
            // Clamp to a realistic max of 30 minutes
            durationMs = Math.min(durationMs, 1800000);
          }
        }

        // Priority 2: infer from the gap to the user's next event
        if (durationMs === 0) {
          // Only look at the same user's subsequent events, skip micro-events within 500ms
          const userEventsAfter = sortedEvents.filter((e) => {
            const eUid = e.userId || e.subscriberKey || e.anonId;
            const eTime = new Date(e.timestamp).getTime();
            return eUid === uid && eTime > evTime + 500;
          });

          if (userEventsAfter.length > 0) {
            const nextEvTime = new Date(userEventsAfter[0].timestamp).getTime();
            const diff = nextEvTime - evTime;
            // Accept gaps between 1s and 10 minutes as real dwell time
            if (diff >= 1000 && diff <= 600000) {
              durationMs = diff;
            } else {
              // Fell outside realistic bounds — use a conservative default
              durationMs = 30000;
            }
          } else {
            // No subsequent event — user probably left; assume 30s
            durationMs = 30000;
          }
        }

        totalDurationMs += durationMs;
        viewSessions.push({ user: uid, startTime: evTime });
      });

      const totalViewCount = viewSessions.length;
      const avgMs = totalViewCount > 0 ? totalDurationMs / totalViewCount : 0;

      let avgFormatted = "—";
      if (totalViewCount > 0 && avgMs > 0) {
        const totalSecs = Math.round(avgMs / 1000);
        if (totalSecs < 60) {
          avgFormatted = `${totalSecs}s`;
        } else {
          const mins = Math.floor(totalSecs / 60);
          const secs = totalSecs % 60;
          avgFormatted = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        }
      }

      map.set(item.id, {
        viewedUsers: Array.from(userIds),
        totalViewCount,
        avgViewTimeFormatted: avgFormatted,
        avgViewTimeMs: avgMs,
      });
    });

    return map;
  }, [events, publishedItems, stagingItems]);

  const totalUniqueProductViewers = useMemo(() => {
    const allUsers = new Set<string>();
    productAnalyticsMap.forEach((val) => val.viewedUsers.forEach((u) => allUsers.add(u)));
    return allUsers.size;
  }, [productAnalyticsMap]);

  const totalProductViews = useMemo(() => {
    let count = 0;
    productAnalyticsMap.forEach((val) => { count += val.totalViewCount; });
    return count;
  }, [productAnalyticsMap]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll(items: CatalogItem[]) {
    const validIds = items.filter((i) => i.validationStatus === "valid").map((i) => i.id);
    if (validIds.every((id) => selectedIds.has(id))) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        validIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        validIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function handleRevalidate() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { toast.error("Select items to re-validate"); return; }
    setValidating(true);
    try {
      const res = await fetch(`/api/catalogs/${catalogId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: ids }),
      });
      if (!res.ok) throw new Error("Validation failed");
      const { results } = await res.json();
      const valid = results.filter((r: any) => r.validationStatus === "valid").length;
      toast.success(`Re-validated ${results.length} items — ${valid} valid`);
      fetchItems();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setValidating(false);
    }
  }

  async function handlePublish() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { toast.error("Select valid staged items to publish"); return; }
    setPublishing(true);
    try {
      const res = await fetch(`/api/catalogs/${catalogId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: ids }),
      });
      if (!res.ok) throw new Error("Publish failed");
      const result = await res.json();
      if (result.rejected?.length > 0) {
        toast.warning(
          `Published ${result.published}, rejected ${result.rejected.length} (invalid or wrong project)`
        );
      } else {
        toast.success(`Published ${result.published} item${result.published !== 1 ? "s" : ""}`);
      }
      setSelectedIds(new Set());
      fetchItems();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    // Optimistically remove from local state immediately so the UI doesn't lag
    const deletedItem = [...publishedItems, ...stagingItems].find(i => i.id === itemId);
    setPublishedItems((prev) => prev.filter((i) => i.id !== itemId));
    setStagingItems((prev) => prev.filter((i) => i.id !== itemId));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    if (selectedDetailItem?.id === itemId) setSelectedDetailItem(null);

    try {
      const res = await fetch(`/api/catalogs/${catalogId}/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) {
        // Rollback on failure
        toast.error("Failed to delete item — restored");
        await fetchItems();
      } else {
        toast.success(`Deleted "${String(deletedItem?.data?.name || deletedItem?.data?.productId || itemId)}"`); 
      }
    } catch {
      toast.error("Failed to delete item — restored");
      await fetchItems();
    }
  }

  if (notAuthed) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-muted-foreground max-w-sm">
          You need to be signed in to view this catalog. Catalogs are project-scoped —
          the server derives your project from your session, not from the URL.
        </p>
        <a
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in →
        </a>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
        Loading catalog…
      </div>
    );
  }

  const validStagingCount = stagingItems.filter((i) => i.validationStatus === "valid").length;
  const selectedValidCount = stagingItems.filter(
    (i) => selectedIds.has(i.id) && i.validationStatus === "valid"
  ).length;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title={catalog.name}
        subtitle={`${catalog.attributes.length} field schema · ${publishedItems.length} active products · ${stagingItems.length} staging`}
      />

      {isProductsCatalog && (
        <div className="mb-6 grid gap-4 md:grid-cols-3 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Catalog Products</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{publishedItems.length + stagingItems.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active products in catalog</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Unique Product Viewers</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUniqueProductViewers}</div>
              <p className="text-xs text-muted-foreground mt-1">Distinct users who viewed products</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Product View Events</CardTitle>
              <Eye className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProductViews}</div>
              <p className="text-xs text-muted-foreground mt-1">Deduplicated product view sessions</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="published" className="mt-2">
        <TabsList className="mb-2">
          <TabsTrigger value="published">
            Live Product Catalog
            {publishedItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">{publishedItems.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="staging">
            Staging & Manual Import
            {stagingItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">{stagingItems.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Live Product Catalog Tab */}
        <TabsContent value="published" className="mt-2">
          <div className="overflow-x-auto rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px]">ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-[140px] text-center">Viewed</TableHead>
                  <TableHead className="w-[150px] text-center">Avg View Time</TableHead>
                  <TableHead className="w-[120px] text-right">Created</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {publishedItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-16 text-center text-sm text-muted-foreground"
                    >
                      No products found. Viewing products on your app will automatically populate them here!
                    </TableCell>
                  </TableRow>
                ) : (
                  publishedItems.map((item) => {
                    const analytics = productAnalyticsMap.get(item.id) || {
                      viewedUsers: [],
                      totalViewCount: 0,
                      avgViewTimeFormatted: "—",
                      avgViewTimeMs: 0,
                    };

                    const itemId = String(item.data.productId || item.data.id || item.id);
                    const productName = String(item.data.name || item.data.productName || item.data.title || "—");

                    return (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => setSelectedDetailItem(item)}
                      >
                        <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                          {itemId}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {productName}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-semibold gap-1 text-xs px-2 py-0.5">
                            <Eye className="h-3 w-3 text-blue-500" />
                            {analytics.totalViewCount} {analytics.totalViewCount === 1 ? "View" : "Views"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono text-xs gap-1 px-2 py-0.5">
                            <Clock className="h-3 w-3 text-green-600" />
                            {analytics.avgViewTimeFormatted}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap text-right font-mono">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Staging & Manual Import Tab */}
        <TabsContent value="staging" className="mt-2 space-y-3">
          <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Manual Schema & Staging Tools
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected · ${selectedValidCount} valid`
                  : `${stagingItems.length} items in staging · ${validStagingCount} valid, ${stagingItems.length - validStagingCount} need review`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCsvModal(true)}>
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Import CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowManualModal(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedIds.size === 0 || validating}
                onClick={handleRevalidate}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {validating ? "Re-validating…" : "Re-validate"}
              </Button>
              <Button
                size="sm"
                disabled={selectedValidCount === 0 || publishing}
                onClick={handlePublish}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {publishing ? "Publishing…" : `Publish (${selectedValidCount})`}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        validStagingCount > 0 &&
                        stagingItems
                          .filter((i) => i.validationStatus === "valid")
                          .every((i) => selectedIds.has(i.id))
                      }
                      onCheckedChange={() => toggleSelectAll(stagingItems)}
                    />
                  </TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[120px]">ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-right">Imported</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stagingItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-16 text-center text-sm text-muted-foreground"
                    >
                      No staged items. Import a CSV or add items manually if needed.
                    </TableCell>
                  </TableRow>
                ) : (
                  stagingItems.map((item) => {
                    const itemId = String(item.data.productId || item.data.id || item.id);
                    const productName = String(item.data.name || item.data.productName || item.data.title || "—");

                    return (
                      <TableRow
                        key={item.id}
                        className={`cursor-pointer hover:bg-muted/60 transition-colors ${
                          selectedIds.has(item.id) ? "bg-muted/40" : ""
                        }`}
                        onClick={() => setSelectedDetailItem(item)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            disabled={item.validationStatus !== "valid"}
                            onCheckedChange={() => toggleSelect(item.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <ValidationBadge
                            status={item.validationStatus}
                            errors={item.validationErrors}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                          {itemId}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {productName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap text-right font-mono">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Product Detail Right Sidebar Drawer */}
      <Sheet open={!!selectedDetailItem} onOpenChange={(open) => !open && setSelectedDetailItem(null)}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[540px] overflow-y-auto p-6">
          {selectedDetailItem && (
            <div className="space-y-6 pt-2">
              <SheetHeader className="text-left border-b pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant="outline" className="mb-1 text-[11px] font-mono">
                      {String(selectedDetailItem.data.productId || selectedDetailItem.id)}
                    </Badge>
                    <SheetTitle className="text-xl font-bold">
                      {String(selectedDetailItem.data.name || selectedDetailItem.data.productName || "Product Details")}
                    </SheetTitle>
                    {Boolean(selectedDetailItem.data.category) && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                        {String(selectedDetailItem.data.category)}
                      </p>
                    )}
                  </div>
                  <Badge variant={selectedDetailItem.status === "published" ? "default" : "secondary"}>
                    {selectedDetailItem.status}
                  </Badge>
                </div>
              </SheetHeader>

              {/* Product Image */}
              {(selectedDetailItem.data.imageUrl || selectedDetailItem.data.image) && (
                <div className="rounded-xl border bg-muted/20 p-3 flex justify-center items-center shadow-xs">
                  <img
                    src={String(selectedDetailItem.data.imageUrl || selectedDetailItem.data.image)}
                    alt={String(selectedDetailItem.data.name || "Product")}
                    className="max-h-60 w-auto object-contain rounded-lg border bg-white"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Product Analytics / Engagement KPI Summary */}
              {(() => {
                const analytics = productAnalyticsMap.get(selectedDetailItem.id) || {
                  viewedUsers: [],
                  totalViewCount: 0,
                  avgViewTimeFormatted: "—",
                };
                return (
                  <div className="grid grid-cols-2 gap-3 p-3.5 bg-muted/30 rounded-xl border">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Total Product Views
                      </span>
                      <div className="text-xl font-bold flex items-center gap-1.5 mt-1 text-foreground">
                        <Eye className="h-4 w-4 text-blue-500" />
                        {analytics.totalViewCount}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Avg View Time
                      </span>
                      <div className="text-xl font-bold flex items-center gap-1.5 mt-1 text-foreground">
                        <Clock className="h-4 w-4 text-green-600" />
                        {analytics.avgViewTimeFormatted}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* All Product Attributes */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Product Attributes & Schema Data
                </h4>
                <div className="rounded-xl border divide-y bg-card text-sm">
                  {Object.entries(selectedDetailItem.data).map(([key, value]) => {
                    const isUrl = key.toLowerCase() === "url";
                    const formattedUrl = isUrl ? formatFullUrl(value) : null;

                    return (
                      <div key={key} className="flex justify-between items-center py-2.5 px-3.5">
                        <span className="font-semibold text-xs text-muted-foreground">{key}</span>
                        {isUrl && formattedUrl ? (
                          <a
                            href={formattedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs text-primary hover:underline flex items-center gap-1 truncate max-w-[300px]"
                            title={formattedUrl}
                          >
                            <span className="truncate">{formattedUrl}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="font-mono text-xs max-w-[280px] truncate text-right text-foreground">
                            {key === "price" && !isNaN(Number(value))
                              ? `$${Number(value).toLocaleString()}`
                              : String(value ?? "—")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Viewed By User IDs */}
              {(() => {
                const analytics = productAnalyticsMap.get(selectedDetailItem.id);
                if (!analytics || analytics.viewedUsers.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Viewed By ({analytics.viewedUsers.length} Unique Users)
                    </h4>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 border rounded-xl bg-card">
                      {analytics.viewedUsers.map((uid, idx) => (
                        <Link
                          key={idx}
                          to="/users/$userId"
                          params={{ userId: uid }}
                          className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2 py-1 font-mono text-xs hover:bg-muted text-foreground transition-colors"
                          title={uid}
                        >
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[140px]">{uid}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Item Metadata Footer & Delete */}
              <div className="pt-4 border-t flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  <p>Created: {new Date(selectedDetailItem.createdAt).toLocaleString()}</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteItem(selectedDetailItem.id)}
                >
                  Delete Item
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CsvUploadModal
        collectionId={catalogId}
        collectionName={catalog.name}
        open={showCsvModal}
        onOpenChange={setShowCsvModal}
        onImported={() => fetchItems()}
      />

      <ManualAddModal
        collectionId={catalogId}
        collectionName={catalog.name}
        attributes={catalog.attributes}
        open={showManualModal}
        onOpenChange={setShowManualModal}
        onImported={() => fetchItems()}
      />
    </div>
  );
}

function ValidationBadge({
  status,
  errors,
}: {
  status: string;
  errors: { field: string; message: string }[];
}) {
  if (status === "valid")
    return <Badge className="bg-green-500/15 text-green-700 border-green-500/30 text-[11px]">Valid</Badge>;
  if (status === "invalid")
    return (
      <div className="space-y-0.5">
        <Badge variant="destructive" className="text-[11px]">Invalid</Badge>
        {errors.map((e, i) => (
          <div key={i} className="text-[10px] text-destructive leading-snug">
            {e.field}: {e.message}
          </div>
        ))}
      </div>
    );
  return <Badge variant="outline" className="text-muted-foreground text-[11px]">Pending</Badge>;
}
