import { ChevronDown, ArrowUp, ArrowDown, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { WorldMap } from "@/components/world-map";
import { Button } from "@/components/ui/button";

interface CountryData {
  name: string;
  value: number;
  code: string;
}

export function ActiveUsersByCountryCard({ data }: { data: CountryData[] }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  // Generate some deterministic mock trends for visual parity with screenshot
  const getMockTrend = (name: string, index: number) => {
    if (index === 0) return { type: "up", val: "50.0%" };
    if (index >= 1 && index <= 3) return { type: "neutral", val: "-" };
    return { type: "down", val: "66.7%" };
  };

  return (
    <Card className="flex flex-col lg:col-span-2 overflow-hidden border border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b-0 px-5 pt-5">
        <div className="flex items-center space-x-1 text-[16px] text-foreground">
          <span className="font-medium cursor-pointer hover:bg-accent px-1.5 py-0.5 rounded flex items-center">
            Active users <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />
          </span>
          <span className="text-muted-foreground font-normal">by</span>
          <span className="font-medium cursor-pointer hover:bg-accent px-1.5 py-0.5 rounded flex items-center">
            Country ID <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />
          </span>
        </div>
        <div className="flex items-center">
          <Button variant="outline" size="sm" className="h-8 px-2 rounded-full border-border bg-card shadow-sm hover:bg-accent">
            <CheckCircle2 className="h-4 w-4 text-[#188038] mr-1" />
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-8 px-5 pt-2 pb-6">
        <div className="md:col-span-3 h-[280px] md:h-[340px] relative flex flex-col justify-center">
          <WorldMap data={data} />
          <div className="absolute bottom-0 right-0 flex items-center space-x-2 text-[10px] text-muted-foreground bg-background/60 px-1 py-0.5 rounded">
            <span>Map Data ©2026</span>
            <a href="#" className="hover:underline">
              Terms
            </a>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col justify-start pt-4">
          <div className="flex items-center justify-between border-b border-border border-dashed pb-2 mb-1 text-[11px] font-semibold text-muted-foreground tracking-wider">
            <span>COUNTRY</span>
            <span>ACTIVE USERS</span>
          </div>

          <div className="flex flex-col w-full">
            {data.slice(0, 7).map((item, i) => {
              const trend = getMockTrend(item.name, i);
              const percentage = Math.max((item.value / maxValue) * 100, 2);

              return (
                <div key={item.name} className="flex flex-col py-2 border-b border-border/40 last:border-0 relative">
                  <div className="flex items-center justify-between text-[13px] z-10 mb-1.5">
                    <span className="font-medium text-foreground truncate max-w-[140px]">{item.name}</span>
                    <div className="flex items-center space-x-3 text-foreground">
                      <span>{item.value}</span>
                      <div className="w-14 flex justify-end text-xs font-medium">
                        {trend.type === "up" && (
                          <span className="text-[#188038] flex items-center">
                            <ArrowUp className="h-3 w-3 mr-0.5" />
                            {trend.val}
                          </span>
                        )}
                        {trend.type === "down" && (
                          <span className="text-destructive flex items-center">
                            <ArrowDown className="h-3 w-3 mr-0.5" />
                            {trend.val}
                          </span>
                        )}
                        {trend.type === "neutral" && <span className="text-muted-foreground">{trend.val}</span>}
                      </div>
                    </div>
                  </div>
                  {/* The horizontal blue progress bar, identical to GA */}
                  <div
                    className="absolute bottom-[-1px] left-0 h-[2px] bg-primary z-0"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t border-border flex items-center justify-between py-3 px-5">
        <Button variant="ghost" size="sm" className="text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent h-8 px-2 -ml-2 font-normal">
          Last 7 days <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </Button>
        <Button variant="link" size="sm" className="text-primary font-medium text-[13px] h-8 px-2 -mr-2">
          View countries <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
