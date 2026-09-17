import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Attribute {
  name: string;
  type: string;
  required: boolean;
}

interface Props {
  collectionId: string;
  collectionName: string;
  attributes: Attribute[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ManualAddModal({
  collectionId,
  collectionName,
  attributes,
  open,
  onOpenChange,
  onImported,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Simple frontend-side field-level validation for UX only
  function getFrontendErrors(): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const attr of attributes) {
      const raw = values[attr.name] ?? "";
      if (attr.required && !raw.trim()) {
        errs[attr.name] = `"${attr.name}" is required`;
        continue;
      }
      if (!raw.trim()) continue;
      if (attr.type === "number" && isNaN(Number(raw))) {
        errs[attr.name] = `Must be a number`;
      }
      if (attr.type === "date" && isNaN(Date.parse(raw))) {
        errs[attr.name] = `Must be a valid date`;
      }
    }
    return errs;
  }

  function coerce(raw: string, type: string): unknown {
    if (type === "number") return raw.trim() === "" ? null : Number(raw);
    if (type === "boolean") return raw === "true";
    return raw;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Build data payload with coerced types
    const data: Record<string, unknown> = {};
    for (const attr of attributes) {
      data[attr.name] = coerce(values[attr.name] ?? "", attr.type);
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/collections/${collectionId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed to add item");
      }
      onImported();
      onOpenChange(false);
      setValues({});
      toast.success("Item added to Staging.");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add item");
    } finally {
      setLoading(false);
    }
  }

  const frontendErrors = getFrontendErrors();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add item to {collectionName}</DialogTitle>
          <DialogDescription>
            Item will be placed in <strong>Staging</strong>. Review and publish
            from the Staging tab.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {attributes.map((attr) => (
            <div key={attr.name} className="grid gap-1.5">
              <Label htmlFor={`field-${attr.name}`} className="text-sm">
                {attr.name}
                {attr.required && <span className="ml-1 text-destructive">*</span>}
                <span className="ml-2 text-xs text-muted-foreground">({attr.type})</span>
              </Label>

              {attr.type === "boolean" ? (
                <div className="flex items-center gap-2">
                  <Switch
                    id={`field-${attr.name}`}
                    checked={values[attr.name] === "true"}
                    onCheckedChange={(v) =>
                      setValues((prev) => ({ ...prev, [attr.name]: String(v) }))
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {values[attr.name] === "true" ? "true" : "false"}
                  </span>
                </div>
              ) : (
                <Input
                  id={`field-${attr.name}`}
                  type={attr.type === "number" ? "number" : attr.type === "date" ? "date" : "text"}
                  value={values[attr.name] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [attr.name]: e.target.value }))
                  }
                />
              )}

              {frontendErrors[attr.name] && (
                <p className="text-xs text-destructive">{frontendErrors[attr.name]}</p>
              )}
            </div>
          ))}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Add to Staging"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
