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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type"); // "event" or "shout"
    const id = url.searchParams.get("id");
    const userAgent = req.headers.get("user-agent");

    console.log(`[og-share] type=${type}, id=${id}, userAgent=${userAgent}`);

    if (!type || !id) {
      return new Response("Missing type or id", { status: 400 });
    }

    // Get the base URL for the app
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Determine the app URL (for redirects and canonical URLs)
    // In production, this would be the actual domain
    const appBaseUrl = "https://hbywzsfecjmkaypbgyuu.lovableproject.com";
    
    // Build the redirect path
    let redirectPath = "/";
    if (type === "event") {
      redirectPath = `/?event=${id}`;
    } else if (type === "shout") {
      redirectPath = `/?shout=${id}`;
    }

    const fullAppUrl = `${appBaseUrl}${redirectPath}`;

    // If not a bot, just redirect to the app
    if (!isBot(userAgent)) {
      console.log(`[og-share] Not a bot, redirecting to ${fullAppUrl}`);
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": fullAppUrl,
        },
      });
    }

    console.log(`[og-share] Bot detected, serving OG meta tags`);

    // Fetch data for the meta tags
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let title = "Mapka - Find Your Spot";
    let description = "Discover events and connect with people nearby.";
    let lat: number | null = null;
    let lng: number | null = null;

    if (type === "event") {
      const { data: event } = await supabase
        .from("megaphones")
        .select("title, description, lat, lng, category")
        .or(`share_code.eq.${id},id.eq.${id}`)
        .maybeSingle();

      if (event) {
        title = `${event.title} | Mapka`;
        description = event.description || `Join this ${event.category || "event"} on Mapka!`;
        lat = event.lat;
        lng = event.lng;
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

    // Build the OG image URL
    const ogImageUrl = `${supabaseUrl}/functions/v1/generate-og-image?type=${type}&id=${id}`;

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
