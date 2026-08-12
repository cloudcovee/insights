import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_dash/settings")({ component: SettingsPage });

const members = [
  { name: "Ada Kohli", email: "ada@acme.io", role: "Owner" },
  { name: "Blake Ng", email: "blake@acme.io", role: "Admin" },
  { name: "Casey Silva", email: "casey@acme.io", role: "Member" },
  { name: "Dara Meyer", email: "dara@acme.io", role: "Member" },
];

function SettingsPage() {
  const [crmUrl, setCrmUrl] = useState("");
  const [crmKey, setCrmKey] = useState("");

  useEffect(() => {
    const config = localStorage.getItem("crm_config");
    if (config) {
      try {
        const parsed = JSON.parse(config);
        setCrmUrl(parsed.url || "");
        setCrmKey(parsed.key || "");
      } catch (e) {}
    }
  }, []);

  const saveCrmConfig = () => {
    localStorage.setItem("crm_config", JSON.stringify({ url: crmUrl, key: crmKey }));
    toast.success("CRM integration saved successfully");
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" subtitle="Manage your workspace, team, billing, and preferences." />

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="danger">Danger zone</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
              <CardDescription>Basic information for your workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input defaultValue="Acme, Inc." />
              </div>
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input defaultValue="acme" />
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t pt-4">
              <Button onClick={() => toast.success("Workspace saved")}>Save changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Members</CardTitle>
                <CardDescription>Invite teammates and manage roles.</CardDescription>
              </div>
              <Button onClick={() => toast.success("Invite sent")}>Invite member</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.email}>
                      <TableCell>
                        <div className="text-sm font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{m.role}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Manage</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>Currently on the Pro plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-4">
                <div>
                  <div className="text-sm font-semibold">Pro plan · $49/mo</div>
                  <div className="text-xs text-muted-foreground">Renews on Aug 12, 2026</div>
                </div>
                <Badge>Active</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">Update payment method</Button>
                <Button variant="outline">Download invoices</Button>
                <Button>Upgrade plan</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="api" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage keys used to send events.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/api-keys">Open API keys →</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom CRM Integration</CardTitle>
              <CardDescription>Connect a CRM API to unify user profiles with your analytics data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>CRM API Base URL</Label>
                <Input 
                  placeholder="https://api.yourcrm.com/v1" 
                  value={crmUrl}
                  onChange={(e) => setCrmUrl(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>API Key</Label>
                <Input 
                  type="password"
                  placeholder="Secret CRM Key" 
                  value={crmKey}
                  onChange={(e) => setCrmKey(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t pt-4">
              <Button onClick={saveCrmConfig}>Save integration</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="danger" className="mt-4">
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Danger zone</CardTitle>
              <CardDescription>Irreversible actions. Proceed with caution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-destructive/30 p-4">
                <div>
                  <div className="text-sm font-medium">Delete workspace</div>
                  <div className="text-xs text-muted-foreground">Permanently delete this workspace and all data.</div>
                </div>
                <Button variant="destructive" onClick={() => toast.error("Workspace deletion is disabled in demo")}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
