-- Update RPC functions to use PostGIS from extensions schema
CREATE OR REPLACE FUNCTION public.get_nearby_profiles(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer DEFAULT 5000
)
RETURNS TABLE (
  id uuid,
  nick text,
  avatar_url text,
  avatar_config jsonb,
  tags text[],
  base_lat double precision,
  base_lng double precision,
  location_lat double precision,
  location_lng double precision,
  bio text,
  is_active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.nick,
    p.avatar_url,
    p.avatar_config,
    p.tags,
    p.base_lat,
    p.base_lng,
    p.location_lat,
    p.location_lng,
    p.bio,
    p.is_active
  FROM public.profiles p
  WHERE 
    p.is_active = true
    AND (
      (p.location_lat IS NOT NULL AND p.location_lng IS NOT NULL)
      OR (p.base_lat IS NOT NULL AND p.base_lng IS NOT NULL)
    )
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(
        COALESCE(p.location_lng, p.base_lng),
        COALESCE(p.location_lat, p.base_lat)
      ), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_nearby_megaphones(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer DEFAULT 5000
)
RETURNS TABLE (
  id uuid,
  title text,
  category text,
  start_time timestamptz,
  duration_minutes integer,
  max_participants integer,
  lat double precision,
  lng double precision,
  host_id uuid,
  is_private boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.title,
    m.category,
    m.start_time,
    m.duration_minutes,
    m.max_participants,
    m.lat,
    m.lng,
    m.host_id,
    m.is_private,
    m.created_at
  FROM public.megaphones m
  WHERE 
    extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(m.lng, m.lat), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
    AND (m.start_time + (m.duration_minutes || ' minutes')::interval) > NOW();
END;
$$;