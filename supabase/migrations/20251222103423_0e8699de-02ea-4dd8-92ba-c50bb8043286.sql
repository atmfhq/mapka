-- The view with SECURITY INVOKER won't work because RLS blocks reading other profiles.
-- Instead, we'll use a SECURITY DEFINER function approach for map queries.
-- Drop the view since we'll use the get_nearby_profiles function instead.

DROP VIEW IF EXISTS public.public_profiles;

-- Create a new function to get public profile data for any user (for popups, etc.)
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
    p.location_lat,
    p.location_lng,
    p.bio,
    p.is_active
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$function$;