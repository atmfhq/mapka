-- Create RPC function to get nearby shouts with strict radius enforcement
CREATE OR REPLACE FUNCTION public.get_nearby_shouts(
  p_lat double precision, 
  p_lng double precision, 
  p_radius_meters integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  content text,
  lat double precision,
  lng double precision,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.content,
    s.lat,
    s.lng,
    s.created_at
  FROM public.shouts s
  WHERE 
    -- Only shouts within last 24 hours
    s.created_at > (now() - interval '24 hours')
    -- Strict radius enforcement via PostGIS
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(s.lng, s.lat), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  ORDER BY s.created_at DESC;
END;
$$;