-- Extend resolve_megaphone_link to return full megaphone details for deep linking.
-- This allows guests (anon) to open a shared link without direct SELECT on megaphones.

DROP FUNCTION IF EXISTS public.resolve_megaphone_link(text, uuid);

CREATE FUNCTION public.resolve_megaphone_link(
  p_share_code text DEFAULT NULL,
  p_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  category text,
  start_time timestamp with time zone,
  duration_minutes integer,
  max_participants integer,
  lat double precision,
  lng double precision,
  host_id uuid,
  is_private boolean,
  share_code text,
  is_official boolean,
  cover_image_url text,
  organizer_display_name text,
  external_link text,
  location_details text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Must provide at least one identifier
  IF p_share_code IS NULL AND p_id IS NULL THEN
    RETURN;
  END IF;

  -- Return megaphone data for deep linking.
  -- Guests can only access public megaphones; authenticated users can access ones they have access to.
  RETURN QUERY
  SELECT
    m.id,
    m.title,
    m.description,
    m.category,
    m.start_time,
    m.duration_minutes,
    m.max_participants,
    m.lat,
    m.lng,
    m.host_id,
    m.is_private,
    m.share_code,
    m.is_official,
    m.cover_image_url,
    m.organizer_display_name,
    m.external_link,
    m.location_details
  FROM public.megaphones m
  WHERE
    ((p_share_code IS NOT NULL AND m.share_code = p_share_code)
      OR (p_id IS NOT NULL AND m.id = p_id))
    AND (
      m.is_private = false
      OR (auth.uid() IS NOT NULL AND public.check_megaphone_access(m.id, auth.uid()))
    )
  LIMIT 1;
END;
$$;


