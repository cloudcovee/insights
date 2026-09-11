import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta: number;
  hint?: string;
}) {
  const up = delta >= 0;
  return (
    <Card className="p-5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
            up ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
          )}
        >
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}%
        </span>
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
