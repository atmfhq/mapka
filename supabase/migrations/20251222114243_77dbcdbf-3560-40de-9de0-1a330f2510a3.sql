-- Fix: Remove STABLE from functions that now call check_rate_limit (which does writes)
-- STABLE promises no database modifications, but rate limiting INSERTS/UPDATES data

-- Recreate get_nearby_profiles without STABLE
CREATE OR REPLACE FUNCTION public.get_nearby_profiles(p_lat double precision, p_lng double precision, p_radius_meters integer DEFAULT 5000)
RETURNS TABLE(id uuid, nick text, avatar_url text, avatar_config jsonb, tags text[], location_lat double precision, location_lng double precision, bio text, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Rate limit: 20 calls per 60 seconds
  PERFORM public.check_rate_limit('get_nearby_profiles', 20, 60);
  
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
    p.is_active
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

-- Recreate get_nearby_megaphones without STABLE
CREATE OR REPLACE FUNCTION public.get_nearby_megaphones(p_lat double precision, p_lng double precision, p_radius_meters integer DEFAULT 5000)
RETURNS TABLE(id uuid, title text, category text, start_time timestamp with time zone, duration_minutes integer, max_participants integer, lat double precision, lng double precision, host_id uuid, is_private boolean, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Rate limit: 20 calls per 60 seconds
  PERFORM public.check_rate_limit('get_nearby_megaphones', 20, 60);
  
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
$function$;

-- Recreate get_unread_message_count without STABLE
CREATE OR REPLACE FUNCTION public.get_unread_message_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  unread_count integer := 0;
BEGIN
  -- Rate limit: 30 calls per 60 seconds
  PERFORM public.check_rate_limit('get_unread_message_count', 30, 60);
  
  SELECT COALESCE(COUNT(ecm.id), 0)
    INTO unread_count
  FROM public.event_chat_messages ecm
  JOIN public.megaphones m
    ON m.id = ecm.event_id
  LEFT JOIN public.event_participants ep
    ON ep.event_id = m.id
   AND ep.user_id = p_user_id
   AND ep.status = 'joined'
  WHERE ecm.user_id <> p_user_id
    AND (m.host_id = p_user_id OR ep.user_id IS NOT NULL)
    AND ecm.created_at > COALESCE(ep.last_read_at, m.created_at, '1970-01-01'::timestamptz);

  RETURN unread_count;
END;
$function$;

-- Grant execute permissions explicitly
GRANT EXECUTE ON FUNCTION public.get_nearby_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearby_megaphones TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_message_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation TO authenticated;