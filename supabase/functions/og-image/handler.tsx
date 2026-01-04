import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImageResponse } from "https://esm.sh/@vercel/og@0.6.8?deno-std=0.224.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type OgType = "event" | "shout";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function toDataUrlPng(bytes: Uint8Array): string {
  return `data:image/png;base64,${encodeBase64(bytes)}`;
}

function getMapboxToken(): string | null {
  // Support the legacy env name used by existing functions, but prefer MAPBOX_ACCESS_TOKEN.
  return Deno.env.get("MAPBOX_ACCESS_TOKEN") ||
    Deno.env.get("VITE_MAPBOX_TOKEN") ||
    null;
}

function mapboxStaticUrl(args: {
  token: string;
  lat: number;
  lng: number;
  zoom: number;
  width: number;
  height: number;
  style: string;
}): string {
  const { token, lat, lng, zoom, width, height, style } = args;
  const markerColor = "285AEB"; // blue
  const overlay = `pin-s+${markerColor}(${lng},${lat})`;
  // Note: @2x gives higher-res imagery while we still render at 1200x630.
  return `https://api.mapbox.com/styles/v1/${style}/static/${overlay}/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${encodeURIComponent(token)}&logo=false&attribution=false`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const typeRaw = url.searchParams.get("type");
    const id = url.searchParams.get("id");

    if (!typeRaw || !id) {
      return new Response("Missing type or id parameter", { status: 400, headers: corsHeaders });
    }

    if (typeRaw !== "event" && typeRaw !== "shout") {
      return new Response("Invalid type. Must be 'event' or 'shout'", { status: 400, headers: corsHeaders });
    }

    const type: OgType = typeRaw;

    // Initialize Supabase client (server-side; bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let lat: number | null = null;
    let lng: number | null = null;
    let title = "Mapka";
    let description = "Find your spot.";

    if (type === "event") {
      const { data: event, error } = await supabase
        .from("megaphones")
        .select("title, description, lat, lng, category, share_code")
        // allow id or share_code
        .or(`share_code.eq.${id},id.eq.${id}`)
        .maybeSingle();

      if (error) {
        console.error("[og-image] Error fetching event:", error);
        return new Response("Error fetching event", { status: 500, headers: corsHeaders });
      }
      if (!event) {
        return new Response("Event not found", { status: 404, headers: corsHeaders });
      }

      lat = event.lat;
      lng = event.lng;
      title = event.title ? `${event.title}` : "Event on Mapka";
      description = event.description || `Join this ${event.category || "event"} on Mapka.`;
    } else {
      const { data: shout, error } = await supabase
        .from("shouts")
        .select("content, lat, lng")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("[og-image] Error fetching shout:", error);
        return new Response("Error fetching shout", { status: 500, headers: corsHeaders });
      }
      if (!shout) {
        return new Response("Shout not found", { status: 404, headers: corsHeaders });
      }

      lat = shout.lat;
      lng = shout.lng;
      title = shout.content ? truncate(shout.content, 72) : "Shout on Mapka";
      description = shout.content ? truncate(shout.content, 140) : "See what's happening nearby on Mapka.";
    }

    if (lat === null || lng === null) {
      return new Response("Invalid coordinates", { status: 400, headers: corsHeaders });
    }

    const width = 1200;
    const height = 630;
    const zoom = 15;
    const style = "mapbox/outdoors-v12";

    let mapDataUrl: string | null = null;
    const mapboxToken = getMapboxToken();
    if (mapboxToken) {
      const mapUrl = mapboxStaticUrl({ token: mapboxToken, lat, lng, zoom, width, height, style });
      const mapResp = await fetch(mapUrl);
      if (mapResp.ok) {
        const buf = new Uint8Array(await mapResp.arrayBuffer());
        mapDataUrl = toDataUrlPng(buf);
      } else {
        console.warn("[og-image] Mapbox static failed:", mapResp.status, await mapResp.text());
      }
    }

    const safeTitle = truncate(title, 90);
    const safeDescription = truncate(description, 160);
    const label = type === "event" ? "Event" : "Shout";

    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            position: "relative",
            display: "flex",
            background: "#0B1020",
            overflow: "hidden",
          }}
        >
          {mapDataUrl
            ? (
              <img
                src={mapDataUrl}
                width={1200}
                height={630}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "1200px",
                  height: "630px",
                  objectFit: "cover",
                }}
              />
            )
            : (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "1200px",
                  height: "630px",
                  background:
                    "linear-gradient(135deg, rgba(12,17,38,1) 0%, rgba(22,33,78,1) 60%, rgba(12,17,38,1) 100%)",
                }}
              />
            )}

          {/* readability overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "1200px",
              height: "630px",
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.10) 55%, rgba(0,0,0,0.55) 100%)",
            }}
          />

          {/* bottom card */}
          <div
            style={{
              position: "absolute",
              left: 56,
              right: 56,
              bottom: 56,
              display: "flex",
            }}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                padding: "32px 36px",
                borderRadius: 28,
                background: "rgba(10, 14, 26, 0.62)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  maxWidth: 880,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      color: "rgba(255,255,255,0.92)",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    {label}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 46,
                    fontWeight: 900,
                    letterSpacing: "-0.02em",
                    color: "#FFFFFF",
                    lineHeight: 1.12,
                  }}
                >
                  {safeTitle}
                </div>

                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.85)",
                    lineHeight: 1.3,
                  }}
                >
                  {safeDescription}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 26,
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.20)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFFFFF",
                    fontSize: 46,
                    fontWeight: 950,
                  }}
                >
                  M
                </div>
                <div
                  style={{
                    color: "rgba(255,255,255,0.90)",
                    fontSize: 20,
                    fontWeight: 800,
                    letterSpacing: "0.02em",
                  }}
                >
                  Mapka
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width,
        height,
        headers: {
          ...corsHeaders,
          "Content-Type": "image/png",
          // cache at the edge; regenerate after 1h, allow SWR
          "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("[og-image] Unexpected error:", error);
    return new Response("Internal server error", { status: 500, headers: corsHeaders });
  }
});


