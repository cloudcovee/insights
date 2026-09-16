import { useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  collectionId: string;
  collectionName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (result: { batchId: string; total: number; valid: number; invalid: number }) => void;
}

export function CsvUploadModal({
  collectionId,
  collectionName,
  open,
  onOpenChange,
  onImported,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/catalogs/${collectionId}/import`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      const result = await res.json();
      onImported(result);
      onOpenChange(false);
      setFile(null);
      toast.success(
        `Imported ${result.total} rows → ${result.valid} valid, ${result.invalid} invalid. All in Staging.`
      );
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import CSV to {collectionName}</DialogTitle>
          <DialogDescription>
            All rows will be imported to <strong>Staging</strong> and validated
            against the schema. Review results before publishing.
          </DialogDescription>
        </DialogHeader>

        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => document.getElementById("csv-file-input")?.click()}
        >
          <input
            id="csv-file-input"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="font-medium truncate max-w-[200px]">{file.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to select a <code>.csv</code> file
              </p>
              <p className="text-xs text-muted-foreground">
                First row must be the header matching your schema fields
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || loading}>
            {loading ? "Importing…" : "Import to Staging"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
