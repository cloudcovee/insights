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
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProject } from "@/lib/project-context";
import { formatUserId } from "@/lib/utils";

export const Route = createFileRoute("/_dash/users_/$userId")({
  component: UserProfilePage,
});

function parseProps(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, any>;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

function UserProfilePage() {
  const { userId } = Route.useParams();
  const { activeProjectId } = useProject();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

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

        // Filter events belonging to this user
        const matched = allEvents.filter((e: any) => {
          const eFormattedAnon = e.anonId ? formatUserId(e.anonId) : null;
          const eFormattedUser = e.userId ? formatUserId(e.userId) : null;

          const matchUser =
            e.userId === decodedUserId ||
            e.anonId === decodedUserId ||
            e.id === decodedUserId ||
            e.properties?.userId === decodedUserId ||
            e.properties?.email === decodedUserId ||
            (eFormattedAnon && (eFormattedAnon === decodedUserId || eFormattedAnon === formattedParam)) ||
            (eFormattedUser && (eFormattedUser === decodedUserId || eFormattedUser === formattedParam));

          if (activeProjectId === "all") return matchUser;
          return matchUser && (e.projectId === activeProjectId || e.project === activeProjectId);
        });

        matched.sort(
          (a: any, b: any) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        setEvents(matched);
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

    // Determine auth status and contact email
    const loggedInEvent = events.find((e) => Boolean(e.userId));
    const isAuth = Boolean(loggedInEvent);
    const userEmail = loggedInEvent?.userId || (decodedUserId.includes("@") ? decodedUserId : null);

    // Primary User ID: ALWAYS the 15-char formatted identifier (e.g. "98f15-8163-2fd3")
    const rawDeviceOrId = events.find((e) => Boolean(e.anonId))?.anonId || events[0]?.anonId || events[0]?.id || decodedUserId;
    const formattedId = formatUserId(rawDeviceOrId);

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

    // Calculate Category & Product Affinities
    const categoryCount: Record<string, number> = {};
    const productCount: Record<string, { count: number; name: string; price?: string }> = {};

    events.forEach((e) => {
      const p = parseProps(e.properties);
      if (p.category) {
        categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
      }
      if (p.productName || p.productId) {
        const key = p.productName || p.productId;
        if (!productCount[key]) {
          productCount[key] = { count: 0, name: p.productName || p.productId, price: p.price };
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
                    <ShieldCheck className="h-3.5 w-3.5" /> Logged In
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-xs text-muted-foreground font-normal">
                    <ShieldAlert className="h-3.5 w-3.5" /> Anonymous
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {profile.userEmail && (
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
              Copy User ID
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
                    const eventTitle =
                      e.event === "page_view"
                        ? `Viewed ${props.path || props.url || "/"}`
                        : props.productName
                        ? `${e.event}: ${props.productName}`
                        : e.event;

                    return (
                      <div key={e.id} className="p-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                              <Activity className="h-3.5 w-3.5" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="font-mono text-[11px]">
                                  {e.event}
                                </Badge>
                                <span className="text-sm font-medium text-foreground">
                                  {eventTitle}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                                <span>{new Date(e.timestamp).toLocaleString()}</span>
                                <span>·</span>
                                <span>Project: {e.projectId || "default"}</span>
                                {props.ip && (
                                  <>
                                    <span>·</span>
                                    <span>IP: {props.ip}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 text-muted-foreground"
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

                        {/* Expandable JSON Properties */}
                        {isExpanded && (
                          <div className="mt-3 rounded-md border bg-muted/40 p-3 text-xs font-mono overflow-x-auto">
                            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap">
                              {JSON.stringify(props, null, 2)}
                            </pre>
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
                      <div key={prod.name} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-medium text-foreground">{prod.name}</div>
                          {prod.price && (
                            <div className="text-[11px] text-muted-foreground font-mono">
                              Price: ${prod.price}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
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
