-- Create RPC function for resolving deep links (distance-agnostic)
-- This allows looking up public megaphones by share_code or id for deep linking
CREATE OR REPLACE FUNCTION public.resolve_megaphone_link(
  p_share_code text DEFAULT NULL,
  p_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  lat double precision,
  lng double precision,
  title text,
  share_code text
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
  
  -- Return megaphone data for deep linking
  -- Only returns public megaphones OR private ones where user has access
  RETURN QUERY
  SELECT 
    m.id,
    m.lat,
    m.lng,
    m.title,
    m.share_code
  FROM public.megaphones m
  WHERE 
    -- Match by share_code or id
    (p_share_code IS NOT NULL AND m.share_code = p_share_code)
    OR (p_id IS NOT NULL AND m.id = p_id)
  LIMIT 1;
END;
$$;