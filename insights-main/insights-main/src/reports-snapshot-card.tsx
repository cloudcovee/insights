import { useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChevronDown, ArrowUp, ArrowDown, ArrowRight, TriangleAlert, Award, Search, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Mock data zeroed out for live testing
const chartData: any[] = [];

const metricsList = [
  {
    group: "Suggested",
    items: [
      "Active users", "Average engagement time per active user", "Engaged sessions",
      "Event count", "Key events", "New users", "Returning users", "Sessions", "Views",
      "Views per active user", "Ecommerce"
    ]
  },
  {
    group: "Ecommerce",
    items: [
      "Purchases", "Purchase revenue", "Average purchase revenue", "Average purchase revenue per active user",
      "Ecommerce purchases", "Item revenue", "Items purchased", "Item view events", "Cart-to-view rate",
      "Checkout-to-view rate", "Refund amount", "Refunds", "Shipping amount", "Tax amount", "Transactions",
      "First-time purchasers", "Returning purchasers", "Average order value"
    ]
  },
  {
    group: "Event",
    items: [
      "Event count per user", "Session key event rate", "User key event rate", "Total users", "Event value", 
      "Event revenue", "Event value per user"
    ]
  },
  {
    group: "Page / screen",
    items: [
      "Screen page views", "Average engagement time", "Entrances", "Exits", "Bounce rate", "Engagement rate",
      "Scrolls", "Landing page views"
    ]
  },
  {
    group: "Revenue",
    items: [
      "Total revenue", "Ad revenue", "Subscription revenue", "Average revenue per user (ARPU)",
      "Lifetime value (LTV)", "Gross purchase revenue"
    ]
  },
  {
    group: "Session",
    items: [
      "Engaged sessions per active user", "Average session duration", "Sessions per user", "Session conversion rate"
    ]
  },
  {
    group: "User",
    items: [
      "User engagement", "Average engagement time per user", "User conversion rate", "Lifetime value",
      "User retention"
    ]
  }
];



const dateOptions = [
  "Custom",
  "Today",
  "Yesterday",
  "This week (Sun - Today)",
  "Last 7 days",
  "Last week (Sun - Sat)",
  "Last 28 days",
  "Last 30 days",
  "This month",
  "Last month",
  "Last 90 days"
];

function DateRangeSelector() {
  const [selected, setSelected] = useState("Last 7 days");
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const [date, setDate] = useState<any>({
    from: new Date(2026, 5, 30),
    to: new Date(2026, 6, 6),
  });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent h-8 px-2 -ml-2 font-normal">
          {selected === "Custom" && date?.from && date?.to
            ? `${date.from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${date.to.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : selected}
          <ChevronDown className="ml-1 h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-card shadow-lg border-border" align="start">
        {isCustomOpen ? (
          <div className="p-3">
             <div className="flex justify-between items-center mb-2">
               <span className="text-sm font-semibold">Custom Range</span>
               <Button variant="ghost" size="sm" onClick={() => setIsCustomOpen(false)} className="h-6 px-2 text-xs">Back</Button>
             </div>
             <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={1}
              />
              <div className="flex justify-end mt-2">
                <Button size="sm" onClick={() => setIsOpen(false)} className="h-7 text-xs bg-[#1a73e8] hover:bg-[#1557b0]">Apply</Button>
              </div>
          </div>
        ) : (
          <div className="flex flex-col py-2 w-48">
            {dateOptions.map(opt => (
              <div 
                key={opt}
                className={`px-4 py-2 text-[13px] cursor-pointer hover:bg-accent ${selected === opt ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'text-foreground'}`}
                onClick={() => {
                  setSelected(opt);
                  if (opt === "Custom") {
                    setIsCustomOpen(true);
                  } else {
                    setIsOpen(false);
                  }
                }}
              >
                {opt}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function MetricsPopover({ tabLabel, children }: { tabLabel: string, children: React.ReactNode }) {
  const [activeGroup, setActiveGroup] = useState(metricsList[0].group);
  const [search, setSearch] = useState("");
  
  const activeItems = search 
    ? metricsList.flatMap(g => g.items).filter(item => item.toLowerCase().includes(search.toLowerCase()))
    : metricsList.find(g => g.group === activeGroup)?.items || [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0 shadow-lg rounded-md border-border bg-card" align="start">
        <div className="flex items-center border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
          <input 
            className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus:ring-0" 
            placeholder="Search items" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex h-[350px]">
          {/* Left Sidebar */}
          {!search && (
            <div className="w-[180px] border-r border-border bg-accent/30 overflow-y-auto">
              {metricsList.map((g) => (
                <div 
                  key={g.group} 
                  className={`px-4 py-2.5 text-[13px] cursor-pointer flex justify-between items-center transition-colors ${activeGroup === g.group ? 'bg-[#e8f0fe] text-[#1a73e8] font-medium' : 'hover:bg-accent text-foreground'}`}
                  onClick={() => setActiveGroup(g.group)}
                >
                  <span className="truncate">{g.group}</span>
                  <ChevronDown className="h-3 w-3 -rotate-90 opacity-40" />
                </div>
              ))}
            </div>
          )}
          
          {/* Right Content */}
          <div className="flex-1 overflow-y-auto p-0 scrollbar-thin">
             {activeGroup === "Suggested" && !search && (
                <div className="px-4 py-3 text-[13px] text-foreground flex items-center border-b border-border/50 cursor-pointer hover:bg-accent transition-colors">
                   Choose for me <Sparkles className="h-3.5 w-3.5 ml-2 text-muted-foreground" />
                </div>
             )}
             {activeItems.map((item) => (
                <div key={item} className="px-4 py-2 text-[13px] text-foreground hover:bg-accent cursor-pointer group transition-colors">
                  <span className="border-b border-dashed border-muted-foreground/60 pb-[1px]">
                    {item}
                  </span>
                </div>
             ))}
             {search && activeItems.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">No results found.</div>
             )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function ReportsSnapshotCard({ stats }: { stats?: { views: number; activeUsers: number } }) {
  const tabsData = [
    { id: "tab1", label: "Active users", value: (stats?.activeUsers || 0).toLocaleString(), trend: "-", trendType: "neutral" },
    { id: "tab2", label: "Views", value: (stats?.views || 0).toLocaleString(), trend: "-", trendType: "neutral" },
    { id: "tab3", label: "Views per active user", value: stats?.activeUsers ? (stats.views / stats.activeUsers).toFixed(1) : "0", trend: "-", trendType: "neutral" },
    { id: "tab4", label: "New users", value: (stats?.activeUsers || 0).toLocaleString(), trend: "-", trendType: "neutral" },
  ];

  const [activeTab, setActiveTab] = useState("tab2");

  // Custom Tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card text-card-foreground shadow-md rounded-md p-3 border border-border/50 text-xs z-50">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => {
            // Ignore the range array in the tooltip
            if (entry.dataKey === "peerRange") return null;
            return (
              <div key={index} className="flex items-center space-x-2 my-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.name}:</span>
                <span className="font-medium">{entry.value}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="flex flex-col border border-border shadow-sm overflow-hidden h-full">
      <CardHeader className="flex flex-row items-start justify-between pb-0 pt-4 px-0 border-b border-border/50">
        <div className="flex w-full overflow-x-auto no-scrollbar relative pl-4">
          {tabsData.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col min-w-[130px] px-3 pb-3 cursor-pointer transition-colors hover:bg-accent/50 relative ${
                  isActive ? "" : "opacity-80 hover:opacity-100"
                }`}
              >
                <MetricsPopover tabLabel={tab.label}>
                  <div className="flex items-center space-x-1 text-[13px] text-muted-foreground hover:bg-accent px-1.5 py-0.5 rounded -ml-1.5 w-fit">
                    <span>{tab.label}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </div>
                </MetricsPopover>

                <div className="text-[26px] leading-tight font-normal text-foreground mt-1">
                  {tab.value}
                </div>
                
                <div className="flex items-center text-[12px] mt-0.5">
                  {tab.trendType === "down" && (
                    <span className="text-destructive flex items-center">
                      <ArrowDown className="h-3 w-3 mr-0.5" />
                      {tab.trend}
                    </span>
                  )}
                  {tab.trendType === "up" && (
                    <span className="text-[#188038] flex items-center">
                      <ArrowUp className="h-3 w-3 mr-0.5" />
                      {tab.trend}
                    </span>
                  )}
                  {tab.trendType === "neutral" && (
                    <span className="text-muted-foreground">{tab.trend}</span>
                  )}
                </div>

                {/* Active Underline */}
                {isActive && (
                  <div className="absolute bottom-[-1px] left-3 right-3 h-[3px] bg-primary rounded-t-sm" />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Top Right Icons */}
        <div className="flex items-center space-x-3 pr-5 pt-2 shrink-0">
          <Award className="h-5 w-5 text-primary cursor-pointer hover:opacity-80" />
          <TriangleAlert className="h-5 w-5 text-[#b06000] cursor-pointer hover:opacity-80" />
        </div>
      </CardHeader>

      <CardContent className="pt-6 pb-2 px-5 flex-1 min-h-[240px]">
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <YAxis
                orientation="right"
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Peer Range Area */}
              <Area
                type="monotone"
                dataKey="peerRange"
                stroke="none"
                fill="#d2f4f2"
                fillOpacity={0.6}
              />
              {/* Peer Median Line */}
              <Line
                type="monotone"
                dataKey="peerMedian"
                name="Peer median"
                stroke="#4ab5ae"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
              />
              
              {/* Previous Period Line (Dotted) */}
              <Line
                type="linear"
                dataKey="previous"
                name="Previous period"
                stroke="#5495ec"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />

              {/* Current Period Line (Solid) */}
              <Line
                type="linear"
                dataKey="current"
                name="Last 7 days"
                stroke="#1a73e8"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      
      {/* Chart Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 px-5 text-[11px] text-muted-foreground">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5 bg-[#1a73e8]" />
          <span>Last 7 days</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5 border-b-2 border-dotted border-[#5495ec]" />
          <span>Previous period</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-[#d2f4f2] flex items-center justify-center">
             <div className="w-full h-0.5 bg-[#4ab5ae]" />
          </div>
          <span>Peer median and range: Jobs & Education</span>
        </div>
      </div>

      <CardFooter className="flex items-center justify-between py-3 px-5 border-t border-border mt-3">
        <DateRangeSelector />
        <Button variant="link" size="sm" className="text-primary font-medium text-[13px] h-8 px-2 -mr-2">
          View reports snapshot <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
