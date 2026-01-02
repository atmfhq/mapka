import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type"); // "event" or "shout"
    const id = url.searchParams.get("id");

    console.log(`[generate-og-image] type=${type}, id=${id}`);

    if (!type || !id) {
      return new Response("Missing type or id parameter", { status: 400 });
    }

    if (type !== "event" && type !== "shout") {
      return new Response("Invalid type. Must be 'event' or 'shout'", { status: 400 });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mapboxToken = Deno.env.get("VITE_MAPBOX_TOKEN");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let lat: number | null = null;
    let lng: number | null = null;
    let title: string | null = null;
    let markerColor = "ff6b35"; // Orange for events

    if (type === "event") {
      // Fetch event by share_code or id
      const { data: event, error } = await supabase
        .from("megaphones")
        .select("lat, lng, title, share_code")
        .or(`share_code.eq.${id},id.eq.${id}`)
        .maybeSingle();

      if (error) {
        console.error("[generate-og-image] Error fetching event:", error);
        return new Response("Error fetching event", { status: 500 });
      }

      if (!event) {
        console.log("[generate-og-image] Event not found");
        return new Response("Event not found", { status: 404 });
      }

      lat = event.lat;
      lng = event.lng;
      title = event.title;
      markerColor = "4CAF50"; // Green for events
    } else if (type === "shout") {
      const { data: shout, error } = await supabase
        .from("shouts")
        .select("lat, lng, content")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("[generate-og-image] Error fetching shout:", error);
        return new Response("Error fetching shout", { status: 500 });
      }

      if (!shout) {
        console.log("[generate-og-image] Shout not found");
        return new Response("Shout not found", { status: 404 });
      }

      lat = shout.lat;
      lng = shout.lng;
      title = shout.content?.substring(0, 50);
      markerColor = "ff6b35"; // Orange for shouts
    }

    if (lat === null || lng === null) {
      return new Response("Invalid coordinates", { status: 400 });
    }

    // If we have a Mapbox token, use the Static Images API
    if (mapboxToken) {
      // Generate Mapbox Static Image URL
      // Format: https://api.mapbox.com/styles/v1/{style}/static/{overlay}/{lon},{lat},{zoom},{bearing},{pitch}/{width}x{height}
      const zoom = 14;
      const width = 1200;
      const height = 630;
      const style = "mapbox/streets-v12";
      
      // Create a pin marker overlay
      const marker = `pin-l+${markerColor}(${lng},${lat})`;
      
      const mapboxUrl = `https://api.mapbox.com/styles/v1/${style}/static/${marker}/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${mapboxToken}`;

      console.log(`[generate-og-image] Redirecting to Mapbox Static Image`);

      // Fetch the image from Mapbox and return it
      const imageResponse = await fetch(mapboxUrl);
      
      if (!imageResponse.ok) {
        console.error("[generate-og-image] Mapbox API error:", await imageResponse.text());
        // Fall back to SVG
        return generateFallbackSVG(lat, lng, title, markerColor);
      }

      const imageBuffer = await imageResponse.arrayBuffer();

      return new Response(imageBuffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      });
    }

    // Fallback: Generate a simple SVG map representation
    return generateFallbackSVG(lat, lng, title, markerColor);

  } catch (error) {
    console.error("[generate-og-image] Unexpected error:", error);
    return new Response("Internal server error", { status: 500 });
  }
});

function generateFallbackSVG(lat: number, lng: number, title: string | null, markerColor: string): Response {
  // Generate a simple SVG with coordinates and a pin icon
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a2e"/>
          <stop offset="100%" style="stop-color:#16213e"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bg)"/>
      
      <!-- Grid pattern -->
      <g stroke="#ffffff" stroke-opacity="0.1" stroke-width="1">
        ${Array.from({ length: 20 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="630"/>`).join('')}
        ${Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${i * 60}" x2="1200" y2="${i * 60}"/>`).join('')}
      </g>
      
      <!-- Decorative circles -->
      <circle cx="600" cy="280" r="150" stroke="#${markerColor}" stroke-opacity="0.3" fill="none" stroke-width="2"/>
      <circle cx="600" cy="280" r="100" stroke="#${markerColor}" stroke-opacity="0.5" fill="none" stroke-width="2"/>
      <circle cx="600" cy="280" r="50" stroke="#${markerColor}" stroke-opacity="0.7" fill="none" stroke-width="2"/>
      
      <!-- Pin marker -->
      <g transform="translate(570, 200)" filter="url(#glow)">
        <path d="M30 0C13.4 0 0 13.4 0 30c0 22.5 30 50 30 50s30-27.5 30-50c0-16.6-13.4-30-30-30z" 
              fill="#${markerColor}"/>
        <circle cx="30" cy="28" r="12" fill="#ffffff"/>
      </g>
      
      <!-- Coordinates -->
      <text x="600" y="400" text-anchor="middle" fill="#ffffff" font-family="monospace" font-size="18" opacity="0.7">
        ${lat.toFixed(4)}°, ${lng.toFixed(4)}°
      </text>
      
      <!-- Title if available -->
      ${title ? `<text x="600" y="450" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="24" font-weight="bold">
        ${escapeXml(title)}
      </text>` : ''}
      
      <!-- Brand -->
      <text x="600" y="550" text-anchor="middle" fill="#${markerColor}" font-family="sans-serif" font-size="36" font-weight="bold">
        MAPKA
      </text>
      <text x="600" y="580" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="16" opacity="0.6">
        Find Your Spot
      </text>
    </svg>
  `;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
