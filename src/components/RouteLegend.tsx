import { Card } from "@/components/ui/card";
import { RoutePoint } from "./CsvUploader";
import { MapPin } from "lucide-react";

interface RouteLegendProps {
  routes: Map<string, RoutePoint[]>;
}

const ROUTE_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52B788"
];

export const RouteLegend = ({ routes }: RouteLegendProps) => {
  if (routes.size === 0) return null;

  return (
    <Card className="p-4 shadow-[var(--shadow-medium)]">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPin className="h-4 w-4 text-accent" />
        Active Routes
      </h3>
      <div className="space-y-2">
        {Array.from(routes.entries()).map(([routeName, points], index) => {
          const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
          return (
            <div key={routeName} className="flex items-center gap-3 text-sm">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium text-foreground">{routeName}</span>
              <span className="text-muted-foreground">
                ({points.length} points)
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
