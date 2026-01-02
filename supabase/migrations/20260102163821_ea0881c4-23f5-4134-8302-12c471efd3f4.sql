-- Create a function to get profile display info that works for anonymous users
CREATE OR REPLACE FUNCTION public.get_profile_display(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  nick text,
  avatar_url text,
  avatar_config jsonb,
  tags text[],
  bio text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.nick,
    p.avatar_url,
    p.avatar_config,
    p.tags,
    p.bio
  FROM public.profiles p
  WHERE p.id = p_user_id
    AND COALESCE(p.is_onboarded, false) = true;
END;
$$;

-- Create a function to get multiple profile display info that works for anonymous users
CREATE OR REPLACE FUNCTION public.get_profiles_display(user_ids uuid[])
RETURNS TABLE(
  id uuid,
  nick text,
  avatar_url text,
  avatar_config jsonb,
  tags text[],
  bio text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.nick,
    p.avatar_url,
    p.avatar_config,
    p.tags,
    p.bio
  FROM public.profiles p
  WHERE p.id = ANY(user_ids)
    AND COALESCE(p.is_onboarded, false) = true;
END;
$$;