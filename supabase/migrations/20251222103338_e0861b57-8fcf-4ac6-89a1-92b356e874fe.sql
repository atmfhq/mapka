-- Fix the security definer view warning by using SECURITY INVOKER
-- This ensures RLS policies of the querying user are applied

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
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

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;