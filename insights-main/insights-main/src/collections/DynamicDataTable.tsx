import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ColAttribute {
  name: string;
  type: string;
  required: boolean;
}

export interface RowItem {
  id: string;
  status: string;
  validationStatus: string;
  validationErrors: { field: string; message: string }[];
  data: Record<string, unknown>;
  batchId: string | null;
  createdAt: string;
}

interface Props {
  attributes: ColAttribute[];
  items: RowItem[];
  showValidation?: boolean;
  renderActions?: (item: RowItem) => React.ReactNode;
  emptyMessage?: string;
}

export function DynamicDataTable({
  attributes,
  items,
  showValidation = false,
  renderActions,
  emptyMessage = "No items.",
}: Props) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {showValidation && <TableHead className="w-[120px]">Status</TableHead>}
            {attributes.map((a) => (
              <TableHead key={a.name}>
                {a.name}
                {a.required && (
                  <span className="ml-1 text-destructive text-[10px]">*</span>
                )}
              </TableHead>
            ))}
            <TableHead className="text-xs text-muted-foreground">Imported</TableHead>
            {renderActions && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={attributes.length + (showValidation ? 1 : 0) + 1 + (renderActions ? 1 : 0)}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                {showValidation && (
                  <TableCell>
                    <ValidationBadge
                      status={item.validationStatus}
                      errors={item.validationErrors}
                    />
                  </TableCell>
                )}
                {attributes.map((a) => (
                  <TableCell key={a.name} className="text-sm">
                    {formatValue(item.data[a.name], a.type)}
                  </TableCell>
                ))}
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(item.createdAt).toLocaleDateString()}
                </TableCell>
                {renderActions && (
                  <TableCell className="text-right">
                    {renderActions(item)}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function formatValue(val: unknown, type: string): React.ReactNode {
  if (val === undefined || val === null || val === "") return <span className="text-muted-foreground">—</span>;
  if (type === "boolean") return <Badge variant={val ? "default" : "secondary"}>{String(val)}</Badge>;
  if (type === "date") {
    try { return new Date(String(val)).toLocaleDateString(); } catch { return String(val); }
  }
  return <span className="font-mono text-xs">{String(val)}</span>;
}

function ValidationBadge({
  status,
  errors,
}: {
  status: string;
  errors: { field: string; message: string }[];
}) {
  if (status === "valid") return <Badge className="bg-green-500/15 text-green-700 border-green-500/30">Valid</Badge>;
  if (status === "invalid") {
    return (
      <div className="space-y-1">
        <Badge variant="destructive" className="text-[11px]">Invalid</Badge>
        {errors.map((e, i) => (
          <div key={i} className="text-[11px] text-destructive leading-tight">
            {e.field}: {e.message}
          </div>
        ))}
      </div>
    );
  }
  return <Badge variant="outline" className="text-muted-foreground">Pending</Badge>;
}
