import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Database } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SchemaAttributeBuilder, type Attribute } from "@/components/collections/SchemaAttributeBuilder";

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

  // Collections state
  const [collections, setCollections] = useState<any[]>([]);
  const [newColName, setNewColName] = useState("");
  const [newColAttrs, setNewColAttrs] = useState<Attribute[]>([]);
  const [creatingCol, setCreatingCol] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null); // null = not checked yet

  async function fetchCollections() {
    try {
      const res = await fetch('/api/collections');
      if (res.status === 401) { setIsAuthed(false); return; }
      setIsAuthed(true);
      if (res.ok) setCollections(await res.json());
    } catch {}
  }

  async function createCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!newColName.trim()) return;
    setCreatingCol(true);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No projectId — server derives it from the session cookie
        body: JSON.stringify({ name: newColName.trim(), attributes: newColAttrs }),
      });
      if (res.status === 401) { setIsAuthed(false); return; }
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      toast.success(`Collection "${newColName.trim()}" created`);
      setNewColName('');
      setNewColAttrs([]);
      fetchCollections();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreatingCol(false);
    }
  }

  async function deleteCollection(id: string, name: string) {
    if (!confirm(`Delete collection "${name}" and all its data?`)) return;
    try {
      const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success(`Deleted "${name}"`);
      fetchCollections();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  useEffect(() => {
    const config = localStorage.getItem("crm_config");
    if (config) {
      try {
        const parsed = JSON.parse(config);
        setCrmUrl(parsed.url || "");
        setCrmKey(parsed.key || "");
      } catch (e) {}
    }
    fetchCollections();
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
          <TabsTrigger value="collections">Collections</TabsTrigger>
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

        {/* Collections tab */}
        <TabsContent value="collections" className="mt-4 space-y-6">
          {/* Auth gate — shown when there is no active session */}
          {isAuthed === false ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-4 w-4" /> Content Collections
                </CardTitle>
                <CardDescription>
                  You need to sign in to manage collections. Collections are scoped to your project
                  session — the server derives your project from your login, not from the client.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link to="/login">Sign in to continue →</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
          <>
          {/* Create new collection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4" /> New Collection
              </CardTitle>
              <CardDescription>
                Define a schema. The collection will appear in the sidebar under "Content Collections".
              </CardDescription>
            </CardHeader>
            <form onSubmit={createCollection}>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Collection name</Label>
                  <Input
                    placeholder="e.g. Products"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Attributes</Label>
                  <SchemaAttributeBuilder value={newColAttrs} onChange={setNewColAttrs} />
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t pt-4">
                <Button type="submit" disabled={creatingCol}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {creatingCol ? "Creating…" : "Create collection"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Existing collections */}
          {collections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Existing Collections</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {collections.map((col: any) => (
                    <div key={col.id} className="flex items-center justify-between px-6 py-3">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">{col.name}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {col.attributes.map((a: any) => (
                            <Badge key={a.name} variant="outline" className="text-[11px]">
                              {a.name}: {a.type}{a.required ? " *" : ""}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono mt-1">{col.id}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteCollection(col.id, col.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          </>
          )}
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
