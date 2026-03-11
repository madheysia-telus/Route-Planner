import { useState, useCallback } from "react";
import { CsvUploader, RoutePoint } from "@/components/CsvUploader";
import { PoiUploader } from "@/components/PoiUploader";
import { RouteMap } from "@/components/RouteMap";
import { RouteLegend } from "@/components/RouteLegend";
import { MultiPoiUploader, MultiRoute } from "@/components/MultiPoiUploader";
import { MultiRouteMap } from "@/components/MultiRouteMap";
import { RouteControls } from "@/components/RouteControls";
import { Map as MapIcon, Upload, Navigation, Download, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { POI, calculateOptimalRoute } from "@/utils/routing";
import { toast } from "sonner";

type Mode = "normal" | "poi" | "multi-poi";

const ROUTE_COLORS = [
  { name: "Red", value: "#FF6B6B" },
  { name: "Teal", value: "#4ECDC4" },
  { name: "Blue", value: "#45B7D1" },
  { name: "Orange", value: "#FFA07A" },
  { name: "Green", value: "#52B788" },
  { name: "Purple", value: "#BB8FCE" },
  { name: "Yellow", value: "#F7DC6F" },
];

const Index = () => {
  const [mode, setMode] = useState<Mode>("normal");
  const [routes, setRoutes] = useState(new Map<string, RoutePoint[]>());
  const [pois, setPois] = useState<POI[]>([]);
  const [rawPois, setRawPois] = useState<POI[]>([]);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [routeColor, setRouteColor] = useState("#FF6B6B");
  const [startPoiIndex, setStartPoiIndex] = useState<number>(0);
  const [endPoiIndex, setEndPoiIndex] = useState<number | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  // Multi-route state
  const [multiRoutes, setMultiRoutes] = useState<MultiRoute[]>([]);
  const [overlapData, setOverlapData] = useState<Map<string, Map<string, number>>>(new Map());

  const handleOverlapCalculated = useCallback((data: Map<string, Map<string, number>>) => {
    setOverlapData(data);
  }, []);

  const handleToggleRouteVisibility = useCallback((id: string) => {
    setMultiRoutes(prev => prev.map(r => 
      r.id === id ? { ...r, visible: !r.visible } : r
    ));
  }, []);

  const handlePoisLoaded = (routeMap: Map<string, RoutePoint[]>, loadedPois: POI[], originalPois: POI[]) => {
    setRoutes(routeMap);
    setPois(loadedPois);
    setRawPois(originalPois);
    setStartPoiIndex(0);
    setEndPoiIndex(originalPois.length > 1 ? originalPois.length - 1 : null);
  };

  const handleRecalculateRoute = async () => {
    if (rawPois.length < 2) return;
    
    setIsRecalculating(true);
    toast.loading("Recalculating route...");
    
    try {
      const routedPath = await calculateOptimalRoute(rawPois, startPoiIndex, endPoiIndex);
      
      if (!routedPath) {
        toast.error("Failed to calculate route");
        return;
      }

      const routePoints: RoutePoint[] = routedPath.coordinates.map(([lng, lat]) => ({
        routeName: "POI Route",
        latitude: lat,
        longitude: lng,
      }));

      const routeMap = new Map<string, RoutePoint[]>();
      routeMap.set("POI Route", routePoints);

      setRoutes(routeMap);
      if (routedPath.optimizedPois) {
        setPois(routedPath.optimizedPois);
      }
      
      toast.success("Route recalculated", {
        description: `Distance: ${(routedPath.distance / 1000).toFixed(2)} km, Duration: ${Math.round(routedPath.duration / 60)} min`
      });
    } catch (error) {
      console.error('Route recalculation error:', error);
      toast.error("Failed to recalculate route", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleExportRouteCsv = () => {
    const routesToExport = mode === "multi-poi" ? multiRoutes : null;
    
    if (mode === "multi-poi") {
      if (multiRoutes.length === 0) return;
      const csvRows = ["latitude,longitude,route_name"];
      multiRoutes.forEach(route => {
        route.points.forEach(point => {
          csvRows.push(`${point.latitude},${point.longitude},${route.name}`);
        });
      });
      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `multi_route_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      if (routes.size === 0) return;
      const csvRows = ["latitude,longitude,route_name"];
      routes.forEach((points, routeName) => {
        points.forEach((point) => {
          csvRows.push(`${point.latitude},${point.longitude},${routeName}`);
        });
      });
      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `route_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const hasData = mode === "multi-poi" ? multiRoutes.length > 0 : routes.size > 0;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <MapIcon className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Route Visualizer</h1>
              <p className="text-xs text-muted-foreground">Interactive route mapping tool powered by OpenStreetMap</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Sidebar */}
        <aside className="flex w-80 flex-col gap-4 overflow-y-auto">
          {/* Mode Selection */}
          <Card className="p-4">
            <Label className="mb-3 block text-sm font-medium">Visualization Mode</Label>
            <RadioGroup value={mode} onValueChange={(value) => setMode(value as Mode)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="normal" />
                <Label htmlFor="normal" className="flex items-center gap-2 cursor-pointer">
                  <MapIcon className="h-4 w-4" />
                  <span>Normal Routes</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="poi" id="poi" />
                <Label htmlFor="poi" className="flex items-center gap-2 cursor-pointer">
                  <Navigation className="h-4 w-4" />
                  <span>Single POI Route</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="multi-poi" id="multi-poi" />
                <Label htmlFor="multi-poi" className="flex items-center gap-2 cursor-pointer">
                  <Navigation className="h-4 w-4" />
                  <span>Multi-Route Compare</span>
                </Label>
              </div>
            </RadioGroup>
          </Card>

          {/* Upload Component */}
          {mode === "normal" ? (
            <CsvUploader onRoutesLoaded={setRoutes} />
          ) : mode === "poi" ? (
            <PoiUploader onPoisLoaded={handlePoisLoaded} />
          ) : (
            <MultiPoiUploader routes={multiRoutes} onRoutesChange={setMultiRoutes} />
          )}

          {/* Route Controls for Multi-POI */}
          {mode === "multi-poi" && multiRoutes.length > 0 && (
            <RouteControls 
              routes={multiRoutes} 
              onToggleVisibility={handleToggleRouteVisibility}
              overlapData={overlapData}
            />
          )}

          {/* Legend for normal/poi modes */}
          {mode !== "multi-poi" && <RouteLegend routes={routes} />}
          
          {/* Settings Card */}
          {hasData && (
            <Card className="p-4 space-y-4">
              {mode !== "multi-poi" && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-coordinates" className="text-sm font-medium">
                    Show Coordinates
                  </Label>
                  <Switch
                    id="show-coordinates"
                    checked={showCoordinates}
                    onCheckedChange={setShowCoordinates}
                  />
                </div>
              )}
              
              {mode === "poi" && rawPois.length > 0 && (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Start Point</Label>
                    <Select 
                      value={startPoiIndex.toString()} 
                      onValueChange={(v) => setStartPoiIndex(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select start" />
                      </SelectTrigger>
                      <SelectContent>
                        {rawPois.map((poi, idx) => (
                          <SelectItem 
                            key={idx} 
                            value={idx.toString()}
                            disabled={idx === endPoiIndex}
                          >
                            {poi.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium mb-2 block">End Point</Label>
                    <Select 
                      value={endPoiIndex?.toString() ?? ""} 
                      onValueChange={(v) => setEndPoiIndex(v ? parseInt(v) : null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select end" />
                      </SelectTrigger>
                      <SelectContent>
                        {rawPois.map((poi, idx) => (
                          <SelectItem 
                            key={idx} 
                            value={idx.toString()}
                            disabled={idx === startPoiIndex}
                          >
                            {poi.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="w-full"
                    onClick={handleRecalculateRoute}
                    disabled={isRecalculating}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
                    Recalculate Route
                  </Button>
                  
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Route Color</Label>
                    <div className="flex flex-wrap gap-2">
                      {ROUTE_COLORS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setRouteColor(color.value)}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${
                            routeColor === color.value 
                              ? "border-foreground scale-110" 
                              : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={handleExportRouteCsv}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Route CSV
              </Button>
            </Card>
          )}
          
          {!hasData && (
            <div className="mt-8 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
              <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {mode === "multi-poi" 
                  ? "Upload multiple CSV files to compare routes" 
                  : "Upload a CSV file to visualize routes on the map"
                }
              </p>
            </div>
          )}
        </aside>

        {/* Map */}
        <main className="flex-1">
          {mode === "multi-poi" ? (
            multiRoutes.length > 0 ? (
              <MultiRouteMap 
                routes={multiRoutes}
                onOverlapCalculated={handleOverlapCalculated}
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20">
                <div className="text-center">
                  <Navigation className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                  <h2 className="text-xl font-semibold text-foreground">Upload multiple route CSVs</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Compare routes and visualize overlaps
                  </p>
                </div>
              </div>
            )
          ) : routes.size > 0 ? (
            <RouteMap 
              routes={routes} 
              showCoordinates={showCoordinates} 
              pois={mode === "poi" ? pois : undefined}
              isPoisMode={mode === "poi"}
              routeColor={routeColor}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20">
              <div className="text-center">
                {mode === "normal" ? (
                  <>
                    <MapIcon className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                    <h2 className="text-xl font-semibold text-foreground">Upload CSV to view routes</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Your routes will appear on the map
                    </p>
                  </>
                ) : (
                  <>
                    <Navigation className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                    <h2 className="text-xl font-semibold text-foreground">Upload POI CSV for routing</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Route will follow real roads based on OpenStreetMap data
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
