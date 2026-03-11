import { useCallback, useState } from "react";
import { MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Papa from "papaparse";
import { toast } from "sonner";
import { POI, calculateOptimalRoute } from "@/utils/routing";
import { RoutePoint } from "./CsvUploader";

interface PoiUploaderProps {
  onPoisLoaded: (routes: Map<string, RoutePoint[]>, pois: POI[], originalPois: POI[]) => void;
}

export const PoiUploader = ({ onPoisLoaded }: PoiUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const pois: POI[] = [];
          let validCount = 0;
          let invalidCount = 0;

          results.data.forEach((row: any) => {
            const name = row.poi_name || row.name || row.route_name || row.routeName;
            const lat = parseFloat(row.latitude);
            const lng = parseFloat(row.longitude);

            if (name && !isNaN(lat) && !isNaN(lng)) {
              pois.push({
                name,
                latitude: lat,
                longitude: lng,
              });
              validCount++;
            } else {
              invalidCount++;
            }
          });

          if (pois.length === 0) {
            toast.error("No valid POIs found in CSV", {
              description: "Expected format: poi_name, latitude, longitude"
            });
            setIsProcessing(false);
            return;
          }

          if (pois.length < 2) {
            toast.error("At least 2 POIs required for routing");
            setIsProcessing(false);
            return;
          }

          // Calculate optimal route using backend service
          // Default: first POI as start, last POI as end
          toast.loading("Calculating optimal route...");
          
          try {
            const routedPath = await calculateOptimalRoute(pois, 0, pois.length - 1);
            
            if (!routedPath) {
              toast.error("Failed to calculate route", {
                description: "The routing service returned no data"
              });
              setIsProcessing(false);
              return;
            }

            // Convert routed coordinates to RoutePoint format
            const routePoints: RoutePoint[] = routedPath.coordinates.map(([lng, lat]) => ({
              routeName: "POI Route",
              latitude: lat,
              longitude: lng,
            }));

            const routeMap = new Map<string, RoutePoint[]>();
            routeMap.set("POI Route", routePoints);

            // Pass optimized POIs if available, otherwise use original
            const optimizedPois = routedPath.optimizedPois || pois;
            onPoisLoaded(routeMap, optimizedPois, pois);
            
            toast.success(`Route calculated for ${pois.length} POIs`, {
              description: `Distance: ${(routedPath.distance / 1000).toFixed(2)} km, Duration: ${Math.round(routedPath.duration / 60)} min${invalidCount > 0 ? `, ${invalidCount} skipped` : ""}`
            });
          } catch (routingError) {
            console.error('Routing calculation error:', routingError);
            toast.error("Failed to calculate route", {
              description: routingError instanceof Error ? routingError.message : "Routing service error"
            });
            setIsProcessing(false);
            return;
          }
        } catch (error) {
          console.error('POI processing error:', error);
          toast.error("Failed to process POIs", {
            description: error instanceof Error ? error.message : "Unknown error"
          });
        } finally {
          setIsProcessing(false);
        }
      },
      error: () => {
        toast.error("Failed to read file");
        setIsProcessing(false);
      }
    });
  }, [onPoisLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file?.type === "text/csv" || file?.name.endsWith(".csv")) {
      processFile(file);
    } else {
      toast.error("Please upload a CSV file");
    }
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  return (
    <Card
      className={`border-2 border-dashed p-8 text-center transition-all ${
        isDragging ? "border-accent bg-accent/5 shadow-[var(--shadow-medium)]" : "border-border"
      } ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
        {isProcessing ? (
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        ) : (
          <MapPin className="h-8 w-8 text-accent" />
        )}
      </div>
      
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        {isProcessing ? "Processing..." : "Upload POI CSV"}
      </h3>
      
      <p className="mb-4 text-sm text-muted-foreground">
        Upload points of interest to calculate optimal drivable route
      </p>

      <input
        type="file"
        accept=".csv"
        onChange={handleFileInput}
        className="hidden"
        id="poi-upload"
        disabled={isProcessing}
      />
      
      <Button asChild disabled={isProcessing}>
        <label htmlFor="poi-upload" className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4" />
          Select POI CSV File
        </label>
      </Button>

      <div className="mt-4 text-xs text-muted-foreground">
        <p>Expected format: poi_name, latitude, longitude</p>
        <p className="mt-1 text-muted-foreground/60">
          Route will follow real roads using OpenStreetMap data
        </p>
      </div>
    </Card>
  );
};
