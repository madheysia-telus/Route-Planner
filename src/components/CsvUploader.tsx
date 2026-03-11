import { useCallback, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Papa from "papaparse";
import { toast } from "sonner";

export interface RoutePoint {
  routeName: string;
  latitude: number;
  longitude: number;
}

interface CsvUploaderProps {
  onRoutesLoaded: (routes: Map<string, RoutePoint[]>) => void;
}

export const CsvUploader = ({ onRoutesLoaded }: CsvUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = useCallback((file: File) => {
    setIsProcessing(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const routeMap = new Map<string, RoutePoint[]>();
          let validCount = 0;
          let invalidCount = 0;

          results.data.forEach((row: any) => {
            const routeName = row.route_name || row.routeName;
            const lat = parseFloat(row.latitude);
            const lng = parseFloat(row.longitude);

            if (routeName && !isNaN(lat) && !isNaN(lng)) {
              if (!routeMap.has(routeName)) {
                routeMap.set(routeName, []);
              }
              routeMap.get(routeName)!.push({
                routeName,
                latitude: lat,
                longitude: lng,
              });
              validCount++;
            } else {
              invalidCount++;
            }
          });

          if (routeMap.size === 0) {
            toast.error("No valid routes found in CSV", {
              description: "Please check your CSV format: route_name, latitude, longitude"
            });
          } else {
            onRoutesLoaded(routeMap);
            toast.success(`${routeMap.size} route(s) loaded successfully`, {
              description: `${validCount} points loaded${invalidCount > 0 ? `, ${invalidCount} skipped` : ""}`
            });
          }
        } catch (error) {
          toast.error("Failed to parse CSV", {
            description: "Please check your file format"
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
  }, [onRoutesLoaded]);

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
          <Upload className="h-8 w-8 text-accent" />
        )}
      </div>
      
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        {isProcessing ? "Processing..." : "Upload Route CSV"}
      </h3>
      
      <p className="mb-4 text-sm text-muted-foreground">
        Drag and drop your CSV file or click to browse
      </p>

      <input
        type="file"
        accept=".csv"
        onChange={handleFileInput}
        className="hidden"
        id="csv-upload"
        disabled={isProcessing}
      />
      
      <Button asChild disabled={isProcessing}>
        <label htmlFor="csv-upload" className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4" />
          Select CSV File
        </label>
      </Button>

      <div className="mt-4 text-xs text-muted-foreground">
        <p>Expected format: route_name, latitude, longitude</p>
      </div>
    </Card>
  );
};
