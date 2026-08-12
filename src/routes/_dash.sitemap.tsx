import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { ExternalLink, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_dash/sitemap")({ component: SitemapPage });

interface SitemapEntry {
  projectId: string;
  domain: string;
  urls: string[];
  timestamp: string;
}

function SitemapPage() {
  const { activeProjectId } = useProject();
  const [sitemaps, setSitemaps] = useState<SitemapEntry[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadSitemaps = async () => {
      try {
        const response = await fetch('/api/sitemap');
        if (!response.ok) return;
        const data = await response.json();
        if (mounted && Array.isArray(data)) {
          setSitemaps(data);
        }
      } catch (err) {
        console.error('Error fetching sitemaps', err);
      }
    };
    
    loadSitemaps();
    const interval = setInterval(loadSitemaps, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Filter for active project
  const activeSitemaps = activeProjectId === 'all' 
    ? sitemaps 
    : sitemaps.filter(s => s.projectId === activeProjectId);

  // Flatten URLs
  let allUrls: { url: string; domain: string; projectId: string; timestamp: string }[] = [];
  activeSitemaps.forEach(s => {
    s.urls.forEach(url => {
      allUrls.push({ url, domain: s.domain, projectId: s.projectId, timestamp: s.timestamp });
    });
  });

  // Filter by search
  if (search.trim() !== '') {
    const q = search.toLowerCase();
    allUrls = allUrls.filter(u => u.url.toLowerCase().includes(q));
  }
  
  // Dedup just in case
  const uniqueUrls = Array.from(new Map(allUrls.map(item => [item.url, item])).values());

  const totalPages = uniqueUrls.length;
  const activeDomains = new Set(activeSitemaps.map(s => s.domain)).size;
  const latestScan = activeSitemaps.length > 0 
    ? new Date(Math.max(...activeSitemaps.map(s => new Date(s.timestamp).getTime()))).toLocaleString()
    : 'Never';

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Discovered Pages" subtitle="Automatically mapped from connected sitemaps." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Discovered Pages" value={totalPages.toLocaleString()} delta={0} hint="From sitemap.xml" />
        <KpiCard label="Connected Domains" value={activeDomains.toString()} delta={0} hint="Projects with sitemaps" />
        <KpiCard label="Last Scanned" value={latestScan} delta={0} hint="Auto-updated" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">All Pages</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search URLs..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL Path</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueUrls.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No sitemaps discovered yet. Ensure the tracker is installed and sitemap.xml exists.
                    </TableCell>
                  </TableRow>
                )}
                {uniqueUrls.map((item, i) => {
                  let path = item.url;
                  try {
                    path = new URL(item.url).pathname;
                  } catch(e) {}
                  
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-sm">{path}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[9px] px-1">{item.projectId}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.domain}</TableCell>
                      <TableCell className="text-right">
                        <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-blue-500 hover:underline">
                          Visit <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
