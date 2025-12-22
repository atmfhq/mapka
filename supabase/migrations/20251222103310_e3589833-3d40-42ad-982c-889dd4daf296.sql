-- Step 1: Drop unused columns from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS base_lat;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS base_lng;

-- Step 2: Lock down profiles table - users can only SELECT their own row
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Users can view only their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Step 3: Create public_profiles view with whitelisted columns
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  nick,
  avatar_config,
  avatar_url,
  location_lat,
  location_lng,
  bio,
  tags,
  is_active
FROM public.profiles;

-- Step 4: Grant SELECT on the view to authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Step 5: Drop and recreate get_nearby_profiles function (return type changed)
DROP FUNCTION IF EXISTS public.get_nearby_profiles(double precision, double precision, integer);

CREATE OR REPLACE FUNCTION public.get_nearby_profiles(p_lat double precision, p_lng double precision, p_radius_meters integer DEFAULT 5000)
 RETURNS TABLE(id uuid, nick text, avatar_url text, avatar_config jsonb, tags text[], location_lat double precision, location_lng double precision, bio text, is_active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
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