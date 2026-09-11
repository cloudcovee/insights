import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Minus } from "lucide-react";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

function getFlagEmoji(countryCode: string) {
  if (!countryCode) return "🏳️";
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
}

export function WorldMap({ data }: { data: { name: string; value: number; code?: string }[] }) {
  const [position, setPosition] = useState({ coordinates: [0, 20] as [number, number], zoom: 1 });

  const dataMap = useMemo(() => {
    return data.reduce((acc, curr) => {
      acc[curr.name] = curr;
      return acc;
    }, {} as Record<string, { name: string; value: number; code?: string }>);
  }, [data]);

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const colorScale = scaleLinear<string>()
    .domain([0, maxValue])
    .range(["#e8f0fe", "#1a73e8"]);

  const handleZoomIn = () => {
    if (position.zoom >= 4) return;
    setPosition((pos) => ({ ...pos, zoom: pos.zoom * 1.5 }));
  };

  const handleZoomOut = () => {
    if (position.zoom <= 1) return;
    setPosition((pos) => ({ ...pos, zoom: pos.zoom / 1.5 }));
  };

  const handleMoveEnd = (position: { coordinates: [number, number]; zoom: number }) => {
    setPosition(position);
  };

  return (
    <div className="h-full w-full relative">
      <TooltipProvider delayDuration={0}>
        <ComposableMap
          projectionConfig={{ scale: 140 }}
          width={800}
          height={400}
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup
            zoom={position.zoom}
            center={position.coordinates}
            onMoveEnd={handleMoveEnd}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryName = geo.properties.name;
                  const searchName = countryName === "United States of America" ? "United States" : countryName;
                  const countryData = dataMap[searchName];
                  const hasValue = !!countryData;
                  const value = countryData?.value;

                  return (
                    <Tooltip key={geo.rsmKey}>
                      <TooltipTrigger asChild>
                        <Geography
                          geography={geo}
                          fill={hasValue ? colorScale(value) : "var(--color-muted)"}
                          stroke="var(--color-background)"
                          strokeWidth={0.5 / position.zoom}
                          style={{
                            default: { outline: "none" },
                            hover: {
                              fill: hasValue ? "#1557b0" : "var(--color-muted)",
                              outline: "none",
                              cursor: hasValue ? "pointer" : "default",
                            },
                            pressed: { outline: "none" },
                          }}
                        />
                      </TooltipTrigger>
                      {hasValue && countryData ? (
                        <TooltipContent
                          side="top"
                          className="bg-card text-card-foreground shadow-md rounded-md p-4 min-w-[200px] border-border/50"
                        >
                          <div className="flex flex-col gap-3">
                            <span className="text-[13px] text-muted-foreground font-medium">
                              Jun 30 - Jul 6, 2026
                            </span>
                            <div className="flex flex-col gap-1">
                              <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                                Active Users
                              </span>
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg leading-none">
                                    {getFlagEmoji(countryData.code || "")}
                                  </span>
                                  <span className="text-[14px] font-medium">{searchName}</span>
                                </div>
                                <span className="text-[14px] font-bold">
                                  {value.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      ) : null}
                    </Tooltip>
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </TooltipProvider>

      {/* Zoom Controls matching GA */}
      <div className="absolute bottom-6 right-2 flex flex-col bg-card border border-border shadow-sm rounded overflow-hidden">
        <button
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-accent flex items-center justify-center border-b border-border transition-colors"
          aria-label="Zoom in"
        >
          <Plus className="h-5 w-5 text-foreground" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-accent flex items-center justify-center transition-colors"
          aria-label="Zoom out"
        >
          <Minus className="h-5 w-5 text-foreground" />
        </button>
      </div>
    </div>
  );
}
