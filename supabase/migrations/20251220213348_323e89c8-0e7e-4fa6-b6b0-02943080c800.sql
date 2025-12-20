
-- Create a secure function to handle invitation acceptance
-- This bypasses RLS safely by running with definer privileges
CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_invitation_id uuid,
  p_title text,
  p_category text,
  p_lat double precision,
  p_lng double precision
)
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
