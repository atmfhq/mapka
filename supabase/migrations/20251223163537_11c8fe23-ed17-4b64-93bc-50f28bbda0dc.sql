-- Drop and recreate get_nearby_profiles function to include last_bounce_at
DROP FUNCTION IF EXISTS public.get_nearby_profiles(double precision, double precision, integer);

CREATE OR REPLACE FUNCTION public.get_nearby_profiles(p_lat double precision, p_lng double precision, p_radius_meters integer DEFAULT 5000)
 RETURNS TABLE(id uuid, nick text, avatar_url text, avatar_config jsonb, tags text[], location_lat double precision, location_lng double precision, bio text, is_active boolean, last_bounce_at timestamp with time zone)
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
    p.location_lat,
    p.location_lng,
    p.bio,
    p.is_active,
    p.last_bounce_at
  FROM public.profiles p
  WHERE 
    p.is_active = true
    AND p.location_lat IS NOT NULL 
    AND p.location_lng IS NOT NULL
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(p.location_lng, p.location_lat), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    );
END;
$function$;