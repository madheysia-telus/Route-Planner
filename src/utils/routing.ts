// OSRM routing utilities for calculating optimal routes between POIs

export interface POI {
  name: string;
  latitude: number;
  longitude: number;
}

export interface RoutedPath {
  coordinates: [number, number][]; // [lng, lat] format from OSRM
  distance: number; // in meters
  duration: number; // in seconds
  optimizedPois?: POI[]; // POIs in optimized order
}

/**
 * Uses backend routing service to compute optimal route visiting all POIs
 * @param pois Array of POIs to visit
 * @param startIndex Index of the starting POI (default 0)
 * @param endIndex Index of the ending POI (default null = auto)
 * @returns Routed path with coordinates following real roads
 */
export async function calculateOptimalRoute(
  pois: POI[], 
  startIndex: number = 0, 
  endIndex: number | null = null
): Promise<RoutedPath | null> {
  if (pois.length < 2) {
    throw new Error("At least 2 POIs are required for routing");
  }

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const functionUrl = `${supabaseUrl}/functions/v1/calculate-route`;
    
    console.log('Calling routing service:', functionUrl);
    console.log('POIs to route:', pois);
    console.log('Start index:', startIndex, 'End index:', endIndex);
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pois, startIndex, endIndex }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Routing service error:', response.status, errorData);
      throw new Error(errorData.error || `Routing service error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Route calculated successfully');
    
    return {
      coordinates: data.coordinates,
      distance: data.distance,
      duration: data.duration,
      optimizedPois: data.optimizedPois,
    };
  } catch (error) {
    console.error('Routing error:', error);
    throw error;
  }
}
