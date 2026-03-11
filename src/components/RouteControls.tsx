import { Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MultiRoute } from "./MultiPoiUploader";

interface RouteControlsProps {
  routes: MultiRoute[];
  onToggleVisibility: (id: string) => void;
  overlapData: Map<string, Map<string, number>>;
}

export const RouteControls = ({ routes, onToggleVisibility, overlapData }: RouteControlsProps) => {
  if (routes.length === 0) return null;

  return (
    <Card className="p-4">
      <Label className="text-sm font-medium mb-3 block">Routes ({routes.length})</Label>
      <div className="space-y-2">
        {routes.map((route) => {
          const routeOverlaps = overlapData.get(route.id);
          
          return (
            <div 
              key={route.id} 
              className="flex items-center gap-3 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors group"
            >
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-background shadow-sm" 
                style={{ backgroundColor: route.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{route.name}</p>
                <p className="text-xs text-muted-foreground">{route.pois.length} POIs</p>
              </div>
              
              {/* Overlap info on hover */}
              {routeOverlaps && routeOverlaps.size > 0 && (
                <div className="hidden group-hover:block absolute left-full ml-2 bg-popover border rounded-md p-2 shadow-lg z-50 min-w-[150px]">
                  <p className="text-xs font-medium mb-1">Overlap with:</p>
                  {Array.from(routeOverlaps.entries()).map(([otherId, percent]) => {
                    const otherRoute = routes.find(r => r.id === otherId);
                    if (!otherRoute || percent === 0) return null;
                    return (
                      <div key={otherId} className="flex items-center gap-2 text-xs">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: otherRoute.color }}
                        />
                        <span className="truncate">{otherRoute.name}</span>
                        <span className="font-mono ml-auto">{percent.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              <button
                onClick={() => onToggleVisibility(route.id)}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                {route.visible ? (
                  <Eye className="h-4 w-4 text-foreground" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
