-- Create UNLOGGED table for rate limit tracking (better performance, acceptable durability tradeoff)
CREATE UNLOGGED TABLE IF NOT EXISTS public.rpc_rate_limits (
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  call_count integer NOT NULL DEFAULT 1,
  CONSTRAINT rpc_rate_limits_pkey PRIMARY KEY (user_id, function_name)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rpc_rate_limits_lookup 
ON public.rpc_rate_limits(user_id, function_name, window_start);

-- Enable RLS on rate limits table
ALTER TABLE public.rpc_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow users to see/modify their own rate limit records (handled by functions)
CREATE POLICY "Users can view their own rate limits"
ON public.rpc_rate_limits
FOR SELECT
USING (auth.uid() = user_id);

-- The guard function that checks and updates rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  func_name text,
  max_calls integer,
  window_seconds integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_count integer;
  v_window_start timestamptz;
  v_now timestamptz := now();
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Try to get existing rate limit record
  SELECT call_count, window_start INTO v_current_count, v_window_start
  FROM public.rpc_rate_limits
  WHERE user_id = v_user_id AND function_name = func_name;
  
  IF FOUND THEN
    -- Check if we're still in the same window
    IF v_now < v_window_start + (window_seconds || ' seconds')::interval THEN
      -- Same window - check if limit exceeded
      IF v_current_count >= max_calls THEN
        RAISE EXCEPTION 'Rate limit exceeded for %. Please wait before trying again.', func_name;
      END IF;
      
      -- Increment counter
      UPDATE public.rpc_rate_limits
      SET call_count = call_count + 1
      WHERE user_id = v_user_id AND function_name = func_name;
    ELSE
      -- Window expired - reset counter
      UPDATE public.rpc_rate_limits
      SET call_count = 1, window_start = v_now
      WHERE user_id = v_user_id AND function_name = func_name;
    END IF;
  ELSE
    -- First call - insert new record
    INSERT INTO public.rpc_rate_limits (user_id, function_name, window_start, call_count)
    VALUES (v_user_id, func_name, v_now, 1);
  END IF;
END;
$$;

-- Update get_nearby_profiles with rate limiting (20 calls per 60 seconds)
CREATE OR REPLACE FUNCTION public.get_nearby_profiles(p_lat double precision, p_lng double precision, p_radius_meters integer DEFAULT 5000)
RETURNS TABLE(id uuid, nick text, avatar_url text, avatar_config jsonb, tags text[], location_lat double precision, location_lng double precision, bio text, is_active boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Rate limit: 20 calls per 60 seconds
  PERFORM public.check_rate_limit('get_nearby_profiles', 20, 60);
  
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
$$;

-- Update get_nearby_megaphones with rate limiting (20 calls per 60 seconds)
CREATE OR REPLACE FUNCTION public.get_nearby_megaphones(p_lat double precision, p_lng double precision, p_radius_meters integer DEFAULT 5000)
RETURNS TABLE(id uuid, title text, category text, start_time timestamp with time zone, duration_minutes integer, max_participants integer, lat double precision, lng double precision, host_id uuid, is_private boolean, created_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Rate limit: 20 calls per 60 seconds
  PERFORM public.check_rate_limit('get_nearby_megaphones', 20, 60);
  
  RETURN QUERY
  SELECT 
    m.id,
    m.title,
    m.category,
    m.start_time,
    m.duration_minutes,
    m.max_participants,
    m.lat,
    m.lng,
    m.host_id,
    m.is_private,
    m.created_at
  FROM public.megaphones m
  WHERE 
    extensions.ST_DWithin(
      extensions.ST_SetSRID(extensions.ST_MakePoint(m.lng, m.lat), 4326)::geography,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
    AND (m.start_time + (m.duration_minutes || ' minutes')::interval) > NOW();
END;
$$;

-- Update accept_invitation with rate limiting (10 calls per 60 seconds)
CREATE OR REPLACE FUNCTION public.accept_invitation(p_invitation_id uuid, p_title text, p_category text, p_lat double precision, p_lng double precision)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation record;
  v_megaphone_id uuid;
  v_current_user uuid;
BEGIN
  -- Rate limit: 10 calls per 60 seconds
  PERFORM public.check_rate_limit('accept_invitation', 10, 60);
  
  v_current_user := auth.uid();
  
  -- Verify the invitation exists and belongs to current user as receiver
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE id = p_invitation_id
    AND receiver_id = v_current_user
    AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or already processed invitation';
  END IF;
  
  -- Update invitation status
  UPDATE public.invitations
  SET status = 'accepted'
  WHERE id = p_invitation_id;
  
  -- Create the private megaphone with receiver as host
  INSERT INTO public.megaphones (
    title, category, start_time, duration_minutes,
    max_participants, lat, lng, host_id, is_private
  )
  VALUES (
    p_title, p_category, now(), 60,
    2, p_lat, p_lng, v_current_user, true
  )
  RETURNING id INTO v_megaphone_id;
  
  -- Add the original sender as participant
  INSERT INTO public.event_participants (event_id, user_id, status)
  VALUES (v_megaphone_id, v_invitation.sender_id, 'joined');
  
  RETURN v_megaphone_id;
END;
$$;

-- Update get_unread_message_count with rate limiting (30 calls per 60 seconds)
CREATE OR REPLACE FUNCTION public.get_unread_message_count(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unread_count integer := 0;
BEGIN
  -- Rate limit: 30 calls per 60 seconds
  PERFORM public.check_rate_limit('get_unread_message_count', 30, 60);
  
  SELECT COALESCE(COUNT(ecm.id), 0)
    INTO unread_count
  FROM public.event_chat_messages ecm
  JOIN public.megaphones m
    ON m.id = ecm.event_id
  LEFT JOIN public.event_participants ep
    ON ep.event_id = m.id
   AND ep.user_id = p_user_id
   AND ep.status = 'joined'
  WHERE ecm.user_id <> p_user_id
    AND (m.host_id = p_user_id OR ep.user_id IS NOT NULL)
    AND ecm.created_at > COALESCE(ep.last_read_at, m.created_at, '1970-01-01'::timestamptz);

  RETURN unread_count;
END;
$$;

-- Cleanup function to periodically remove old rate limit entries (optional maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rpc_rate_limits
  WHERE window_start < now() - interval '10 minutes';
END;
$$;