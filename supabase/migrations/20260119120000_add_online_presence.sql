-- Add online presence tracking columns to profiles
-- is_online: tracks if user is currently connected (auto-managed)
-- last_seen: timestamp of last heartbeat (for cleanup stale sessions)

-- Add columns for online presence tracking
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON public.profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen);

-- Drop existing functions first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_nearby_profiles(double precision, double precision, integer);
DROP FUNCTION IF EXISTS public.get_public_profile(uuid);
DROP FUNCTION IF EXISTS public.get_public_profiles_by_ids(uuid[]);

-- Update get_nearby_profiles to filter by is_online in addition to is_active
-- is_active = ghost mode (user-controlled)
-- is_online = connection status (auto-managed)
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
    p.is_active = true
    AND p.is_online = true  -- Only show users that are currently online
    AND p.location_lat IS NOT NULL
    AND p.location_lng IS NOT NULL
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(p.location_lng, p.location_lat), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    );
END;
$function$;

-- Update get_public_profile to include is_online
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
 RETURNS TABLE(id uuid, nick text, avatar_url text, avatar_config jsonb, tags text[], location_lat double precision, location_lng double precision, bio text, is_active boolean, is_online boolean, last_seen timestamp with time zone)
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
    p.is_active,
    p.is_online,
    p.last_seen
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$function$;

-- Update get_public_profiles_by_ids to include is_online
CREATE OR REPLACE FUNCTION public.get_public_profiles_by_ids(user_ids uuid[])
 RETURNS TABLE(id uuid, nick text, avatar_url text, avatar_config jsonb, tags text[], location_lat double precision, location_lng double precision, bio text, is_active boolean, is_online boolean, last_seen timestamp with time zone)
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
    p.is_active,
    p.is_online,
    p.last_seen
  FROM public.profiles p
  WHERE p.id = ANY(user_ids);
END;
$function$;

-- Function to mark a user as online (called on login/heartbeat)
CREATE OR REPLACE FUNCTION public.mark_user_online(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET is_online = true, last_seen = now()
  WHERE id = p_user_id;
END;
$function$;

-- Function to mark a user as offline (called on logout/beacon)
CREATE OR REPLACE FUNCTION public.mark_user_offline(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles
  SET is_online = false, last_seen = now()
  WHERE id = p_user_id;
END;
$function$;

-- Cleanup function for stale sessions (users who haven't sent heartbeat in >2 minutes)
-- Should be called periodically via pg_cron or edge function
CREATE OR REPLACE FUNCTION public.cleanup_stale_online_users()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  affected_rows integer;
BEGIN
  UPDATE public.profiles
  SET is_online = false
  WHERE is_online = true
    AND last_seen < NOW() - INTERVAL '2 minutes';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN affected_rows;
END;
$function$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_user_online(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_user_offline(uuid) TO authenticated;

-- Note: Realtime for profiles is already enabled in the Supabase project.
-- No need to add it again to the supabase_realtime publication.
