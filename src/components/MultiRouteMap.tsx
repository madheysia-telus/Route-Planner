import { useEffect, useRef, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MultiRoute } from "./MultiPoiUploader";
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

interface MultiRouteMapProps {
  routes: MultiRoute[];
  onOverlapCalculated: (overlapData: Map<string, Map<string, number>>) => void;
}

// Helper to calculate distance between two points
const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Check if a point is near any segment of another route
const isPointNearRoute = (lat: number, lng: number, routePoints: {latitude: number, longitude: number}[], threshold = 100): boolean => {
  for (const point of routePoints) {
    if (haversineDistance(lat, lng, point.latitude, point.longitude) < threshold) {
      return true;
    }
  }
  return false;
};

export const MultiRouteMap = ({ routes, onOverlapCalculated }: MultiRouteMapProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const popupRef = useRef<L.Popup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const visibleRoutes = useMemo(() => routes.filter(r => r.visible), [routes]);

  // Calculate overlaps
  useEffect(() => {
    if (routes.length < 2) {
      onOverlapCalculated(new Map());
      return;
    }

    const overlapData = new Map<string, Map<string, number>>();

    routes.forEach(route => {
      const routeOverlaps = new Map<string, number>();
      
      routes.forEach(otherRoute => {
        if (route.id === otherRoute.id) return;
        
        let overlappingPoints = 0;
        route.points.forEach(point => {
          if (isPointNearRoute(point.latitude, point.longitude, otherRoute.points)) {
            overlappingPoints++;
          }
        });
        
        const overlapPercent = route.points.length > 0 
          ? (overlappingPoints / route.points.length) * 100 
          : 0;
        
        routeOverlaps.set(otherRoute.id, overlapPercent);
      });
      
      overlapData.set(route.id, routeOverlaps);
    });

    onOverlapCalculated(overlapData);
  }, [routes, onOverlapCalculated]);

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
    if (!mapRef.current) return;

    // Clear existing layers
    layersRef.current.forEach((layer) => {
      mapRef.current?.removeLayer(layer);
    });
    layersRef.current = [];

    if (visibleRoutes.length === 0) return;

    const allPoints: L.LatLngExpression[] = [];

    visibleRoutes.forEach((route) => {
      if (route.points.length === 0) return;

      const latLngs: L.LatLngExpression[] = route.points.map((p) => [p.latitude, p.longitude]);
      allPoints.push(...latLngs);

      // Add polyline with hover for overlap info
      const polyline = L.polyline(latLngs, {
        color: route.color,
        weight: 4,
        opacity: 0.8,
      }).addTo(mapRef.current!);
      
      polyline.on('mouseover', (e) => {
        if (popupRef.current) {
          mapRef.current?.closePopup(popupRef.current);
        }
        
        // Build overlap info
        const otherRoutes = routes.filter(r => r.id !== route.id);
        let overlapHtml = '';
        
        if (otherRoutes.length > 0) {
          let overlappingPoints = 0;
          route.points.forEach(point => {
            for (const other of otherRoutes) {
              if (isPointNearRoute(point.latitude, point.longitude, other.points)) {
                overlappingPoints++;
                break;
              }
            }
          });
          const totalOverlap = route.points.length > 0 
            ? (overlappingPoints / route.points.length) * 100 
            : 0;
          
          if (totalOverlap > 0) {
            overlapHtml = `<br><span style="color:#888">Overlap: ${totalOverlap.toFixed(1)}%</span>`;
          }
        }
        
        const popup = L.popup({ closeButton: false, offset: [0, -5] })
          .setLatLng(e.latlng)
          .setContent(`<strong style="color:${route.color}">${route.name}</strong><br>${route.pois.length} POIs${overlapHtml}`)
          .openOn(mapRef.current!);
        
        popupRef.current = popup;
      });
      
      polyline.on('mouseout', () => {
        if (popupRef.current) {
          mapRef.current?.closePopup(popupRef.current);
          popupRef.current = null;
        }
      });
      
      layersRef.current.push(polyline);

      // Start marker
      const startIcon = L.divIcon({
        html: `<div style="display: flex; flex-direction: column; align-items: center;">
          <div style="background-color: #22c55e; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
          <span style="background: ${route.color}; padding: 1px 4px; border-radius: 3px; font-size: 9px; font-weight: 600; color: white; margin-top: 2px; white-space: nowrap;">Start</span>
        </div>`,
        className: "start-marker",
        iconSize: [50, 30],
        iconAnchor: [25, 12],
      });
      const startMarker = L.marker(latLngs[0], { icon: startIcon }).addTo(mapRef.current!);
      layersRef.current.push(startMarker);

      // End marker
      if (latLngs.length > 1) {
        const endIcon = L.divIcon({
          html: `<div style="display: flex; flex-direction: column; align-items: center;">
            <div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
            <span style="background: ${route.color}; padding: 1px 4px; border-radius: 3px; font-size: 9px; font-weight: 600; color: white; margin-top: 2px; white-space: nowrap;">End</span>
          </div>`,
          className: "end-marker",
          iconSize: [50, 30],
          iconAnchor: [25, 12],
        });
        const endMarker = L.marker(latLngs[latLngs.length - 1], { icon: endIcon }).addTo(mapRef.current!);
        layersRef.current.push(endMarker);
      }

      // POI markers
      route.pois.forEach((poi, idx) => {
        const poiIcon = L.divIcon({
          html: `<div style="display: flex; flex-direction: column; align-items: center;">
            <div style="background-color: ${route.color}; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
            <span style="background: rgba(255,255,255,0.9); padding: 1px 3px; border-radius: 2px; font-size: 8px; font-weight: 600; color: ${route.color}; margin-top: 2px; white-space: nowrap; max-width: 60px; overflow: hidden; text-overflow: ellipsis;">${poi.name}</span>
          </div>`,
          className: "poi-marker",
          iconSize: [70, 35],
          iconAnchor: [35, 10],
        });

        const poiMarker = L.marker([poi.latitude, poi.longitude], { icon: poiIcon })
          .bindPopup(`<strong>${route.name}</strong><br>POI: ${poi.name}<br>Stop ${idx + 1}`)
          .addTo(mapRef.current!);
        layersRef.current.push(poiMarker);
      });
    });

    // Fit bounds
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [visibleRoutes, routes]);

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
