import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RoutePoint } from "./CsvUploader";
import { POI } from "@/utils/routing";
import { Moon, Sun } from "lucide-react";

// Fix marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const TILE_LAYERS = {
  light: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
};

interface RouteMapProps {
  routes: Map<string, RoutePoint[]>;
  showCoordinates?: boolean;
  pois?: POI[];
  isPoisMode?: boolean;
  routeColor?: string;
}

const ROUTE_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52B788"
];

export const RouteMap = ({ 
  routes, 
  showCoordinates = true, 
  pois, 
  isPoisMode = false,
  routeColor = "#FF6B6B"
}: RouteMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([20, 0], 2);
    
    tileLayerRef.current = L.tileLayer(TILE_LAYERS.light, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle dark mode toggle
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    
    mapRef.current.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(isDarkMode ? TILE_LAYERS.dark : TILE_LAYERS.light, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapRef.current);
  }, [isDarkMode]);

  // Update routes
  useEffect(() => {
    if (!mapRef.current || routes.size === 0) return;

    // Clear existing layers
    layersRef.current.forEach((layer) => {
      mapRef.current?.removeLayer(layer);
    });
    layersRef.current = [];

    const allPoints: L.LatLngExpression[] = [];
    let colorIndex = 0;

    routes.forEach((points, routeName) => {
      if (points.length === 0) return;

      // Use custom color in POI mode, otherwise use color from palette
      const color = isPoisMode ? routeColor : ROUTE_COLORS[colorIndex % ROUTE_COLORS.length];
      colorIndex++;

      const latLngs: L.LatLngExpression[] = points.map((p) => [p.latitude, p.longitude]);
      allPoints.push(...latLngs);

      // Add polyline
      const polyline = L.polyline(latLngs, {
        color,
        weight: 4,
        opacity: 0.8,
      }).addTo(mapRef.current!);
      layersRef.current.push(polyline);

      // Add start marker (green) with "Start" label
      const startIcon = L.divIcon({
        html: `<div style="display: flex; flex-direction: column; align-items: center;">
          <div style="background-color: #22c55e; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white;"></div>
          <span style="background: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; color: #22c55e; margin-top: 4px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">Start</span>
        </div>`,
        className: "start-marker",
        iconSize: [60, 40],
        iconAnchor: [30, 14],
      });
      const startMarker = L.marker(latLngs[0] as L.LatLngExpression, { icon: startIcon })
        .bindPopup(`<strong>Start: ${routeName}</strong><br/>Lat: ${points[0].latitude.toFixed(5)}<br/>Lng: ${points[0].longitude.toFixed(5)}`)
        .addTo(mapRef.current!);
      layersRef.current.push(startMarker);

      // Add end marker (red) with "End" label
      if (latLngs.length > 1) {
        const endIcon = L.divIcon({
          html: `<div style="display: flex; flex-direction: column; align-items: center;">
            <div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white;"></div>
            <span style="background: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; color: #ef4444; margin-top: 4px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">End</span>
          </div>`,
          className: "end-marker",
          iconSize: [60, 40],
          iconAnchor: [30, 14],
        });
        const endMarker = L.marker(latLngs[latLngs.length - 1] as L.LatLngExpression, { icon: endIcon })
          .bindPopup(`<strong>End: ${routeName}</strong><br/>Lat: ${points[points.length - 1].latitude.toFixed(5)}<br/>Lng: ${points[points.length - 1].longitude.toFixed(5)}`)
          .addTo(mapRef.current!);
        layersRef.current.push(endMarker);
      }

      // Add point markers (smaller size) - only if showCoordinates is true
      if (showCoordinates && !isPoisMode) {
        points.forEach((point, idx) => {
          const pointIcon = L.divIcon({
            html: `<div style="background-color: ${color}; width: 6px; height: 6px; border-radius: 50%; border: 1px solid white;"></div>`,
            className: "point-marker",
            iconSize: [6, 6],
            iconAnchor: [3, 3],
          });

          const pointMarker = L.marker([point.latitude, point.longitude], { icon: pointIcon })
            .bindPopup(`<strong>${routeName}</strong><br/>Point ${idx + 1} of ${points.length}`)
            .addTo(mapRef.current!);
          layersRef.current.push(pointMarker);
        });
      }
    });

    // Add POI markers if in POI mode
    if (isPoisMode && pois && pois.length > 0) {
      pois.forEach((poi, idx) => {
        const poiIcon = L.divIcon({
          html: `<div style="display: flex; flex-direction: column; align-items: center;">
            <div style="background-color: #8b5cf6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
            <span style="background: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; color: #8b5cf6; margin-top: 4px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">${poi.name}</span>
          </div>`,
          className: "poi-marker",
          iconSize: [80, 50],
          iconAnchor: [40, 16],
        });

        const poiMarker = L.marker([poi.latitude, poi.longitude], { icon: poiIcon })
          .bindPopup(`<strong>POI: ${poi.name}</strong><br/>Stop ${idx + 1}<br/>Lat: ${poi.latitude.toFixed(5)}<br/>Lng: ${poi.longitude.toFixed(5)}`)
          .addTo(mapRef.current!);
        layersRef.current.push(poiMarker);
      });
    }

    // Fit bounds to show all routes
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [routes, showCoordinates, pois, isPoisMode, routeColor]);

  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden shadow-[var(--shadow-medium)]">
      <div ref={containerRef} className="h-full w-full" />
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="absolute top-3 right-3 z-[1000] p-2 bg-background/90 backdrop-blur-sm rounded-lg border border-border shadow-md hover:bg-muted transition-colors"
        title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDarkMode ? (
          <Sun className="h-5 w-5 text-yellow-500" />
        ) : (
          <Moon className="h-5 w-5 text-slate-600" />
        )}
      </button>
    </div>
  );
};
