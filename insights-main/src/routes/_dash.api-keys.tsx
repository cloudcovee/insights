import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_dash/api-keys")({ component: ApiKeysPage });

function ApiKeysPage() {
  const [publicKey, setPublicKey] = useState("pk_live_9zxQaR2mVpLcT8kNb3Yf");
  const [secretKey, setSecretKey] = useState("sk_live_4wJdE7bT6yUqXmH1oZgV");
  const [showSecret, setShowSecret] = useState(false);

  const copy = (v: string) => {
    navigator.clipboard.writeText(v).catch(() => {});
    toast.success("Copied to clipboard");
  };

  const regen = (which: "public" | "secret") => {
    const key = which === "public" ? "pk_live_" : "sk_live_";
    const rand = Array.from({ length: 20 }).map(() => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
    if (which === "public") setPublicKey(key + rand);
    else setSecretKey(key + rand);
    toast.success(`${which === "public" ? "Public" : "Secret"} key regenerated`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="API Keys"
        subtitle="Use these keys to send events from your applications. Never share your secret key."
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Public key</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Safe to include in client-side code.</p>
          </div>
          <Badge variant="secondary">Client</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={publicKey} className="font-mono" />
            <Button variant="outline" onClick={() => copy(publicKey)}><Copy className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => regen("public")}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Secret key</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Server-side only. Keep in a secret manager.</p>
          </div>
          <Badge variant="outline" className="border-destructive/40 text-destructive">Server</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly type={showSecret ? "text" : "password"} value={secretKey} className="font-mono" />
            <Button variant="outline" onClick={() => setShowSecret((v) => !v)}>
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="outline" onClick={() => copy(secretKey)}><Copy className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={() => regen("secret")}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Install the SDK</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">1. Install</Label>
            <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs">
{`npm install @lumen/analytics`}
            </pre>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">2. Initialize</Label>
            <pre className="mt-2 overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs">
{`import { Lumen } from '@lumen/analytics'

const lumen = new Lumen({ publicKey: '${publicKey}' })

lumen.track('page_view', { path: window.location.pathname })`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
