import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export interface Attribute {
  name: string;
  type: "string" | "number" | "boolean" | "date";
  required: boolean;
}

interface Props {
  value: Attribute[];
  onChange: (attrs: Attribute[]) => void;
}

export function SchemaAttributeBuilder({ value, onChange }: Props) {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Attribute["type"]>("string");
  const [newRequired, setNewRequired] = useState(false);

  function add() {
    const name = newName.trim();
    if (!name) return;
    if (value.some((a) => a.name === name)) return;
    onChange([...value, { name, type: newType, required: newRequired }]);
    setNewName("");
    setNewType("string");
    setNewRequired(false);
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="rounded-md border divide-y">
          {value.map((attr, i) => (
            <div
              key={attr.name}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-medium truncate">{attr.name}</span>
                <span className="text-xs text-muted-foreground rounded-sm bg-muted px-1.5 py-0.5">
                  {attr.type}
                </span>
                {attr.required && (
                  <span className="text-xs text-destructive">required</span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => remove(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 flex-wrap">
        <div className="grid gap-1 flex-1 min-w-[140px]">
          <Label className="text-xs">Field name</Label>
          <Input
            placeholder="e.g. price"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={newType}
            onValueChange={(v) => setNewType(v as Attribute["type"])}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="string">String</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="date">Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1 items-center">
          <Label className="text-xs">Required</Label>
          <div className="flex items-center h-9">
            <Switch
              checked={newRequired}
              onCheckedChange={setNewRequired}
            />
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add field
        </Button>
      </div>
    </div>
  );
}
