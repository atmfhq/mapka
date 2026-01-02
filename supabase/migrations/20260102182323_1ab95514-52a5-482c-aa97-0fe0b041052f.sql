-- Drop and recreate get_nearby_megaphones to include official event fields
DROP FUNCTION IF EXISTS public.get_nearby_megaphones(double precision, double precision, integer);

CREATE FUNCTION public.get_nearby_megaphones(p_lat double precision, p_lng double precision, p_radius_meters integer DEFAULT 5000)
 RETURNS TABLE(
   id uuid, 
   title text, 
   category text, 
   start_time timestamp with time zone, 
   duration_minutes integer, 
   max_participants integer, 
   lat double precision, 
   lng double precision, 
   host_id uuid, 
   is_private boolean, 
   created_at timestamp with time zone,
   is_official boolean,
   cover_image_url text,
   organizer_display_name text,
   external_link text,
   location_details text,
   description text,
   share_code text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Only rate limit authenticated users
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.check_rate_limit('get_nearby_megaphones', 20, 60);
  END IF;
  
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
    m.created_at,
    m.is_official,
    m.cover_image_url,
    m.organizer_display_name,
    m.external_link,
    m.location_details,
    m.description,
    m.share_code
  FROM public.megaphones m
  WHERE 
    m.is_private = false  -- Anon users can only see public megaphones
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(m.lng, m.lat), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
    AND (m.start_time + (m.duration_minutes || ' minutes')::interval) > NOW();
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_nearby_megaphones TO anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_megaphones TO authenticated;