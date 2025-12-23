-- SECURITY FIX: prevent raw profile coordinates from being readable via direct table SELECT
-- Strategy:
-- 1) Lock down profiles SELECT to self-only (row-level; Postgres has no column-level RLS)
-- 2) Serve nearby/public profile data via SECURITY DEFINER RPCs that return fuzzed coordinates for others
-- 3) Require authentication in the RPCs to avoid anon scraping

-- 1) Restrict profiles SELECT to self-only
DROP POLICY IF EXISTS "Users can view nearby active profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2) Harden RPCs: require auth + ensure only fuzzed coords for other users leave the DB

CREATE OR REPLACE FUNCTION public.get_nearby_profiles(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
  nick text,
  avatar_url text,
  avatar_config jsonb,
  tags text[],
  location_lat double precision,
  location_lng double precision,
  bio text,
  is_active boolean,
  last_bounce_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Rate limit authenticated users
  PERFORM public.check_rate_limit('get_nearby_profiles', 20, 60);

  RETURN QUERY
  SELECT
    p.id,
    p.nick,
    p.avatar_url,
    p.avatar_config,
    p.tags,
    -- Exact for self, rounded (3dp ≈ 110m) for others
    CASE WHEN p.id = auth.uid() THEN p.location_lat ELSE ROUND(p.location_lat::numeric, 3)::double precision END AS location_lat,
    CASE WHEN p.id = auth.uid() THEN p.location_lng ELSE ROUND(p.location_lng::numeric, 3)::double precision END AS location_lng,
    p.bio,
    p.is_active,
    p.last_bounce_at
  FROM public.profiles p
  WHERE
    p.is_active = true
    AND COALESCE(p.is_onboarded, false) = true
    AND p.location_lat IS NOT NULL
    AND p.location_lng IS NOT NULL
    AND extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(p.location_lng, p.location_lat), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  nick text,
  avatar_url text,
  avatar_config jsonb,
  tags text[],
  location_lat double precision,
  location_lng double precision,
  bio text,
  is_active boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.nick,
    p.avatar_url,
    p.avatar_config,
    p.tags,
    CASE WHEN p.id = auth.uid() THEN p.location_lat ELSE ROUND(p.location_lat::numeric, 3)::double precision END AS location_lat,
    CASE WHEN p.id = auth.uid() THEN p.location_lng ELSE ROUND(p.location_lng::numeric, 3)::double precision END AS location_lng,
    p.bio,
    p.is_active
  FROM public.profiles p
  WHERE p.id = p_user_id
    AND COALESCE(p.is_onboarded, false) = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_profiles_by_ids(user_ids uuid[])
RETURNS TABLE(
  id uuid,
  nick text,
  avatar_url text,
  avatar_config jsonb,
  tags text[],
  location_lat double precision,
  location_lng double precision,
  bio text,
  is_active boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.nick,
    p.avatar_url,
    p.avatar_config,
    p.tags,
    CASE WHEN p.id = auth.uid() THEN p.location_lat ELSE ROUND(p.location_lat::numeric, 3)::double precision END AS location_lat,
    CASE WHEN p.id = auth.uid() THEN p.location_lng ELSE ROUND(p.location_lng::numeric, 3)::double precision END AS location_lng,
    p.bio,
    p.is_active
  FROM public.profiles p
  WHERE p.id = ANY(user_ids)
    AND COALESCE(p.is_onboarded, false) = true;
END;
$function$;

COMMENT ON POLICY "Users can view their own profile" ON public.profiles IS
'Profiles are not directly queryable for other users (prevents raw coordinate leakage); public discovery data must be fetched via RPCs that fuzz coordinates server-side.';