-- Fix online presence visibility issues
-- Problem: Users don't see each other on login because is_online starts as false
-- Solution: Remove is_online filter from get_nearby_profiles - visibility should only depend on is_active (ghost mode)
-- The is_online flag is still useful for cleanup of stale sessions, but not for filtering visibility

-- Drop existing function first (required when changing function body)
DROP FUNCTION IF EXISTS public.get_nearby_profiles(double precision, double precision, integer);

-- Recreate get_nearby_profiles WITHOUT is_online filter
-- Visibility now depends ONLY on is_active (ghost mode - user controlled)
CREATE OR REPLACE FUNCTION public.get_nearby_profiles(p_lat double precision, p_lng double precision, p_radius_meters integer DEFAULT 5000)
 RETURNS TABLE(id uuid, nick text, avatar_url text, avatar_config jsonb, tags text[], location_lat double precision, location_lng double precision, bio text, is_active boolean, last_bounce_at timestamp with time zone, is_online boolean, last_seen timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Only rate limit authenticated users
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.check_rate_limit('get_nearby_profiles', 20, 60);
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.nick,
    p.avatar_url,
    p.avatar_config,
    p.tags,
    -- Return exact coordinates for own profile, rounded for others
    CASE WHEN p.id = auth.uid() THEN p.location_lat ELSE ROUND(p.location_lat::numeric, 3)::double precision END as location_lat,
    CASE WHEN p.id = auth.uid() THEN p.location_lng ELSE ROUND(p.location_lng::numeric, 3)::double precision END as location_lng,
    p.bio,
    p.is_active,
    p.last_bounce_at,
    p.is_online,
    p.last_seen
  FROM public.profiles p
  WHERE
    p.is_active = true  -- Only ghost mode matters for visibility
    -- REMOVED: AND p.is_online = true (this caused users to be invisible on login)
    AND p.location_lat IS NOT NULL
    AND p.location_lng IS NOT NULL
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(p.location_lng, p.location_lat), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    );
END;
$function$;
