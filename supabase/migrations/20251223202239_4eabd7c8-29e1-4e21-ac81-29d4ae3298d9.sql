-- Function to get the current user's location for RLS comparisons
-- This allows us to compare distances without recursive RLS issues
CREATE OR REPLACE FUNCTION public.get_current_user_location()
RETURNS TABLE(lat double precision, lng double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT location_lat, location_lng
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

-- Function to check if a profile is within viewing radius of the current user
-- Radius is set to 50km (50000 meters) to allow local discovery while preventing global scraping
CREATE OR REPLACE FUNCTION public.is_profile_within_radius(
  target_lat double precision,
  target_lng double precision,
  radius_meters integer DEFAULT 50000
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT CASE
    -- If target has no location, don't show
    WHEN target_lat IS NULL OR target_lng IS NULL THEN false
    -- Check if current user has a location set
    WHEN EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND location_lat IS NOT NULL 
      AND location_lng IS NOT NULL
    ) THEN
      -- User has location: check if target is within radius
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND extensions.ST_DWithin(
          extensions.ST_SetSRID(extensions.ST_MakePoint(target_lng, target_lat), 4326)::geography,
          extensions.ST_SetSRID(extensions.ST_MakePoint(p.location_lng, p.location_lat), 4326)::geography,
          radius_meters
        )
      )
    ELSE
      -- User has no location set: deny access to other profiles' locations
      false
  END
$$;

-- Drop the old overly-permissive policy
DROP POLICY IF EXISTS "Authenticated users can view active location profiles" ON public.profiles;

-- Create new spatial-limited policy for viewing other users' profiles
-- Users can only see profiles within 50km of their own location
CREATE POLICY "Users can view nearby active profiles"
ON public.profiles
FOR SELECT
USING (
  -- Always allow users to view their own profile
  auth.uid() = id
  OR
  -- For other profiles: must be active, onboarded, have location, and be within radius
  (
    auth.uid() IS NOT NULL
    AND is_active = true
    AND location_lat IS NOT NULL
    AND location_lng IS NOT NULL
    AND COALESCE(is_onboarded, false) = true
    AND public.is_profile_within_radius(location_lat, location_lng, 50000)
  )
);