import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Code2, KeyRound, Package, Zap } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_dash/documentation")({ component: DocsPage });

const guides = [
  { icon: KeyRound, title: "Quickstart", desc: "Install the SDK and send your first event in 2 minutes." },
  { icon: Zap, title: "Event tracking", desc: "Autocapture, custom events, and typed schemas." },
  { icon: Code2, title: "SDK reference", desc: "Web, iOS, Android, Node, Python, Go, and Ruby." },
  { icon: Package, title: "Server APIs", desc: "Ingest, export, and manage projects programmatically." },
];

function DocsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Documentation"
        subtitle="Everything you need to build with Lumen."
        actions={
          <Button variant="outline">
            <BookOpen className="mr-2 h-4 w-4" /> Open full docs
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {guides.map((g) => (
          <Card key={g.title} className="transition-shadow hover:shadow-sm">
            <CardHeader>
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <g.icon className="h-4 w-4" />
              </div>
              <CardTitle className="mt-3 text-base">{g.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{g.desc}</p>
              <Button variant="link" className="mt-2 h-auto p-0 text-sm">Read guide →</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Send your first event</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs text-muted-foreground whitespace-pre-wrap">
{`<!-- Add this snippet to the <head> of your website -->
<script>
  window.insightq = window.insightq || [];
  function insight() { window.insightq.push(arguments); }
  
  // Initialize tracker with your API Key
  insight('init', { 
    apiKey: 'YOUR_API_KEY', 
    endpoint: 'https://api.yourdomain.com' 
  });
  
  // Track page views
  insight('page');
</script>
<!-- Load the analytics script asynchronously -->
<script async src="https://your-domain.com/path-to/insight-tag.js"></script>`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
