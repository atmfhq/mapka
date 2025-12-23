-- Update get_nearby_profiles to round coordinates for other users (3 decimal places ≈ 110m precision)
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
    -- Return exact coordinates for own profile, rounded for others
    CASE WHEN p.id = auth.uid() THEN p.location_lat ELSE ROUND(p.location_lat::numeric, 3)::double precision END as location_lat,
    CASE WHEN p.id = auth.uid() THEN p.location_lng ELSE ROUND(p.location_lng::numeric, 3)::double precision END as location_lng,
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

-- Update get_public_profile to round coordinates for other users
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
 RETURNS TABLE(id uuid, nick text, avatar_url text, avatar_config jsonb, tags text[], location_lat double precision, location_lng double precision, bio text, is_active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
    p.is_active
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$function$;

-- Update get_public_profiles_by_ids to round coordinates for other users
CREATE OR REPLACE FUNCTION public.get_public_profiles_by_ids(user_ids uuid[])
 RETURNS TABLE(id uuid, nick text, avatar_url text, avatar_config jsonb, tags text[], location_lat double precision, location_lng double precision, bio text, is_active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
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
    p.is_active
  FROM public.profiles p
  WHERE p.id = ANY(user_ids);
END;
$function$;