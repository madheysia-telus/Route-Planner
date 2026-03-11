import { useCallback, useState } from "react";
import { MapPin, FileText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Papa from "papaparse";
import { toast } from "sonner";
import { POI, calculateOptimalRoute } from "@/utils/routing";
import { RoutePoint } from "./CsvUploader";

export interface MultiRoute {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  points: RoutePoint[];
  pois: POI[];
  rawPois: POI[];
}

interface MultiPoiUploaderProps {
  routes: MultiRoute[];
  onRoutesChange: (routes: MultiRoute[]) => void;
}

const ROUTE_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#52B788",
  "#BB8FCE", "#F7DC6F", "#85C1E2", "#F8B739", "#E74C3C"
];

export const MultiPoiUploader = ({ routes, onRoutesChange }: MultiPoiUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const getNextColor = () => {
    const usedColors = routes.map(r => r.color);
    return ROUTE_COLORS.find(c => !usedColors.includes(c)) || ROUTE_COLORS[routes.length % ROUTE_COLORS.length];
  };

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const pois: POI[] = [];

          results.data.forEach((row: any) => {
            const name = row.poi_name || row.name || row.route_name || row.routeName;
            const lat = parseFloat(row.latitude);
            const lng = parseFloat(row.longitude);

            if (name && !isNaN(lat) && !isNaN(lng)) {
              pois.push({ name, latitude: lat, longitude: lng });
            }
          });

          if (pois.length < 2) {
            toast.error("At least 2 POIs required for routing");
            setIsProcessing(false);
            return;
          }

          toast.loading("Calculating optimal route...");
          
          const routedPath = await calculateOptimalRoute(pois, 0, pois.length - 1);
          
          if (!routedPath) {
            toast.error("Failed to calculate route");
            setIsProcessing(false);
            return;
          }

          const routePoints: RoutePoint[] = routedPath.coordinates.map(([lng, lat]) => ({
            routeName: file.name.replace('.csv', ''),
            latitude: lat,
            longitude: lng,
          }));

          const newRoute: MultiRoute = {
            id: `route-${Date.now()}`,
            name: file.name.replace('.csv', ''),
            color: getNextColor(),
            visible: true,
            points: routePoints,
            pois: routedPath.optimizedPois || pois,
            rawPois: pois,
          };

          onRoutesChange([...routes, newRoute]);
          
          toast.success(`Route "${newRoute.name}" added`, {
            description: `${pois.length} POIs, ${(routedPath.distance / 1000).toFixed(2)} km`
          });
        } catch (error) {
          console.error('POI processing error:', error);
          toast.error("Failed to process POIs");
        } finally {
          setIsProcessing(false);
        }
      },
      error: () => {
        toast.error("Failed to read file");
        setIsProcessing(false);
      }
    });
  }, [routes, onRoutesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const csvFiles = files.filter(f => f.type === "text/csv" || f.name.endsWith(".csv"));
    
    if (csvFiles.length === 0) {
      toast.error("Please upload CSV files");
      return;
    }

    csvFiles.forEach(file => processFile(file));
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => processFile(file));
    e.target.value = '';
  }, [processFile]);

  const removeRoute = (id: string) => {
    onRoutesChange(routes.filter(r => r.id !== id));
  };

  return (
    <Card
      className={`border-2 border-dashed p-6 text-center transition-all ${
        isDragging ? "border-accent bg-accent/5" : "border-border"
      } ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
        {isProcessing ? (
          <div className="h-6 w-6 animate-spin rounded-full border-3 border-accent border-t-transparent" />
        ) : (
          <MapPin className="h-6 w-6 text-accent" />
        )}
      </div>
      
      <h3 className="mb-1 text-sm font-semibold text-foreground">
        {isProcessing ? "Processing..." : "Add Route CSVs"}
      </h3>
      
      <p className="mb-3 text-xs text-muted-foreground">
        Upload multiple CSVs to compare routes
      </p>

      <input
        type="file"
        accept=".csv"
        multiple
        onChange={handleFileInput}
        className="hidden"
        id="multi-poi-upload"
        disabled={isProcessing}
      />
      
      <Button size="sm" asChild disabled={isProcessing}>
        <label htmlFor="multi-poi-upload" className="cursor-pointer">
          <Plus className="mr-1 h-3 w-3" />
          Add CSV
        </label>
      </Button>

      {routes.length > 0 && (
        <div className="mt-3 text-left space-y-1">
          {routes.map(route => (
            <div key={route.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: route.color }}
              />
              <span className="truncate flex-1">{route.name}</span>
              <button 
                onClick={() => removeRoute(route.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
