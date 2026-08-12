import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_dash/reports")({ component: ReportsPage });

const reports = [
  { name: "Daily traffic summary", period: "Daily", updated: "2h ago", status: "Ready" },
  { name: "Weekly product review", period: "Weekly", updated: "Yesterday", status: "Ready" },
  { name: "Monthly executive KPIs", period: "Monthly", updated: "3d ago", status: "Ready" },
  { name: "Funnel drop-off analysis", period: "Weekly", updated: "5d ago", status: "Draft" },
];

function ReportsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Reports"
        subtitle="Scheduled and on-demand reports across your workspace."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Exported to CSV")}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={() => toast.success("Exported to PDF")}>
              <FileText className="mr-2 h-4 w-4" /> Export PDF
            </Button>
          </>
        }
      />

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
        {(["daily", "weekly", "monthly"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium capitalize">{tab} reports</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports
                      .filter((r) => r.period.toLowerCase() === tab)
                      .map((r) => (
                        <TableRow key={r.name}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell>{r.period}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.updated}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === "Ready" ? "default" : "secondary"}>
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline">Download</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
