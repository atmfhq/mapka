type OgType = "event" | "shout";

function getSupabaseUrl(): string | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || null;
  return url?.startsWith("http") ? url : null;
}

/**
 * URL for sharing that works for crawlers (served by Supabase Edge Function `og-share`).
 * For humans it will redirect into the SPA.
 */
export function buildShareUrl(args: { type: OgType; id: string }): string {
  const supabaseUrl = getSupabaseUrl();
  const { type, id } = args;
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1/og-share?type=${type}&id=${encodeURIComponent(id)}`;
  }

  // Fallback if env is missing (local broken env etc.)
  if (type === "shout") return `${window.location.origin}/shout/${id}`;
  return `${window.location.origin}/event/${id}`;
}


