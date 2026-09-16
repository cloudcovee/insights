import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Upload, RefreshCw, Send } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { DynamicDataTable } from "@/components/collections/DynamicDataTable";
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

function CatalogPage() {
  const { catalogId } = Route.useParams();

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [stagingItems, setStagingItems] = useState<CatalogItem[]>([]);
  const [publishedItems, setPublishedItems] = useState<CatalogItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    fetchCatalog();
    fetchItems();
  }, [fetchCatalog, fetchItems]);

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
    try {
      await fetch(`/api/catalogs/${catalogId}/items/${itemId}`, { method: "DELETE" });
      fetchItems();
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    } catch {}
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
        subtitle={`${catalog.attributes.length} field schema · ${stagingItems.length} staging · ${publishedItems.length} published`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowCsvModal(true)}>
              <Upload className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={() => setShowManualModal(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add item
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="staging" className="mt-2">
        <TabsList>
          <TabsTrigger value="staging">
            Staging
            {stagingItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">{stagingItems.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="published">
            Published
            {publishedItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">{publishedItems.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staging" className="mt-4 space-y-3">
          {/* Staging toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected · ${selectedValidCount} valid`
                : `${stagingItems.length} items · ${validStagingCount} valid, ${stagingItems.length - validStagingCount} need review`}
            </p>
            <div className="flex gap-2">
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

          {/* Staging table with checkboxes */}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableHead className="w-[120px]">Status</TableHead>
                  {catalog.attributes.map((a) => (
                    <TableHead key={a.name}>
                      {a.name}
                      {a.required && <span className="ml-1 text-destructive text-[10px]">*</span>}
                    </TableHead>
                  ))}
                  <TableHead className="text-xs text-muted-foreground">Imported</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {stagingItems.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={catalog.attributes.length + 4}
                      className="py-16 text-center text-sm text-muted-foreground"
                    >
                      No staged items. Import a CSV or add items manually.
                    </TableCell>
                  </TableRow>
                ) : (
                  stagingItems.map((item) => (
                    <TableRow key={item.id} className={selectedIds.has(item.id) ? "bg-muted/40" : ""}>
                      <TableCell>
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
                      {catalog.attributes.map((a) => (
                        <TableCell key={a.name} className="text-sm font-mono text-xs">
                          {formatVal(item.data[a.name])}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive h-7 text-xs"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="published" className="mt-4">
          <DynamicDataTable
            attributes={catalog.attributes}
            items={publishedItems}
            showValidation={false}
            emptyMessage="No published items yet. Stage and publish from the Staging tab."
          />
        </TabsContent>
      </Tabs>

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

function formatVal(val: unknown): React.ReactNode {
  if (val === undefined || val === null || val === "")
    return <span className="text-muted-foreground">—</span>;
  return String(val);
}
