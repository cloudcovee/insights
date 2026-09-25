import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  User,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Monitor,
  Activity,
  Calendar,
  Layers,
  ShoppingBag,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Code,
  Info,
  Package,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProject } from "@/lib/project-context";
import { formatUserId } from "@/lib/utils";
import {
  parseProps,
  getDisplayEventName,
  getEventTitle,
  resolveProductDetails,
  deduplicateEvents
} from "@/lib/event-utils";

export const Route = createFileRoute("/_dash/users_/$userId")({
  component: UserProfilePage,
});

function UserProfilePage() {
  const { userId } = Route.useParams();
  const { activeProjectId } = useProject();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const handleCopyPayload = (payload: any, eventId: string) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedEventId(eventId);
    toast.success("Event payload copied to clipboard");
    setTimeout(() => {
      setCopiedEventId(null);
    }, 2000);
  };

  useEffect(() => {
    let mounted = true;
    const fetchEvents = async () => {
      try {
        const res = await fetch("/api/events");
        if (!res.ok) return;
        const allEvents = await res.json();
        if (!mounted || !Array.isArray(allEvents)) return;

        // Decode URL-encoded userId if needed
        const decodedUserId = decodeURIComponent(userId);
        const formattedParam = formatUserId(decodedUserId);
        const idLower = decodedUserId.toLowerCase();

        // 1. Identify target subscriberKey or profileId across all events
        let targetKey: string | undefined;
        for (const e of allEvents) {
          const eFormattedAnon = e.anonId ? formatUserId(e.anonId) : null;
          const eFormattedUser = e.userId ? formatUserId(e.userId) : null;
          const eSub = e.subscriberKey?.toLowerCase();

          if (
            (eSub && eSub === idLower) ||
            (e.profileId && e.profileId.toLowerCase() === idLower) ||
            (e.userId && e.userId.toLowerCase() === idLower) ||
            (e.anonId && (e.anonId.toLowerCase() === idLower || eFormattedAnon === decodedUserId || eFormattedAnon === formattedParam)) ||
            (eFormattedUser && (eFormattedUser === decodedUserId || eFormattedUser === formattedParam))
          ) {
            targetKey = e.subscriberKey || e.profileId;
            if (targetKey) break;
          }
        }

        // 2. Filter events belonging to this profile
        const targetKeyLower = targetKey?.toLowerCase();
        const matched = allEvents.filter((e: any) => {
          let matchUser = false;
          if (targetKeyLower && (
            (e.subscriberKey && e.subscriberKey.toLowerCase() === targetKeyLower) ||
            (e.profileId && e.profileId.toLowerCase() === targetKeyLower)
          )) {
            matchUser = true;
          } else {
            const eFormattedAnon = e.anonId ? formatUserId(e.anonId) : null;
            const eFormattedUser = e.userId ? formatUserId(e.userId) : null;

            matchUser =
              (e.subscriberKey && e.subscriberKey.toLowerCase() === idLower) ||
              (e.profileId && e.profileId.toLowerCase() === idLower) ||
              e.userId === decodedUserId ||
              e.anonId === decodedUserId ||
              (eFormattedAnon && (eFormattedAnon === decodedUserId || eFormattedAnon === formattedParam)) ||
              (eFormattedUser && (eFormattedUser === decodedUserId || eFormattedUser === formattedParam)) ||
              e.id === decodedUserId ||
              e.properties?.userId === decodedUserId ||
              e.properties?.email === decodedUserId;
          }

          if (activeProjectId === "all") return matchUser;
          return matchUser && (e.projectId === activeProjectId || e.project === activeProjectId);
        });

        matched.sort(
          (a: any, b: any) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Deduplicate consecutive events within 2s and auto-tracked clicks
        const deduped = deduplicateEvents(matched);
        setEvents(deduped);
      } catch (err) {
        console.error("Error fetching user events:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [userId, activeProjectId]);

  const profile = useMemo(() => {
    const decodedUserId = decodeURIComponent(userId);

    if (events.length === 0) {
      const isEmail = decodedUserId.includes("@");
      const formatted = formatUserId(decodedUserId);
      return {
        id: formatted,
        rawId: decodedUserId,
        formattedUserId: formatted,
        userEmail: isEmail ? decodedUserId : null,
        subscriberKey: isEmail ? decodedUserId : null,
        profileId: decodedUserId.startsWith("prof_") ? decodedUserId : null,
        connectedDevicesCount: 0,
        connectedAnonIds: [],
        isLoggedIn: isEmail,
        firstSeen: null,
        lastSeen: null,
        totalEvents: 0,
        sessionsCount: 0,
        country: "Unknown",
        city: "",
        region: "",
        isp: "",
        ip: "—",
        browser: "Unknown",
        os: "Unknown",
        device: "Desktop",
        affinities: [],
        topProducts: [],
      };
    }

    const firstSeen = events[events.length - 1]?.timestamp;
    const lastSeen = events[0]?.timestamp;

    // Determine auth status and subscriberKey
    const firstSubEvent = events.find((e) => Boolean(e.subscriberKey && !e.subscriberKey.startsWith("anon_")));
    const isAuth = Boolean(firstSubEvent);
    const subscriberKey = firstSubEvent?.subscriberKey || firstSubEvent?.userId || (!decodedUserId.includes("@") && decodedUserId.startsWith("003") ? decodedUserId : null);
    const firstAnonEvent = events.find((e) => Boolean(e.anonId));
    const rawAnonId = firstAnonEvent?.anonId || (decodedUserId.startsWith("anon_") ? decodedUserId.replace("anon_", "") : decodedUserId);
    const formattedAnonId = formatUserId(rawAnonId);

    // Connected anonymous devices for this profile
    const connectedAnonIds = Array.from(new Set(events.map((e) => e.anonId ? formatUserId(e.anonId) : null).filter(Boolean)));

    const profileId = subscriberKey || `anon_${formattedAnonId}`;
    const emailProp = events.find((e) => Boolean(e.properties?.email || parseProps(e.properties).email));
    const userEmail = emailProp ? (emailProp.properties?.email || parseProps(emailProp.properties).email) : (decodedUserId.includes("@") ? decodedUserId : null);

    // Primary User ID: SubscriberKey if identified, otherwise 15-char formatted identifier
    const formattedId = isAuth && subscriberKey ? subscriberKey : formattedAnonId;
    const rawDeviceOrId = isAuth && subscriberKey ? subscriberKey : formattedAnonId;

    // Tech and Geolocation from the latest event with info
    const latestWithGeo = events.find((e) => e.properties?.city || e.country || e.ip);
    const latestProps = parseProps(latestWithGeo?.properties);

    const country = latestWithGeo?.country || latestProps.country || "Unknown";
    const city = latestProps.city || "";
    const region = latestProps.region || "";
    const isp = latestProps.isp || latestProps.org || "";
    const ip = latestWithGeo?.ip || latestProps.ip || "127.0.0.1";

    const browser =
      typeof events[0]?.browser === "object"
        ? events[0]?.browser?.name
        : events[0]?.browser || "Chrome";
    const os = events[0]?.os || "Windows";
    const device =
      typeof events[0]?.device === "object"
        ? events[0]?.device?.type
        : events[0]?.device || "Desktop";

    // Calculate Category & Product Affinities (SFMC Personalization style)
    const categoryCount: Record<string, number> = {};
    const productCount: Record<string, { count: number; name: string; price?: string | number; imageUrl?: string; category?: string; productId?: string }> = {};

    events.forEach((e) => {
      const p = parseProps(e.properties);
      const prodInfo = resolveProductDetails(e, events);
      const cat = p.category || prodInfo?.category;
      if (cat) {
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      }
      const prodName = p.productName || prodInfo?.productName;
      const prodId = p.productId || prodInfo?.productId;
      const prodImg = p.imageUrl || prodInfo?.imageUrl;
      if (prodName || prodId) {
        const key = prodName || prodId;
        if (!productCount[key]) {
          productCount[key] = {
            count: 0,
            name: prodName || prodId,
            productId: prodId,
            price: p.price || prodInfo?.price,
            imageUrl: prodImg,
            category: cat
          };
        } else if (!productCount[key].imageUrl && prodImg) {
          productCount[key].imageUrl = prodImg;
        }
        productCount[key].count += 1;
      }
    });

    const affinities = Object.entries(categoryCount)
      .map(([cat, count]) => ({
        category: cat,
        count,
        percentage: Math.round((count / events.length) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const topProducts = Object.values(productCount).sort((a, b) => b.count - a.count);

    return {
      id: formattedId,
      rawId: rawDeviceOrId,
      formattedUserId: formattedId,
      userEmail: userEmail,
      subscriberKey,
      profileId,
      connectedDevicesCount: connectedAnonIds.length,
      connectedAnonIds,
      isLoggedIn: isAuth,
      firstSeen,
      lastSeen,
      totalEvents: events.length,
      sessionsCount: Math.max(1, Math.ceil(events.length / 5)), // estimated sessions
      country,
      city,
      region,
      isp,
      ip,
      browser,
      os,
      device,
      affinities,
      topProducts,
    };
  }, [events, userId]);

  const copyId = () => {
    navigator.clipboard.writeText(profile.formattedUserId || profile.id).catch(() => {});
    setCopied(true);
    toast.success("User ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      {/* Back navigation & Page Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/users"
          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Link>
        <span>/</span>
        <Link
          to="/events"
          className="hover:text-foreground transition-colors"
        >
          Events Stream
        </Link>
      </div>

      {/* Unified Customer Profile Identity Header */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg border border-primary/20">
              <User className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                  {profile.formattedUserId}
                </h1>
                {profile.isLoggedIn ? (
                  <Badge variant="secondary" className="gap-1 text-xs font-normal">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Logged In
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-xs text-muted-foreground font-normal">
                    <ShieldAlert className="h-3.5 w-3.5" /> Anonymous
                  </Badge>
                )}
                {profile.connectedDevicesCount > 1 && (
                  <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                    <Monitor className="h-3.5 w-3.5" /> {profile.connectedDevicesCount} Linked Devices
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {profile.isLoggedIn && profile.subscriberKey ? (
                  <>
                    <span>
                      Subscriber Key: <strong className="text-foreground font-mono">{profile.subscriberKey}</strong>
                    </span>
                    <span>·</span>
                  </>
                ) : (
                  <>
                    <span>
                      Anonymous ID: <strong className="text-foreground font-mono">{profile.formattedUserId}</strong>
                    </span>
                    <span>·</span>
                  </>
                )}
                {profile.userEmail && profile.userEmail !== profile.subscriberKey && (
                  <>
                    <span>
                      Contact Email: <strong className="text-foreground font-mono">{profile.userEmail}</strong>
                    </span>
                    <span>·</span>
                  </>
                )}
                <span>Active Project: <strong className="text-foreground">{activeProjectId}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button variant="outline" size="sm" onClick={copyId}>
              {copied ? <Check className="h-4 w-4 text-emerald-600 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
              {profile.isLoggedIn ? "Copy Subscriber Key" : "Copy Anonymous ID"}
            </Button>
          </div>
        </div>
      </div>

      {/* 4-KPI Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Events
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {profile.totalEvents.toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Recorded interactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Auth Status
            </CardTitle>
            {profile.isLoggedIn ? (
              <ShieldCheck className="h-4 w-4 text-foreground" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {profile.isLoggedIn ? "Authenticated" : "Anonymous Visitor"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate" title={profile.userEmail || "Unidentified device session"}>
              {profile.userEmail ? `Contact: ${profile.userEmail}` : "Unidentified device session"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Location & ISP
            </CardTitle>
            <Globe className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold truncate">
              {profile.city ? `${profile.city}, ` : ""}{profile.country}
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-1" title={profile.isp || profile.ip}>
              {profile.isp ? profile.isp : `IP: ${profile.ip}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Last Seen
            </CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold truncate">
              {profile.lastSeen ? new Date(profile.lastSeen).toLocaleTimeString() : "Never"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {profile.lastSeen ? new Date(profile.lastSeen).toLocaleDateString() : "No history"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Activity Timeline, Affinities, Technical Details */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">
            Activity Stream
            <Badge variant="secondary" className="ml-2 text-xs">{events.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="affinities">
            Affinities & Categories
            {profile.affinities.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{profile.affinities.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="technical">Technical & Device</TabsTrigger>
        </TabsList>

        {/* Tab 1: Real-Time Activity Timeline */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event Stream History</CardTitle>
              <CardDescription>
                Chronological timeline of all interactions captured for this customer.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {events.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  No activity captured for this user yet.
                </div>
              ) : (
                <div className="divide-y">
                  {events.map((e) => {
                    const props = parseProps(e.properties);
                    const isExpanded = expandedEventId === e.id;
                    const displayEventName = getDisplayEventName(e);
                    const eventTitle = getEventTitle(e, events);
                    const productDetails = resolveProductDetails(e, events);

                    const accuratePayload = {
                      id: e.id,
                      event: e.event,
                      displayEvent: displayEventName,
                      timestamp: e.timestamp,
                      projectId: e.projectId || e.project || "default",
                      ...(e.subscriberKey ? { subscriberKey: e.subscriberKey } : {}),
                      ...(e.userId ? { userId: e.userId } : {}),
                      ...(e.anonId ? { anonId: e.anonId } : {}),
                      ...(e.profileId ? { profileId: e.profileId } : {}),
                      ...(e.path || props.path ? { path: e.path || props.path } : {}),
                      ...(e.url || props.url ? { url: e.url || props.url } : {}),
                      device: typeof e.device === "object" ? e.device?.type || "Desktop" : e.device || props.device || "Desktop",
                      browser: typeof e.browser === "object" ? e.browser?.name || "Chrome" : e.browser || props.browser || "Chrome",
                      os: e.os || props.os || "Windows",
                      ip: e.ip || props.ip || "127.0.0.1",
                      country: e.country || props.country || "Unknown",
                      ...(props.city || e.city ? { city: props.city || e.city } : {}),
                      ...(props.region || e.region ? { region: props.region || e.region } : {}),
                      properties: props,
                      ...(productDetails ? { productDetails } : {})
                    };

                    return (
                      <div key={e.id} className="p-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                              <Activity className="h-3.5 w-3.5" />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="font-mono text-[11px] font-medium">
                                  {displayEventName}
                                </Badge>
                                <span className="text-sm font-medium text-foreground truncate">
                                  {eventTitle}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono flex-wrap">
                                <span>{new Date(e.timestamp).toLocaleString()}</span>
                                <span>·</span>
                                <span>Project: {e.projectId || e.project || "default"}</span>
                                {accuratePayload.ip && (
                                  <>
                                    <span>·</span>
                                    <span>IP: {accuratePayload.ip}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 text-muted-foreground shrink-0"
                            onClick={() =>
                              setExpandedEventId(isExpanded ? null : e.id)
                            }
                          >
                            {isExpanded ? (
                              <>
                                Hide Payload <ChevronDown className="ml-1 h-3.5 w-3.5" />
                              </>
                            ) : (
                              <>
                                View Payload <ChevronRight className="ml-1 h-3.5 w-3.5" />
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Expandable Accurate Payload Section */}
                        {isExpanded && (
                          <div className="mt-4 rounded-lg border bg-card p-4 space-y-4 text-xs shadow-sm">
                            <div className="flex items-center justify-between border-b pb-3">
                              <div className="flex items-center gap-2">
                                <Code className="h-4 w-4 text-primary" />
                                <span className="font-semibold text-foreground text-xs uppercase tracking-wider">
                                  Event Payload
                                </span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1.5"
                                onClick={() => handleCopyPayload(accuratePayload, e.id)}
                              >
                                {copiedEventId === e.id ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-500" /> Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" /> Copy JSON
                                  </>
                                )}
                              </Button>
                            </div>

                            {/* Product / Purchase / Cart Breakdown Card if available */}
                            {productDetails && (
                              <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    {productDetails.type === "purchase"
                                      ? "PURCHASE & ORDER BREAKDOWN"
                                      : productDetails.type === "cart"
                                      ? "CART & PRODUCT DETAILS"
                                      : "PRODUCT INFORMATION"}
                                  </span>
                                  <Badge variant="secondary" className="text-[10px] font-mono">
                                    {productDetails.status}
                                  </Badge>
                                </div>

                                {productDetails.type === "purchase" && Array.isArray(productDetails.items) ? (
                                  <div className="space-y-2.5">
                                    <div className="rounded border bg-background divide-y divide-border/60 overflow-hidden">
                                      {productDetails.items.map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-2.5 gap-2">
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            {item.imageUrl ? (
                                              <img
                                                src={item.imageUrl}
                                                alt={item.productName}
                                                className="h-8 w-8 rounded-md object-cover border bg-muted shadow-xs shrink-0"
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                              />
                                            ) : (
                                              <div className="h-8 w-8 rounded-md border bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                                <Package className="h-3.5 w-3.5" />
                                              </div>
                                            )}
                                            <div className="min-w-0">
                                              <div className="font-medium text-xs text-foreground truncate">
                                                {item.productName}
                                              </div>
                                              <div className="text-[10px] text-muted-foreground font-mono">
                                                {item.category} · ID: {item.productId}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <div className="font-bold text-xs font-mono text-foreground">
                                              ${item.subtotal.toLocaleString()}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground font-mono">
                                              ${item.price.toLocaleString()} × {item.quantity}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                      <div className="rounded bg-background p-2 border">
                                        <span className="text-muted-foreground block text-[10px]">Total Items</span>
                                        <span className="font-medium text-xs text-foreground block">
                                          {productDetails.totalUnits} units ({productDetails.itemCount} items)
                                        </span>
                                      </div>
                                      <div className="rounded bg-background p-2 border">
                                        <span className="text-muted-foreground block text-[10px]">Grand Total</span>
                                        <span className="font-bold text-xs text-foreground block font-mono">
                                          ${productDetails.grandTotal.toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="rounded bg-background p-2 border">
                                        <span className="text-muted-foreground block text-[10px]">Discount</span>
                                        <span className="font-medium text-xs text-foreground truncate block">
                                          {productDetails.discount}
                                        </span>
                                      </div>
                                      <div className="rounded bg-background p-2 border">
                                        <span className="text-muted-foreground block text-[10px]">Shipping</span>
                                        <span className="font-medium text-xs text-foreground truncate block">
                                          {productDetails.shipping}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        {productDetails.imageUrl ? (
                                          <img
                                            src={productDetails.imageUrl}
                                            alt={productDetails.productName}
                                            className="h-10 w-10 rounded-md object-cover border bg-muted shadow-xs shrink-0"
                                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                          />
                                        ) : (
                                          <div className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                            <Package className="h-4 w-4" />
                                          </div>
                                        )}
                                        <div className="min-w-0">
                                          <div className="font-semibold text-xs text-foreground truncate">
                                            {productDetails.productName}
                                          </div>
                                          <div className="text-[11px] text-muted-foreground">
                                            Category: {productDetails.category} · ID: {productDetails.productId}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-bold text-xs text-foreground font-mono">
                                          ${productDetails.subtotal?.toLocaleString() || productDetails.price?.toLocaleString()}
                                        </div>
                                        {productDetails.quantity && (
                                          <div className="text-[10px] text-muted-foreground font-mono">
                                            ${productDetails.price?.toLocaleString()} × {productDetails.quantity}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Identity, Context & Tech Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                              <div className="rounded border bg-muted/20 p-2.5 space-y-1">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold block tracking-wider">
                                  Identity & Session
                                </span>
                                <div className="text-[11px] font-mono text-foreground truncate" title={e.subscriberKey || "None"}>
                                  SubKey: {e.subscriberKey || "—"}
                                </div>
                                <div className="text-[11px] font-mono text-muted-foreground truncate" title={e.anonId ? formatUserId(e.anonId) : "—"}>
                                  Anon ID: {e.anonId ? formatUserId(e.anonId) : "—"}
                                </div>
                                <div className="text-[11px] font-mono text-muted-foreground truncate" title={e.userId || "—"}>
                                  User ID: {e.userId || "—"}
                                </div>
                              </div>

                              <div className="rounded border bg-muted/20 p-2.5 space-y-1">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold block tracking-wider">
                                  Device & Client
                                </span>
                                <div className="text-[11px] text-foreground truncate">
                                  {accuratePayload.browser} on {accuratePayload.os}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  Device: {accuratePayload.device}
                                </div>
                                <div className="text-[11px] font-mono text-muted-foreground truncate">
                                  IP: {accuratePayload.ip}
                                </div>
                              </div>

                              <div className="rounded border bg-muted/20 p-2.5 space-y-1">
                                <span className="text-[10px] text-muted-foreground uppercase font-semibold block tracking-wider">
                                  Location & Route
                                </span>
                                <div className="text-[11px] text-foreground truncate">
                                  {[accuratePayload.city, accuratePayload.region, accuratePayload.country !== "Unknown" ? accuratePayload.country : null].filter(Boolean).join(", ") || "Unknown"}
                                </div>
                                <div className="text-[11px] font-mono text-muted-foreground truncate" title={accuratePayload.path || accuratePayload.url || "/"}>
                                  Path: {accuratePayload.path || accuratePayload.url || "/"}
                                </div>
                              </div>
                            </div>

                            {/* Properties Table */}
                            {Object.keys(props).length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                  Event Properties ({Object.keys(props).length})
                                </span>
                                <div className="rounded border bg-card/60 divide-y divide-border/60 max-h-48 overflow-y-auto">
                                  {Object.entries(props)
                                    .filter(([_, val]) => val !== undefined && val !== null && val !== "")
                                    .map(([k, val]) => (
                                      <div key={k} className="flex items-start justify-between gap-2 px-3 py-1.5 text-[11px]">
                                        <span className="font-mono text-muted-foreground font-medium shrink-0">
                                          {k}
                                        </span>
                                        <span className="font-mono text-foreground text-right break-all">
                                          {typeof val === "object" ? JSON.stringify(val) : String(val)}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* JSON Payload */}
                            <div className="space-y-1">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                                JSON Payload
                              </span>
                              <div className="rounded-md border bg-muted/40 p-3 font-mono overflow-x-auto">
                                <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap">
                                  {JSON.stringify(accuratePayload, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Affinities & Categories */}
        <TabsContent value="affinities" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Affinities */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Category Affinities
                </CardTitle>
                <CardDescription>
                  Calculated interest weights based on browsing and catalog engagement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profile.affinities.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-4 text-center">
                    No catalog category interactions recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {profile.affinities.map((aff) => (
                      <div key={aff.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{aff.category}</span>
                          <span className="text-muted-foreground font-mono">
                            {aff.count} views ({aff.percentage}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, aff.percentage * 1.5)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Products Viewed */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" /> Products Viewed
                </CardTitle>
                <CardDescription>
                  Specific catalog items this customer evaluated.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profile.topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-4 text-center">
                    No product interactions recorded yet.
                  </p>
                ) : (
                  <div className="divide-y">
                    {profile.topProducts.map((prod) => (
                      <div key={prod.name} className="py-2.5 flex items-center justify-between text-xs gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {prod.imageUrl ? (
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="h-9 w-9 rounded-md object-cover border bg-muted shadow-xs shrink-0"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-md border bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                              <Package className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">{prod.name}</div>
                            <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                              {prod.category && <span>{prod.category}</span>}
                              {prod.price && <span>· ${prod.price}</span>}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {prod.count} interaction{prod.count > 1 ? "s" : ""}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: Technical & Device Breakdown */}
        <TabsContent value="technical" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="h-4 w-4" /> Device & Network Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Browser & OS
                  </span>
                  <div className="font-medium text-foreground text-sm">
                    {profile.browser} on {profile.os}
                  </div>
                </div>

                <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Device Type
                  </span>
                  <div className="font-medium text-foreground text-sm">
                    {profile.device}
                  </div>
                </div>

                <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    IP Address
                  </span>
                  <div className="font-medium text-foreground text-sm font-mono">
                    {profile.ip}
                  </div>
                </div>

                <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    ISP / ASN Network
                  </span>
                  <div className="font-medium text-foreground text-sm">
                    {profile.isp || "Unknown ISP"}
                  </div>
                </div>

                <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Location
                  </span>
                  <div className="font-medium text-foreground text-sm">
                    {[profile.city, profile.region, profile.country].filter(Boolean).join(", ") || "Unknown"}
                  </div>
                </div>

                <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    First Tracked
                  </span>
                  <div className="font-medium text-foreground text-sm font-mono">
                    {profile.firstSeen ? new Date(profile.firstSeen).toLocaleDateString() : "—"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
