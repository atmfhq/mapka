-- Recreate public_profiles view for frontend queries
-- Using SECURITY INVOKER means RLS is applied, but we need to add a policy that allows authenticated users to read other profiles via the view

-- First, we need to update the RLS policy on profiles to allow reading via the secure functions
-- The view won't work with current RLS, so we use the RPC functions instead

-- Add a policy that allows authenticated users to read basic profile info
-- This policy only allows reading the whitelisted columns via a security definer function

-- Create a function that returns public profile data (for use in queries)
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
    p.location_lat,
    p.location_lng,
    p.bio,
    p.is_active
  FROM public.profiles p
  WHERE p.id = ANY(user_ids);
END;
$function$;