import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This Edge Function serves HTML pages with proper OG meta tags for social media crawlers
// It detects if the request is from a bot/crawler and serves meta tags, otherwise redirects to the app

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOT_USER_AGENTS = [
  "facebookexternalhit",
  "Facebot",
  "Twitterbot",
  "WhatsApp",
  "LinkedInBot",
  "Pinterest",
  "Slackbot",
  "TelegramBot",
  "Discordbot",
  "vkShare",
  "Googlebot",
  "bingbot",
];

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_USER_AGENTS.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
}

function isUuid(value: string): boolean {
  // basic UUID v1-v5 matcher
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type"); // "event" or "shout"
    const id = url.searchParams.get("id");
    const force = url.searchParams.get("force") === "1";
    const userAgent = req.headers.get("user-agent");

    console.log(`[og-share] type=${type}, id=${id}, userAgent=${userAgent}`);

    if (!type || !id) {
      return new Response("Missing type or id", { status: 400 });
    }

    // Get the base URL for the app
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Determine the app URL (for redirects and canonical URLs)
    // Set APP_BASE_URL in Supabase secrets for production.
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "http://localhost:8080";
    
    // Build the redirect path (must match SPA deep-link params handled in `Dashboard`)
    let redirectPath = "/";
    if (type === "event") {
      // Prefer short share codes (`c=`); fall back to UUID param (`eventId=`)
      redirectPath = isUuid(id) ? `/?eventId=${id}` : `/?c=${encodeURIComponent(id)}`;
    } else if (type === "shout") {
      redirectPath = `/?shoutId=${id}`;
    }

    const fullAppUrl = `${appBaseUrl}${redirectPath}`;

    // If not a bot, just redirect to the app (unless forced for debugging)
    if (!force && !isBot(userAgent)) {
      console.log(`[og-share] Not a bot, redirecting to ${fullAppUrl}`);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": fullAppUrl,
        },
      });
    }

    console.log(`[og-share] ${force ? "Forced" : "Bot detected"}, serving OG meta tags`);

    // Fetch data for the meta tags
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let title = "Mapka - Find Your Spot";
    let description = "Discover events and connect with people nearby.";
    let lat: number | null = null;
    let lng: number | null = null;
    const ogDefaultRaw = Deno.env.get("OG_DEFAULT_IMAGE_URL") || `${appBaseUrl}/icon.svg`;
    let ogImageUrl = normalizeOgImageUrl(ogDefaultRaw, appBaseUrl) || `${appBaseUrl}/icon.svg`;

    if (type === "event") {
      const { data: event } = await supabase
        .from("megaphones")
        .select("title, description, lat, lng, category, is_official, cover_image_url")
        .or(`share_code.eq.${id},id.eq.${id}`)
        .maybeSingle();

      if (event) {
        title = `${event.title} | Mapka`;
        description = event.description || `Join this ${event.category || "event"} on Mapka!`;
        lat = event.lat;
        lng = event.lng;

        // Official events: use their cover image as OG image
        if (event.is_official && event.cover_image_url) {
          const normalized = normalizeOgImageUrl(event.cover_image_url, appBaseUrl);
          if (normalized) ogImageUrl = normalized;
        }
      }
    } else if (type === "shout") {
      const { data: shout } = await supabase
        .from("shouts")
        .select("content, lat, lng")
        .eq("id", id)
        .maybeSingle();

      if (shout) {
        title = `${shout.content?.substring(0, 60) || "Shout"} | Mapka`;
        description = shout.content || "See what's happening nearby on Mapka!";
        lat = shout.lat;
        lng = shout.lng;
      }
    }

    // Serve HTML with proper meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${fullAppUrl}">
  <meta property="og:site_name" content="Mapka">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${ogImageUrl}">
  
  ${lat && lng ? `
  <!-- Location -->
  <meta property="og:latitude" content="${lat}">
  <meta property="og:longitude" content="${lng}">
  ` : ''}
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${fullAppUrl}">
  
  <!-- Redirect for non-JS clients -->
  <meta http-equiv="refresh" content="0;url=${fullAppUrl}">
  
  <script>
    // Immediate redirect for browsers
    window.location.replace("${fullAppUrl}");
  </script>
</head>
<body>
  <p>Redirecting to <a href="${fullAppUrl}">Mapka</a>...</p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
      },
    });

  } catch (error) {
    console.error("[og-share] Error:", error);
    return new Response("Internal server error", { status: 500 });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeOgImageUrl(value: string, appBaseUrl: string): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;

  // Disallow dangerous/unsupported schemes in OG tags.
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("file:")
  ) return null;

  let absolute: string;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    absolute = trimmed;
  } else if (trimmed.startsWith("/")) {
    absolute = `${appBaseUrl}${trimmed}`;
  } else {
    absolute = `${appBaseUrl}/${trimmed}`;
  }

  try {
    const u = new URL(absolute);

    // Allow http only for localhost dev; otherwise require https.
    const isLocalhost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(isLocalhost && u.protocol === "http:")) return null;

    // Avoid expiring signed storage URLs for OG images (previews might re-fetch later).
    // Prefer public bucket URLs: /storage/v1/object/public/...
    if (u.pathname.includes("/storage/v1/object/sign/")) return null;

    return u.toString();
  } catch {
    return null;
  }
}
