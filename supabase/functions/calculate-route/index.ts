import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let pois;
    let startIndex = 0;
    let endIndex: number | null = null;
    
    try {
      const body = await req.json();
      pois = body.pois;
      startIndex = body.startIndex ?? 0;
      endIndex = body.endIndex ?? null;
    } catch (jsonError) {
      console.error('Failed to parse request body:', jsonError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request body',
          details: 'Request must contain valid JSON with pois array'
        }), 
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Received request with POIs:', pois?.length || 0);

    if (!pois || pois.length < 2) {
      console.error('Invalid POI count:', pois?.length);
      return new Response(
        JSON.stringify({ error: 'At least 2 POIs are required' }), 
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Calculating route for ${pois.length} POIs, start: ${startIndex}, end: ${endIndex}`);

    // Reorder POIs: put start first, end last, others in between
    const orderedPois = [...pois];
    const startPoi = orderedPois.splice(startIndex, 1)[0];
    
    let endPoi = null;
    if (endIndex !== null && endIndex !== startIndex) {
      // Adjust index since we removed start
      const adjustedEndIndex = endIndex > startIndex ? endIndex - 1 : endIndex;
      endPoi = orderedPois.splice(adjustedEndIndex, 1)[0];
    }
    
    // Rebuild: start + middle + end
    const finalPois = [startPoi, ...orderedPois];
    if (endPoi) {
      finalPois.push(endPoi);
    }

    // Format coordinates for OSRM (lng,lat format)
    const coordinates = finalPois.map((poi: any) => `${poi.longitude},${poi.latitude}`).join(';');
    
    // Use OSRM trip service with source=first, destination=last, roundtrip=false
    const osrmUrl = `https://router.project-osrm.org/trip/v1/driving/${coordinates}?overview=full&geometries=geojson&source=first&destination=last&roundtrip=false`;
    
    console.log('Calling OSRM:', osrmUrl);

    const osrmResponse = await fetch(osrmUrl);
    
    if (!osrmResponse.ok) {
      const errorText = await osrmResponse.text();
      console.error('OSRM API error:', osrmResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'OSRM routing service error',
          details: errorText 
        }), 
        { 
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const data = await osrmResponse.json();
    console.log('OSRM response code:', data.code);
    
    if (data.code !== 'Ok' || !data.trips || data.trips.length === 0) {
      console.error('OSRM returned invalid data:', data);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to calculate route',
          details: data.message || 'No trips found'
        }), 
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const trip = data.trips[0];
    
    // Get the optimal waypoint order from OSRM
    const waypointOrder = data.waypoints.map((wp: any) => wp.waypoint_index);
    
    // Map back to original POI order
    const optimizedPois = waypointOrder.map((idx: number) => finalPois[idx]);
    
    console.log(`Route calculated: ${(trip.distance / 1000).toFixed(2)} km, ${Math.round(trip.duration / 60)} min`);

    return new Response(
      JSON.stringify({
        coordinates: trip.geometry.coordinates,
        distance: trip.distance,
        duration: trip.duration,
        optimizedPois: optimizedPois,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in calculate-route function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
